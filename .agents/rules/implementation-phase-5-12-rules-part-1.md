---
trigger: always_on
---

# Plan-Wide Rules (Phases 5+)

These rules apply to ALL phases below. They were established during the Phase 5-11 plan review and must be followed without exception.

### Path Safety
- **Every** constructed file path passed to any vault API (`vault.create()`, `vault.getFileByPath()`, `vault.readBinary()`, `vault.process()`) **must** be wrapped in `normalizePath()`. No exceptions. Different OSes use different separators.
- Wiki-link image paths (e.g., `image.png` from `![[image.png]]`) must be resolved via `app.metadataCache.getFirstLinkpathDest(imagePath, sourceFilePath)` before passing to vault APIs.
- **Path-type settings normalization (defense-in-depth):** All path-type settings (`journalFolder`, `weeklyReviewFolder`, `exportFolder`) must be normalized at **two** points: (1) when saved in the settings tab (so `data.json` always stores clean paths), and (2) at point of use (in case `data.json` is manually edited). Add a `normalizePathSetting(value: string): string` helper to `settingsMigration.ts` that strips leading/trailing slashes and normalizes separators. Always apply `normalizePath()` to the **full joined path** after combining folder + filename (e.g., `normalizePath(folder + '/' + filename)`).
/** In-app data.json size notice: show in plugin settings when data.json exceeds 1MB */
- **Path traversal validation:** `normalizePath()` normalizes separators but does NOT reject `../../`, absolute paths, or drive-prefixed input. Add a shared `validateVaultRelativePath(path: string): string | null` utility to `src/utils/vaultUtils.ts`:
  ```typescript
  export function validateVaultRelativePath(path: string): string | null {
      const normalized = normalizePath(path);
      if (normalized.startsWith('/') || normalized.startsWith('\\')) return null;
      if (/^[a-zA-Z]:/.test(normalized)) return null; // drive letter
      if (normalized.split('/').some(seg => seg === '..')) return null;
      if (normalized.includes('\0')) return null; // null byte injection
      return normalized;
  }
  ```
  **Required call sites:** `ExportButton` (export folder), `NoteCreationService` (journal folder, weekly review folder), and settings save handlers for `journalFolder`, `weeklyReviewFolder`, and `exportFolder`. If validation fails, show a Notice: "Invalid folder path — must be a relative path within the vault."

### Error Recovery
- All service methods that call Obsidian APIs must wrap calls in `try/catch`, show a `Notice` with a user-friendly error message, and log via `console.error`.
- Services must degrade gracefully — e.g., `ThumbnailService` returns `null` on failure, `NoteCreationService` shows a Notice and doesn't crash the wizard.
- Before `vault.create()`, always check `vault.getFileByPath(normalizePath(targetPath))` first. If the file exists, open it instead of creating a duplicate.
- Before `vault.create()`, always ensure parent folders exist using the shared `ensureFolderExists()` utility (see `src/utils/vaultUtils.ts`, created in Phase 10). `vault.create()` throws if parent directories don't exist. This is especially important for user-configured paths (`weeklyReviewFolder`, export paths) where the user may not have created the folder structure yet.
- **Annotation path validation:** `AnnotationService.onEntryRenamed(oldPath, newPath)` must validate that both `oldPath` and `newPath` are within the configured journal folder. If either path is outside the journal folder, log a warning via `debugLog()` and skip the rename operation. This prevents a rogue plugin event or corrupted rename from injecting arbitrary keys into annotation storage.

### Security / Guidelines
- **No `innerHTML`, `dangerouslySetInnerHTML`, `outerHTML`, or `insertAdjacentHTML` anywhere.** Use DOM API (`createEl()`), React JSX, or `MarkdownRenderer.renderMarkdown()`. This is an automatic blocker. The pre-phase grep gate checks for all four patterns.
- Search term highlighting must use string-split + React `<mark>` components via the shared `HighlightText.tsx` component. Never inject HTML.
- File exports (CSV, JSON) must write to the vault via `vault.create()`. Do NOT use `URL.createObjectURL()` + `<a download>` — this breaks on mobile WebViews.
- **CSV injection mitigation — canonical rule for `sanitizeCsvCell()`:** The following steps are executed in this exact order:
  1. **Coerce to string:** Numbers → `.toString()`, booleans → `.toString()`, `null`/`undefined` → `""`. **Arrays:** sanitize each element individually via recursive `sanitizeCsvCell()` call *before* joining with `"; "`. **Objects:** `JSON.stringify()`. This ensures individual dangerous elements within arrays (e.g., `["=CMD()", "-3.5"]`) are sanitized element-by-element rather than relying on the joined result.
  2. **Numeric bypass check:** If the coerced string is a valid number (`!isNaN(Number(str))` AND `str.trim() !== ""`), **skip sanitization entirely** — numbers cannot be formulas. This covers standalone negative numbers like `"-3.5"`.
  3. **Dangerous character sanitization:** If the first non-whitespace character is `=`, `+`, `-`, `@`, `|`, `\t`, `\r`, or `\n`, prefix with a single quote (`'`). **Additionally** (A2): check for tab (`\t`), carriage return (`\r`), and line feed (`\n`) as leading characters — these can cause column/row injection in CSV parsers.
 **Mid-cell sanitization (amendment):** After the dangerous-prefix check (step 3), add step 3.5: replace ``\t`` with spaces and ``\r`` with empty string in ALL cell values (not just when they are the first character). Tab characters mid-cell can cause column shifting in TSV-expecting parsers; carriage returns can cause row splitting. This defense-in-depth measure eliminates the attack surface completely without losing meaningful data (journal frontmatter values should not contain tabs).
  4. **Quote-escape:** Escape internal `"` with `""` and wrap the entire value in double quotes.

  **Key invariant:** Step 2 ensures that valid negative numbers (e.g., `-3.5`) are never sanitized. Step 1 ensures array elements are individually sanitized before joining, so `["-3.5", "=CMD()"]` becomes `"-3.5; '=CMD()"` — the number passes through, the formula is prefixed.

  **Implementation architecture:** The above steps are split into two functions in `csvSafety.ts`:
  - `sanitizeValue(value: string): string` — steps 1-3 only (coerce, numeric bypass, dangerous prefix). Used for individual array elements.
  - `sanitizeCsvCell(value: unknown): string` — calls `sanitizeValue()` on each element (for arrays), joins with `"; "`, then applies step 4 (quote-escape + wrap in double quotes) exactly once on the final string. This prevents double-quoting when array elements are individually sanitized.
- **Prototype pollution guard:** Add a generic `sanitizeLoadedData(obj: unknown): unknown` utility to `src/utils/settingsMigration.ts` that recursively strips `__proto__`, `constructor`, and `prototype` keys from any object at any nesting depth. **The recursive traversal must also iterate arrays and recurse into each object element** — `data.json` contains arrays of objects (e.g., `savedFilters`, `annotationPresets`, `widgets`) that must also be sanitized. Call it once in `migrateSettings()` on the raw loaded data before applying defaults. Also call it when loading plugin-mode annotations. This centralizes the guard instead of scattering it across individual validators. Use `Object.prototype.hasOwnProperty.call(obj, key)` (not `Object.hasOwn()`) for all property checks — `Object.hasOwn()` was introduced in ES2022 and is not available in older browser engines (iOS 15.3 and earlier; Obsidian mobile supports back to iOS 14+). Protected data paths include: `goalTargets`, `fieldPolarity`, `savedFilters`, `annotationPresets`, `widgets`, and plugin-mode annotation storage.
- **Chart.js tooltip rendering (CRITICAL for review bot):** Chart.js uses `innerHTML` internally in its default tooltip plugin. Since the Obsidian review bot scans the bundled `main.js` (not just source code), this will trigger an automatic flag. **All Chart.js components must disable the default tooltip plugin** (`plugins: { tooltip: { enabled: false } }`) and implement hover tooltips via a React-rendered `<div>` positioned by mouse coordinates and component state (same pattern as the Heatmap tooltip). Do NOT use Chart.js's `external` tooltip callback with DOM creation — use pure React state for tooltip visibility, position, and content. This completely avoids any Chart.js tooltip DOM manipulation.
- **Annotation text sanitization:** `addAnnotation()` performs: max-length check (500 chars, enforced at both UI and service level), newline replacement (`\n`, `\r` → spaces), and trimming. **Angle brackets are NOT stripped** — annotations like "mood was < 3 today" are legitimate content. All rendering paths auto-escape (React JSX, Chart.js React-rendered tooltips), so angle brackets in stored text are safe. Chart.js tooltip callbacks for annotation markers use the React tooltip pattern, which auto-escapes all text content.
- **Network guard-rail:** This plugin makes ZERO network requests. If any future feature requires external requests, `requestUrl` from `'obsidian'` must be used (not `fetch()` or `XMLHttpRequest`), and all network activity must be disclosed in README. Undisclosed network calls are an automatic plugin rejection.

### Chart.js Theme Reactivity
- All Chart.js components (MetricChart, ScatterPlot, TagFrequencyChart, QualityDashboard) must subscribe to `app.workspace.on('css-change')` and re-read CSS variables + call `chart.update()` on theme change. Canvas elements don't respond to CSS variable changes automatically.
- **Every** Chart.js `useEffect` must follow this exact cleanup pattern:
  ```typescript
  useEffect(() => {
      if (!canvasRef.current) return; // guard against unmounted canvas
      let chart: Chart | null = null;
      try {
          chart = new Chart(canvasRef.current, config);
      } catch (err) {
          console.error('[Hindsight] Chart initialization failed:', err);
          setChartError(true); // local useState — render error message instead of canvas
          return;
      }
      const onThemeChange = () => { /* re-read CSS vars, chart.update() */ };
      app.workspace.on('css-change', onThemeChange);
      return () => {
          app.workspace.off('css-change', onThemeChange);
          chart?.destroy();
      };
  }, [/* deps */]);
  ```
  The `off()` call and `chart.destroy()` are both critical. The canvas null guard prevents crashes in StrictMode or slow renders. The `try/catch` around `new Chart()` prevents unhandled exceptions from crashing the component — failures are caught and shown as a user-friendly error message via local state. **This pattern IS the Chart.js error boundary.** React `<ErrorBoundary>` does NOT catch errors thrown in `useEffect` callbacks or event handlers — the try/catch is the correct and only mechanism. Include `chart?.destroy()` in the catch block to clean up partial initialization.