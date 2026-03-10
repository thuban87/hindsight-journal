/**
 * Lens Store
 *
 * Dedicated Zustand store for Lens panel UI state.
 * Saved filters persist in HindsightSettings (data.json), not here.
 */

import { create } from 'zustand';
import type { JournalEntry, LensFilterRow } from '../types';

interface LensState {
    /** Current search query text */
    searchQuery: string;
    /** Active filter rows (AND logic) */
    activeFilters: LensFilterRow[];
    /** Search results (filtered entries) */
    results: JournalEntry[];
    /** Total count of matching results */
    resultCount: number;
    /** Whether a search is currently running */
    isSearching: boolean;
    /** Generation token for stale-result guard */
    generationToken: number;
    /** Currently selected saved filter ID (name) */
    selectedFilterId: string | null;
    /** Whether full-content search is enabled */
    fullContentSearch: boolean;
}

interface LensActions {
    setSearchQuery: (query: string) => void;
    setActiveFilters: (filters: LensFilterRow[]) => void;
    addFilter: (filter: LensFilterRow) => void;
    removeFilter: (index: number) => void;
    updateFilter: (index: number, filter: LensFilterRow) => void;
    setResults: (results: JournalEntry[], count: number) => void;
    setIsSearching: (searching: boolean) => void;
    nextGeneration: () => number;
    setSelectedFilterId: (id: string | null) => void;
    setFullContentSearch: (enabled: boolean) => void;
    clearAll: () => void;
    reset: () => void;
}

const INITIAL_STATE: LensState = {
    searchQuery: '',
    activeFilters: [],
    results: [],
    resultCount: 0,
    isSearching: false,
    generationToken: 0,
    selectedFilterId: null,
    fullContentSearch: false,
};

export const useLensStore = create<LensState & LensActions>((set, get) => ({
    ...INITIAL_STATE,

    setSearchQuery: (query: string) => set({ searchQuery: query.substring(0, 200) }),

    setActiveFilters: (filters: LensFilterRow[]) => set({ activeFilters: filters }),

    addFilter: (filter: LensFilterRow) => set(s => ({
        activeFilters: [...s.activeFilters, filter],
    })),

    removeFilter: (index: number) => set(s => ({
        activeFilters: s.activeFilters.filter((_, i) => i !== index),
    })),

    updateFilter: (index: number, filter: LensFilterRow) => set(s => ({
        activeFilters: s.activeFilters.map((f, i) => i === index ? filter : f),
    })),

    setResults: (results: JournalEntry[], count: number) => set({
        results,
        resultCount: count,
        isSearching: false,
    }),

    setIsSearching: (searching: boolean) => set({ isSearching: searching }),

    nextGeneration: () => {
        const next = get().generationToken + 1;
        set({ generationToken: next });
        return next;
    },

    setSelectedFilterId: (id: string | null) => set({ selectedFilterId: id }),

    setFullContentSearch: (enabled: boolean) => set({ fullContentSearch: enabled }),

    clearAll: () => set({
        searchQuery: '',
        activeFilters: [],
        results: [],
        resultCount: 0,
        isSearching: false,
        selectedFilterId: null,
    }),

    reset: () => set(INITIAL_STATE),
}));
