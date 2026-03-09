/**
 * Metrics Cache Store
 *
 * Computed data cache with staleness tracking. Stores expensive
 * computed artifacts (time series, rolling averages, correlations,
 * trend alerts) and manages invalidation when journal entries change.
 *
 * Separate from chartUiStore to avoid mixing UI state with cached data.
 * This is a pure cache — it stores and retrieves data only.
 * It does NOT read from journalStore internally. The useChartData() hook
 * reads entries from journalStore and passes them to ChartDataService
 * on cache miss, then stores the result here.
 */

import { create } from 'zustand';
import type { MetricDataPoint } from '../types';

interface MetricsCacheState {
    /** Cached time series per field key. Invalidated when entries change. */
    timeSeriesCache: Map<string, MetricDataPoint[]>;
    /** Cached rolling averages per field key + window size (key: "fieldKey:windowSize"). */
    rollingAverageCache: Map<string, MetricDataPoint[]>;
    /** Cache key: entry count + latest mtime. Only invalidate fields that changed. */
    cacheKey: { entryCount: number; latestMtime: number };
    /** Cached correlation results (Phase 5c — null until computed) */
    correlationResults: { field1: string; field2: string; r: number }[] | null;
    /** Cached trend alerts (Phase 5c — null until computed) */
    cachedAlerts: unknown[] | null;
    /** Cached weekly comparison (Phase 5c — null until computed) */
    cachedWeeklyComparison: { field: string; thisWeek: number; lastWeek: number; change: number; percentChange: number }[] | null;
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
     * Granular invalidation: clears cached data only for the specified fields.
     * Called with changedFieldKeys after 2s debounce. Empty array = full clear
     * (used on bulk changes like reconfigure/clear).
     * Sets stale = false when complete.
     */
    invalidateCache(changedFieldKeys: string[]): void;

    /**
     * Get cached time series for a field.
     * Returns null on cache miss — the useChartData hook handles recomputation.
     */
    getTimeSeries(fieldKey: string): MetricDataPoint[] | null;

    /** Store a computed time series in the cache. */
    setTimeSeries(fieldKey: string, data: MetricDataPoint[]): void;

    /** Get cached rolling average for a field + window size. */
    getRollingAverage(fieldKey: string, windowSize: number): MetricDataPoint[] | null;

    /** Store a computed rolling average in the cache. */
    setRollingAverage(fieldKey: string, windowSize: number, data: MetricDataPoint[]): void;

    /** Reset to initial state (called from plugin.onunload()) */
    reset(): void;
}

export const useMetricsCacheStore = create<MetricsCacheState & MetricsCacheActions>((set, get) => ({
    timeSeriesCache: new Map(),
    rollingAverageCache: new Map(),
    cacheKey: { entryCount: 0, latestMtime: 0 },
    correlationResults: null,
    cachedAlerts: null,
    cachedWeeklyComparison: null,
    stale: false,

    markStale(): void {
        set({ stale: true });
    },

    invalidateCache(changedFieldKeys: string[]): void {
        const state = get();

        if (changedFieldKeys.length === 0) {
            // Full invalidation — clear everything
            set({
                timeSeriesCache: new Map(),
                rollingAverageCache: new Map(),
                correlationResults: null,
                cachedAlerts: null,
                cachedWeeklyComparison: null,
                stale: false,
            });
            return;
        }

        // Granular invalidation — only clear affected fields
        const newTsCache = new Map(state.timeSeriesCache);
        const newRaCache = new Map(state.rollingAverageCache);

        for (const key of changedFieldKeys) {
            newTsCache.delete(key);
            // Rolling average keys are "fieldKey:windowSize"
            for (const raKey of newRaCache.keys()) {
                if (raKey.startsWith(key + ':')) {
                    newRaCache.delete(raKey);
                }
            }
        }

        // Correlations: only clear if a changed field participates
        let newCorrelations = state.correlationResults;
        if (newCorrelations) {
            const hasAffected = newCorrelations.some(
                c => changedFieldKeys.includes(c.field1) || changedFieldKeys.includes(c.field2)
            );
            if (hasAffected) {
                newCorrelations = null;
            }
        }

        // Alerts: always clear on any invalidation (may reference any field)
        // Weekly comparison: always clear (cheap to recompute)
        set({
            timeSeriesCache: newTsCache,
            rollingAverageCache: newRaCache,
            correlationResults: newCorrelations,
            cachedAlerts: null,
            cachedWeeklyComparison: null,
            stale: false,
        });
    },

    getTimeSeries(fieldKey: string): MetricDataPoint[] | null {
        return get().timeSeriesCache.get(fieldKey) ?? null;
    },

    setTimeSeries(fieldKey: string, data: MetricDataPoint[]): void {
        set((state) => {
            const newCache = new Map(state.timeSeriesCache);
            newCache.set(fieldKey, data);
            return { timeSeriesCache: newCache };
        });
    },

    getRollingAverage(fieldKey: string, windowSize: number): MetricDataPoint[] | null {
        return get().rollingAverageCache.get(`${fieldKey}:${windowSize}`) ?? null;
    },

    setRollingAverage(fieldKey: string, windowSize: number, data: MetricDataPoint[]): void {
        set((state) => {
            const newCache = new Map(state.rollingAverageCache);
            newCache.set(`${fieldKey}:${windowSize}`, data);
            return { rollingAverageCache: newCache };
        });
    },

    reset(): void {
        set({
            timeSeriesCache: new Map(),
            rollingAverageCache: new Map(),
            cacheKey: { entryCount: 0, latestMtime: 0 },
            correlationResults: null,
            cachedAlerts: null,
            cachedWeeklyComparison: null,
            stale: false,
        });
    },
}));
