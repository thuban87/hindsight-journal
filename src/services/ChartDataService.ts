/**
 * Chart Data Service
 *
 * Stateless pure-function service that transforms journal entry data
 * into Chart.js-ready datasets. No Obsidian API dependency.
 *
 * Reuses FrontmatterService.getFieldTimeSeries() for data extraction.
 */

import type { JournalEntry, MetricDataPoint, DateRange } from '../types';
import { getFieldTimeSeries } from './FrontmatterService';

/**
 * Extract a time series for a specific frontmatter field.
 * Returns sorted MetricDataPoint[] with null for missing values.
 * Optionally filters by date range.
 */
export function getTimeSeries(
    entries: JournalEntry[],
    fieldKey: string,
    range?: DateRange
): MetricDataPoint[] {
    const series = getFieldTimeSeries(entries, fieldKey);

    // Sort by date ascending
    series.sort((a, b) => a.date - b.date);

    // Apply date range filter if provided
    if (range) {
        const startMs = range.start.getTime();
        const endMs = range.end.getTime();
        return series.filter(p => p.date >= startMs && p.date <= endMs);
    }

    return series;
}

/**
 * Compute a rolling average over a time series.
 * windowSize: number of data points in the rolling window (default 7).
 * Null values are skipped in the average calculation.
 */
export function rollingAverage(
    data: MetricDataPoint[],
    windowSize: number = 7
): MetricDataPoint[] {
    return data.map((point, index) => {
        // Collect values within the window (look back from current index)
        const windowStart = Math.max(0, index - windowSize + 1);
        const windowSlice = data.slice(windowStart, index + 1);

        const nonNullValues = windowSlice
            .map(p => p.value)
            .filter((v): v is number => v !== null);

        const avg = nonNullValues.length > 0
            ? nonNullValues.reduce((sum, v) => sum + v, 0) / nonNullValues.length
            : null;

        return { date: point.date, value: avg };
    });
}

/**
 * Compute a simple linear trend line (least squares regression).
 * Returns slope, intercept, and two endpoint data points for Chart.js line overlay.
 * Skips null values in the regression.
 */
export function trendLine(
    data: MetricDataPoint[]
): { slope: number; intercept: number; points: MetricDataPoint[] } {
    // Filter to non-null entries
    const valid = data.filter((p): p is MetricDataPoint & { value: number } => p.value !== null);

    if (valid.length < 2) {
        return { slope: 0, intercept: 0, points: [] };
    }

    // Use index-based x values for simplicity (0, 1, 2, ...)
    const n = valid.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += valid[i].value;
        sumXY += i * valid[i].value;
        sumXX += i * i;
    }

    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / n;

    // Create two endpoint data points (first and last date)
    const firstDate = valid[0].date;
    const lastDate = valid[valid.length - 1].date;
    const firstValue = intercept;
    const lastValue = slope * (n - 1) + intercept;

    return {
        slope,
        intercept,
        points: [
            { date: firstDate, value: firstValue },
            { date: lastDate, value: lastValue },
        ],
    };
}

/**
 * Build a Chart.js-compatible dataset config for a single metric.
 * Includes labels (dates), data values, and color.
 */
export function buildChartDataset(
    data: MetricDataPoint[],
    label: string,
    color: string
): { labels: string[]; datasets: ChartDataset[] } {
    const labels = data.map(p => formatDateLabel(p.date));
    const values = data.map(p => p.value);

    return {
        labels,
        datasets: [{
            label,
            data: values,
            borderColor: color,
            backgroundColor: color + '33', // 20% opacity fill
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
            spanGaps: false,
            tension: 0.1,
        }],
    };
}

/** Type for the datasets we build (subset of Chart.js dataset config) */
interface ChartDataset {
    label: string;
    data: (number | null)[];
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    pointRadius: number;
    pointHoverRadius: number;
    fill: boolean;
    spanGaps: boolean;
    tension: number;
    yAxisID?: string;
    borderDash?: number[];
}

/**
 * Build a multi-metric overlay dataset (multiple metrics on same chart).
 * Each metric gets its own Y axis if scales differ significantly (>10x).
 */
export function buildMultiMetricDataset(
    series: { data: MetricDataPoint[]; label: string; color: string }[]
): { labels: string[]; datasets: ChartDataset[]; needsDualAxis: boolean } {
    if (series.length === 0) {
        return { labels: [], datasets: [], needsDualAxis: false };
    }

    // Collect all unique dates across all series
    const allDates = new Set<number>();
    for (const s of series) {
        for (const p of s.data) {
            allDates.add(p.date);
        }
    }
    const sortedDates = Array.from(allDates).sort((a, b) => a - b);
    const labels = sortedDates.map(d => formatDateLabel(d));

    // Check if we need dual axes (ranges differ by >10x)
    let needsDualAxis = false;
    if (series.length >= 2) {
        const ranges = series.map(s => {
            const values = s.data
                .map(p => p.value)
                .filter((v): v is number => v !== null);
            if (values.length === 0) return { min: 0, max: 0 };
            return { min: Math.min(...values), max: Math.max(...values) };
        });

        const range0 = ranges[0].max - ranges[0].min || 1;
        const range1 = ranges[1].max - ranges[1].min || 1;
        needsDualAxis = Math.max(range0, range1) / Math.min(range0, range1) > 10;
    }

    // Build datasets — align values to the shared date labels
    const datasets: ChartDataset[] = series.map((s, index) => {
        // Create a lookup map for this series
        const dateValueMap = new Map<number, number | null>();
        for (const p of s.data) {
            dateValueMap.set(p.date, p.value);
        }

        const alignedValues = sortedDates.map(d => dateValueMap.get(d) ?? null);

        const dataset: ChartDataset = {
            label: s.label,
            data: alignedValues,
            borderColor: s.color,
            backgroundColor: s.color + '33',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
            spanGaps: false,
            tension: 0.1,
        };

        // Assign to second Y axis if needed
        if (needsDualAxis && index >= 1) {
            dataset.yAxisID = 'y1';
        }

        return dataset;
    });

    return { labels, datasets, needsDualAxis };
}

/**
 * Format a Unix timestamp to a short date label (MM/DD).
 */
function formatDateLabel(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
