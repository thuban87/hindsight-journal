---
trigger: always_on
---

Hub-and-Spoke for Period Aggregation
- `src/utils/periodUtils.ts` is the shared hub for all period-based aggregation (weekly averages, monthly counts, period slicing). `MetricsEngine`, `PulseService`, and `ChartDataService` all import from `periodUtils` rather than each implementing their own iteration logic.

### Modal Sizing
- Full-screen modals use a custom `hindsight-fullscreen-modal` CSS class (`width: 90vw; max-width: 900px; height: 85vh;`). Do NOT use Obsidian's internal `mod-community-modal` class — it's an internal class that could change.
- **CSS specificity:** Use the compound selector `.modal.hindsight-fullscreen-modal` (not just `.hindsight-fullscreen-modal`) to ensure specificity matches Obsidian's base `.modal` rules without needing `!important`. Verify on both desktop and mobile that the modal fills the viewport correctly.

### Metrics Computation Ownership
- Clear single-source responsibilities to prevent redundant recomputation:
  - **`metricsCacheStore`** owns all expensive computed artifacts (time series, rolling averages, correlations, trend alerts) and invalidation logic. It is the single source of truth for computed data.
  - **Services** (`ChartDataService`, `MetricsEngine`, `TrendAlertEngine`) are stateless pure calculators. They take data in, return results. They never cache internally.
  - **Hooks** (`useMetrics`, `useChartData`) are thin selectors that read from `metricsCacheStore`. They never recompute expensive data — they only select cached slices and trigger compute actions when the cache is stale.
  - **Components** never call service functions directly for expensive operations. They go through hooks, which go through the cache store.

### Mobile Detection
- **Hybrid approach:** Use `Platform.isMobile` for **behavior** changes (touch targets, overscan values, render budgets, concurrency limits). Use CSS container queries for **layout** changes (grid columns, stacking direction, sidebar width). `Platform.isMobile` is device-class (phone/tablet vs desktop), not layout-class — a desktop user with a narrow sidebar pane should still get a responsive layout via container queries. Do NOT use `matchMedia('(pointer: coarse)')` or viewport width checks for behavior detection.

### Regex Safety
- **No regex lookbehind** (`(?<=...)`). Safari WebView (Obsidian Mobile on iOS) has limited support. Use capture groups or other alternatives instead. This applies to all utility code, parsers, and search logic.

### Time-Based Yielding (replaces fixed-batch setTimeout)
- All background processing loops (indexing, correlation computation, full-text search, annotation migration) must use **time-based yielding**, not fixed batch sizes. Fixed counts (e.g., "50 files per batch") are hardware-dependent — 50 files takes 2ms on an M3 Mac but 40ms on a low-end Android, causing dropped frames.
- Use the shared `processWithYielding()` utility:
  ```typescript
  // src/utils/yieldUtils.ts
  export async function processWithYielding<T>(
      items: T[],
      processor: (item: T) => void | Promise<void>,
      options?: {
          budgetMs?: number;     // default 10
          sync?: boolean;        // hint: processor is synchronous, skip await in tight loop
          signal?: { cancelled: boolean };  // check at each yield point
          onError?: (item: T, error: unknown) => void;    // skip bad items, continue
          onProgress?: (processed: number, total: number) => void;  // progress reporting
      }
  ): Promise<void> {
      const { budgetMs = 10, sync = false, signal, onError, onProgress } = options ?? {};
      let i = 0;
      while (i < items.length) {
          if (signal?.cancelled) return;
          const startTime = performance.now();
          while (i < items.length && performance.now() - startTime < budgetMs) {
              try {
                  if (sync) {
                      const result = processor(items[i]);
                      // A4: Runtime guard — detect sync:true with async processor
                      if (result && typeof (result as any).then === 'function') {
                          debugLog('processWithYielding: sync=true but processor returned a Promise. Use sync=false or fix the processor.');
                      }
                  } else {
                      await processor(items[i]);
                  }
              } catch (err) {
                  if (onError) {
                      onError(items[i], err);
                  } else {
                      throw err; // backward compatible — propagate if no handler
                  }
              }
              i++;
          }
          onProgress?.(i, items.length);
          if (i < items.length) {
              await new Promise(resolve => setTimeout(resolve, 0));
          }
      }
      onProgress?.(items.length, items.length); // final 100% callback
  }
  ```
  This guarantees smooth 60fps UI regardless of hardware. The default 10ms budget leaves ~6ms per frame for rendering. **Dynamic yielding budget:** Use `Platform.isMobile ? 8 : 16` as the default budget to adapt to device capability (mobile gets shorter budgets for smoother scrolling, desktop gets longer budgets for faster throughput). Consider `requestIdleCallback` (with polyfill) for truly non-critical tasks like `detectFields` and `cleanupOrphanedAnnotations`. The `sync` option avoids microtask overhead for synchronous processors (e.g., Pearson correlation) — **note:** `sync: true` does NOT defeat yielding. The time budget still triggers yields via `setTimeout(0)` at budget boundaries. `sync` just avoids the overhead of `await` on each synchronous processor call. For pure-math work like Pearson, `sync: true` IS the correct choice. The `signal` option enables cancellation for long-running operations. The `onError` handler enables resilient processing where one bad item doesn't kill the entire batch. The `onProgress` callback provides UI progress reporting at natural yield points.
- **Tab-visibility awareness:** Long-running computations (full-text search in Lens) should check `document.hidden` (Page Visibility API) and pause while the tab is backgrounded, resuming on `visibilitychange`. This prevents wasting CPU when the user has switched to another app or tab. Implemented by pausing the yielding loop when `document.hidden` is `true` and listening for `visibilitychange` to resume. **Note:** Do NOT implement visibility pausing for correlation computation — with the 20-field cap, correlations complete in <50ms. Visibility pausing is only worthwhile for multi-second operations like full-text search across cold entries.
- **Background tab budget reduction:** When `document.hidden === true`, reduce the yielding budget to 8ms and increase the batch delay to 50ms (`setTimeout(resolve, 50)` instead of `setTimeout(resolve, 0)`). This lets foreground work in other apps proceed without competition. When the document becomes visible again, restore normal budget immediately. Document this contract in the `processWithYielding` JSDoc.
- **Resume-staleness check:** When a paused computation resumes after `visibilitychange`, it must check `metricsCacheStore.stale` before continuing. If `stale` is `true` (entries changed while paused), abort the current computation and restart with fresh data. This prevents computing results from a stale snapshot.
- Apply to: `JournalIndexService.runPass2()`, `LensPanel` full-content search (with `signal`), `AnnotationService.migrateStorage()` (with `signal` + `onError` + `onProgress`).
- **Priority of rules:** When a phase-specific instruction conflicts with a plan-wide rule, **the phase-specific instruction takes precedence**. For example, Plan-Wide Rules list `MetricsEngine.findCorrelations()` as a yielding candidate, but Phase 5c explicitly says to use a plain `for` loop with signal check (correct — capped at 20 fields, completes in <50ms). The phase override is canonical.
- **When to apply yielding (performance-driven, not ceremony-driven):** Any computation that exceeds ~50ms on the target dataset (benchmark with 1000+ entries) must use `processWithYielding()`. Simple O(n) aggregations that complete in <5ms do NOT need yielding — adding it would be overhead for no benefit. The following operations explicitly do NOT need yielding:
  - `getConsistencyScores()` — O(n), <5ms
  - `getHabitStreaks()` — O(n × fields), <10ms for 20 fields × 700 entries
  - `getWeekBounds()` / `getMonthBounds()` — O(1)
  - `findCorrelations()` — plain `for` loop with signal check (Phase 5c override — capped at 20 fields)
  - `getGoalProgress()` — O(n) per field, <5ms
  - `getAdherenceRate()` — O(n), <5ms
  - `getTagFrequency()` — O(n), <10ms
  Operations that MAY need yielding (benchmark first): `getPersonalBests()`, `generateAlerts()`. Cancellation tokens (`signal`) are required for user-interruptible operations (search, migration). Stale-checks on resume are required for operations that pause via `visibilitychange`. When in doubt, profile first — don't add yielding speculatively.

### Image Security
- **Whitelist local vault files only in thumbnail generation.** `extractImagePaths()` captures both local vault images (`![[image.png]]`) and external URLs (`![alt](https://example.com/img.png)`). `ThumbnailService.generateThumbnail()` must resolve every image path via `app.metadataCache.getFirstLinkpathDest(imagePath, sourceFilePath)`. If `getFirstLinkpathDest()` returns `null`, skip the image entirely. This is the real security gate — if it doesn't resolve to a `TFile` in the vault, it's not processable. This covers `http://`, `https://`, `data:`, `javascript:`, `blob:`, and any other non-vault URI scheme without maintaining a blacklist. Undisclosed network requests are an automatic plugin rejection.

### Color Theme CSS Variables
- All color theme definitions in `colorThemes.ts` must use CSS variables for theme-adaptive colors (e.g., `emptyColor`). Since `colorThemes.ts` is a pure utility with no DOM access, resolve CSS variables at render time in the component via `getComputedStyle(document.body).getPropertyValue('--background-modifier-border').trim()` and pass the resolved value to the theme's `mapValue()` function. Do NOT hardcode hex colors for `emptyColor` — they won't adapt to light/dark theme changes.