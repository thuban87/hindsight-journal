/**
 * Section Reader Data Hook
 *
 * Owns all data logic for the Section Reader:
 * - Derives available section headings from journalStore entries
 * - Filters entries by selected heading + date range
 * - Two-tier search: hot entries in-memory, cold entries via ensureSectionsLoaded
 *   with 5-concurrent sliding window
 * - Debounced search query (300ms)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useJournalStore } from '../store/journalStore';
import type { JournalEntry } from '../types/journal';

export type DateRangePreset = 'last30' | 'last90' | 'all' | 'custom';

interface SectionReaderData {
    /** All detected section headings across entries */
    availableHeadings: string[];
    /** Currently selected heading */
    selectedHeading: string;
    /** Set the selected heading */
    setSelectedHeading: (h: string) => void;
    /** Date range preset */
    dateRange: DateRangePreset;
    /** Set date range */
    setDateRange: (r: DateRangePreset) => void;
    /** Custom start date (YYYY-MM-DD string for input binding) */
    customStartDate: string;
    /** Set custom start date */
    setCustomStartDate: (d: string) => void;
    /** Custom end date (YYYY-MM-DD string for input binding) */
    customEndDate: string;
    /** Set custom end date */
    setCustomEndDate: (d: string) => void;
    /** Search query (raw input) */
    searchQuery: string;
    /** Set search query */
    setSearchQuery: (q: string) => void;
    /** Filtered/searched entries (newest first) */
    filteredEntries: JournalEntry[];
    /** Whether a cold-entry search is in progress */
    isSearching: boolean;
    /** Search result footer info */
    searchFooter: string | null;
    /** Whether simple (plain text) view is active */
    simpleView: boolean;
    /** Toggle simple view */
    setSimpleView: (v: boolean) => void;
    /** Context version — increments on heading/dateRange change to reset VirtualVariableList */
    contextVersion: number;
}

/** Format today as YYYY-MM-DD for date input defaults */
function toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface DateBounds {
    start: Date | null;
    end: Date | null;
}

/**
 * Compute the date bounds for a range preset or custom dates.
 */
function getDateBounds(
    preset: DateRangePreset,
    customStart: string,
    customEnd: string
): DateBounds {
    if (preset === 'all') return { start: null, end: null };
    if (preset === 'custom') {
        return {
            start: customStart ? new Date(customStart + 'T00:00:00') : null,
            end: customEnd ? new Date(customEnd + 'T23:59:59') : null,
        };
    }
    const now = new Date();
    const days = preset === 'last30' ? 30 : 90;
    return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days),
        end: null,
    };
}

export function useSectionReaderData(): SectionReaderData {
    const entries = useJournalStore(s => s.entries);
    const revision = useJournalStore(s => s.revision);

    const [selectedHeading, setSelectedHeading] = useState('');
    const [dateRange, setDateRange] = useState<DateRangePreset>('last90');
    const [customStartDate, setCustomStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return toDateString(d);
    });
    const [customEndDate, setCustomEndDate] = useState(() => toDateString(new Date()));
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchFooter, setSearchFooter] = useState<string | null>(null);
    const [simpleView, setSimpleView] = useState(false);
    const [contextVersion, setContextVersion] = useState(0);

    // Debounce search query (300ms)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Collect all section headings
    const availableHeadings = useMemo(() => {
        const headingSet = new Set<string>();
        for (const entry of entries.values()) {
            // Hot-tier: get from sections keys
            if (entry.sections && Object.keys(entry.sections).length > 0) {
                for (const key of Object.keys(entry.sections)) {
                    headingSet.add(key);
                }
            }
            // Cold-tier: get from sectionHeadings
            if (entry.sectionHeadings) {
                for (const h of entry.sectionHeadings) {
                    headingSet.add(h);
                }
            }
        }
        return Array.from(headingSet).sort();
    }, [entries, revision]);

    // Auto-select first heading when available
    useEffect(() => {
        if (!selectedHeading && availableHeadings.length > 0) {
            setSelectedHeading(availableHeadings[0]);
        }
    }, [availableHeadings, selectedHeading]);

    // Increment context version on heading/dateRange change
    const handleSetHeading = useCallback((h: string) => {
        setSelectedHeading(h);
        setContextVersion(v => v + 1);
    }, []);

    const handleSetDateRange = useCallback((r: DateRangePreset) => {
        setDateRange(r);
        setContextVersion(v => v + 1);
    }, []);

    const handleSetCustomStart = useCallback((d: string) => {
        setCustomStartDate(d);
        setDateRange('custom');
        setContextVersion(v => v + 1);
    }, []);

    const handleSetCustomEnd = useCallback((d: string) => {
        setCustomEndDate(d);
        setDateRange('custom');
        setContextVersion(v => v + 1);
    }, []);

    // Generation token for stale-result guard
    const generationRef = useRef(0);

    // Filter entries by heading + date range, then search
    const baseEntries = useMemo(() => {
        if (!selectedHeading) return [];

        const bounds = getDateBounds(dateRange, customStartDate, customEndDate);
        const result: JournalEntry[] = [];

        for (const entry of entries.values()) {
            // Date filter
            if (bounds.start && entry.date < bounds.start) continue;
            if (bounds.end && entry.date > bounds.end) continue;

            // Heading filter: check hot-tier sections or cold-tier sectionHeadings
            const hasHeadingHot = entry.sections && selectedHeading in entry.sections;
            const hasHeadingCold = entry.sectionHeadings?.includes(selectedHeading);

            if (hasHeadingHot || hasHeadingCold) {
                result.push(entry);
            }
        }

        // Sort newest first
        result.sort((a, b) => b.date.getTime() - a.date.getTime());
        return result;
    }, [selectedHeading, dateRange, customStartDate, customEndDate, entries, revision]);

    // State for search-filtered results
    const [searchResults, setSearchResults] = useState<JournalEntry[] | null>(null);

    // Search logic with two-tier cold entry loading
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setSearchResults(null);
            setSearchFooter(null);
            setIsSearching(false);
            return;
        }

        const token = ++generationRef.current;
        const query = debouncedQuery.toLowerCase().trim();
        const terms = query.split(/\s+/).filter(t => t.length > 0);

        const runSearch = async (): Promise<void> => {
            setIsSearching(true);
            const results: JournalEntry[] = [];
            let hotCount = 0;
            let coldSearched = 0;
            let totalCold = 0;

            // Hot entries: search in-memory sections
            const coldEntries: JournalEntry[] = [];
            for (const entry of baseEntries) {
                const content = entry.sections?.[selectedHeading];
                if (content && content.length > 0) {
                    hotCount++;
                    const lower = content.toLowerCase();
                    if (terms.every(t => lower.includes(t))) {
                        results.push(entry);
                    }
                } else {
                    coldEntries.push(entry);
                    totalCold++;
                }
            }

            // Cold entries: load sections with concurrency limit
            if (coldEntries.length > 0) {
                const startTime = performance.now();
                const timeout = 10000; // 10s timeout
                const concurrency = 5;
                let i = 0;

                while (i < coldEntries.length && performance.now() - startTime < timeout) {
                    if (token !== generationRef.current) return; // stale

                    const batch = coldEntries.slice(i, i + concurrency);
                    const loadResults = await Promise.allSettled(
                        batch.map(e =>
                            useJournalStore.getState().ensureSectionsLoaded(e.filePath)
                        )
                    );

                    for (let j = 0; j < loadResults.length; j++) {
                        const result = loadResults[j];
                        if (result.status === 'fulfilled' && result.value) {
                            coldSearched++;
                            const loaded = result.value;
                            const content = loaded.sections?.[selectedHeading];
                            if (content) {
                                const lower = content.toLowerCase();
                                if (terms.every(t => lower.includes(t))) {
                                    results.push(loaded);
                                }
                            }
                        }
                    }

                    i += concurrency;
                }
            }

            if (token !== generationRef.current) return; // stale

            // Sort results newest first
            results.sort((a, b) => b.date.getTime() - a.date.getTime());
            setSearchResults(results);

            // Build footer
            if (totalCold > 0) {
                const unsearched = totalCold - coldSearched;
                if (unsearched > 0) {
                    setSearchFooter(
                        `Searched ${hotCount} recent entries and ${coldSearched} older entries. ` +
                        `${unsearched} older entries were not searched — narrow your date range for complete results.`
                    );
                } else {
                    setSearchFooter(
                        `Searched ${hotCount + coldSearched} entries.`
                    );
                }
            } else {
                setSearchFooter(null);
            }

            setIsSearching(false);
        };

        void runSearch();

        return () => {
            generationRef.current++;
        };
    }, [debouncedQuery, baseEntries, selectedHeading]);

    const filteredEntries = searchResults ?? baseEntries;

    return {
        availableHeadings,
        selectedHeading,
        setSelectedHeading: handleSetHeading,
        dateRange,
        setDateRange: handleSetDateRange,
        customStartDate,
        setCustomStartDate: handleSetCustomStart,
        customEndDate,
        setCustomEndDate: handleSetCustomEnd,
        searchQuery,
        setSearchQuery,
        filteredEntries,
        isSearching,
        searchFooter,
        simpleView,
        setSimpleView,
        contextVersion,
    };
}
