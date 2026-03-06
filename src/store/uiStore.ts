/**
 * UI Store
 *
 * Zustand store for UI state that needs to persist across
 * component re-renders but not across plugin reloads.
 */

import { create } from 'zustand';

interface UIState {
    /** Active tab in the sidebar view */
    activeSidebarTab: 'today' | 'echoes';
    /** Which section heading to display as excerpt on echo cards (null = auto-detect) */
    echoSectionKey: string | null;
    /** Which frontmatter field to show as the badge on echo cards (default: 'mood') */
    echoMetricKey: string;

    /** Active tab in the main full-page view */
    activeMainTab: 'calendar' | 'timeline' | 'index';
    /** Currently displayed calendar month (0-11) */
    calendarMonth: number;
    /** Currently displayed calendar year */
    calendarYear: number;
    /** Selected frontmatter field key for calendar color-coding (null = none) */
    selectedMetric: string | null;

    /** Set the active sidebar tab */
    setActiveSidebarTab(tab: 'today' | 'echoes'): void;
    /** Set the section key for echo card excerpts */
    setEchoSectionKey(key: string | null): void;
    /** Set the frontmatter metric key for echo card badges */
    setEchoMetricKey(key: string): void;
    /** Set the active main view tab */
    setActiveMainTab(tab: 'calendar' | 'timeline' | 'index'): void;
    /** Set the calendar month and year */
    setCalendarMonth(month: number, year: number): void;
    /** Set the selected metric for calendar color-coding */
    setSelectedMetric(metric: string | null): void;
}

const now = new Date();

export const useUIStore = create<UIState>((set) => ({
    activeSidebarTab: 'today',
    echoSectionKey: null,
    echoMetricKey: 'mood',
    activeMainTab: 'calendar',
    calendarMonth: now.getMonth(),
    calendarYear: now.getFullYear(),
    selectedMetric: null,

    setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
    setEchoSectionKey: (key) => set({ echoSectionKey: key }),
    setEchoMetricKey: (key) => set({ echoMetricKey: key }),
    setActiveMainTab: (tab) => set({ activeMainTab: tab }),
    setCalendarMonth: (month, year) => set({ calendarMonth: month, calendarYear: year }),
    setSelectedMetric: (metric) => set({ selectedMetric: metric }),
}));
