---
trigger: always_on
---

### React Root Error Boundaries
- **Every** React root must be wrapped in `<ErrorBoundary>`. The existing Main View and Sidebar View already do this. All future modal React roots (QuickEditModal, EntryWizardModal, SectionReaderModal, WeeklyReviewModal) must follow the same pattern:
  ```typescript
  this.root.render(
      <ErrorBoundary fallback="Hindsight encountered an error.">
          <ModalComponent />
      </ErrorBoundary>
  );
  ```
  Without this, a Chart.js initialization error or service exception in a `useEffect` crashes the entire view with no recovery path.

### MarkdownRenderer Safety
- `MarkdownRenderer.renderMarkdown()` is the approved method for rendering user-authored markdown content with full Obsidian formatting (bold, italics, callouts, embedded content). It handles HTML sanitization internally — Obsidian strips unsafe tags. Do NOT replace it with `innerHTML`, `dangerouslySetInnerHTML`, or custom markdown-to-HTML converters.
- `stripMarkdown()` is still used for plain-text contexts: excerpts, tooltips, search result snippets, `EntryCard` preview text, chart popovers.

### Versions & API Compatibility
- Before each release, verify that all Obsidian APIs used are available in `minAppVersion` (currently `1.6.5`). Key APIs to verify: `vault.process()` (1.4.0+), `Platform.isMobile` (1.1.0+), `getFirstLinkpathDest()` (0.13.0+), `getFrontMatterInfo()` (1.4.0+), `getFolderByPath()` (1.6.5+). Current `minAppVersion` of `1.6.5` covers all of these.
- Update both `manifest.json` and `versions.json` if a new phase introduces an API requiring a higher version.
- **`versions.json` update protocol:** Every time `manifest.json version` changes (during release), `versions.json` must be updated to include a new entry mapping the version to its `minAppVersion`. Example: `{ "0.1.0": "1.6.5", "0.2.0": "1.6.5" }`. Add this to the session wrap-up / release workflow checklist.

### Week Start Day
- All "weekly" computations (week bounds, weekly averages, weekly review periods, consistency scores) must respect the user's `weekStartDay` setting. Default: **auto-detect from user's locale** with full capability guards for mobile WebViews where `Intl.Locale` may be entirely absent:
  ```typescript
  function getDefaultWeekStart(): 0 | 1 {
      try {
          if (typeof Intl === 'undefined' || typeof Intl.Locale !== 'function') return 0;
          const locale = new Intl.Locale(navigator.language);
          if ('weekInfo' in locale) {
              return (locale as { weekInfo: { firstDay: number } }).weekInfo.firstDay === 1 ? 1 : 0;
          }
      } catch {
          // Intl.Locale constructor or weekInfo access failed — fall through to default
      }
      return 0; // Sunday fallback
  }
  ```
  Do NOT use `as any` for the `weekInfo` access — use an `in` type guard as shown. This setting is added in Phase 6b.
   > **Locale limitation:** `weekInfo.firstDay` uses 1=Monday through 7=Sunday. Our setting only supports Sunday (0) and Monday (1). Saturday-start and other locale-specific starts (common in Middle Eastern locales) are mapped to Sunday as the fallback. Add a note in the settings UI: "Auto-detected from your device locale. If incorrect, change it here." This sets expectations for users on older devices where auto-detection returns the Sunday fallback.
- `periodUtils.ts` functions (`getWeekBounds()`, `getEntriesInPeriod()`) accept a `weekStartDay` parameter. Services read the value from `useSettingsStore`.
- The existing `getISOWeek()` in `dateUtils.ts` (Monday-start, used for echo week matching) remains unchanged — it serves a different purpose (matching "same week number across years" for echoes, where ISO consistency matters).

### Memory Management
- After indexing completes, log estimated heap usage for `sections` data via `debugLog()` when `debugMode` is enabled. Format: `[Hindsight] Index complete: ${entries.size} entries, sections ~${estimatedSizeKB}KB`.
- **Tiered section storage (implement in Phase 5a):** If estimated sections memory exceeds 5MB (roughly 1500+ entries at ~3KB avg), switch to a tiered strategy:
  - **Hot tier:** Keep full `sections` data in memory for entries from the last 90 days (used by sidebar, echoes, sparklines).
  - **Cold tier:** For older entries, store only `sectionHeadings: string[]` (list of heading names) and `firstSectionExcerpt: string` (first 200 chars of first section, for timeline cards). Full section content for cold entries is lazy-loaded via `vault.cachedRead()` + `parseSections()` on demand (e.g., when Section Reader opens an old entry, when Lens searches older content).
  - The `JournalEntry` type gains: `sectionHeadings?: string[]` and `firstSectionExcerpt?: string` (populated for cold entries only). `sections` remains `Record<string, string>` but is `{}` for cold entries.
  - Components that need full sections for cold entries (SectionReader, Lens, Digest) call a new `journalStore.ensureSectionsLoaded(filePath): Promise<JournalEntry>` action that lazy-loads and caches the sections.
  - **Concurrency semaphore:** ``ensureSectionsLoaded()`` must limit concurrent ``vault.cachedRead()`` calls via a semaphore (``MAX_CONCURRENT_LOADS = 5``, or ``3`` on mobile via ``Platform.isMobile``). Without this, SectionReader search can trigger dozens of parallel file reads, causing I/O thundering herd on mobile.
 **Subscription scope (amendment):** The SectionReader should subscribe to ``journalStore`` only for the entries it is currently displaying, not the entire store. Use a ``useMemo`` to derive the filtered entry list from ``journalStore.entries``, keyed on ``revision + dateRange + selectedSection``. Entry edits outside the current date range or section selection should not trigger re-renders.
  - The 90-day threshold is configurable via a constant `HOT_TIER_DAYS = 90` in `src/constants.ts`.

### Cancellation Support
- Long-running background operations must support cancellation via a lightweight signal:
  ```typescript
  // src/utils/yieldUtils.ts — extended signature
  export async function processWithYielding<T>(
      items: T[],
      processor: (item: T) => void | Promise<void>,
      options?: {
          budgetMs?: number;     // default 10
          sync?: boolean;        // hint: processor is synchronous, skip await in tight loop
          signal?: { cancelled: boolean };  // check at each yield point
          onError?: (item: T, error: unknown) => void;    // skip item, log, continue
          onProgress?: (processed: number, total: number) => void;  // called at yield points
      }
  ): Promise<void>
  ```
  When `signal.cancelled` is true, the function returns early. When `sync` is true, the inner loop calls `processor(items[i])` without `await`, giving more accurate timing for synchronous operations like Pearson correlation. **IMPORTANT: The `signal.cancelled` check must occur inside the inner (budget) loop, not just at yield points.** Without this, `sync: true` mode is uncancellable for up to `budgetMs` per tick. The inner loop should be:
   ```typescript
   while (i < items.length && performance.now() - startTime < budgetMs) {
       if (signal?.cancelled) return;
       if (sync) {
           processor(items[i]);
       } else {
           await processor(items[i]);
       }
       i++;
   }
   ```
  **Error propagation (`onError`):** When provided, catch individual item processor errors, call the handler with the failing item and error, and continue processing remaining items. When not provided, errors propagate as-is (backward compatible). This is essential for Phase 9 (thumbnail generation — one corrupt image shouldn't block all others) and Phase 10 (annotation migration — one locked file shouldn't abort the entire migration).
  **Progress reporting (`onProgress`):** Called at each yield point with the current processed count and total item count. Callers that need progress UI (indexing, migration, search) pass a callback; callers that don't (correlation, simple aggregation) omit it.
- Apply cancellation to: annotation migration (Phase 10, user can cancel), thumbnail batch generation (Phase 9, cancel on settings change), full-text search (Phase 7, cancel on new query — already specified via generation counter).

- **Canonical cancellation contract table:** Different operation types use different cancellation mechanisms. This table is the single source of truth:

  | Operation Type | Cancellation Mechanism | Example |
  |---------------|----------------------|--------|
  | Compute (pure math) | `{ cancelled: boolean }` signal via `processWithYielding` | Correlations, personal bests |
  | I/O (file reads) | `{ cancelled: boolean }` signal via `processWithYielding` | Thumbnail generation, annotation migration |
  | Search (debounced query) | Generation counter (stale-result guard) | Lens text search, field detection |
  | Background job (named) | WorkCoordinator named lane | Re-index, cache rebuild |

   > **Note:** Thumbnails are NOT managed via WorkCoordinator. Thumbnail concurrency is fully managed by `ThumbnailService`'s internal queue with its own concurrency limit and signal-based cancellation. The `WorkCoordinator` should only manage lanes where "newest supersedes oldest" semantics apply: `insights`, `search`, `migration`.

  The `signal` and generation counter serve different purposes: signals stop work mid-stream, generation counters prevent stale writes. Both may be used together on the same operation.

### UI State Persistence
- **Persisted in settings (survive reload):** `selectedChartFields: string[]` (which fields are charted), `rollingWindow: number` (rolling average window). These represent deliberate user preferences, not transient navigation state. Added to `HindsightSettings` and saved via `saveSettingsDebounced()` on change.
- **Transient in `uiStore` (reset on reload):** tab state (active tab group, active sub-tab). Tab state is navigational — users expect to land on the default tab when they reopen Obsidian, not to be deposited back at a sub-tab they visited hours ago.

### Types Organization
- Split `types.ts` into `src/types/settings.ts`, `src/types/journal.ts`, `src/types/metrics.ts`, `src/types/insights.ts` with a barrel `src/types/index.ts`. **Do this in Phase 5a pre-phase cleanup** (not "when it exceeds 200 lines") to prevent import churn as Phases 5c–6c add new types.

### Shared Virtual Scroll Foundation
- **Extract a shared `useVirtualScroll()` hook in Phase 5a** (before Phase 8) that contains the common scroll-tracking logic (scroll offset, viewport calculation, overscan, visible range). `VirtualList` (Phase 4) and `VirtualVariableList` (Phase 8) become thin wrappers around this hook, differing only in height calculation (fixed vs measured). The Gallery (Phase 9) uses the same hook with row heights calculated from thumbnail size + padding. This must be done before Phase 8, not as a backlog item â€” the Section Reader's variable-height virtualization is the most complex piece, and building it on a shared foundation is dramatically easier than retrofitting.
 **Container ResizeObserver (amendment):** Add a ``ResizeObserver`` on the ``VirtualVariableList`` container element. When the container WIDTH changes (sidebar resize, workspace split), invalidate ALL measured heights and remeasure. Text wrapping depends on container width, so width changes make cached heights stale. This is separate from the item-level observers that handle content-driven height changes.
- The hook signature:
  ```typescript
  function useVirtualScroll(options: {
      containerRef: RefObject<HTMLElement>;
      totalItems: number;
      estimatedItemHeight: number;
      overscan?: number;
      mode: 'fixed' | 'variable';
      measuredHeights?: Map<number, number>; // for variable mode
  }): {
      startIndex: number;
      endIndex: number;
      totalHeight: number;
      offsetY: number;
  }
  ```