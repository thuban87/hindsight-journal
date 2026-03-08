---
trigger: always_on
---

### Inline Style Policy
- **No `style={{}}` JSX attributes — no exceptions.** The Obsidian review bot does not distinguish between CSS custom property assignment (`style={{ '--hindsight-cell-bg': color }}`) and regular inline styles (`style={{ color: 'red' }}`). Both are flagged. All dynamic styling must use **imperative ref-based assignment**: `ref.current.style.setProperty('--hindsight-cell-bg', color)` paired with `.hindsight-calendar-cell { background-color: var(--hindsight-cell-bg); }`. The only acceptable uses of `element.style.*` are: (1) CSS custom property assignment via `style.setProperty('--hindsight-*', value)`, (2) VirtualList spacer `style.height` (documented exception — spacer divs require dynamic pixel height).
- **Verification grep:** `grep -rn 'style={{' src/` must return zero results. Existing violations (e.g., `CalendarCell.tsx:136`) must be migrated to the ref-based CSS variable pattern during Phase 5a cleanup.

### ESLint Integration
- ESLint must run alongside every build. Add a `lint` script to `package.json` (`"lint": "eslint src/ --ext .ts,.tsx"`) and update the `build` script to run lint first: `"build": "npm run lint && node esbuild.config.mjs production"`. Every phase verification checklist must include `npm run lint` passing as a prerequisite to `npm run build`.

### Settings Schema Migration
- Add a `migrateSettings(loaded: Record<string, unknown>): HindsightSettings` function (in `src/utils/settingsMigration.ts`) that runs once in `loadSettings()`. As phases add ~20 new settings keys over 12 phases, this function handles:
  1. Applies `Object.assign({}, DEFAULT_SETTINGS, loaded)` (existing pattern)
  2. Handles key renames (e.g., if a setting name changes between phases)
  3. Handles type migrations (e.g., `widgetOrder: string[]` → `{ id: string; visible: boolean }[]`)
 **Amendment:** Standardize on ``widgets: { id: string; visible: boolean }[]`` as the canonical settings key. ``widgetOrder`` is used only as a legacy migration input (if data.json contains ``widgetOrder`` from a pre-migration version, convert it to ``widgets`` format). All verification text and UI code should reference ``widgets``, not ``widgetOrder``.
  4. Strips unknown keys no longer in `HindsightSettings` (prevents data.json bloat)
  5. Logs migrations via `debugLog()` when `debugMode` is enabled
- **Settings version field:** Add `settingsVersion: number` (default `1`) to `HindsightSettings` and `DEFAULT_SETTINGS` in Phase 5a. `migrateSettings()` checks `settingsVersion` and runs migration functions sequentially: v0→v1, v1→v2, etc. Each phase that adds or renames settings increments the version and adds a migration function. This avoids introspection-based migration which fails for transformative changes (key renames, type changes). This is cheap to add now and expensive to retrofit later.
- Create this utility in Phase 5a cleanup. Initially it migrates v0 (no version field, pre-existing users) → v1 (adds version field + applies `DEFAULT_SETTINGS`). Each subsequent phase adds migration rules as new settings are introduced.

### Settings Save Debounce
- `saveSettings()` writes to disk. Individual settings interactions are already debounced at the UI level (widget reorder 500ms, slider 300ms, text inputs on blur). Add a global debounced wrapper on the plugin class for routine settings changes:
  ```typescript
  private saveSettingsDebounced = debounce(() => {
      void this.saveData(this.settings);
  }, 500);
  ```
  Use `saveSettingsDebounced()` for routine changes (user toggling options, reordering widgets). Use direct `await this.saveSettings()` for critical saves (annotation migration state, storage mode changes) where data loss on crash is unacceptable.

### Accessibility (Moderate — ARIA Roles, Focus Management, Live Regions)
- **Tab groups:** All tab groups (sidebar Today/Echoes, main Journal/Insights/Explore, sub-tabs) must use `role="tablist"` on the container, `role="tab"` with `aria-selected` on each tab button, and `role="tabpanel"` on the content panel. Keyboard: arrow keys to move between tabs, Enter/Space to select.
- **Modals:** Obsidian's `Modal` class handles focus trapping and Escape-to-close. For custom modal-like UI, focus must return to the trigger element on close.
- **Live regions:** Dynamic result counts (e.g., "42 entries match" in Lens, search result counts) should use `aria-live="polite"` on the count container. This announces count changes to screen readers without interrupting the user.
 **Extended aria-live coverage (amendment):** In addition to the Lens result count, add ``aria-live="polite"`` to: Tab count badges in ``TabGroup`` (Phase 5b), ``TrendAlertsPanel`` header count (Phase 5c), Gallery image count (Phase 9). Consider a shared ``<DynamicCount count={n} label="entries" />`` component wrapping counts in an ``aria-live`` region to centralize this pattern.
- **Form labels:** All form inputs in settings, wizard, and quick-edit modals must have associated `<label>` elements or `aria-label` attributes.
- Chart and SVG accessibility requirements remain as specified in the "Chart.js Accessibility" rule above.

### Guideline & Accessibility Gate (applies to EVERY phase verification)
- Every phase that introduces UI components or modifies existing ones must pass this gate before being marked complete. This is a hard requirement, not optional prose — treat it as implicit items appended to every phase's Verification section:
   1. `npm run lint` passes (no floating promises, no `console.log`, no `any` types)
   2. `grep -r "innerHTML\|outerHTML\|insertAdjacentHTML\|dangerouslySetInnerHTML" src/` returns zero results
   3. All Chart.js `<canvas>` containers have descriptive `aria-label` (e.g., `aria-label="Line chart showing mood over the last 30 days"`)
   4. All React SVG components have `role="img"` with descriptive `aria-label` on the `<svg>` element
   5. All interactive elements (buttons, toggles, links) have 44px minimum touch targets on mobile. Use a shared `.hindsight-touch-target { min-height: 44px; min-width: 44px; }` class in `shared.css` to enforce this consistently.
   6. Keyboard navigation works for all new interactive components
   7. Tab groups use `role="tablist"`/`role="tab"`/`role="tabpanel"` with `aria-selected`
   8. Dynamic result counts use `aria-live="polite"` regions
   9. Annotation text, alert text, and user-authored content rendered via React JSX auto-escaping only
  10. All React roots wrapped in `<ErrorBoundary>`, all roots unmounted in `onClose()`
  11. All cleanup functions: store subscriptions in `storeSubscriptions[]`, other cleanup in `cleanupRegistry[]`
   12. Settings UI labels use sentence case ("Field configuration", not "Field Configuration")
   13. All Chart.js tooltips use React-rendered `<div>` tooltips with the default tooltip plugin disabled (`plugins: { tooltip: { enabled: false } }`) — see Security / Guidelines. The Chart.js Tooltip plugin must NOT be registered in `chartSetup.ts`.
    14. `grep -rn "!important" src/styles/` returns zero results (or only justified, documented exceptions)
    15. No fixed `px` font sizes in `src/styles/` (use `em`, `rem`, or CSS variables)
    16. No selectors targeting Obsidian internal classes (`.workspace-*`, `.mod-*`, etc.) in `src/styles/`
    17. `grep -rn "className=" src/ | grep -v "hindsight-"` returns only Obsidian base classes (e.g., `modal`, `setting-item`)
    18. `grep -rn "style={{" src/` returns zero results (no inline JSX styles — use ref-based `style.setProperty()` pattern; see Inline Style Policy)
    19. All UI text uses **sentence case** ("Create new daily note", not "Create New Daily Note"). Only capitalize the first word and proper nouns. This applies to: command names, setting labels, button text, section headers, modal titles, notices, and empty state messages.
   20. Every new `.css` file in `src/styles/` has a corresponding `@import` in `src/styles/index.css` (PostCSS does not auto-discover CSS files)

### Multiple React Root Render Timing
- Multiple React roots (Main View, Sidebar, QuickEditModal, etc.) subscribe to the same Zustand stores independently. Zustand updates are synchronous to each subscriber, but renders across separate React roots are not synchronized — a brief (<1 frame) visual inconsistency between the sidebar and main view is possible but imperceptible. No code mitigation is needed.

### Empty State Handling
- **All components that consume `detectedFields` must handle the empty case.** If `detectedFields.length === 0`, render `<EmptyState icon='search' message='No journal entries indexed yet. Check your journal folder in settings.' />`. Do NOT render empty charts, empty heatmaps, or broken layouts. The `EmptyState` component (built in Phase 2) is the universal fallback. This applies to: CorrelationCards, HabitStreaksGrid, GoalTracker, ActionableEcho, ThreadsPanel, MetricChart, HeatmapGrid, LensPanel, and any other component that depends on indexed data.

### Async Promise Handling Gate
- Before starting feature work on any phase, run this grep to find un-handled async patterns:
  ```bash
  grep -rn "addEventListener.*async\|setTimeout(async\|on('create', async\|on('modify', async\|on('delete', async\|on('rename', async" src/
  ```
  All matches must be wrapped in `void`, `await`, or `.catch()`. This is enforced by the `no-floating-promises` ESLint rule, but the grep serves as a manual sanity check during development.

### Stale-Result Guard (Async Commit Pattern)
- Any async operation that commits results to a store (search results, correlation data, trend alerts) must guard the commit point with a generation token:
  ```typescript
  const token = ++this.currentToken;
  // ... async work ...
  if (token !== this.currentToken) return; // a newer operation superseded us
  store.setState({ results }); // safe to commit
  ```
  This must be applied at ALL async result paths: success, timeout partial, and error partial. Without it, a slow old search can overwrite a newer fast search's results.

### Work Coordinator (Background Job Scheduling)
- Heavy background jobs (correlations, trend alerts, full-text search, thumbnail generation, annotation migration) must not run concurrently without coordination. Add a lightweight `WorkCoordinator` utility with named lanes:
  ```typescript
  // src/utils/workCoordinator.ts
  const lanes = new Map<string, { signal: { cancelled: boolean } }>();
  export function startWork(lane: string): { signal: { cancelled: boolean }; done: () => void } {
      const existing = lanes.get(lane);
      if (existing) existing.signal.cancelled = true; // cancel previous
      const signal = { cancelled: false };
      lanes.set(lane, { signal });
      return { signal, done: () => lanes.delete(lane) };
  }
  export function cancelWork(lane: string): void {
      const existing = lanes.get(lane);
      if (existing) existing.signal.cancelled = true;
  }
  ```
  **Lane cleanup (A21):** `startWork()` returns a `done()` function that removes the lane entry from the Map. Callers must call `done()` in a `finally` block after the job completes. This prevents unbounded Map growth over long sessions.
  Named lanes: `insights` (correlations/trends), `search` (Lens full-text), `migration` (annotations). When a new job starts in a lane, it cancels the previous job's signal. This prevents aggregate CPU pressure spikes when users switch tabs quickly. **Thumbnail jobs must never use WorkCoordinator** — `ThumbnailService` has its own concurrency-limited generation queue with signal-based cancellation. WorkCoordinator lanes are for operations where "newest supersedes oldest" semantics apply; thumbnail generation is demand-driven (per visible item), not supersede-driven.