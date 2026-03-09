/**
 * Chart UI Store
 *
 * UI state for the Charts/Insights tabs. Separated from metricsCacheStore
 * to avoid mixing UI concerns with cached computed data.
 *
 * Persistence model:
 * - selectedChartFields and rollingWindow are mirrored from HindsightSettings.
 *   They are loaded from settings on plugin start and written back via
 *   saveSettingsDebounced() on change. This ensures they survive reload.
 * - dismissedAlertIds and chartDateRange are session-only (transient, reset on reload).
 */

import { create } from 'zustand';

/** Maximum dismissed alert IDs to store (FIFO eviction beyond this) */
const MAX_DISMISSED_ALERTS = 500;

interface ChartUiState {
    /** Selected fields for the Charts tab */
    selectedChartFields: string[];
    /** Date range for chart display */
    chartDateRange: { start: Date; end: Date } | null;
    /** Rolling average window size (days) */
    rollingWindow: number;
    /** Dismissed trend alert IDs for the current session.
     *  Plain array (not Set) to ensure immutable updates trigger re-renders.
     *  Capped at MAX_DISMISSED_ALERTS via FIFO. Reset on plugin reload. */
    dismissedAlertIds: string[];
    /** Whether to analyze all fields (bypasses the mobile/desktop cap). Session-only. */
    analyzeAllFields: boolean;
}

interface ChartUiActions {
    setSelectedChartFields(fields: string[]): void;
    setChartDateRange(range: { start: Date; end: Date } | null): void;
    setRollingWindow(window: number): void;
    /** Add an alert ID to the dismissed list. Uses immutable update (new array). */
    dismissAlert(id: string): void;
    /** Toggle analyze-all-fields mode. */
    setAnalyzeAllFields(value: boolean): void;
    /** Reset to initial state (called from plugin.onunload()) */
    reset(): void;
}

export const useChartUiStore = create<ChartUiState & ChartUiActions>((set) => ({
    selectedChartFields: [],
    chartDateRange: null,
    rollingWindow: 7,
    dismissedAlertIds: [],
    analyzeAllFields: false,

    setSelectedChartFields: (fields) => set({ selectedChartFields: fields }),

    setChartDateRange: (range) => set({ chartDateRange: range }),

    setRollingWindow: (window) => set({ rollingWindow: window }),

    dismissAlert: (id) => set((state) => {
        if (state.dismissedAlertIds.includes(id)) return state;
        let next = [...state.dismissedAlertIds, id];
        // FIFO cap: drop oldest entries when exceeding limit
        if (next.length > MAX_DISMISSED_ALERTS) {
            next = next.slice(next.length - MAX_DISMISSED_ALERTS);
        }
        return { dismissedAlertIds: next };
    }),

    setAnalyzeAllFields: (value) => set({ analyzeAllFields: value }),

    reset: () => set({
        selectedChartFields: [],
        chartDateRange: null,
        rollingWindow: 7,
        dismissedAlertIds: [],
        analyzeAllFields: false,
    }),
}));
