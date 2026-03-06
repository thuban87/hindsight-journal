/**
 * Journal Store
 *
 * Zustand store holding all indexed journal entries, supporting
 * fast lookups by date, path, and month-day (for echoes).
 */

import { create } from 'zustand';
import type { JournalEntry, FrontmatterField, DateRange } from '../types';
import { formatDateISO, startOfDay } from '../utils/dateUtils';

interface IndexingProgress {
    /** Current indexing phase (1 = frontmatter only, 2 = full content) */
    phase: 1 | 2;
    /** Number of files processed in current phase */
    processed: number;
    /** Total files to process in current phase */
    total: number;
}

interface JournalState {
    /** All indexed entries, keyed by vault-relative file path */
    entries: Map<string, JournalEntry>;
    /** Date-keyed index for O(1) echo lookups. Key: "MM-DD", Value: entries for that day across all years */
    dateIndex: Map<string, JournalEntry[]>;
    /** Dates with entries, sorted ascending (for quick range lookups) */
    sortedDates: Date[];
    /** Cached sorted entries array (newest first). Invalidated on entry changes. */
    cachedSortedEntries: JournalEntry[] | null;
    /** Detected frontmatter fields across all entries */
    detectedFields: FrontmatterField[];
    /** Whether the initial scan is in progress */
    loading: boolean;
    /** Error message if scan failed */
    error: string | null;
    /** Indexing progress for pass 1/2 — used for progress bar UI */
    indexingProgress: IndexingProgress | null;
}

interface JournalActions {
    /** Bulk set all entries (pass 1). Builds dateIndex and sortedDates in one pass. */
    setEntries(entries: JournalEntry[]): void;
    /** Update a single entry. Uses binary insertion for sortedDates. Invalidates cache. */
    upsertEntry(entry: JournalEntry): void;
    /** Bulk update multiple entries (pass 2 batches). Sorts once at end. Invalidates cache. */
    upsertEntries(entries: JournalEntry[]): void;
    /** Remove an entry by file path. Invalidates cache. */
    removeEntry(filePath: string): void;
    /** Clear all entries and indexes (used by reconfigure). */
    clear(): void;
    setDetectedFields(fields: FrontmatterField[]): void;
    setLoading(loading: boolean): void;
    setError(error: string | null): void;
    setIndexingProgress(progress: IndexingProgress | null): void;

    /** Get entries within a date range (inclusive) */
    getEntriesInRange(range: DateRange): JournalEntry[];
    /** Get entry for a specific date (first match) */
    getEntryByDate(date: Date): JournalEntry | undefined;
    /**
     * Get all entries as a sorted array (newest first).
     * Returns a cached array — only rebuilds when entries actually change.
     * Components should use this instead of spreading entries.values().
     */
    getAllEntriesSorted(): JournalEntry[];
    /**
     * Get entries for a specific month-day across all years (for echoes).
     * O(1) lookup via dateIndex. Key format: "MM-DD".
     */
    getEntriesByMonthDay(monthDay: string): JournalEntry[];
}

/**
 * Build the "MM-DD" key for a date, used by dateIndex.
 */
function toMonthDayKey(date: Date): string {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}-${d}`;
}

/**
 * Binary search for insertion index into sortedDates (ascending).
 * Returns the index where the date should be inserted.
 */
function binaryInsertIndex(sortedDates: Date[], date: Date): number {
    const target = date.getTime();
    let low = 0;
    let high = sortedDates.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (sortedDates[mid].getTime() < target) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return low;
}

export const useJournalStore = create<JournalState & JournalActions>((set, get) => ({
    entries: new Map(),
    dateIndex: new Map(),
    sortedDates: [],
    cachedSortedEntries: null,
    detectedFields: [],
    loading: false,
    error: null,
    indexingProgress: null,

    setEntries(entries: JournalEntry[]): void {
        const entriesMap = new Map<string, JournalEntry>();
        const dateIndex = new Map<string, JournalEntry[]>();
        const dates: Date[] = [];

        for (const entry of entries) {
            entriesMap.set(entry.filePath, entry);

            const key = toMonthDayKey(entry.date);
            if (!dateIndex.has(key)) {
                dateIndex.set(key, []);
            }
            dateIndex.get(key)!.push(entry);

            dates.push(entry.date);
        }

        // Sort dates ascending once
        dates.sort((a, b) => a.getTime() - b.getTime());

        set({
            entries: entriesMap,
            dateIndex,
            sortedDates: dates,
            cachedSortedEntries: null,
        });
    },

    upsertEntry(entry: JournalEntry): void {
        const state = get();
        const newEntries = new Map(state.entries);
        const existingEntry = newEntries.get(entry.filePath);
        newEntries.set(entry.filePath, entry);

        // Update dateIndex
        const newDateIndex = new Map(state.dateIndex);
        const key = toMonthDayKey(entry.date);

        if (existingEntry) {
            // Remove old entry from dateIndex if date changed
            const oldKey = toMonthDayKey(existingEntry.date);
            if (oldKey !== key) {
                const oldList = newDateIndex.get(oldKey);
                if (oldList) {
                    const filtered = oldList.filter(e => e.filePath !== entry.filePath);
                    if (filtered.length > 0) {
                        newDateIndex.set(oldKey, filtered);
                    } else {
                        newDateIndex.delete(oldKey);
                    }
                }
            }
        }

        // Add/update in dateIndex
        const list = newDateIndex.get(key) ?? [];
        const existingIdx = list.findIndex(e => e.filePath === entry.filePath);
        if (existingIdx >= 0) {
            list[existingIdx] = entry;
        } else {
            list.push(entry);
        }
        newDateIndex.set(key, list);

        // Update sortedDates with binary insertion
        let newSortedDates = [...state.sortedDates];
        if (!existingEntry) {
            // New entry — binary insert
            const idx = binaryInsertIndex(newSortedDates, entry.date);
            newSortedDates.splice(idx, 0, entry.date);
        } else if (formatDateISO(existingEntry.date) !== formatDateISO(entry.date)) {
            // Date changed — remove old, insert new
            newSortedDates = newSortedDates.filter(
                d => formatDateISO(d) !== formatDateISO(existingEntry.date)
            );
            const idx = binaryInsertIndex(newSortedDates, entry.date);
            newSortedDates.splice(idx, 0, entry.date);
        }

        set({
            entries: newEntries,
            dateIndex: newDateIndex,
            sortedDates: newSortedDates,
            cachedSortedEntries: null,
        });
    },

    upsertEntries(entries: JournalEntry[]): void {
        const state = get();
        const newEntries = new Map(state.entries);
        const newDateIndex = new Map(state.dateIndex);
        let datesChanged = false;

        for (const entry of entries) {
            const existingEntry = newEntries.get(entry.filePath);
            newEntries.set(entry.filePath, entry);

            const key = toMonthDayKey(entry.date);

            if (existingEntry) {
                const oldKey = toMonthDayKey(existingEntry.date);
                if (oldKey !== key) {
                    datesChanged = true;
                    const oldList = newDateIndex.get(oldKey);
                    if (oldList) {
                        const filtered = oldList.filter(e => e.filePath !== entry.filePath);
                        if (filtered.length > 0) {
                            newDateIndex.set(oldKey, filtered);
                        } else {
                            newDateIndex.delete(oldKey);
                        }
                    }
                }
            } else {
                datesChanged = true;
            }

            const list = newDateIndex.get(key) ?? [];
            const existingIdx = list.findIndex(e => e.filePath === entry.filePath);
            if (existingIdx >= 0) {
                list[existingIdx] = entry;
            } else {
                list.push(entry);
            }
            newDateIndex.set(key, list);
        }

        // Rebuild sortedDates only if dates actually changed
        let newSortedDates = state.sortedDates;
        if (datesChanged) {
            const allDates = Array.from(newEntries.values()).map(e => e.date);
            allDates.sort((a, b) => a.getTime() - b.getTime());
            newSortedDates = allDates;
        }

        set({
            entries: newEntries,
            dateIndex: newDateIndex,
            sortedDates: newSortedDates,
            cachedSortedEntries: null,
        });
    },

    removeEntry(filePath: string): void {
        const state = get();
        const entry = state.entries.get(filePath);
        if (!entry) return;

        const newEntries = new Map(state.entries);
        newEntries.delete(filePath);

        // Remove from dateIndex
        const newDateIndex = new Map(state.dateIndex);
        const key = toMonthDayKey(entry.date);
        const list = newDateIndex.get(key);
        if (list) {
            const filtered = list.filter(e => e.filePath !== filePath);
            if (filtered.length > 0) {
                newDateIndex.set(key, filtered);
            } else {
                newDateIndex.delete(key);
            }
        }

        // Remove from sortedDates
        const entryDateISO = formatDateISO(entry.date);
        const newSortedDates = state.sortedDates.filter(
            d => formatDateISO(d) !== entryDateISO
        );

        set({
            entries: newEntries,
            dateIndex: newDateIndex,
            sortedDates: newSortedDates,
            cachedSortedEntries: null,
        });
    },

    clear(): void {
        set({
            entries: new Map(),
            dateIndex: new Map(),
            sortedDates: [],
            cachedSortedEntries: null,
            detectedFields: [],
            loading: false,
            error: null,
            indexingProgress: null,
        });
    },

    setDetectedFields(fields: FrontmatterField[]): void {
        set({ detectedFields: fields });
    },

    setLoading(loading: boolean): void {
        set({ loading });
    },

    setError(error: string | null): void {
        set({ error });
    },

    setIndexingProgress(progress: IndexingProgress | null): void {
        set({ indexingProgress: progress });
    },

    getEntriesInRange(range: DateRange): JournalEntry[] {
        const state = get();
        const start = startOfDay(range.start).getTime();
        const end = startOfDay(range.end).getTime();
        const result: JournalEntry[] = [];

        for (const entry of state.entries.values()) {
            const entryTime = startOfDay(entry.date).getTime();
            if (entryTime >= start && entryTime <= end) {
                result.push(entry);
            }
        }

        // Sort newest first
        result.sort((a, b) => b.date.getTime() - a.date.getTime());
        return result;
    },

    getEntryByDate(date: Date): JournalEntry | undefined {
        const state = get();
        const targetISO = formatDateISO(date);
        for (const entry of state.entries.values()) {
            if (formatDateISO(entry.date) === targetISO) {
                return entry;
            }
        }
        return undefined;
    },

    getAllEntriesSorted(): JournalEntry[] {
        const state = get();
        if (state.cachedSortedEntries !== null) {
            return state.cachedSortedEntries;
        }
        const sorted = Array.from(state.entries.values())
            .sort((a, b) => b.date.getTime() - a.date.getTime());
        // Cache the result — set won't trigger re-render since we're in an action
        // We mutate state directly to avoid infinite loops
        (state as JournalState).cachedSortedEntries = sorted;
        return sorted;
    },

    getEntriesByMonthDay(monthDay: string): JournalEntry[] {
        return get().dateIndex.get(monthDay) ?? [];
    },
}));
