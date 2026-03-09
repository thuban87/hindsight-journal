/**
 * Journal Store
 *
 * Zustand store holding all indexed journal entries, supporting
 * fast lookups by date, path, and month-day (for echoes).
 */

import { create } from 'zustand';
import type { JournalEntry, FrontmatterField, DateRange } from '../types';
import { formatDateISO, startOfDay } from '../utils/dateUtils';
import { useAppStore } from './appStore';
import { parseSections } from '../services/SectionParserService';
import { debugLog } from '../utils/debugLog';

/**
 * Module-level in-flight promise map for ensureSectionsLoaded() deduplication.
 * NOT part of Zustand state — Promise is not serializable/immutable-update-friendly.
 * See A22 design decision in Plan-Wide Rules.
 */
const inFlightSectionLoads = new Map<string, Promise<JournalEntry>>();

/**
 * Clear the in-flight map. Called from resetAllStores() during plugin unload
 * and from test beforeEach to prevent inter-test state leaks.
 */
export function clearInFlightMap(): void {
    inFlightSectionLoads.clear();
}

interface IndexingProgress {
    /** Current indexing phase (1 = frontmatter only, 2 = full content) */
    phase: 1 | 2;
    /** Number of files processed in current phase */
    processed: number;
    /** Total files to process in current phase */
    total: number;
}

interface JournalState {
    /** All indexed journal entries, keyed by filePath */
    entries: Map<string, JournalEntry>;
    /** Date index for O(1) echo lookups. Key: "MM-DD" → entries on that month-day */
    dateIndex: Map<string, JournalEntry[]>;
    /** Sorted array of unique entry dates (ascending) for streak/range calculations */
    sortedDates: Date[];
    /** Cached sorted entries array (newest first). Invalidated on mutations. */
    cachedSortedEntries: JournalEntry[] | null;
    /** Detected frontmatter fields with types and ranges */
    detectedFields: FrontmatterField[];
    /** Whether initial indexing is in progress */
    loading: boolean;
    /** Error message from the last indexing operation */
    error: string | null;
    /** Current indexing progress (phase, processed count, total count) */
    indexingProgress: IndexingProgress | null;
    /** Monotonically increasing counter — incremented on every store mutation.
     *  Provides a cheap change signal for downstream cache invalidation. */
    revision: number;
    /** Whether the detected schema (field keys) has changed since last detectFields().
     *  Set true when a file watcher detects added/removed frontmatter keys. */
    schemaDirty: boolean;
    /** Accumulated changed field keys since last clearPendingChanges().
     *  Used for granular cache invalidation — only clear caches for fields that changed. */
    pendingChangedFieldKeys: Set<string>;
    /** When true, next invalidation should clear ALL field caches (bulk change). */
    fullInvalidation: boolean;
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
    setSchemaDirty(dirty: boolean): void;
    /** Clear accumulated pending changes after they've been consumed by cache invalidation. */
    clearPendingChanges(): void;
    /** Reset store to initial state (called from plugin.onunload()). */
    reset(): void;

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
    /**
     * Lazy-load full sections for a cold-tier entry.
     * Returns the entry with sections populated. Uses in-flight promise
     * deduplication to prevent duplicate vault.cachedRead() calls when
     * SectionReader and Lens request the same entry simultaneously.
     */
    ensureSectionsLoaded(filePath: string): Promise<JournalEntry | null>;
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
    revision: 0,
    schemaDirty: false,
    pendingChangedFieldKeys: new Set<string>(),
    fullInvalidation: false,

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

        set((state) => ({
            entries: entriesMap,
            dateIndex,
            sortedDates: dates,
            cachedSortedEntries: null,
            revision: state.revision + 1,
            fullInvalidation: true,
        }));
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

        // Accumulate changed field keys for granular cache invalidation
        const changedKeys = new Set(get().pendingChangedFieldKeys);
        for (const key of Object.keys(entry.frontmatter)) {
            changedKeys.add(key);
        }

        set(state => ({
            entries: newEntries,
            dateIndex: newDateIndex,
            sortedDates: newSortedDates,
            cachedSortedEntries: null,
            revision: state.revision + 1,
            pendingChangedFieldKeys: changedKeys,
        }));
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

        set(state => ({
            entries: newEntries,
            dateIndex: newDateIndex,
            sortedDates: newSortedDates,
            cachedSortedEntries: null,
            revision: state.revision + 1,
            fullInvalidation: true,
        }));
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

        set(state => ({
            entries: newEntries,
            dateIndex: newDateIndex,
            sortedDates: newSortedDates,
            cachedSortedEntries: null,
            revision: state.revision + 1,
            fullInvalidation: true,
        }));
    },

    clear(): void {
        set(state => ({
            entries: new Map(),
            dateIndex: new Map(),
            sortedDates: [],
            cachedSortedEntries: null,
            detectedFields: [],
            loading: false,
            error: null,
            indexingProgress: null,
            revision: state.revision + 1,
            fullInvalidation: true,
        }));
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

    setSchemaDirty(dirty: boolean): void {
        set({ schemaDirty: dirty });
    },

    clearPendingChanges(): void {
        set({ pendingChangedFieldKeys: new Set<string>(), fullInvalidation: false });
    },

    reset(): void {
        set({
            entries: new Map(),
            dateIndex: new Map(),
            sortedDates: [],
            cachedSortedEntries: null,
            detectedFields: [],
            loading: false,
            error: null,
            indexingProgress: null,
            revision: 0,
            schemaDirty: false,
            pendingChangedFieldKeys: new Set<string>(),
            fullInvalidation: false,
        });
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

    async ensureSectionsLoaded(filePath: string): Promise<JournalEntry | null> {
        const entry = get().entries.get(filePath);
        if (!entry) return null;

        // Hot-tier entry already has full sections
        if (Object.keys(entry.sections).length > 0) return entry;

        // Check if a load is already in progress for this file
        const existing = inFlightSectionLoads.get(filePath);
        if (existing) return existing;

        // Start a new load
        const loadPromise = (async (): Promise<JournalEntry> => {
            try {
                const app = useAppStore.getState().app;
                if (!app) return entry;

                const file = app.vault.getFileByPath(filePath);
                if (!file) {
                    debugLog('ensureSectionsLoaded: file not found', filePath);
                    return entry;
                }

                const content = await app.vault.cachedRead(file);
                const sections = parseSections(content);

                // Create an updated entry with sections populated
                const updatedEntry: JournalEntry = {
                    ...entry,
                    sections,
                };

                // Update the store with the loaded sections
                get().upsertEntry(updatedEntry);

                return updatedEntry;
            } finally {
                inFlightSectionLoads.delete(filePath);
            }
        })();

        inFlightSectionLoads.set(filePath, loadPromise);
        return loadPromise;
    },
}));
