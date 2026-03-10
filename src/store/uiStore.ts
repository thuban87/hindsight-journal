/**
 * UI Store
 *
 * Zustand store for UI state that needs to persist across
 * component re-renders but not across plugin reloads.
 */

import { create } from 'zustand';
import type { DateRange } from '../types';

/** Type-safe tab group → sub-tab mapping */
type TabGroupMap = {
    journal: 'calendar' | 'timeline' | 'index';
    insights: 'charts' | 'pulse' | 'digest';
    explore: 'lens' | 'threads' | 'gallery';
};
type TabGroup = keyof TabGroupMap;
type SubTab = TabGroupMap[TabGroup];

/** First sub-tab for each group (used when switching groups) */
const FIRST_TAB: Record<TabGroup, SubTab> = {
    journal: 'calendar',
    insights: 'charts',
    explore: 'lens',
};

export type { TabGroup, SubTab, TabGroupMap };

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
    /** Target date to scroll to in timeline (set when 'View in timeline' is clicked from calendar) */
    timelineScrollToDate: Date | null;

    /** Active group in the main full-page view */
    activeGroup: TabGroup;
    /** Active sub-tab within the current group */
    activeSubTab: SubTab;
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
    /** Set the active group (resets sub-tab to first tab of new group) */
    setActiveGroup(group: TabGroup): void;
    /** Set the active sub-tab within current group */
    setActiveSubTab(tab: SubTab): void;
    /** Set the target date to scroll to in timeline */
    setTimelineScrollToDate(date: Date | null): void;
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
    timelineScrollToDate: null,
    activeGroup: 'journal' as TabGroup,
    activeSubTab: 'calendar' as SubTab,
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
    setActiveGroup: (group) => set({ activeGroup: group, activeSubTab: FIRST_TAB[group] }),
    setActiveSubTab: (tab) => set({ activeSubTab: tab }),
    setTimelineScrollToDate: (date) => set({ timelineScrollToDate: date }),
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
            timelineScrollToDate: null,
            activeGroup: 'journal' as TabGroup,
            activeSubTab: 'calendar' as SubTab,
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
