/**
 * Metrics Cache Store
 *
 * Computed data cache with staleness tracking. Stores expensive
 * computed artifacts (time series, rolling averages, correlations,
 * trend alerts) and manages invalidation when journal entries change.
 *
 * Separate from chartUiStore to avoid mixing UI state with cached data.
 * This is a minimal Phase 5a version — full cache implementation
 * comes in Phase 5b.
 */

import { create } from 'zustand';

interface MetricsCacheState {
    /** Whether cached data is stale (entry changed but recomputation pending) */
    stale: boolean;
}

interface MetricsCacheActions {
    /**
     * Mark cache as stale immediately when entries change.
     * Components show a subtle "Updating..." indicator while stale.
     */
    markStale(): void;

    /**
     * Granular invalidation: clears cached data for specified fields.
     * Empty array = full clear (used on bulk changes like reconfigure/clear).
     * Sets stale = false when complete.
     *
     * Phase 5a: minimal implementation — just clears stale flag.
     * Phase 5b adds actual cache maps (timeSeriesCache, rollingAverageCache, etc.)
     */
    invalidateCache(changedFieldKeys: string[]): void;

    /** Reset to initial state (called from plugin.onunload()) */
    reset(): void;
}

export const useMetricsCacheStore = create<MetricsCacheState & MetricsCacheActions>((set) => ({
    stale: false,

    markStale(): void {
        set({ stale: true });
    },

    invalidateCache(_changedFieldKeys: string[]): void {
        // Phase 5a: minimal — just clear stale flag
        // Phase 5b will add actual cache clearing logic
        set({ stale: false });
    },

    reset(): void {
        set({ stale: false });
    },
}));
