---
trigger: always_on
---

### Chart.js Tree-Shaking
- Import Chart.js components individually to reduce bundle size (~80KB instead of ~180KB):
  ```typescript
  import { Chart, LineController, LineElement, PointElement, LinearScale,
           TimeScale, CategoryScale, Legend, ScatterController,
           BarController, BarElement } from 'chart.js';
  Chart.register(LineController, LineElement, PointElement, LinearScale,
                 TimeScale, CategoryScale, Legend, ScatterController,
                 BarController, BarElement);
  ```
  Only register the chart types and components actually used. Do NOT use `import Chart from 'chart.js/auto'` — this imports everything and defeats tree-shaking. **IMPORTANT: `Tooltip` is intentionally NOT registered.** All Chart.js components use `plugins: { tooltip: { enabled: false } }` and implement hover tooltips via React (see "Chart.js tooltip rendering" above). Importing/registering `Tooltip` would bundle Chart.js's internal `innerHTML` usage, which triggers the Obsidian review bot's automatic security flag.
   **CRITICAL Chart.js innerHTML audit:** The Obsidian review bot scans the bundled `main.js`, not source code. Chart.js's Legend plugin uses DOM manipulation internally that may contain `innerHTML` strings in the bundle. Mitigation strategy:
   1. After Chart.js integration, run `Select-String -Pattern 'innerHTML' main.js` on the production build to count hits from Chart.js internals.
   2. If Legend plugin contributes `innerHTML` strings: disable the default Legend plugin (`plugins: { legend: { display: false } }`) and implement a React-rendered legend (same pattern as tooltips).
   3. If disabling Legend doesn't eliminate all Chart.js `innerHTML` hits: document in a `REVIEW_NOTES.md` that remaining strings are inside Chart.js library internals, never called by plugin code. Prepare a reviewer explanation for the submission PR.
   4. Add to Phase 5b verification: "Confirm `innerHTML` grep results in `main.js` are exclusively from Chart.js library code."

### Chart.js Accessibility
- All Chart.js canvas containers must have an `aria-label` describing the chart content (e.g., `aria-label="Line chart showing mood over the last 30 days"`).
- React SVG components (Heatmap, HabitStreaksGrid, Sparkline) must have `role="img"` on the `<svg>` element with a descriptive `aria-label`. Individual SVG rects in the Heatmap should have `aria-label` attributes with date and value.

### Promise Handling
- All promises in event handlers must be handled with `void`, `await`, or `.catch()`. Event handlers that call `saveSettings()` or other async methods should use `void this.plugin.saveSettings()` or wrap in `.catch(console.error)`.

### Settings Organization
- The settings tab uses **Essential** (always visible) vs **Advanced** (collapsed by default) sections. Essential: Journal folder, sidebar toggle, weekly review folder. Advanced: everything else.
- Use `Setting.setHeading()` for section headers (not HTML elements).
- **Settings file split trigger:** When `settings.ts` exceeds 250 lines, split it into modular tab section files (e.g., `settings/JournalSettings.ts`, `settings/AppearanceSettings.ts`, `settings/AdvancedSettings.ts`). The main `HindsightSettingTab.display()` composes them. Likely trigger point: Phase 6c or Phase 10, when goals, widgets, themes, annotations, and export settings are all added.

### main.ts Hygiene
- `main.ts` is lifecycle + service init only. All `addCommand()` calls live in `src/commands.ts` via a `registerCommands(plugin)` function. **Acceptance criterion: zero `addCommand(` calls in `main.ts`.** All phase examples showing command registration must use `registerCommands()` additions, not direct `this.addCommand()` in `main.ts`.
- Remove the temporary uPlot and Chart.js eval views before starting Phase 5a. Remove the `debug-index` command. Uninstall `uplot` from `package.json`.
  **Phase 5a Gate 0 (MANDATORY BEFORE ALL OTHER WORK):** Wrap all async file watcher callbacks (``setTimeout(async () => ...)``, async vault event handlers) in ``try/catch`` with ``debugLog`` error reporting. Current watcher code (``JournalIndexService`` lines ~312, ~332, ~364) can silently swallow promise rejections under rapid file churn. This is a formal gate â€” verify by adding a test that simulates parse failures and asserts logged/handled behavior. Zero-result confirmation required before proceeding to items 2+.
- All debug logging must be gated behind a `settings.debugMode` toggle (default `false`, in Advanced settings section). Use a shared helper:
  ```typescript
  // src/utils/debugLog.ts
  export function debugLog(plugin: HindsightPlugin, ...args: unknown[]): void {
      if (plugin.settings.debugMode) console.debug('[Hindsight]', ...args);
   **IMPORTANT:** `debugLog.ts` itself calls `console.debug` internally. It must use `// eslint-disable-next-line no-console` on that line. Without this, enabling the ESLint `no-console` rule will cause a build failure in this file.
  }
  ```
- **Console sweep (Phase 5a mandatory):** Replace ALL `console.debug()` and `console.info()` calls in `src/` with `debugLog()`. Verify with `grep -rn 'console\.debug\|console\.info\|console\.log' src/` returning zero results. Only `console.warn` and `console.error` are allowed (as per Obsidian plugin guidelines).
 - **Async watcher error boundaries (see Gate 0 above):** ALL async watcher callbacks in ``JournalIndexService`` must be wrapped in ``try/catch`` with ``debugLog`` error reporting. Specifically: ``setTimeout(async () => { try { ... } catch (e) { debugLog(plugin, 'File watcher error:', e); } })`` pattern. Add a targeted test that simulates parse failures and asserts logged/handled behavior.
- **Inline styles remediation (Phase 5a):** Replace existing inline `style={...}` usage in JSX with CSS variables + classes where possible. Acceptable exceptions (document in Phase 5a): VirtualList spacer elements (computed heights for DOM virtualization) and CSS custom properties via `style.setProperty('--hindsight-*', ...)` (setting CSS custom properties is not inline styling per the Obsidian guideline interpretation). Run `grep -rn 'style={' src/` after remediation — all remaining uses must be in the documented exceptions list.

### Field Detection Performance
- `detectFields()` is expensive (iterates all entries × all fields). It must NOT be called on every file watcher event. Instead, debounce field re-detection separately at **5 seconds** after the last entry change. Full re-detection runs only on `initialize()` and `reconfigure()`. File watcher events trigger the debounced re-detection, not immediate calls.
- **Schema-dirty flag:** When a file watcher event fires, compare the changed entry's frontmatter *keys* against the current `detectedFields` keys. If the keys are identical (same fields, just different values — the common case), do NOT set `schemaDirty`. Only set `journalStore.schemaDirty = true` when a key is added or removed from frontmatter. This prevents UI flicker ("Updating..." indicator) for simple value-only edits like changing mood from 7 to 8. The 5-second debounced `detectFields()` still runs unconditionally (to catch coverage/range changes from value edits), but the visual disruption is eliminated for the 95% case. After the debounced `detectFields()` completes, set `schemaDirty = false`. Field-dependent UI controls (metric selectors, polarity dropdowns, field filter dropdowns) show a subtle "Updating..." indicator while `schemaDirty` is `true`.