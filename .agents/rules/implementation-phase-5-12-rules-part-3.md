---
trigger: always_on
---

Store Lifecycle
- All Zustand stores must be reset in `plugin.onunload()` to prevent stale data when the plugin is disabled and re-enabled.
- **Cleanup order matters.** Cross-store subscriptions (e.g., `journalStore` → `metricsCacheStore.markStale()`) must be unsubscribed BEFORE stores are reset. Otherwise, resetting `journalStore` triggers the subscription, which calls `markStale()` on a store that may already be reset or mid-teardown.
- **Two cleanup arrays (not one):** Use two separate arrays on the plugin class to enforce ordering:
  ```typescript
  private storeSubscriptions: (() => void)[] = [];  // unsubscribed first
  private cleanupRegistry: (() => void)[] = [];     // cleaned up second
  ```
  `storeSubscriptions` holds cross-store subscription unsubscribe functions. `cleanupRegistry` holds all other cleanup (timers, ResizeObservers, IntersectionObservers, event listeners). Keeping them separate makes the ordering requirement explicit — a flat array loses the ability to reason about cleanup order.
- **Store subscription DAG (cross-store wiring):** The `storeWiring.ts` file must include a documented subscription dependency graph at the top:
  ```typescript
  // Subscription dependency graph (must be wired in this order):
  // 1. journalStore.revision → metricsCacheStore.markStale() [debounced 2s]
 **Bulk-mode revision deferral (amendment):** During runPass1 and bulk upsertEntries calls, journalStore.revision must increment ONCE at the end (batch mode), not per-entry. This prevents metricsCacheStore.markStale from firing mid-index via the DAG subscription. The 2-second debounce mitigates this in most cases, but bulk imports can take longer than 2 seconds on mobile.
  // 2. settingsStore.productivitySections → journalIndex.reindexTasks() [debounced 5s]
  // 3. settingsStore.annotationStorage → annotationService.migrate() [user-initiated only]
   // 4. settingsStore.hotTierDays â†’ journalIndex.reEvaluateTiers() [debounced 5s]
   // 5. settingsStore.fieldPolarity â†’ metricsCacheStore.invalidateCache([]) [immediate, full]
   // 6. settingsStore.calendarColorTheme â†’ chart.update() on all mounted Chart.js instances
  //
  // INVARIANT: No subscription may synchronously write to the store it reads from.
  // All cross-store updates must be async (setTimeout, debounce) to prevent re-entrant loops.
  ```
  Each phase that adds cross-store subscriptions must update this DAG. All trigger points include `debugLog()` trace lines (behind `debugMode`): e.g., `debugLog(plugin, 'Store event: journalStore.revision changed →', revision);`.
   **Subscription #4:** When `hotTierDays` changes, re-run Pass 2 section storage decisions for all entries (hotâ†’cold or coldâ†’hot). Debounce at 5 seconds.
   **Subscription #5:** When `fieldPolarity` changes, immediately invalidate all cached trend alerts, correlation results, and polarity-dependent badge colors. This is a full invalidation because polarity affects alert severity interpretation.
   **Subscription #6:** `calendarColorTheme` uses JS-computed colors (not CSS variables), so the existing `css-change` event handler does NOT cover theme switches. An explicit subscription must call `chart.update()` on all mounted Chart.js instances when the theme changes.
- **Store subscription re-entrancy guard (debug mode only):** Add a runtime guard in `wireStoreSubscriptions()` to catch accidental infinite loops during development:
  ```typescript
  const writeGuard = new Set<string>();
  function guardedWrite(storeName: string, fn: () => void) {
      if (writeGuard.has(storeName)) {
          console.error(`[Hindsight] Re-entrant write to ${storeName} detected!`);
          return;
      }
      writeGuard.add(storeName);
      try { fn(); } finally { writeGuard.delete(storeName); }
  }
  ```
  Only active when `debugMode` is enabled. Catches violations during development without runtime cost in production.
- `onunload()` must follow this sequence:
  ```typescript
  onunload(): void {
      // 0. Signal teardown to React components and async hooks
      useAppStore.getState().setIsUnloading(true);

      // 1. Flush debounced settings save (prevents data loss if user changed settings just before closing)
      this.saveSettingsDebounced.flush?.();

      // 2. Unsubscribe all cross-store subscriptions FIRST
      //    (prevents subscriptions from firing during service teardown)
      this.storeSubscriptions.forEach(unsub => unsub());

      // 3. Destroy services (stops file watchers, cleans resources)
      this.journalIndex?.destroy();
      this.thumbnailService?.destroy();
 **``onunload()`` cleanup (amendment):** ``ThumbnailService.destroy()`` must be explicitly called from the plugin's ``onunload()`` sequence: ``this.services.thumbnailService?.destroy();`` (or via ``this.cleanupRegistry.push(() => this.services.thumbnailService?.destroy());`` during initialization). Without this, the IndexedDB connection leaks on plugin disable/reload.

      // 4. Run general cleanup (timers, observers, listeners)
      this.cleanupRegistry.forEach(fn => fn());

      // 5. Reset all stores — appStore LAST (components may reference it during cleanup effects)
      useJournalStore.getState().clear();
      useSettingsStore.getState().reset();
      useMetricsCacheStore?.getState().reset();
      useChartUiStore?.getState().reset();
      useLensStore?.getState().reset();
      useUiStore?.getState().reset();
      useTimeMachineStore?.getState().reset();
      useAppStore.getState().reset();  // LAST — components may still access app during teardown
  }
  ```
  **Key ordering change:** Cross-store subscriptions are unsubscribed (step 2) BEFORE services are destroyed (step 3). This prevents a debounce timer (cleared during service destroy) from firing mid-teardown and calling into a store subscription that triggers work on a partially-destroyed service.
  **`appStore` reset last:** `appStore` is reset last because React cleanup effects (from `useEffect` return functions) may still access `app` during unmount. Resetting `appStore` before other stores would cause null-access crashes in any cleanup effect that calls `useAppStore(s => s.app)`.
  **React unmount timing:** React roots are unmounted by Obsidian AFTER `onunload()` completes (via `onClose()` on each view). All `useEffect` cleanup functions must be resilient to stores being in a reset state — use optional chaining and null checks. The `isUnloading` flag (set as step 0) allows hooks to abort early and prevents new async operations from starting during teardown.
- Each store that holds cached/computed data must expose a `reset()` action that returns it to its initial state. This includes `settingsStore` (reset to `DEFAULT_SETTINGS`).
- **NEVER call `this.app.workspace.detachLeavesOfType()` in `onunload()`.** Obsidian handles leaf lifecycle on plugin update/disable. Detaching leaves in `onunload()` prevents Obsidian from restoring view state on plugin re-enable. React roots are unmounted in each view's `onClose()` method (called by Obsidian, not by the plugin).

### App/Plugin Access (Zustand, not React Context)
- Do NOT prop-drill `app: App` or `plugin: HindsightPlugin` through the React component tree. Since there are 5+ separate React roots (Main View, Sidebar, QuickEditModal, EntryWizardModal, SectionReaderModal, WeeklyReviewModal), React Context would require wrapping every root in double providers. Instead, use a Zustand store initialized once in `onload()`:
  ```typescript
  // src/store/appStore.ts
  import { create } from 'zustand';
  import type { App } from 'obsidian';
  import type { HindsightPluginInterface } from '../types/plugin';

  interface AppState {
      app: App | null;
      plugin: HindsightPluginInterface | null;
      isUnloading: boolean;
      setApp: (app: App, plugin: HindsightPluginInterface) => void;
      setIsUnloading: (v: boolean) => void;
      reset: () => void;
  }

  export const useAppStore = create<AppState>((set) => ({
      app: null,
      plugin: null,
      isUnloading: false,
      setApp: (app, plugin) => set({ app, plugin }),
      setIsUnloading: (isUnloading) => set({ isUnloading }),
      reset: () => set({ app: null, plugin: null, isUnloading: false }),
  }));
  ```
  Initialize once in `main.ts onload()`: `useAppStore.getState().setApp(this.app, this);`
  Reset in `onunload()`: `useAppStore.getState().reset();` (reset LAST — see Store Lifecycle)
  Any component in any React tree: `const app = useAppStore(s => s.app); if (!app) return null;`

- **Never use non-null assertion (`!`) on `app` or `plugin` from `appStore`.** Between `onunload()` starting and all React roots finishing their unmount, `app` may be `null`. Components must always use conditional access: `const app = useAppStore(s => s.app); if (!app) return null;`. Hooks should early-return when `app` is null.
- **`isUnloading` flag:** `isUnloading: boolean` on `appStore` (default `false`). Set to `true` as the **first** action in `onunload()`, before destroying services. Hooks that perform async work (e.g., saving data, generating thumbnails) should check `isUnloading` and abort early. This prevents async operations from starting during teardown.

- **Service registry pattern:** Do NOT flatten service singletons (e.g., `thumbnailService`, `annotationService`) directly onto `appStore`. This turns appStore into a sprawling service locator that grows with each phase. Instead, define a `ServiceRegistry` interface in `src/types/plugin.ts`:
  ```typescript
  interface ServiceRegistry {
      journalIndex: JournalIndexService;
      thumbnailService: ThumbnailService | null;
      annotationService: AnnotationService | null;
  }
  ```
  Expose via `HindsightPluginInterface`: `services: ServiceRegistry`. Components access services through `const plugin = useAppStore(s => s.plugin); plugin?.services.thumbnailService`. This keeps `appStore` lean (`app`, `plugin`, `isUnloading` only) and ties service lifecycle to the plugin instance (which already handles cleanup in `onunload()`).

- **Circular import prevention:** `appStore` must NOT import `HindsightPlugin` directly from `main.ts`. Instead, define a `HindsightPluginInterface` in `src/types/plugin.ts` that exposes only what services and components need (e.g., `settings`, `saveSettings()`, `services: ServiceRegistry`). `main.ts` implements this interface. This avoids `main.ts → appStore.ts → main.ts` circular dependencies and makes the plugin mockable in tests without importing `main.ts`.