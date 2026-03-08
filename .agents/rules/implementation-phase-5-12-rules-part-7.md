---
trigger: always_on
---

### Pre-Release Checklist
- Before submitting to the Obsidian community plugins registry, verify:
  - [ ] `README.md` is complete (not template), describes all features
  - [ ] `LICENSE` file is present
  - [ ] Network usage disclosed in README (or "None — fully offline" stated)
  - [ ] `manifest.json` description: action verb start, period end, no "Obsidian", no emoji, <250 chars
  - [ ] `versions.json` up to date with all released versions
  - [ ] GitHub Issues enabled
  - [ ] Bundle size verified (tree-shaking Chart.js)

### Leaf Lifecycle on Unload
- **Do NOT call `detachLeavesOfType()` in `onunload()`.** Obsidian handles view leaf lifecycle automatically during plugin update/disable. Manually detaching leaves causes views to disappear on hot-reload, which is a poor development experience and breaks the user's workspace layout on plugin updates.

### Chart.js Label Sanitization
- All Chart.js label and title content must be **plain strings**. Never pass HTML markup as label content. Chart.js internal code may use `innerHTML` for rendering labels/titles in some configurations. Force all chart axis labels, dataset labels, and title text through safe string values. If dynamic label formatting is needed, use Chart.js callback formatters that return plain strings, not HTML.

### `onunload()` Cleanup Ordering
- Plugin shutdown must follow this exact sequence to prevent null pointer crashes, orphaned React roots, or stale state during disable/re-enable cycles:
  ```
  1. Set appStore.isUnloading = true (prevents new React root creation in modals)
  2. Obsidian calls onClose() on all views (unmounts React roots)
  3. Unsubscribe all store subscriptions (storeSubscriptions.forEach(fn => fn()))
  4. Run all cleanup callbacks (cleanupRegistry.forEach(fn => fn()))
  5. Destroy services (journalIndex.destroy(), thumbnailService?.destroy())
  6. Reset all stores (appStore.reset() LAST — setting app/plugin to null)
  ```
- **Why order matters:** Zustand stores are module-level singletons — they persist across plugin disable/enable cycles within the same Obsidian session. If `appStore.reset()` runs before React roots unmount, components will read `null` from `appStore` and crash. If services are destroyed before subscriptions are unsubscribed, the subscription callbacks fire on stale service references.
- **Re-enable safety (A17):** When the plugin is re-enabled, `onload()` must call `appStore.reset()` and `appStore.setApp(this.app, this)` back-to-back, with no awaits between them. This eliminates the window where `app` is `null` while React cleanup effects from the previous enable cycle may still be running:
  ```typescript
  // In onload():
  const appState = useAppStore.getState();
  appState.reset();  // sets isUnloading=true, clears refs
  appState.setApp(this.app, this); // immediately sets new values + isUnloading=false
  ```
- **Named cleanup phases (A25):** Consider using named cleanup phase objects instead of flat arrays to make the ordering intent explicit in the type system:
  ```typescript
  interface CleanupPhases {
      storeSubscriptions: (() => void)[];
      serviceCleanup: (() => void)[];
      storeResets: (() => void)[];
  }
  ```
  Then `onunload()` iterates them in defined order. This is optional but recommended for maintainability.

### Canonical Modal Pattern
- All Obsidian Modals that mount React roots must follow this exact pattern:
  ```typescript
  export class ExampleModal extends Modal {
      private root: Root | null = null;

      onOpen(): void {
          // Guard: don't create React roots during shutdown
          if (useAppStore.getState().isUnloading) return;
          const { contentEl } = this;
          contentEl.empty();
          contentEl.addClass('hindsight-modal-container');
          this.root = createRoot(contentEl);
          this.root.render(
              <ErrorBoundary fallback={<ModalErrorFallback onClose={() => this.close()} />}>
                  <ExampleComponent />
              </ErrorBoundary>
          );
      }

      onClose(): void {
          if (this.root) {
              this.root.unmount();
              this.root = null;
          }
          this.contentEl.empty();
      }
  }
  ```
- **ErrorBoundary fallback must include a Close button** that calls `modal.close()`. This prevents a stuck blank modal that requires Ctrl+W to escape.

### Global Error Notification Strategy
- All services that run background operations must report errors through a tiered system:
  1. **FATAL** (service won't recover): `Notice` + `console.error` + error state in relevant store. Example: IndexedDB completely unavailable, journal folder deleted.
  2. **DEGRADED** (feature disabled but plugin works): `Notice` (once) + `console.warn` + feature flag in store. Example: Thumbnail generation failed, correlation computation timeout.
  3. **TRANSIENT** (auto-retry likely): `debugLog()` only, no user notification. Example: File watcher debounce collision, temporary file lock.
- Components must check error state in their relevant store and show inline error banners — not just empty states. Never swallow errors silently in `catch` blocks.

### Store Dependency Graph
- Inter-store subscriptions must be documented and maintained as the plugin grows:
  ```
  journalStore ──→ metricsCacheStore (revision counter invalidation)
               ──→ lensStore (search re-execution on entry changes)
  settingsStore ──→ metricsCacheStore (field polarity changes)
                ──→ chartUiStore (rolling window changes)
  timeMachineStore ──→ (read-only by components, no store dependencies)
  appStore ──→ (write-once on load, no dependencies)
  ```
- **RULES:** No circular dependencies. No store subscribes to a store that subscribes back to it. `storeWiring.ts` is the ONLY place cross-store subscriptions are created.
- **Zustand selector hygiene:** Components must use surgical selectors — `const moodData = useMetricsCacheStore(s => s.timeSeriesCache.get('mood'))` — never flat `useStore()`. Flat selectors cause re-renders on any store update, which destroys 60fps on mobile.

### Path Safety
- **All constructed file paths** (exports, weekly reviews, daily notes) must pass through `normalizePath()` before any vault operation. This includes: `NoteCreationService`, `ExportService`, and `AnnotationService` (frontmatter mode paths are already from `TFile`, so they're safe).
- **`validateVaultRelativePath()`** (created in Phase 5a, wired in Phase 10) must:
  1. Call `normalizePath()` first
  2. Reject paths containing `..` after normalization
  3. Reject absolute paths (starts with `/` or drive letter like `C:`)
  4. Reject paths containing null bytes (`\0`)
  5. Return the validated path or `null` on failure