/**
 * Metrics Hooks
 *
 * Thin selector hooks for chart config and cached chart data.
 * useChartData() handles cache-miss computation in a useEffect
 * (NOT inline during render — writing to Zustand during render
 * violates React's render purity contract).
 */

import { useEffect } from 'react';
import { useChartUiStore } from '../store/chartUiStore';
import { useMetricsCacheStore } from '../store/metricsCacheStore';
import { useJournalStore } from '../store/journalStore';
import type { MetricDataPoint } from '../types';
import * as ChartDataService from '../services/ChartDataService';

/**
 * Subscribe to chartUiStore + metricsCacheStore for chart config and data.
 */
export function useMetrics() {
    const selectedChartFields = useChartUiStore(s => s.selectedChartFields);
    const chartDateRange = useChartUiStore(s => s.chartDateRange);
    const rollingWindow = useChartUiStore(s => s.rollingWindow);
    const stale = useMetricsCacheStore(s => s.stale);

    return {
        selectedChartFields,
        chartDateRange,
        rollingWindow,
        stale,
    };
}

/**
 * Get chart-ready time series for a field, with caching.
 * Uses useEffect for cache-miss computation (NOT inline during render).
 * Returns cached value (possibly empty [] on first render); re-renders
 * when the effect completes and the store updates.
 */
export function useChartData(fieldKey: string): {
    data: MetricDataPoint[];
    rolling: MetricDataPoint[];
    trend: { slope: number; intercept: number };
} {
    const cached = useMetricsCacheStore(s => s.getTimeSeries(fieldKey));
    const rollingWindow = useChartUiStore(s => s.rollingWindow);
    const chartDateRange = useChartUiStore(s => s.chartDateRange);
    const cachedRolling = useMetricsCacheStore(s => s.getRollingAverage(fieldKey, rollingWindow));
    const revision = useJournalStore(s => s.revision);

    // Cache-miss computation in useEffect
    useEffect(() => {
        if (cached !== null) return;

        // Read entries from journalStore (not via selector — avoid re-render loop)
        const entries = Array.from(useJournalStore.getState().entries.values());
        const dateRange = chartDateRange ?? undefined;

        const timeSeries = ChartDataService.getTimeSeries(entries, fieldKey, dateRange);
        useMetricsCacheStore.getState().setTimeSeries(fieldKey, timeSeries);

        // Also compute rolling average
        const rolling = ChartDataService.rollingAverage(timeSeries, rollingWindow);
        useMetricsCacheStore.getState().setRollingAverage(fieldKey, rollingWindow, rolling);
    }, [fieldKey, cached, revision, chartDateRange, rollingWindow]);

    // Compute rolling average on cache miss
    useEffect(() => {
        if (cachedRolling !== null || cached === null) return;

        const rolling = ChartDataService.rollingAverage(cached, rollingWindow);
        useMetricsCacheStore.getState().setRollingAverage(fieldKey, rollingWindow, rolling);
    }, [fieldKey, cached, cachedRolling, rollingWindow]);

    const data = cached ?? [];
    const rolling = cachedRolling ?? [];
    const trend = data.length > 0
        ? ChartDataService.trendLine(data)
        : { slope: 0, intercept: 0, points: [] };

    return {
        data,
        rolling,
        trend: { slope: trend.slope, intercept: trend.intercept },
    };
}
