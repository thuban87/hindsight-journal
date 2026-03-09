/**
 * UI Store
 *
 * Zustand store for UI state that needs to persist across
 * component re-renders but not across plugin reloads.
 */

import { create } from 'zustand';
import type { DateRange } from '../types';

/** A single field filter for the index table */
interface FieldFilter {
    field: string;
    operator: '>=' | '<=' | '=';
    value: number;
}

interface UIState {
    /** Active tab in the sidebar view */
    activeSidebarTab: 'today' | 'echoes';
    /** Which section heading to display as excerpt on echo cards (null = auto-detect) */
    echoSectionKey: string | null;
    /** Which frontmatter field to show as the badge on echo cards (default: 'mood') */
    echoMetricKey: string;
    /** Which section heading to display as excerpt on timeline cards (null = auto-detect) */
    timelineSectionKey: string | null;

    /** Active tab in the main full-page view */
    activeMainTab: 'calendar' | 'timeline' | 'index';
    /** Currently displayed calendar month (0-11) */
    calendarMonth: number;
    /** Currently displayed calendar year */
    calendarYear: number;
    /** Selected frontmatter field key for calendar color-coding (null = none) */
    selectedMetric: string | null;

    /** Index table sort state */
    indexSort: { field: string; direction: 'asc' | 'desc' };
    /** Index table filter state */
    indexFilters: {
        search: string;
        dateRange: DateRange | null;
        fieldFilters: FieldFilter[];
    };

    /** Set the active sidebar tab */
    setActiveSidebarTab(tab: 'today' | 'echoes'): void;
    /** Set the section key for echo card excerpts */
    setEchoSectionKey(key: string | null): void;
    /** Set the frontmatter metric key for echo card badges */
    setEchoMetricKey(key: string): void;
    /** Set the section key for timeline card excerpts */
    setTimelineSectionKey(key: string | null): void;
    /** Set the active main view tab */
    setActiveMainTab(tab: 'calendar' | 'timeline' | 'index'): void;
    /** Set the calendar month and year */
    setCalendarMonth(month: number, year: number): void;
    /** Set the selected metric for calendar color-coding */
    setSelectedMetric(metric: string | null): void;
    /** Toggle sort direction if same field, set asc if new field */
    setIndexSort(field: string): void;
    /** Set the text search filter */
    setSearchFilter(search: string): void;
    /** Set the date range filter (null clears) */
    setDateRangeFilter(range: DateRange | null): void;
    /** Add a numeric field filter */
    addFieldFilter(field: string, operator: '>=' | '<=' | '=', value: number): void;
    /** Remove a field filter by index */
    removeFieldFilter(index: number): void;
    /** Reset all filters to defaults */
    clearAllFilters(): void;
    /** Reset entire UI state to defaults (called from plugin.onunload()) */
    reset(): void;
}

const now = new Date();

export const useUIStore = create<UIState>((set, get) => ({
    activeSidebarTab: 'today',
    echoSectionKey: null,
    echoMetricKey: 'mood',
    timelineSectionKey: null,
    activeMainTab: 'calendar',
    calendarMonth: now.getMonth(),
    calendarYear: now.getFullYear(),
    selectedMetric: null,
    indexSort: { field: 'date', direction: 'desc' },
    indexFilters: {
        search: '',
        dateRange: null,
        fieldFilters: [],
    },

    setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
    setEchoSectionKey: (key) => set({ echoSectionKey: key }),
    setEchoMetricKey: (key) => set({ echoMetricKey: key }),
    setTimelineSectionKey: (key) => set({ timelineSectionKey: key }),
    setActiveMainTab: (tab) => set({ activeMainTab: tab }),
    setCalendarMonth: (month, year) => set({ calendarMonth: month, calendarYear: year }),
    setSelectedMetric: (metric) => set({ selectedMetric: metric }),

    setIndexSort: (field) => {
        const current = get().indexSort;
        if (current.field === field) {
            set({ indexSort: { field, direction: current.direction === 'asc' ? 'desc' : 'asc' } });
        } else {
            set({ indexSort: { field, direction: 'asc' } });
        }
    },

    setSearchFilter: (search) => set((state) => ({
        indexFilters: { ...state.indexFilters, search },
    })),

    setDateRangeFilter: (range) => set((state) => ({
        indexFilters: { ...state.indexFilters, dateRange: range },
    })),

    addFieldFilter: (field, operator, value) => set((state) => ({
        indexFilters: {
            ...state.indexFilters,
            fieldFilters: [...state.indexFilters.fieldFilters, { field, operator, value }],
        },
    })),

    removeFieldFilter: (index) => set((state) => ({
        indexFilters: {
            ...state.indexFilters,
            fieldFilters: state.indexFilters.fieldFilters.filter((_, i) => i !== index),
        },
    })),

    clearAllFilters: () => set({
        indexFilters: {
            search: '',
            dateRange: null,
            fieldFilters: [],
        },
    }),

    reset: () => {
        const now = new Date();
        set({
            activeSidebarTab: 'today',
            echoSectionKey: null,
            echoMetricKey: 'mood',
            timelineSectionKey: null,
            activeMainTab: 'calendar',
            calendarMonth: now.getMonth(),
            calendarYear: now.getFullYear(),
            selectedMetric: null,
            indexSort: { field: 'date', direction: 'desc' },
            indexFilters: {
                search: '',
                dateRange: null,
                fieldFilters: [],
            },
        });
    },
}));
