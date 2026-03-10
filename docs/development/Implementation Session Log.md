# Hindsight Implementation Session Log

Development log for the Hindsight Journal plugin implementation.

> **Plugin:** hindsight-journal
> **Started:** 2026-03-06
> **Related Docs:** [[Implementation Plan]] for phase details

---

## Session Format

Each session entry should include:
- **Date & Focus:** What was worked on
- **Completed:** Checklist of completed items
- **Files Changed:** Key files modified/created
- **Testing Notes:** What was tested and results
- **Blockers/Issues:** Any problems encountered
- **Next Steps:** What to continue with

---

## 2026-03-06 - Phase 1: Journal Index Service + Store & Phase 1.5: Tests

**Focus:** Build the data backbone — recursive journal folder scanning, daily note parsing, Zustand store, file event watchers, and comprehensive unit tests.

### Completed:

#### Phase 1: Journal Index Service + Store

**Utility Layer:**
- ✅ Created `src/utils/fileNameParser.ts` — Parses `YYYY-MM-DD, DayName.md` filenames with date validation
- ✅ Created `src/utils/dateUtils.ts` — isSameDay, isSameWeek, getISOWeek, getDatesInRange, formatDateISO, startOfDay, daysBetween, isInRange (all native Date, no moment.js)

**Service Layer:**
- ✅ Created `src/services/SectionParserService.ts` — parseSections (code-block-aware), extractSection, extractImagePaths (wiki + standard syntax), countWords, stripMarkdown
- ✅ Created `src/services/FrontmatterService.ts` — detectFields, inferFieldType, getFieldTimeSeries
- ✅ Created `src/services/JournalIndexService.ts` — Two-pass init (frontmatter via MetadataCache, then batched content via cachedRead), recursive folder scanning, debounced metadata watchers, vault create/delete/rename handlers

**Store Layer:**
- ✅ Created `src/store/journalStore.ts` — Map-based entries, dateIndex for O(1) echo lookups, binary insertion for sortedDates, batch upsert, cached sorted entries
- ✅ Created `src/store/settingsStore.ts` — Reactive settings mirror for React components

**Orchestration:**
- ✅ Updated `main.ts` — JournalIndexService lifecycle, settings store sync, temporary debug-index command, destroy in onunload, saveSettings syncs store
- ✅ Updated `src/settings.ts` — Uncommented reconfigure call for journal folder changes

**Bonus (outside plan):**
- ✅ Created `src/ui/FolderSuggest.ts` — Folder autocomplete using Obsidian's AbstractInputSuggest for all folder settings
- ✅ Updated `test/mocks/obsidian.ts` — Added AbstractInputSuggest mock and Vault.getRoot()

#### Phase 1.5: Index & Parsing Tests (109 tests, all passing)

| Test File | Tests | Description |
|-----------|-------|-------------|
| `test/utils/fileNameParser.test.ts` | 22 | Valid/invalid filenames, edge dates, day-of-week parsing |
| `test/utils/dateUtils.test.ts` | 27 | All 8 date utility functions, ISO week boundaries |
| `test/services/SectionParserService.test.ts` | 29 | Section parsing, code blocks, images, word count, markdown stripping |
| `test/services/FrontmatterService.test.ts` | 16 | Type inference, field detection, coverage, ranges, time series |
| `test/store/journalStore.test.ts` | 15 | CRUD operations, range queries, sort consistency, echo lookups |

### Files Changed:

**New Files (12):**
- `src/utils/fileNameParser.ts`
- `src/utils/dateUtils.ts`
- `src/services/SectionParserService.ts`
- `src/services/FrontmatterService.ts`
- `src/services/JournalIndexService.ts`
- `src/store/journalStore.ts`
- `src/store/settingsStore.ts`
- `src/ui/FolderSuggest.ts`
- `test/utils/fileNameParser.test.ts`
- `test/utils/dateUtils.test.ts`
- `test/services/SectionParserService.test.ts`
- `test/services/FrontmatterService.test.ts`
- `test/store/journalStore.test.ts`

**Modified Files (3):**
- `main.ts` — Index service init, debug command, settings store sync, onunload cleanup
- `src/settings.ts` — Folder autocomplete, reconfigure call enabled
- `test/mocks/obsidian.ts` — AbstractInputSuggest mock, Vault.getRoot()

### Testing Notes:
- ✅ `npm run build` passes (TypeScript + esbuild)
- ✅ `npm run deploy:test` deploys to test vault
- ✅ Manual verification in Obsidian: index shows correct entry count, detected fields, sample entry with sections/images/word count
- ✅ File watchers confirmed: modify, create, delete all update the index
- ✅ Folder autocomplete working in settings
- ✅ All 109 unit tests passing (1.17s)

### Blockers/Issues:
- None

### Design Notes:

**console.debug vs console.log:** The debug command uses `console.debug` per Obsidian plugin guidelines (which ban `console.log`). Users need to enable "Verbose" log level in DevTools to see output — this is the expected behavior.

---

## Next Session Prompt

```
Phase 2 is complete. Hindsight now has a working sidebar view:
- Right-panel sidebar with Today + Echoes tabs
- Today tab: entry status, filled fields count, writing streak
- Echoes tab: "On this day" and "This week last year" entries
- Section and metric dropdowns on echo cards for at-a-glance customization
- 109 unit tests still passing, no regressions

Continue with Phase 2.5: Tests — Sidebar & Services
- EchoesService tests (getOnThisDay, getThisWeekLastYear)
- PulseService tests (getCurrentStreak, getLongestStreak)
- UI store tests (tab state, echo preferences)

Key files to reference:
- docs/development/Implementation Plan.md — Phase 2.5 details
- src/services/EchoesService.ts — Echo lookup functions
- src/services/PulseService.ts — Streak calculation functions
- src/store/uiStore.ts — UI state store
```

---

## Git Commit Message

```
feat: Phase 1 — journal index service, store, and tests

Journal Index Service:
- Two-pass initialization (frontmatter via MetadataCache, content via cachedRead)
- Recursive folder scanning with filename pattern matching
- Debounced file watchers (metadata change, create, delete, rename)
- Quality score computation per entry

Utilities:
- fileNameParser: YYYY-MM-DD, DayName.md → date + dayOfWeek
- dateUtils: isSameDay, isSameWeek, getISOWeek, formatDateISO, etc.
- SectionParserService: code-block-aware section parsing, image extraction, word count
- FrontmatterService: dynamic field detection, type inference, time series

Store:
- journalStore: Map-based entries, dateIndex for O(1) echo lookups,
  binary insertion for sortedDates, batch upsert, cached sorted entries
- settingsStore: reactive settings mirror for React components

Settings:
- Folder autocomplete using AbstractInputSuggest
- Journal folder reconfigure triggers re-index

Tests (109 passing):
- fileNameParser (22), dateUtils (27), SectionParserService (29),
  FrontmatterService (16), journalStore (15)

Files: 12 new, 3 modified
```

---

## 2026-03-06 - Phase 2: Sidebar View — Today + Echoes

**Focus:** Ship the first visible UI — a right-panel sidebar view with Today status and Echoes from past years, plus section/metric dropdowns for at-a-glance customization.

### Completed:

#### Services & Store
- ✅ Created `src/services/EchoesService.ts` — `getOnThisDay()` (O(1) via dateIndex), `getThisWeekLastYear()` (ISO week matching)
- ✅ Created `src/services/PulseService.ts` — `getCurrentStreak()`, `getLongestStreak()` (consecutive day calculations)
- ✅ Created `src/store/uiStore.ts` — `activeSidebarTab`, `echoSectionKey`, `echoMetricKey` states

#### Hooks
- ✅ Created `src/hooks/useJournalEntries.ts` — Thin selector hooks for journal data slices
- ✅ Created `src/hooks/useEchoes.ts` — Echo data hook (memoized on month-day string)
- ✅ Created `src/hooks/useToday.ts` — Midnight-safe date hook with auto-refresh
- ✅ Created `src/hooks/useSettings.ts` — Settings selector hook

#### View & Components
- ✅ Created `src/views/HindsightSidebarView.tsx` — React-in-ItemView pattern, root mounted in onOpen, unmounted in onClose
- ✅ Created `src/components/SidebarApp.tsx` — Root sidebar component with tab switching
- ✅ Created `src/components/shared/ErrorBoundary.tsx` — React error boundary with reload
- ✅ Created `src/components/shared/TabSwitcher.tsx` — Reusable tab bar (ARIA roles, 44px touch targets)
- ✅ Created `src/components/shared/EmptyState.tsx` — Reusable empty state with icon
- ✅ Created `src/components/sidebar/TodayStatus.tsx` — Entry status, fields count, streak, relative time
- ✅ Created `src/components/echoes/EchoesPanel.tsx` — Echo list with section and metric dropdowns
- ✅ Created `src/components/echoes/EchoCard.tsx` — Clickable card with date, metric badge, excerpt, word count

#### Styles
- ✅ Created `src/styles/sidebar.css` — Tab bar, today status, error boundary, empty state styles
- ✅ Created `src/styles/echoes.css` — Echo cards, dropdown controls, metric badges (light blue)
- ✅ Updated `src/styles/index.css` — Added sidebar and echoes imports
- ✅ Updated `src/styles/variables.css` — Scoped CSS vars to `.hindsight-sidebar-container`

#### Integration
- ✅ Updated `main.ts` — Sidebar view registration, open-sidebar command, auto-open when enabled, right-panel placement with wrong-side detection

### Files Changed:

**New Files (18):**
- `src/services/EchoesService.ts`
- `src/services/PulseService.ts`
- `src/store/uiStore.ts`
- `src/hooks/useJournalEntries.ts`
- `src/hooks/useEchoes.ts`
- `src/hooks/useToday.ts`
- `src/hooks/useSettings.ts`
- `src/views/HindsightSidebarView.tsx`
- `src/components/SidebarApp.tsx`
- `src/components/shared/ErrorBoundary.tsx`
- `src/components/shared/TabSwitcher.tsx`
- `src/components/shared/EmptyState.tsx`
- `src/components/sidebar/TodayStatus.tsx`
- `src/components/echoes/EchoesPanel.tsx`
- `src/components/echoes/EchoCard.tsx`
- `src/styles/sidebar.css`
- `src/styles/echoes.css`

**Modified Files (4):**
- `main.ts` — Sidebar view registration, command, auto-open, activateSidebarView()
- `src/styles/index.css` — Added sidebar + echoes CSS imports
- `src/styles/variables.css` — Added .hindsight-sidebar-container to CSS variable scope
- `styles.css` — Compiled output with all new styles

### Testing Notes:
- ✅ `npm run build` passes (TypeScript + PostCSS + esbuild)
- ✅ `npm run deploy:test` deploys to test vault
- ✅ All 109 existing unit tests pass (no regressions)
- ✅ Manual verification: sidebar opens in right panel, Today tab shows fields/streak, Echoes tab shows past entries
- ✅ Section dropdown changes excerpt on all echo cards
- ✅ Metric dropdown changes badge field on all echo cards
- ✅ Clicking echo cards opens the corresponding note
- ✅ CSS variables properly inherited in sidebar context

### Blockers/Issues:
- **Word count removed from Today card** — Template text (instructions, prefilled info under section headers) inflates word count. No clean way to distinguish user-written text from template content without template awareness. Decided to remove the field rather than show misleading data.
- **Sidebar position caching** — Obsidian caches leaf positions across reloads. Fixed by detecting if the sidebar is on the wrong side and detaching/recreating on the right.

### Design Notes:
- **CSS variable scoping bug:** Variables were defined on `.hindsight-container` only. Sidebar uses `.hindsight-sidebar-container`, so all `var()` references resolved to empty. Fixed by adding the sidebar class to the variable definition selector.
- **Metric badge coloring:** Initially implemented a red→orange→green gradient based on value, but Brad correctly noted this doesnt work universally (some metrics have inverted scales, string values, etc.). Switched to consistent light blue for all metric badges.
- **Section/metric dropdowns:** Deviation from the plan (which hardcoded mood + first section), but a significant UX improvement allowing at-a-glance customization of what each echo card shows.

---

## 2026-03-06 - Phase 2.5: Echoes & Pulse Service Tests

**Focus:** Unit tests for EchoesService and PulseService, plus a bug fix in `getThisWeekLastYear`.

### Completed:

#### Phase 2.5: Echoes & Pulse Service Tests (16 new tests, 125 total passing)

| Test File | Tests | Description |
|-----------|-------|-------------|
| `test/services/EchoesService.test.ts` | 7 | getOnThisDay (date matching, empty results, leap year, sorting), getThisWeekLastYear (week matching, year boundary, empty results) |
| `test/services/PulseService.test.ts` | 9 | getCurrentStreak (5-day, broken, no today, single), getLongestStreak (longest run, equal runs, single, empty), unsorted input handling |

#### Bug Fix: getThisWeekLastYear mid-year lookups
- **Problem:** `getThisWeekLastYear` used `isSameWeek()` which checks both week number AND ISO week year. For mid-year dates, ISO week year equals calendar year, so entries from different calendar years always had different ISO week years — making all mid-year lookups return empty.
- **Fix:** Added `getWeekOfYear()` to `dateUtils.ts` (local-time, week-number-only). Updated `EchoesService.ts` to compare week numbers directly instead of using `isSameWeek()`.

### Files Changed:

**New Files (2):**
- `test/services/EchoesService.test.ts`
- `test/services/PulseService.test.ts`

**Modified Files (2):**
- `src/utils/dateUtils.ts` — Added `getWeekOfYear()` function (local-time week number)
- `src/services/EchoesService.ts` — Replaced `isSameWeek` with `getWeekOfYear` comparison

### Testing Notes:
- ✅ All 125 unit tests passing (1.04s)
- ✅ No regressions from Phase 1 or 1.5 tests
- ✅ Bug fix verified: mid-year week matching now works correctly

### Blockers/Issues:
- None

---

## 2026-03-06 - Phase 3: Full-Page View + Calendar

**Focus:** Full-page view with tab router and month calendar. Calendar shows day grid color-coded by selected frontmatter metric.

### Completed:

#### View & Components
- ✅ Created `src/views/HindsightMainView.tsx` — ItemView + React root (same pattern as sidebar)
- ✅ Created `src/components/MainApp.tsx` — Tab router: Calendar, Timeline (stub), Index (stub) with entry count in labels
- ✅ Created `src/components/calendar/CalendarGrid.tsx` — 7-column month grid, day-of-week headers, memoized entry mapping
- ✅ Created `src/components/calendar/CalendarCell.tsx` — Metric color-coding (HSL gradient), context menu (Obsidian Menu class), mobile tap Notice, hover tooltips
- ✅ Created `src/components/calendar/CalendarNav.tsx` — Month prev/next, arrow key navigation, "Today" button
- ✅ Created `src/components/shared/MetricSelector.tsx` — Dropdown filtering to numeric/boolean fields only

#### Utilities & Store
- ✅ Created `src/utils/statsUtils.ts` — `mapValueToColor()` (HSL red→yellow→green), `mapBooleanToColor()`
- ✅ Updated `src/store/uiStore.ts` — `activeMainTab`, `calendarMonth`, `calendarYear`, `selectedMetric` + setters

#### Styles
- ✅ Created `src/styles/calendar.css` — Grid layout, cell styling, nav bar, hover effects, today ring, metric indicator dot, 44px touch targets
- ✅ Updated `src/styles/variables.css` — Added `.hindsight-main-container` to CSS variable scope
- ✅ Updated `src/styles/index.css` — Added calendar.css import

#### Integration
- ✅ Updated `main.ts` — View registration, `open-main` command, `book-open` ribbon icon, `activateMainView()` helper

#### Bug Fix
- ✅ Added `tabIndex={0}` to calendar container div — without this, arrow key navigation didn't work because divs aren't focusable by default

### Files Changed:

**New Files (10):**
- `src/views/HindsightMainView.tsx`
- `src/components/MainApp.tsx`
- `src/components/calendar/CalendarGrid.tsx`
- `src/components/calendar/CalendarCell.tsx`
- `src/components/calendar/CalendarNav.tsx`
- `src/components/shared/MetricSelector.tsx`
- `src/utils/statsUtils.ts`
- `src/styles/calendar.css`
- `test/utils/statsUtils.test.ts`
- `test/utils/calendarUtils.test.ts`

**Modified Files (4):**
- `main.ts` — View registration, command, ribbon icon, activateMainView()
- `src/store/uiStore.ts` — Calendar state fields (activeMainTab, calendarMonth, calendarYear, selectedMetric)
- `src/styles/variables.css` — Added .hindsight-main-container to CSS scope
- `src/styles/index.css` — Calendar CSS import

### Testing Notes:
- ✅ `npm run build` passes
- ✅ `npm run deploy:test` deploys to test vault
- ✅ All 13 Phase 3 verification items confirmed by Brad
- ✅ Arrow key navigation fix verified by Brad

### Blockers/Issues:
- None

### Design Notes:
- **Calendar container focusability:** Standard `<div>` elements don't receive keyboard events. Added `tabIndex={0}` with `outline: none` CSS to make the calendar container focusable for arrow key month navigation without a visible focus ring.
- **Context menu "View in timeline":** Added per plan — switches to Timeline tab which currently shows "Coming soon" stub. Will become functional in Phase 4.

---

## 2026-03-06 - Phase 3.5: Calendar Utility Tests

**Focus:** Unit tests for statsUtils color-mapping functions and calendar date math.

### Completed:

#### Phase 3.5: Calendar Utility Tests (27 new tests, 152 total passing)

| Test File | Tests | Description |
|-----------|-------|-------------|
| `test/utils/statsUtils.test.ts` | 13 | mapValueToColor (min/max/mid/null/clamp-below/clamp-above/min=max/negative-range/large-range/25%), mapBooleanToColor (true/false/null) |
| `test/utils/calendarUtils.test.ts` | 14 | Days per month (Jan/Feb/Apr/Dec, leap years 2024/2000/1900), first-day-of-week alignment (4 months), month nav boundary crossing (Dec→Jan, Jan→Dec, mid-year) |

### Testing Notes:
- ✅ All 152 unit tests passing (9 test files)
- ✅ No regressions from Phase 1/1.5/2.5 tests

### Blockers/Issues:
- None

---

## 2026-03-06 - Phase 4: Timeline + Journal Index & Phase 4.5: Filter & Sort Tests

**Focus:** Complete the three core navigation modes — Timeline (scrollable card feed) and Index (sortable/filterable data table). Both read from the journal store. Also: extract filter/sort logic and write comprehensive unit and integration tests.

### Completed:

#### Phase 4: Timeline + Journal Index

**Shared Components:**
- ✅ Created `src/components/shared/VirtualList.tsx` — Lightweight virtual scroll (ResizeObserver + scroll events, spacer divs, overscan buffer)

**Timeline Components:**
- ✅ Created `src/components/timeline/EntryCard.tsx` — Entry card with date, dynamic badges (all numeric/boolean detected fields), quality score, word count, image count, tags, and clean-text excerpt
- ✅ Created `src/components/timeline/TimelineList.tsx` — Paginated card feed (50 per page), newest/oldest sort toggle, VirtualList integration

**Index Table Components:**
- ✅ Created `src/components/index-table/IndexFilters.tsx` — Text search (250ms debounce), date range (blur-apply), numeric field filters with add/remove, clear all
- ✅ Created `src/components/index-table/JournalIndex.tsx` — Sortable data table with dynamic columns from detected fields, filter application, click-to-sort headers

**Store & Styles:**
- ✅ Updated `src/store/uiStore.ts` — Added indexSort (field + direction toggle) and indexFilters (search, dateRange, fieldFilters) with all setters
- ✅ Created `src/styles/timeline.css` — Cards, badges, excerpts, tags, sort toggle, load more button
- ✅ Updated `src/styles/shared.css` — Index table styles, sortable headers with direction indicators, filter bar, filter pills
- ✅ Updated `src/styles/index.css` — Added timeline.css import

**Integration:**
- ✅ Updated `src/components/MainApp.tsx` — Replaced Timeline/Index stubs with real components

**Post-review fixes:**
- ✅ Made EntryCard badges dynamic (all detected numeric/boolean fields, not hardcoded mood/energy)
- ✅ Fixed date range filter UX — changed from onChange to onBlur to prevent table updates on every date picker arrow click

#### Phase 4.5: Filter & Sort Tests (23 new tests, 175 total passing)

| Test File | Tests | Description |
|-----------|-------|-------------|
| `test/store/uiStore.test.ts` | 11 | setIndexSort toggle (asc/desc/new field), setSearchFilter, setDateRangeFilter (set/clear), addFieldFilter, removeFieldFilter (shift), clearAllFilters, tab persistence |
| `test/integration/filter-integration.test.ts` | 12 | Text search (case insensitive, partial match, no match), date range (inclusive boundaries), field filters (>= with null exclusion), combined filters, sort (asc date, desc mood, null-at-end) |

**Refactoring:**
- ✅ Created `src/utils/filterUtils.ts` — Extracted `applyFilters()` and `applySorting()` from JournalIndex into pure testable functions
- ✅ Refactored `JournalIndex.tsx` to use extracted utils (no behavior change)

### Files Changed:

**New Files (10):**
- `src/components/shared/VirtualList.tsx`
- `src/components/timeline/EntryCard.tsx`
- `src/components/timeline/TimelineList.tsx`
- `src/components/index-table/IndexFilters.tsx`
- `src/components/index-table/JournalIndex.tsx`
- `src/styles/timeline.css`
- `src/utils/filterUtils.ts`
- `test/store/uiStore.test.ts`
- `test/integration/filter-integration.test.ts`

**Modified Files (5):**
- `src/store/uiStore.ts` — indexSort + indexFilters state, 6 new action methods
- `src/styles/shared.css` — Index table + filter styles (~160 lines)
- `src/styles/index.css` — timeline.css import
- `src/components/MainApp.tsx` — Wired real Timeline/Index components, removed stubs
- `styles.css` — Compiled output with all new styles

### Testing Notes:
- ✅ `npm run build` passes (TypeScript + PostCSS + esbuild)
- ✅ `npm run deploy:test` deploys to test vault
- ✅ All 175 unit tests passing across 11 test files (1.95s)
- ✅ All 15 Phase 4 manual verification items confirmed by Brad
- ✅ No regressions from Phase 1-3.5 tests

### Blockers/Issues:
- **Mobile table width (noted, not blocking):** Index table requires horizontal scrolling on mobile due to dynamic column count. Future consideration: responsive column hiding for small screens.

### Design Notes:
- **Dynamic badges over hardcoded fields:** Plan originally specified mood/energy badges. Brad requested (and approved deviation) to make badges pull from all detected numeric/boolean fields dynamically, making the component user-agnostic.
- **Date filter blur pattern:** Native `<input type="date">` fires onChange on every arrow click inside the date picker (month/year navigation). Switched to onBlur + defaultValue to only apply the filter when the user finishes selecting a date.
- **Filter logic extraction:** Plan suggested extracting filtering into a util if not already done. Created `filterUtils.ts` with `applyFilters()` and `applySorting()` as pure functions, keeping JournalIndex lean and tests clean.

---

## 2026-03-08 - Phase 5a Session 1: Infrastructure Cleanup + Foundation Utilities

**Focus:** Remove dead eval code (security gate), fix unhandled promises, add ESLint, create debugLog utility, extract commands, and split types into modules. Pure infrastructure — no new user-facing features.

### Completed:

#### Security Gate (Items 1-2)
- ✅ Deleted `src/views/UPlotEvalView.ts` — contained `innerHTML` usage (automatic plugin review blocker)
- ✅ Deleted `src/views/ChartJsEvalView.ts` — temporary eval code
- ✅ Removed `HINDSIGHT_UPLOT_EVAL_VIEW_TYPE` and `CHARTJS_EVAL_VIEW_TYPE` from `constants.ts`
- ✅ Removed all eval view imports, registrations, and commands from `main.ts`
- ✅ `npm uninstall uplot` — removed from dependencies

#### Unhandled Promises (Item 0)
- ✅ Fixed 2 `addEventListener('blur', async ...)` handlers in `settings.ts` — wrapped with `void` IIFE
- ✅ Fixed 3 async file watcher handlers in `JournalIndexService.ts` — `setTimeout(async ...)`, `vault.on('create', async ...)`, `vault.on('rename', async ...)` — wrapped with `void` IIFE + `try/catch`

#### Debug Cleanup (Items 3, 6)
- ✅ Removed `debug-index` command from `main.ts`
- ✅ Created `src/utils/debugLog.ts` — settings-gated debug logger reading from `settingsStore`
- ✅ Added `debugMode: boolean` to `HindsightSettings` + `DEFAULT_SETTINGS`
- ✅ Added "Advanced" section to settings tab with debug mode toggle
- ✅ Replaced all 4 `console.debug` calls — only `debugLog.ts` itself calls `console.debug`

#### ESLint (Item 17)
- ✅ Installed ESLint v10 + `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
- ✅ Created `eslint.config.mjs` (flat config) with: `no-floating-promises`, `no-explicit-any`, `no-console` (allow warn/error)
- ✅ Updated `build` script to run lint first: `npm run lint && npm run css:build && ...`
- ✅ Fixed 4 pre-existing lint errors: 3 floating `revealLeaf()` promises in `main.ts`, 1 floating `reconfigure()` in `settings.ts`
- ✅ Removed unused eslint-disable directive in `TodayStatus.tsx`

#### Command Extraction (Item 4)
- ✅ Created `src/commands.ts` with `registerCommands(plugin)` — contains `open-sidebar` and `open-main` commands
- ✅ Zero `addCommand()` calls remain in `main.ts`

#### Types Split (Item 10)
- ✅ Created `src/types/settings.ts` — `HindsightSettings`, `DEFAULT_SETTINGS`
- ✅ Created `src/types/journal.ts` — `JournalEntry`, `ParsedSection`
- ✅ Created `src/types/metrics.ts` — `FrontmatterField`, `MetricDataPoint`, `DateRange`
- ✅ Created `src/types/insights.ts` — empty placeholder for Phase 5c
- ✅ Created `src/types/index.ts` — barrel re-exports
- ✅ Deleted `src/types.ts` — all imports resolve via barrel automatically

### Files Changed:

**New Files (7):**
- `eslint.config.mjs`
- `src/commands.ts`
- `src/utils/debugLog.ts`
- `src/types/settings.ts`
- `src/types/journal.ts`
- `src/types/metrics.ts`
- `src/types/insights.ts`
- `src/types/index.ts`

**Modified Files (7):**
- `main.ts` — Removed eval views/imports/commands/debug-index, added `registerCommands()` + `debugLog`, fixed floating promises
- `package.json` — Added lint script, updated build to lint-first, removed uplot dep
- `package-lock.json` — ESLint + typescript-eslint deps added, uplot removed
- `src/constants.ts` — Removed eval view type constants
- `src/settings.ts` — Fixed async blur handlers, added Advanced section with debugMode toggle
- `src/services/JournalIndexService.ts` — Wrapped async file watcher handlers in void IIFE + try/catch
- `src/components/sidebar/TodayStatus.tsx` — Removed unused eslint-disable directive

**Deleted Files (3):**
- `src/types.ts` — Replaced by `src/types/` modules
- `src/views/UPlotEvalView.ts` — Security blocker (innerHTML)
- `src/views/ChartJsEvalView.ts` — Temporary eval code

### Testing Notes:
- ✅ `npm run lint` passes — zero errors, zero warnings
- ✅ `npm run build` passes — lint + CSS + TypeScript + esbuild
- ✅ All 175 unit tests pass across 11 test files (1.80s)
- ✅ `npm run deploy:test` successful
- ✅ Brad verified in Obsidian: plugin loads, sidebar/main view work, no eval commands in palette, debugMode toggle present
- ✅ All exit gate greps return zero results (innerHTML, console.debug, eval remnants, addCommand in main.ts)

### Blockers/Issues:
- None

### Design Notes:
- **debugLog signature:** Plan specified `debugLog(plugin, ...args)` but we used `debugLog(...args)` reading from `settingsStore` instead. This avoids prop-drilling the plugin instance through utility functions and is consistent with the existing pattern of services reading from stores. Brad approved.
- **ESLint v10 flat config:** Installed ESLint v10 which uses flat config (`eslint.config.mjs`) instead of the legacy `.eslintrc.json` format.
- **Types barrel resolution:** TypeScript resolves `from '../types'` to `../types/index.ts` automatically when the directory contains an `index.ts`, so no import path changes were needed across the 25+ files that import from types.

---

## Next Session Prompt

```
Phase 5a Session 2 complete. Store + service infrastructure done:
- appStore created, all 9 components refactored (no more app prop-drilling)
- All 4 stores have reset() actions with proper onunload() sequencing
- journalStore has revision counter, schemaDirty, pendingChangedFieldKeys
- JournalIndexService refactored: processWithYielding, debounced detectFields,
  indexing lock, bulk event settling, conflict file filter
- CalendarCell inline style remediated to CSS variable pattern
- 202 tests passing, all lint/build gates clean

Continue with Phase 5a Session 3 — remaining items:
- Item 11: Inline style remediation audit (grep for remaining style={{ )
  NOTE: CalendarCell is already done. Check for others.
- Item 12 WIRING: The revision counter state was added to journalStore this
  session. Session 3 needs to wire the cross-store subscription in storeWiring.ts:
  journalStore.revision -> metricsCacheStore.markStale() [debounced 2s].
  The state is ready, the subscription is not.
- Any remaining Phase 5a items from the plan not covered by Sessions 1-2

Key files to reference:
- docs/development/Implementation Plan.md — Phase 5a (line 2555+)
- src/store/journalStore.ts — Has revision, schemaDirty, pendingChangedFieldKeys
- src/store/appStore.ts — Global app/plugin access
- src/services/JournalIndexService.ts — Refactored with all new infrastructure
- src/utils/yieldUtils.ts — processWithYielding utility
```

## Git Commit Message

```
refactor(phase-5a): infrastructure cleanup and foundation utilities - session 1

Security Gate:
- Delete UPlotEvalView.ts and ChartJsEvalView.ts (innerHTML blocker)
- Remove eval view constants, imports, registrations, and commands
- Uninstall uplot dependency

Promise Handling:
- Wrap async blur handlers in settings.ts with void IIFE
- Wrap async file watcher handlers in JournalIndexService.ts with
  void IIFE + try/catch (metadata change, create, rename)
- Fix 3 floating revealLeaf() promises in main.ts
- Fix floating reconfigure() promise in settings.ts

Debug Infrastructure:
- Create src/utils/debugLog.ts — settings-gated debug logger
- Add debugMode setting to HindsightSettings + Advanced settings section
- Remove debug-index command and all console.debug calls

ESLint:
- Install ESLint v10 + typescript-eslint
- Configure no-floating-promises, no-explicit-any, no-console rules
- Add lint script, update build to lint-first

Code Organization:
- Extract commands to src/commands.ts with registerCommands()
- Split src/types.ts into src/types/ modules with barrel re-exports
  (settings, journal, metrics, insights, index)

All 175 tests passing, all exit gate greps clean
```

---

## 2026-03-08 - Phase 5a Session 2: Stores, appStore Refactoring, JournalIndexService Infrastructure

**Focus:** Create appStore and HindsightPluginInterface to eliminate app prop-drilling, add store reset actions, add revision counter and schemaDirty to journalStore, refactor JournalIndexService with time-based yielding / debounced detectFields / indexing lock / bulk event settling, remediate CalendarCell inline styles.

### Completed:

#### processWithYielding (Item 5)
- ✅ Created `src/utils/yieldUtils.ts` — time-based yielding with configurable budget (mobile/desktop), cancellation signals, error recovery, and progress callbacks
- ✅ Refactored `JournalIndexService.runPass2()` to use `processWithYielding` instead of fixed PARSE_BATCH_SIZE

#### Conflict File Filter (Item 9c)
- ✅ Updated `src/utils/fileNameParser.ts` — rejects Obsidian Sync conflict files containing `(Conflict)` (case-insensitive)

#### appStore + Prop-Drilling Removal (Item 7)
- ✅ Created `src/types/plugin.ts` — `HindsightPluginInterface` and `ServiceRegistry` types
- ✅ Created `src/store/appStore.ts` — global Zustand store for App and plugin singletons
- ✅ Updated `src/types/index.ts` — barrel re-exports for new types
- ✅ Refactored 9 components to use `useAppStore` instead of `app: App` prop:
  - `EchoCard`, `EchoesPanel`, `SidebarApp`, `TodayStatus`
  - `CalendarCell`, `CalendarGrid`, `MainApp`, `TimelineList`, `JournalIndex`
- ✅ Updated `HindsightSidebarView.tsx` — removed plugin param from constructor/render
- ✅ Updated `HindsightMainView.tsx` — removed plugin param from constructor/render
- ✅ Updated `main.ts` — implements `HindsightPluginInterface`, initializes appStore with reset-then-set for re-enable safety (A17)

#### Store `reset()` Actions (Item 8)
- ✅ Added `reset()` to `journalStore`, `uiStore`, `settingsStore`, `appStore`
- ✅ Wired `onunload()` cleanup sequence in `main.ts`: signal teardown → unsubscribe cross-store subs → destroy services → cleanup registry → reset stores (appStore LAST)

#### Debounced detectFields + Schema-Dirty (Item 9)
- ✅ Added `debouncedDetectFields()` (5s) — all watchers use this instead of direct calls
- ✅ Added `checkSchemaChange()` — sets `schemaDirty` only when frontmatter keys change, not just values
- ✅ Added `schemaDirty`, `pendingChangedFieldKeys` (Set), `fullInvalidation`, `setSchemaDirty()`, `clearPendingChanges()` to journalStore

#### Atomic Indexing Lock (Item 9a)
- ✅ Added `isIndexing` / `needsReindex` to `JournalIndexService`
- ✅ `initialize()` guards with lock, queues re-index if triggered mid-run

#### Bulk Event Settling (Item 9b)
- ✅ >10 events in 500ms → pauses individual processing, waits 2s silence → full re-index
- ✅ All timers cleaned up in `destroy()`

#### Revision Counter + Pending Changes (Item 12 — state only)
- ✅ Added `revision` counter (increments on every mutation: setEntries, upsertEntry, upsertEntries, removeEntry, clear)
- ✅ Added `pendingChangedFieldKeys` (accumulates frontmatter keys on upsertEntry)
- ✅ Added `fullInvalidation` flag (set on bulk operations)
- ⚠️ **Note for Session 3:** Cross-store subscription wiring (journalStore.revision → metricsCacheStore.markStale) is NOT done. Only the state was added this session.

#### Inline Style Remediation
- ✅ Migrated `CalendarCell` `style={{backgroundColor}}` to ref-based CSS variable pattern (`--hindsight-cell-bg`) via `useEffect` + `cellRef.current.style.setProperty()`
- ✅ Added `.hindsight-calendar-cell.has-metric-color` CSS rule to `calendar.css`

### Files Changed:

**New Files (5):**
- `src/utils/yieldUtils.ts`
- `src/types/plugin.ts`
- `src/store/appStore.ts`
- `test/utils/yieldUtils.test.ts`
- `test/store/appStore.test.ts`

**Modified Files (14):**
- `main.ts` — Implements HindsightPluginInterface, appStore init, onunload sequence, view constructors updated
- `src/services/JournalIndexService.ts` — processWithYielding, debounced detectFields, indexing lock, bulk settle, checkSchemaChange
- `src/store/journalStore.ts` — revision, schemaDirty, pendingChangedFieldKeys, fullInvalidation, reset(), clearPendingChanges()
- `src/store/uiStore.ts` — reset() action
- `src/store/settingsStore.ts` — reset() action
- `src/types/index.ts` — Added plugin type re-exports
- `src/components/SidebarApp.tsx` — Removed plugin/app props
- `src/components/MainApp.tsx` — Removed plugin/app props, uses appStore
- `src/components/calendar/CalendarCell.tsx` — Uses appStore, CSS variable pattern for bg color
- `src/components/calendar/CalendarGrid.tsx` — Removed app prop
- `src/components/echoes/EchoCard.tsx` — Uses appStore
- `src/components/echoes/EchoesPanel.tsx` — Removed app prop
- `src/components/sidebar/TodayStatus.tsx` — Uses appStore
- `src/components/timeline/TimelineList.tsx` — Uses appStore
- `src/components/index-table/JournalIndex.tsx` — Uses appStore
- `src/views/HindsightSidebarView.tsx` — Removed plugin param
- `src/views/HindsightMainView.tsx` — Removed plugin param
- `src/utils/fileNameParser.ts` — Conflict file filter
- `src/styles/calendar.css` — has-metric-color CSS variable rule
- `test/store/journalStore.test.ts` — revision, reset, schemaDirty, pendingChangedFieldKeys tests
- `test/store/uiStore.test.ts` — reset test
- `test/utils/fileNameParser.test.ts` — Conflict filter tests

### Testing Notes:
- ✅ `npm run lint` passes
- ✅ `npm run build` passes (lint + CSS + TypeScript + esbuild)
- ✅ All 202 unit tests pass across 13 test files (41 new, zero regressions)
- ✅ `npm run deploy:test` successful
- ✅ Brad confirmed in Obsidian: sidebar loads, calendar color-coding works, timeline/index tabs work

### Blockers/Issues:
- None

### Design Notes:
- **appStore re-enable safety (A17):** On plugin re-enable, `onload()` calls `appStore.reset()` immediately followed by `appStore.setApp(this.app, this)` with no awaits between, eliminating the window where `app` is null.
- **CalendarCell inline style fix:** Obsidian review bot flags all `style={{}}` JSX attributes equally, regardless of whether they set CSS custom properties or regular inline styles. Migrated to imperative `ref.current.style.setProperty('--hindsight-cell-bg', bgColor)` paired with a CSS class rule.
- **runPass2 bulk upsert:** Changed from per-batch `upsertEntries()` to collecting all updated entries then one final `upsertEntries()` call, resulting in a single `revision` increment instead of N increments (important for the upcoming DAG subscription wiring).

---

## 2026-03-08 - Phase 5a Session 3: Store Wiring, Settings Migration, Cold-Tier Display Fixes

**Focus:** Complete remaining Phase 5a infrastructure: storeWiring, FileWatcherService extraction, settings migration, and fix cold-tier section display regressions. Add timeline section selector.

### Completed:

**Infrastructure:**
- ✅ Created `src/storeWiring.ts` — wireStoreSubscriptions (journalStore.revision → metricsCacheStore.markStale debounced 2s), resetAllStores
- ✅ Created `src/services/FileWatcherService.ts` — Extracted file watching from JournalIndexService
- ✅ Created `src/utils/settingsMigration.ts` — migrateSettings (versioned), validateSettings, normalizePathSetting, sanitizeLoadedData (prototype pollution guard with array traversal)
- ✅ Updated `src/settings.ts` — Added hotTierDays setting, path validation on journalFolder/weeklyReviewFolder using normalizePathSetting + validateVaultRelativePath
- ✅ Updated `main.ts` — Integrated FileWatcherService, storeWiring, migrateSettings; onunload uses resetAllStores

**Cold-Tier Section Display Fixes:**
- ✅ `EchoCard.tsx` — Lazy-loads sections via ensureSectionsLoaded for cold-tier entries; skipInstructionPrefix skips template lines
- ✅ `EchoesPanel.tsx` — Uses entry.sectionHeadings for dropdown on cold-tier entries
- ✅ `EntryCard.tsx` — Lazy-loads sections (same pattern as EchoCard); getRealContent validates sections have real content
- ✅ `JournalIndexService.ts` — firstSectionExcerpt uses partial match (.includes) for What Actually Happened (handles emoji-prefixed headings like 🗒️), skips template-only sections

**Timeline Section Selector (new feature):**
- ✅ `uiStore.ts` — Added timelineSectionKey/setTimelineSectionKey state
- ✅ `TimelineList.tsx` — Section dropdown (same UX as echoes sidebar), collects headings from hot-tier entries only
- ✅ `EntryCard.tsx` — Accepts sectionKey prop, uses it in getExcerpt when user selects specific section
- ✅ `timeline.css` — Styles for section dropdown control

**Tests:**
- ✅ Created `test/utils/sanitize.test.ts` — sanitizeLoadedData prototype pollution tests
- ✅ Created `test/utils/vaultUtils.test.ts` — validateVaultRelativePath tests

### Files Changed:
- `main.ts` — FileWatcherService integration, storeWiring, migrateSettings
- `src/storeWiring.ts` — [NEW] Cross-store subscriptions + resetAllStores
- `src/services/FileWatcherService.ts` — [NEW] Extracted file watcher
- `src/utils/settingsMigration.ts` — [NEW] Settings migration + validation
- `src/settings.ts` — hotTierDays, path validation
- `src/store/uiStore.ts` — timelineSectionKey state
- `src/components/echoes/EchoCard.tsx` — Lazy-load + skipInstructionPrefix + getRealContent
- `src/components/echoes/EchoesPanel.tsx` — Cold-tier sectionHeadings fallback
- `src/components/timeline/EntryCard.tsx` — Lazy-load + sectionKey prop + getRealContent
- `src/components/timeline/TimelineList.tsx` — Section dropdown
- `src/services/JournalIndexService.ts` — firstSectionExcerpt partial match + skip logic
- `src/styles/timeline.css` — Section dropdown styles
- `test/utils/sanitize.test.ts` — [NEW]
- `test/utils/vaultUtils.test.ts` — [NEW]

### Testing Notes:
- ✅ `npm run lint` passes
- ✅ `npm run build` passes (lint + CSS + TypeScript + esbuild)
- ✅ All 260 unit tests pass across 18 test files (58 new, zero regressions)
- ✅ `npm run deploy:test` successful
- ✅ Brad confirmed: echoes sidebar section dropdown works with cold-tier entries, timeline section selector works, section excerpts show actual content instead of template instructions

### Blockers/Issues:
- **Template format discovery:** Section headings use emoji prefixes (e.g., `🗒️ What Actually Happened`), so exact string matching failed. Fixed with `.includes()` partial matching.
- **Template instruction lines:** Sections like Dreams contain only template prompts (`> Record immediately upon waking.` + `-`). Fixed with getRealContent that validates sections have real content after stripping instructions.
- **Cold-tier vs hot-tier heading mismatch:** Older entries had headings without emojis, newer entries have them. Timeline dropdown now only collects from hot-tier entries to avoid duplicates.

### Design Notes:
- **skipInstructionPrefix:** Scans line-by-line, skips empty lines, punctuation-only separators, and the first 2 short lines (<80 chars). Falls through to original text if nothing substantial remains.
- **getRealContent:** Validates section has real content (>5 chars after strip, not just punctuation). Used by both EntryCard and EchoCard to skip template-only sections in auto-detect mode.
- **Timeline section selector:** Mirrors echoes sidebar pattern — dropdown in controls bar, state in uiStore, passed as prop to cards.

---

## Next Session Prompt

```
Phase 5a Session 3 complete. Core utilities, wiring, and cold-tier display all done:
- storeWiring.ts created (cross-store subscriptions + resetAllStores)
- FileWatcherService extracted from JournalIndexService
- settingsMigration.ts created (migrateSettings, validateSettings, normalizePathSetting)
- settings.ts updated with hotTierDays setting and path validation
- main.ts refactored to integrate FileWatcherService, storeWiring, migrateSettings
- Cold-tier section display fixed: EchoCard lazy-loads via ensureSectionsLoaded,
  EchoesPanel uses sectionHeadings for dropdown, EntryCard lazy-loads sections
- Section excerpt logic fixed: partial matching for emoji-prefixed headings,
  getRealContent skips template-only sections, skipInstructionPrefix skips
  instruction lines and separators
- Timeline section selector dropdown added (same pattern as echoes)
- uiStore gained timelineSectionKey
- 260 tests passing, all lint/build gates clean

Continue with remaining Phase 5a items or begin Phase 5b.
The session 3 items from the plan should be marked complete.

Key files to reference:
- docs/development/Implementation Plan.md — Phase 5a (line 2555+)
- src/storeWiring.ts — Cross-store subscriptions + resetAllStores
- src/services/FileWatcherService.ts — Extracted file watcher
- src/utils/settingsMigration.ts — Settings migration + validation
```

## Git Commit Message

```
feat(phase-5a): storeWiring, FileWatcherService, settingsMigration, cold-tier section display, timeline section selector - session 3

Store Wiring + Lifecycle:
- Create src/storeWiring.ts with wireStoreSubscriptions and resetAllStores
- Wire journalStore.revision -> metricsCacheStore.markStale (debounced 2s)
- Refactor main.ts onunload to use resetAllStores instead of direct store resets

FileWatcherService:
- Extract file watching logic from JournalIndexService into FileWatcherService
- Integrate into main.ts lifecycle

Settings Migration:
- Create src/utils/settingsMigration.ts with migrateSettings, validateSettings,
  normalizePathSetting, sanitizeLoadedData (prototype pollution guard)
- Add hotTierDays setting to settings.ts with path validation on folder inputs
- Wire migrateSettings into loadSettings in main.ts

Cold-Tier Section Display Fixes:
- EchoCard: lazy-load sections via ensureSectionsLoaded for cold-tier entries
- EchoesPanel: use entry.sectionHeadings for dropdown on cold-tier entries
- EntryCard: lazy-load sections via ensureSectionsLoaded (same pattern as EchoCard)
- JournalIndexService: firstSectionExcerpt uses partial match for What Actually
  Happened (emoji-prefixed headings), skips template-only sections

Section Excerpt Intelligence:
- Add skipInstructionPrefix: skips leading instruction lines, separators, and
  punctuation-only lines in section content
- Add getRealContent: validates section has real content after stripping templates
- Partial match with .includes for What Actually Happened (handles emoji prefixes)

Timeline Section Selector:
- Add timelineSectionKey/setTimelineSectionKey to uiStore
- Add section dropdown to TimelineList (same UX as echoes sidebar)
- EntryCard accepts sectionKey prop for user-selected section excerpts
- CSS for section dropdown control in timeline.css

Tests: 260 passing (58 new from sanitize.test.ts and vaultUtils.test.ts), zero regressions
```

---

## 2026-03-09 - Phase 5b: Chart Engine + Tab Groups + Sparklines

**Focus:** Install Chart.js integration, build the chart data pipeline, create charting and sparkline components, restructure the main view with two-tier tab group navigation.

### Completed:

#### Chart Engine & Data Pipeline
- ✅ Verified `src/utils/chartSetup.ts` (from Phase 5a) — tree-shaken Chart.js registration, Tooltip plugin excluded (innerHTML policy)
- ✅ Created `src/services/ChartDataService.ts` — `getTimeSeries`, `rollingAverage`, `trendLine`, `buildChartDataset`, `buildMultiMetricDataset` (dual Y-axis support)
- ✅ Created `src/store/chartUiStore.ts` — Selected fields, date range, rolling window, dismissed alerts, reset
- ✅ Expanded `src/store/metricsCacheStore.ts` — Full caching for time series and rolling averages, granular invalidation, stale flag
- ✅ Created `src/hooks/useMetrics.ts` — `useMetrics()` config hook, `useChartData()` cache-miss computation in useEffect

#### Chart Components
- ✅ Created `src/components/charts/Sparkline.tsx` — SVG sparkline with null gap handling, ARIA attributes
- ✅ Created `src/components/sidebar/SparklineRow.tsx` — Field label + value + sparkline row for sidebar
- ✅ Created `src/components/charts/MetricChart.tsx` — Chart.js line chart wrapper with canvas null guard, theme reactivity (css-change), disabled tooltip (React popover), click handler for excerpts, multi-metric dual Y-axis, error handling, ARIA
- ✅ Created `src/components/charts/ChartsPanel.tsx` — Charts sub-tab with field selection, date range presets, custom date pickers, rolling average/trend line toggles

#### Tab Group Navigation
- ✅ Created `src/components/shared/TabGroup.tsx` — Two-tier tab component with ARIA tablist/tab/tabpanel roles
- ✅ Updated `src/store/uiStore.ts` — Replaced flat `activeMainTab` with type-safe `TabGroup`/`SubTab` mapping, `setActiveGroup` resets sub-tab
- ✅ Restructured `src/components/MainApp.tsx` — Two-tier TabGroup (Journal→Calendar|Timeline|Index, Insights→Charts|Pulse|Digest, Explore→Lens|Threads|Gallery) with CalendarContent inline composition

#### Sidebar Sparklines
- ✅ Updated `src/components/sidebar/TodayStatus.tsx` — Added sparkline rows for all numeric fields below existing stats

#### Lifecycle & Store Wiring
- ✅ Updated `main.ts` — `chartSetup` side-effect import, `chartUiStore` initialization from persisted settings
- ✅ Updated `src/storeWiring.ts` — Added `chartUiStore.reset()` to `resetAllStores`
- ✅ Updated `src/utils/settingsMigration.ts` — v1→v2 migration for `selectedChartFields` and `rollingWindow`
- ✅ Updated `src/types/settings.ts` — Added `selectedChartFields: string[]`, `rollingWindow: number` to settings

#### Bug Fixes (post-testing)
- ✅ Fixed CalendarCell "View in timeline" — Added `timelineScrollToDate` to uiStore; CalendarCell sets target date, TimelineList scrolls to entry with pulse highlight animation
- ✅ Fixed chart date range filtering — `MetricChart` now reactively subscribes to `chartDateRange` and filters at render time; cache stores full data
- ✅ Fixed preset active detection — ChartsPanel matches current range to nearest preset within ±2 days
- ✅ Added custom date pickers to ChartsPanel — HTML date inputs for custom range selection
- ✅ Fixed CalendarCell and uiStore test references to old `activeMainTab` API
- ✅ Fixed settingsMigration tests for settingsVersion 2

### Files Changed (15 files):

| File | Change | Description |
|------|--------|-------------|
| `main.ts` | Modified | chartSetup import, chartUiStore init from settings |
| `src/components/MainApp.tsx` | Rewritten | Two-tier TabGroup routing, CalendarContent composition |
| `src/components/calendar/CalendarCell.tsx` | Modified | setActiveSubTab + timelineScrollToDate |
| `src/components/charts/ChartsPanel.tsx` | New | Charts sub-tab controls and MetricChart rendering |
| `src/components/charts/MetricChart.tsx` | New | Chart.js wrapper with theme reactivity, date range filter |
| `src/components/shared/TabGroup.tsx` | New | Two-tier tab navigation component |
| `src/components/sidebar/SparklineRow.tsx` | New | Sidebar sparkline row |
| `src/components/sidebar/TodayStatus.tsx` | Modified | Added sparkline rows for numeric fields |
| `src/components/timeline/EntryCard.tsx` | Modified | Added data-entry-date attribute |
| `src/components/timeline/TimelineList.tsx` | Modified | Scroll-to-date effect with highlight |
| `src/services/ChartDataService.ts` | New | Chart data transformations |
| `src/store/chartUiStore.ts` | New | Chart UI state management |
| `src/store/metricsCacheStore.ts` | Expanded | Full cache with granular invalidation |
| `src/store/uiStore.ts` | Modified | TabGroup/SubTab types, timelineScrollToDate |
| `src/storeWiring.ts` | Modified | chartUiStore reset |
| `src/styles/charts.css` | New | All chart, sparkline, tab, popover, highlight styles |
| `src/hooks/useMetrics.ts` | New | useMetrics, useChartData hooks |
| `src/utils/settingsMigration.ts` | Modified | v1→v2 migration |
| `src/types/settings.ts` | Modified | selectedChartFields, rollingWindow |
| `test/store/uiStore.test.ts` | Modified | Updated for TabGroup API |
| `test/utils/settingsMigration.test.ts` | Modified | Updated expectations for v2 |

### Testing Notes:
- All 18 test files passing (260 tests), zero regressions
- Lint + CSS build + tsc + esbuild all clean
- Bundle size: 377.9 KB (Chart.js tree-shaking effective)
- Grep gates pass: innerHTML (comment only), style={{ (VirtualList spacers + comment)
- Manually verified in Obsidian: tab groups, charts, sparklines, date range, timeline scroll-to-date

### Blockers/Issues:
- None discovered

### Next Steps:
- Phase 5c: Trend Alerts + Correlation Engine
- The Insights → Pulse and Digest sub-tabs are stubs ready for future phases
- The Explore → Lens, Threads, Gallery sub-tabs are stubs ready for future phases

## Next Session Prompt

```
Continue with Phase 5.5: Chart & Metrics Tests, followed by Phase 6a: Pulse + Heatmap + Personal Bests.

Key context:
- Phase 5c is complete. MetricsEngine, TrendAlertEngine, ScatterPlot, CorrelationCards,
  TrendAlertsPanel, field polarity, polarity-aware badges all working.
- Settings migration is at v3 (fieldPolarity added).
- metricsCacheStore is fully wired with correlation/alert caching.
- storeWiring has subscription #5 (fieldPolarity → full cache invalidation).
- ChartsPanel has 3 collapsible sections: Correlations, Scatter Plot, Trend Alerts.
- 18 test files passing, bundle under 400 KB.

Key files to reference:
- docs/development/Implementation Plan.md — Phase 5.5 and Phase 6a sections
- src/services/MetricsEngine.ts — Pearson correlation, conditional averages, weekly comparison
- src/services/TrendAlertEngine.ts — Consecutive change, anomaly, gap, pattern recall alerts
- src/store/metricsCacheStore.ts — Full caching for correlations, alerts, conditional insights
- src/components/charts/ChartsPanel.tsx — Collapsible sections with correlation/scatter/alerts
```

## Git Commit Message

```
feat(phase-5c): correlation discovery, trend alerts, field polarity

MetricsEngine:
- Create MetricsEngine.ts with pearsonCorrelation, conditionalAverage,
  findCorrelations (20-field cap with ranking), findConditionalInsights,
  weeklyComparison (hub-and-spoke via periodUtils)
- All functions are pure/stateless per architecture rules

TrendAlertEngine:
- Create TrendAlertEngine.ts with detectConsecutiveChange (3-day streaks),
  detectAnomaly (2-sigma), detectFieldGap (3+ days missing), patternRecall
- generateAlerts aggregates and caps at 5, sorted by severity
- Polarity-aware alert tone (positive vs warning based on fieldPolarity)

UI Components:
- Create ScatterPlot.tsx with Chart.js scatter, field dropdowns, optional
  boolean color-coding, regression line, Pearson r display, click-to-open
- Create CorrelationCards.tsx with debounced cache-miss computation,
  stale-result guard via generation token, click-to-scatter-plot
- Create TrendAlertCard.tsx with severity-coded left border, dismiss button
- Create TrendAlertsPanel.tsx with aria-live count, session dismissal
- Create insights.css with polished card styles, collapsible section headers

ChartsPanel Integration:
- Add collapsible Correlations, Scatter Plot, Trend Alerts sections
- Click correlation card pre-selects scatter plot fields and opens section

Badge Polarity:
- Add getPolarityColor to statsUtils for polarity-aware coloring
- Update CalendarCell, EntryCard (with BadgeSpan component), EchoCard
  to use polarity-aware badge backgrounds via ref-based CSS variables

Settings:
- Add fieldPolarity to HindsightSettings with v2-to-v3 migration
- Add Field configuration section to settings tab with polarity dropdowns
- Wire subscription #5 in storeWiring (fieldPolarity change invalidates cache)

Store Updates:
- metricsCacheStore: proper Phase 5c types, setters, cachedConditionalInsights
- chartUiStore: add analyzeAllFields session toggle

Tests: 18 test files passing, updated settingsMigration tests for v3
```

---

## 2026-03-09 - Phase 5c: Correlation Discovery + Trend Alerts + Field Polarity

**Focus:** Build MetricsEngine for cross-field analysis, TrendAlertEngine for proactive insights, field polarity settings, and polarity-aware badges across all components.

### Completed:

**Types & Settings Foundation:**
- ✅ Added types to `src/types/insights.ts` (AlertSeverity, TrendAlert, CorrelationResult, ConditionalInsight)
- ✅ Added `fieldPolarity` to `HindsightSettings` and `DEFAULT_SETTINGS`
- ✅ Updated barrel export in `src/types/index.ts`
- ✅ Settings migration v2→v3 (`migrateV2ToV3`, validation, version bump to `CURRENT_MAX_VERSION = 3`)

**New Services:**
- ✅ Created `src/services/MetricsEngine.ts` — pearsonCorrelation, conditionalAverage, findCorrelations (20-field cap with ranking), findConditionalInsights, weeklyComparison
- ✅ Created `src/services/TrendAlertEngine.ts` — detectConsecutiveChange, detectAnomaly, detectFieldGap, patternRecall, generateAlerts

**Utility Updates:**
- ✅ Added `getPolarityColor()` to `src/utils/statsUtils.ts` for polarity-aware badge/cell coloring

**Store Updates:**
- ✅ Updated `metricsCacheStore` with proper Phase 5c types, field name fixes, new setters, `cachedConditionalInsights`
- ✅ Updated `chartUiStore` with `analyzeAllFields` session toggle
- ✅ Added subscription #5 in `storeWiring.ts` (fieldPolarity → full cache invalidation)

**New UI Components:**
- ✅ Created `ScatterPlot.tsx` — Chart.js scatter, field dropdowns, boolean color-coding, regression line, click-to-open, theme reactivity
- ✅ Created `CorrelationCards.tsx` — debounced cache-miss computation, generation token guard, click-to-scatter-plot
- ✅ Created `TrendAlertCard.tsx` — severity-coded border, view entry link, dismiss button
- ✅ Created `TrendAlertsPanel.tsx` — cache reader, dismissal, aria-live count

**Existing Component Updates:**
- ✅ Updated `CalendarCell.tsx` — uses `getPolarityColor` with settings-driven polarity
- ✅ Updated `EntryCard.tsx` — added `BadgeSpan` with ref-based CSS variable polarity coloring
- ✅ Updated `EchoCard.tsx` — added ref-based metric badge polarity coloring
- ✅ Updated `ChartsPanel.tsx` — collapsible Correlations, Scatter Plot, Trend Alerts sections
- ✅ Updated `MainApp.tsx` — Pulse stub → Phase 6a

**Settings Tab:**
- ✅ Added Field configuration section with polarity dropdowns for all detected numeric fields

**Styles:**
- ✅ Created `insights.css` with polished correlation card styles (colored left border, hover lift, shadow), collapsible section headers (uppercase pill-shaped, accent arrow, reveal animation), trend alert cards, badge polarity support

### Files Changed:

| File | Status | Description |
|------|--------|-------------|
| `src/types/insights.ts` | Modified | AlertSeverity, TrendAlert, CorrelationResult, ConditionalInsight types |
| `src/types/settings.ts` | Modified | Added fieldPolarity to HindsightSettings |
| `src/types/index.ts` | Modified | Barrel export for insight types |
| `src/utils/settingsMigration.ts` | Modified | v2→v3 migration, fieldPolarity validation |
| `src/utils/statsUtils.ts` | Modified | Added getPolarityColor |
| `src/services/MetricsEngine.ts` | New | Correlation and statistical analysis service |
| `src/services/TrendAlertEngine.ts` | New | Trend alert detection service |
| `src/store/metricsCacheStore.ts` | Modified | Phase 5c types, setters, conditional insights |
| `src/store/chartUiStore.ts` | Modified | analyzeAllFields toggle |
| `src/storeWiring.ts` | Modified | Subscription #5 (fieldPolarity → cache invalidation) |
| `src/components/charts/ChartsPanel.tsx` | Modified | Collapsible sections for correlations, scatter, alerts |
| `src/components/charts/ScatterPlot.tsx` | New | Interactive scatter plot component |
| `src/components/charts/CorrelationCards.tsx` | New | Auto-generated correlation insight cards |
| `src/components/insights/TrendAlertCard.tsx` | New | Individual trend alert card |
| `src/components/insights/TrendAlertsPanel.tsx` | New | Trend alerts container with dismissal |
| `src/components/calendar/CalendarCell.tsx` | Modified | Polarity-aware cell coloring |
| `src/components/timeline/EntryCard.tsx` | Modified | BadgeSpan with polarity coloring |
| `src/components/echoes/EchoCard.tsx` | Modified | Polarity-aware metric badge |
| `src/components/MainApp.tsx` | Modified | Pulse stub → Phase 6a |
| `src/settings.ts` | Modified | Field configuration section with polarity dropdowns |
| `src/styles/insights.css` | New | All insight component styles |
| `src/styles/index.css` | Modified | Import insights.css |
| `test/utils/settingsMigration.test.ts` | Modified | Updated version assertions for v3 |

### Testing Notes:
- All 18 test files passing, zero regressions
- Lint + CSS build + tsc + esbuild all clean
- Grep gates pass: no innerHTML usage, no style={{}}, no console.log
- Manually verified in Obsidian: correlation cards display, scatter plot with field selection, trend alerts with dismissal, polarity badge colors, field configuration in settings
- CSS fix applied for button height clipping in Obsidian (height: auto + min-height: unset on correlation card buttons)

### Blockers/Issues:
- Obsidian base button styles clip content height — fixed by explicitly setting `height: auto` and `min-height: unset` on `.hindsight-correlation-card`

### Next Steps:
- Phase 5.5: Chart and Metrics Tests
- Phase 6a: Pulse + Heatmap + Personal Bests

---

## 2026-03-09 - Phase 5.5: Chart & Metrics Tests

**Focus:** Write comprehensive unit tests for ChartDataService, MetricsEngine, TrendAlertEngine, store lifecycle, command IDs, tiered sections, and cache invalidation.

### Completed:

#### Gap Analysis
- ✅ Analyzed existing test coverage — 5 of 10 planned test files already existed with sufficient coverage:
  - `yieldUtils.test.ts` (7 tests, all plan items covered)
  - `settingsMigration.test.ts` (13 tests, all plan items covered)
  - `fileNameParser.test.ts` (conflict file tests already present)
  - `vaultUtils.test.ts` (9 tests, covers planned `pathValidation.test.ts`)
  - `periodUtils.test.ts` (14 tests, all plan items covered)

#### New Test Files (7 files, 62 new tests)

| Test File | Tests | Description |
|-----------|-------|-------------|
| `test/services/ChartDataService.test.ts` | 11 | getTimeSeries (date-value pairs, null values, date range), rollingAverage (smoothing, nulls, oversized window), trendLine (positive/negative/flat slope), buildChartDataset, buildMultiMetricDataset |
| `test/services/MetricsEngine.test.ts` | 12 | pearsonCorrelation (perfect positive/negative/near-zero/null handling/insufficient data), conditionalAverage (correct averages/insufficient sample), findCorrelations (sorted, no self-correlation), findConditionalInsights, weeklyComparison (change calculation, missing data) |
| `test/services/TrendAlertEngine.test.ts` | 16 | detectConsecutiveChange (3-day/2-day/polarity variants), detectAnomaly (2-sigma/normal), detectFieldGap (high/low coverage), patternRecall (found/not found), generateAlerts (combined/capped/sorted), getPolarityColor (higher/lower/neutral) |
| `test/commands.test.ts` | 2 | Command IDs do not contain plugin manifest ID (Obsidian auto-prefixes), dynamically checks ALL registered commands |
| `test/store/storeLifecycle.test.ts` | 7 | journalStore.clear (Maps empty, sortedDates empty, revision increments), revision increments on all mutations, settingsStore/uiStore/appStore/metricsCacheStore/chartUiStore reset |
| `test/store/tieredSections.test.ts` | 7 | Hot tier full sections, cold tier empty sections with headings/excerpt, ensureSectionsLoaded (lazy-load, hot entry pass-through, missing file, concurrent dedup same path, concurrent independent paths) |
| `test/integration/cache-invalidation.test.ts` | 6 | Entry upsert increments revision, revision triggers markStale (via storeWiring debounce), invalidateCache (specific fields, full clear), stale flag reset, fresh data after invalidation |

#### Bug Fix
- ✅ Fixed `commands.test.ts` — manifest.json path was `../../manifest.json` (resolved to `obsidian-plugins/manifest.json`), corrected to `../manifest.json` (resolves to `hindsight-journal/manifest.json`)

### Files Changed:

**New Files (7):**
- `test/services/ChartDataService.test.ts`
- `test/services/MetricsEngine.test.ts`
- `test/services/TrendAlertEngine.test.ts`
- `test/commands.test.ts`
- `test/store/storeLifecycle.test.ts`
- `test/store/tieredSections.test.ts`
- `test/integration/cache-invalidation.test.ts`

### Testing Notes:
- ✅ All 25 test files passing (321 tests total, 62 new)
- ✅ `npm run lint` passes — zero errors, zero warnings
- ✅ No regressions from Phase 1-5c tests
- ✅ Test duration: 3.04s

### Blockers/Issues:
- **commands.test.ts path bug:** The `path.resolve(__dirname, '../../manifest.json')` in `commands.test.ts` went one directory too far up from `test/` to `obsidian-plugins/` instead of stopping at `hindsight-journal/`. Fixed by changing to `../manifest.json`.

### Design Notes:
- **Consolidated storeLifecycle.test.ts:** The plan explicitly requested a single file verifying all stores reset correctly with Map `.size === 0` checks, even though individual store tests already had some coverage. This provides a single verification point for the complete cleanup sequence.
- **tieredSections.test.ts mocking:** Uses appStore mock with a fake vault to test `ensureSectionsLoaded()` lazy-loading. The concurrent dedup test verifies that multiple callers for the same path share a single promise.
- **getPolarityColor in TrendAlertEngine tests:** The plan lists these tests under TrendAlertEngine.test.ts even though the function lives in statsUtils.ts. Tests import from statsUtils and are placed per the plan.

---

## Next Session Prompt

```
Phase 5.5 complete. All chart and metrics tests written and passing:
- 25 test files, 321 tests total, zero failures
- Lint gate passes with zero errors
- Full coverage of ChartDataService, MetricsEngine, TrendAlertEngine,
  store lifecycle, command IDs, tiered sections, and cache invalidation

Continue with Phase 6a: Pulse Dashboard + Heatmap + Personal Bests.

Key files to reference:
- docs/development/Implementation Plan.md — Phase 6a (line 3499+)
- src/services/PulseService.ts — Existing streak/consistency functions to expand
- src/store/metricsCacheStore.ts — Cache for personal bests
- src/components/charts/ — Existing chart components for patterns
```

## Git Commit Message

```
test(phase-5.5): chart and metrics test suite

ChartDataService Tests (11):
- getTimeSeries: date-value extraction, null values, date range filtering
- rollingAverage: 7-day smoothing, null handling, oversized window
- trendLine: positive/negative/flat slope detection
- buildChartDataset and buildMultiMetricDataset structure validation

MetricsEngine Tests (12):
- pearsonCorrelation: perfect positive/negative/near-zero/null/insufficient
- conditionalAverage: correct group averages, insufficient sample guard
- findCorrelations: sorted by r, no self-correlation
- findConditionalInsights and weeklyComparison with missing data

TrendAlertEngine Tests (16):
- detectConsecutiveChange: 3-day threshold, polarity-aware severity
- detectAnomaly: 2-sigma detection, normal value rejection
- detectFieldGap: coverage-gated alerts
- patternRecall, generateAlerts (combined/capped/sorted)
- getPolarityColor: higher-is-better/lower-is-better/neutral

Store and Integration Tests (22):
- storeLifecycle: all 6 stores reset correctly with Map size checks
- tieredSections: hot/cold tier, lazy-load, concurrent dedup
- cache-invalidation: revision wiring, granular invalidation
- commands: no plugin ID in command IDs

Fix commands.test.ts manifest path from ../../ to ../

25 test files, 321 tests passing, lint clean
```

---

## 2026-03-09 - Phase 6a: Pulse Dashboard + Heatmap + Personal Bests

**Focus:** Build the Insights → Pulse sub-tab with analytics dashboard, GitHub-style heatmap, personal bests, habit streaks, and consistency scoring.

### Completed:

**Types & Store:**
- ✅ Added `PersonalBest` interface to `src/types/insights.ts` (type, field, title, value, period)
- ✅ Added `PersonalBest` re-export to `src/types/index.ts` barrel
- ✅ Extended `metricsCacheStore.ts` with `cachedPersonalBests`, `personalBestsStale`, `setPersonalBests()`, `markPersonalBestsStale()` — included in all invalidation and reset paths
- ✅ Wired `markPersonalBestsStale()` into `storeWiring.ts` revision subscription

**Service Layer:**
- ✅ Expanded `PulseService.ts` from ~91 to ~445 lines with 4 new functions:
  - `getHeatmapData(entries, fieldKey, months)` — date→value mapping for N months
  - `getHabitStreaks(entries, booleanFields)` — per boolean field: 90-day array, current/longest streaks
  - `getPersonalBests(entries, fields, polarity)` — best week (rolling 7-day avg), most consistent month, best trend (windows [7, 14, 30])
  - `getConsistencyScores(entries, referenceDate, weekStartDay)` — thisWeek/thisMonth/allTime counts

**Components (6 new files):**
- ✅ `src/components/pulse/PulsePanel.tsx` — layout with collapsible sections, field selector dropdown for heatmap
- ✅ `src/components/pulse/StatsCards.tsx` — total entries, current streak, avg of first numeric field, this week count
- ✅ `src/components/pulse/PersonalBests.tsx` — cached in metricsCacheStore, 2s debounce recomputation
- ✅ `src/components/pulse/ConsistencyScore.tsx` — week/month/all-time with progress bars
- ✅ `src/components/charts/Heatmap.tsx` (~500 lines) — SVG heatmap with:
  - Event delegation, polarity-aware coloring via `getPolarityColor()`
  - React-rendered tooltip (positioned below cells)
  - Year navigation, color legend with 5 gradient swatches
  - Desktop drag-select via refs (imperative DOM), updates chartUiStore
  - Mobile: tap-to-show persistent tooltips, no drag
  - Keyboard nav: arrow keys + Enter
  - Accessibility: aria-labelledby + sr-only table
  - Field selector dropdown for switching between numeric/boolean fields
- ✅ `src/components/charts/HabitStreaksGrid.tsx` — SVG rows with per-cell aria-labels, memoized on revision

**Styles & Integration:**
- ✅ `src/styles/pulse.css` — 390+ lines (stats cards, heatmap, legend, habit grid, personal bests, consistency, sr-only, mobile dates)
- ✅ Added `@import './pulse.css'` to `src/styles/index.css`
- ✅ Replaced EmptyState stub with `<PulsePanel />` in `MainApp.tsx`

### Files Changed:
- **New:** `src/components/pulse/PulsePanel.tsx`, `StatsCards.tsx`, `PersonalBests.tsx`, `ConsistencyScore.tsx`
- **New:** `src/components/charts/Heatmap.tsx`, `HabitStreaksGrid.tsx`
- **New:** `src/styles/pulse.css`
- **Modified:** `src/types/insights.ts`, `src/types/index.ts`
- **Modified:** `src/store/metricsCacheStore.ts`, `src/storeWiring.ts`
- **Modified:** `src/services/PulseService.ts`
- **Modified:** `src/components/MainApp.tsx`
- **Modified:** `src/styles/index.css`
- **Modified:** `styles.css` (build output)

### Testing Notes:
- ✅ `npm run build` passes (lint + CSS + tsc + esbuild)
- ✅ 25 test files, 321 tests all passing — no regressions
- ✅ Grep gates clean: innerHTML (comment in chartSetup only), style={{ (VirtualList spacer + CalendarCell comment only), console.log (zero results)
- ✅ Brad manually tested in Obsidian: stats cards, heatmap, personal bests, consistency, habit streaks, tooltips, field selector dropdown

### UI Tweaks Applied During Session:
- Fixed tooltip positioning (above → below cells to avoid top-row clipping)
- Added color legend with gradient swatches showing fieldKey min–max
- Removed native browser tooltip from aria-label → aria-labelledby
- Added field selector dropdown to switch between numeric/boolean fields
- Reverted max-width: fit-content (broke short-year layouts)

### Bugs/Issues:
- Minor: Heatmap section has some excess horizontal scroll space after the SVG content. Cosmetic only, not breaking. Can revisit later.
- Future enhancement discussed: Support text fields containing numeric values (e.g., text "7" → treated as number for analytics). Estimated ~2-3 hours, would modify `JournalIndexService.detectFields()`.

### Next Steps:
- Phase 6b: Goals + Week Start Day + Settings Expansion
- Phase 6c: Weekly Review + Digest

---

## Next Session Prompt

```
Phase 6a complete. Pulse Dashboard deployed and verified:
- 6 new components, PulseService expanded with 4 analytics functions
- GitHub-style heatmap with field selector, drag-select, keyboard nav, legend
- Personal bests, consistency scores, habit streaks all working
- 25 test files, 321 tests, lint clean

Continue with Phase 6b: Goals + Week Start Day + Settings Expansion.

Key files to reference:
- docs/development/Implementation Plan.md — Phase 6b (after line 3661)
- src/components/pulse/ — New Pulse components
- src/types/settings.ts — Settings to expand
- src/store/settingsStore.ts — Settings store
```

## Git Commit Message

```
feat(phase-6a): pulse dashboard with heatmap, personal bests, and habit streaks

PulseService expanded with 4 analytics functions:
- getHeatmapData: date-to-value mapping for N months
- getHabitStreaks: boolean field 90-day tracking with current/longest streaks
- getPersonalBests: best week, most consistent month, best trend windows
- getConsistencyScores: week/month/all-time journaling consistency

New components:
- Heatmap: GitHub-style SVG with polarity coloring, drag-select, keyboard nav,
  year navigation, color legend, field selector dropdown, sr-only table
- HabitStreaksGrid: SVG rows per boolean field with aria-labels
- StatsCards: total entries, streak, average, this week count
- PersonalBests: cached in metricsCacheStore with 2s debounce
- ConsistencyScore: week/month/all-time with progress bars
- PulsePanel: collapsible layout container

Store and wiring:
- PersonalBest type added to insights.ts
- metricsCacheStore extended with personal bests caching
- storeWiring updated for personal bests staleness

8 modified files, 4 new files, 732 insertions
25 test files, 321 tests passing, lint clean
```

---

# Phase 6b: Goals + Today Tab Enhancements

## Session 1: Phase 6b — 2026-03-09

### What Was Done:
- **Settings v3→v4 migration:** Added `GoalConfig` interface, `goalTargets`, `prioritySectionHeading`, `weekStartDay` to `HindsightSettings` and `DEFAULT_SETTINGS`
- **Migration chain:** Added `migrateV3ToV4()` with validation for all 3 new fields (goalTargets validates period/target/type, target > 0 defense-in-depth, weekStartDay validates 0|1)
- **PulseService expanded:** Added `getGoalProgress()` (uses `getEntriesInPeriod()` for period scoping, supports sum/count types) and `getAdherenceRate()` (boolean field completion over N days)
- **4 new components created:**
  - `ProgressRing.tsx` — SVG progress ring with clamped rendering (0-1) but actual value display, CSS vars via refs, accessible
  - `GoalTracker.tsx` — Renders ProgressRings per configured goal, compact mode for sidebar
  - `MorningBriefing.tsx` — Yesterday metrics, 1-year echo excerpt, priorities from configurable heading, streak, boolean adherence rates
  - `GapAlerts.tsx` — Entry/field gap nudges (3+ day gaps, field-specific for >50% coverage fields), max 3 alerts
- **Settings tab expanded:** Goals section (add/edit/remove with field/period/target/type), Week start day dropdown, Morning briefing toggle, Priority section heading input
- **TodayStatus.tsx rewritten:** 5-section scrollable layout (entry status, goal rings, sparklines, gap alerts, morning briefing)
- **Styles:** New `goals.css` with progress ring, goal tracker, morning briefing, gap alert, and settings styles

### Files Changed:
**New files (4):**
- `src/components/charts/ProgressRing.tsx`
- `src/components/pulse/GoalTracker.tsx`
- `src/components/sidebar/MorningBriefing.tsx`
- `src/components/sidebar/GapAlerts.tsx`
- `src/styles/goals.css`

**Modified files (9):**
- `src/types/settings.ts` — GoalConfig interface, 3 new settings
- `src/types/index.ts` — Barrel export for GoalConfig
- `src/utils/settingsMigration.ts` — v3→v4 migration, validation, version bump
- `src/services/PulseService.ts` — getGoalProgress(), getAdherenceRate()
- `src/settings.ts` — Goals section, week start day, priority heading, morning briefing toggle
- `src/components/sidebar/TodayStatus.tsx` — 5-section layout with new components
- `src/styles/index.css` — @import goals.css
- `styles.css` — Built CSS output
- `test/utils/settingsMigration.test.ts` — Updated assertions for v4, added Phase 6b field checks

### Testing:
- ✅ `npm run lint` passes (zero errors)
- ✅ `npx tsc --noEmit` passes (zero type errors)
- ✅ `npm run build` passes (lint + CSS + tsc + esbuild)
- ✅ 25 test files, 321 tests all passing — no regressions
- ✅ Grep gates clean: innerHTML (chartSetup comment only), style={{ (CalendarCell/EntryCard comments only), console.log (zero results)
- ✅ Brad manually tested in Obsidian: goals settings, progress rings, morning briefing, gap alerts, week start day, scrollable Today tab

### Bugs/Issues:
- None discovered during this session

### Next Steps:
- Phase 6c: Widgets + Themes + Quality Dashboard
- Phase 6.5: Tests for Phase 6a-6c features

---

## Next Session Prompt

```
Phase 6b complete. Goals + Today Tab Enhancements deployed and verified:
- Settings v3→v4: goalTargets, prioritySectionHeading, weekStartDay
- PulseService expanded with getGoalProgress() and getAdherenceRate()
- 4 new components: ProgressRing, GoalTracker, MorningBriefing, GapAlerts
- TodayStatus rewritten with 5-section scrollable layout
- 25 test files, 321 tests, lint clean

Continue with Phase 6c: Widgets + Themes + Quality Dashboard.

Key files to reference:
- docs/development/Implementation Plan.md — Phase 6c (after line 3797)
- src/components/pulse/ — GoalTracker
- src/components/sidebar/ — MorningBriefing, GapAlerts, TodayStatus
- src/types/settings.ts — Settings interface (now v4)
```

## Git Commit Message

```
feat(phase-6b): goal tracking, morning briefing, and gap alerts for Today tab

Settings v3 to v4 migration:
- GoalConfig interface with period, target, type
- goalTargets, prioritySectionHeading, weekStartDay settings
- Full validation and migration chain

PulseService expanded with 2 functions:
- getGoalProgress: period-scoped sum/count with target comparison
- getAdherenceRate: boolean field completion over N days

New components:
- ProgressRing: SVG progress ring with clamped rendering, CSS var refs
- GoalTracker: renders progress rings per goal, compact sidebar mode
- MorningBriefing: yesterday metrics, echo excerpt, priorities, streak, adherence
- GapAlerts: entry/field gap nudges for high-coverage fields, max 3 alerts

Settings tab: Goals section with add/edit/remove, week start day dropdown,
morning briefing toggle, priority section heading input
TodayStatus: 5-section scrollable layout integrating all new components

9 modified files, 5 new files, 629 insertions
25 test files, 321 tests passing, lint clean
```

---

## 2026-03-09 - Phase 6i: Numeric-Text Field Type (Interjected)

**Focus:** Extend the plugin to detect and handle frontmatter text fields that contain numeric values, treating them equivalently to native number fields across all analytics, charts, and UI features.

### Completed:

**Type System:**
- ✅ Added `'numeric-text'` to the `FrontmatterField.type` union in `src/types/metrics.ts`

**Shared Helpers (FrontmatterService.ts):**
- ✅ `isNumericField(field)` — returns true for both `'number'` and `'numeric-text'` types
- ✅ `getNumericValue(raw)` — coerces native numbers and numeric strings to `number | null`

**Detection Logic (FrontmatterService.ts):**
- ✅ Updated `inferFieldType()` to detect numeric-text using an 80% threshold heuristic
- ✅ Fixed mixed-type detection: handles fields with native numbers in older entries (`anxiety: 6`) and quoted strings in newer entries (`anxiety: "3"`)
- ✅ Updated `detectFields()` to compute min/max ranges for numeric-text fields

**Service Updates (3 services):**
- ✅ `MetricsEngine.ts` — 6 filter sites + value coercion in conditionalAverage, weeklyComparison
- ✅ `TrendAlertEngine.ts` — 6 filter sites + value coercion in consecutive change, anomaly, pattern recall
- ✅ `PulseService.ts` — 5 filter sites + value coercion in heatmap, personal bests, goal progress

**Component Updates (12 components):**
- ✅ `MetricSelector.tsx` — metric dropdown includes numeric-text fields
- ✅ `ChartsPanel.tsx` — chart field selector includes numeric-text
- ✅ `ScatterPlot.tsx` — scatter axis selectors include numeric-text
- ✅ `CorrelationCards.tsx` — correlation count includes numeric-text
- ✅ `PulsePanel.tsx` — heatmap field selector includes numeric-text
- ✅ `StatsCards.tsx` — average calculation uses getNumericValue
- ✅ `TodayStatus.tsx` — sparkline fields include numeric-text
- ✅ `MorningBriefing.tsx` — yesterday metrics use getNumericValue
- ✅ `GapAlerts.tsx` — gap detection includes numeric-text
- ✅ `IndexFilters.tsx` — filter dropdowns include numeric-text
- ✅ `JournalIndex.tsx` — table columns include numeric-text
- ✅ `EntryCard.tsx` — badge display uses getNumericValue for polarity coloring

**Settings (settings.ts):**
- ✅ Polarity config dropdown includes numeric-text fields
- ✅ Goal config dropdown includes numeric-text fields

**Tests (FrontmatterService.test.ts):**
- ✅ 21 new tests: numeric-text detection (7), isNumericField (4), getNumericValue (7), range computation (1), time series coercion (1), mixed-type detection (1)

### Files Changed:
| File | Change |
|------|--------|
| `src/types/metrics.ts` | Added `'numeric-text'` to type union |
| `src/services/FrontmatterService.ts` | Helpers + detection logic (45 lines added) |
| `src/services/MetricsEngine.ts` | Filter + coercion updates |
| `src/services/TrendAlertEngine.ts` | Filter + coercion updates |
| `src/services/PulseService.ts` | Filter + coercion updates |
| `src/components/charts/ChartsPanel.tsx` | isNumericField filter |
| `src/components/charts/ScatterPlot.tsx` | isNumericField filter |
| `src/components/charts/CorrelationCards.tsx` | isNumericField filter |
| `src/components/shared/MetricSelector.tsx` | isNumericField filter |
| `src/components/pulse/PulsePanel.tsx` | isNumericField filter |
| `src/components/pulse/StatsCards.tsx` | isNumericField + getNumericValue |
| `src/components/sidebar/TodayStatus.tsx` | isNumericField filter |
| `src/components/sidebar/MorningBriefing.tsx` | isNumericField + getNumericValue |
| `src/components/sidebar/GapAlerts.tsx` | isNumericField filter |
| `src/components/index-table/IndexFilters.tsx` | isNumericField filter |
| `src/components/index-table/JournalIndex.tsx` | isNumericField filter |
| `src/components/timeline/EntryCard.tsx` | isNumericField + getNumericValue for badges |
| `src/settings.ts` | Expanded type checks for polarity + goals |
| `test/services/FrontmatterService.test.ts` | 21 new tests (135 lines added) |

### Testing Notes:
- ✅ 342 tests passing across 25 test files
- ✅ `npm run lint` clean
- ✅ `npm run build` clean (lint + CSS + tsc + esbuild)
- ✅ Brad manually verified in Obsidian: numeric-text fields appearing in charts, pulse, badges, settings

### Bugs/Issues:
- **Root cause bug found and fixed:** The initial implementation required ALL values to be strings before checking numeric-text. In Brad's vault, fields like `anxiety` had native numbers in 2023-2024 entries (`anxiety: 6`) but quoted strings in 2026 entries (`anxiety: "3"`). The mixed case fell through to `'string'`. Fixed by checking if ≥80% of ALL values (native numbers + string numbers combined) are parseable as finite numbers.

### Next Steps:
- Phase 6c: Widgets + Themes + Quality Dashboard
- Phase 6.5: Tests for Phase 6a-6c features

---

## Next Session Prompt

```
Phase 6i complete (interjected). Numeric-text field support deployed and verified:
- New type 'numeric-text' in FrontmatterField type union
- Shared helpers: isNumericField(), getNumericValue()
- inferFieldType detects text fields where >=80% of values parse as numbers
  (handles mixed native-number + string-number across entry generations)
- All 18 consumer files updated (3 services, 12 components, settings.ts)
- 342 tests, 25 test files, lint clean

Continue with Phase 6c: Widgets + Themes + Quality Dashboard.

Key files to reference:
- docs/development/Implementation Plan.md — Phase 6c (after line 3797)
- src/services/FrontmatterService.ts — isNumericField, getNumericValue helpers
- src/types/metrics.ts — FrontmatterField type union
```

## Git Commit Message

```
feat(phase-6i): numeric-text field type for text frontmatter with numeric values

New type and helpers:
- Added numeric-text to FrontmatterField type union
- isNumericField(field) returns true for number or numeric-text types
- getNumericValue(raw) coerces native numbers and numeric strings to number or null
- inferFieldType detects numeric-text when >=80% of values parse as finite numbers
- Handles mixed native-number + string-number across entry generations

Updated 15 consumer files:
- MetricsEngine: 6 filter sites + value coercion
- TrendAlertEngine: 6 filter sites + value coercion
- PulseService: 5 filter sites + value coercion
- 12 UI components: filter swaps + badge coercion in EntryCard
- settings.ts: polarity and goal config include numeric-text

Tests: 21 new tests for detection, helpers, range computation, mixed types
19 files changed, 246 insertions, 53 deletions
25 test files, 342 tests passing, lint clean
```
