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

## Next Session Prompt

```
Phase 3 + 3.5 complete. Full-page view with calendar is deployed and tested.
152 total tests passing across 9 test files.

Continue with Phase 4: Timeline + Journal Index
- TimelineList (paginated entry card feed)
- VirtualList (lightweight virtual scroll)
- EntryCard (date, badges, excerpt, tags)
- JournalIndex (sortable data table)
- IndexFilters (search, date range, field filters)
- uiStore updates (indexSort, indexFilters)
- timeline.css + shared table styles

Key files to reference:
- docs/development/Implementation Plan.md — Phase 4 details (line 1665)
- src/components/MainApp.tsx — Replace Timeline/Index stubs with real components
- src/store/uiStore.ts — Needs indexSort and indexFilters state
```
