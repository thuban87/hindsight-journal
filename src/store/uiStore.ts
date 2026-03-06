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

    /** Set the active sidebar tab */
    setActiveSidebarTab(tab: 'today' | 'echoes'): void;
    /** Set the section key for echo card excerpts */
    setEchoSectionKey(key: string | null): void;
    /** Set the frontmatter metric key for echo card badges */
    setEchoMetricKey(key: string): void;
}

export const useUIStore = create<UIState>((set) => ({
    activeSidebarTab: 'today',
    echoSectionKey: null,
    echoMetricKey: 'mood',

    setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
    setEchoSectionKey: (key) => set({ echoSectionKey: key }),
    setEchoMetricKey: (key) => set({ echoMetricKey: key }),
}));
