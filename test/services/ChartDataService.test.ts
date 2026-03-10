/**
 * ChartDataService Tests
 *
 * Tests for chart data transformation functions:
 * getTimeSeries, rollingAverage, trendLine, buildChartDataset, buildMultiMetricDataset.
 */

import { describe, it, expect } from 'vitest';
import {
    getTimeSeries,
    rollingAverage,
    trendLine,
    buildChartDataset,
    buildMultiMetricDataset,
} from '../../src/services/ChartDataService';
import type { JournalEntry, MetricDataPoint } from '../../src/types';

/** Helper to create a minimal JournalEntry */
function makeEntry(dateStr: string, frontmatter: Record<string, unknown> = {}): JournalEntry {
    return {
        filePath: `Journal/${dateStr}.md`,
        date: new Date(dateStr + 'T00:00:00'),
        dayOfWeek: 'Monday',
        frontmatter,
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 100,
    };
}

describe('getTimeSeries', () => {
    it('extracts correct date-value pairs for a field', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 7 }),
            makeEntry('2026-03-02', { mood: 8 }),
            makeEntry('2026-03-03', { mood: 6 }),
        ];
        const series = getTimeSeries(entries, 'mood');
        expect(series).toHaveLength(3);
        expect(series[0].value).toBe(7);
        expect(series[1].value).toBe(8);
        expect(series[2].value).toBe(6);
    });

    it('returns null values for entries missing the field', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 7 }),
            makeEntry('2026-03-02', {}), // no mood
            makeEntry('2026-03-03', { mood: 5 }),
        ];
        const series = getTimeSeries(entries, 'mood');
        expect(series).toHaveLength(3);
        expect(series[1].value).toBeNull();
    });

    it('filters by date range and returns only in-range points', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 7 }),
            makeEntry('2026-03-05', { mood: 8 }),
            makeEntry('2026-03-10', { mood: 6 }),
            makeEntry('2026-03-15', { mood: 9 }),
        ];
        const series = getTimeSeries(entries, 'mood', {
            start: new Date('2026-03-03'),
            end: new Date('2026-03-12'),
        });
        expect(series).toHaveLength(2);
        expect(series[0].value).toBe(8);
        expect(series[1].value).toBe(6);
    });
});

describe('rollingAverage', () => {
    it('7-day window smooths data correctly', () => {
        const data: MetricDataPoint[] = [
            { date: 1, value: 10 },
            { date: 2, value: 20 },
            { date: 3, value: 30 },
            { date: 4, value: 40 },
            { date: 5, value: 50 },
            { date: 6, value: 60 },
            { date: 7, value: 70 },
        ];
        const result = rollingAverage(data, 7);
        expect(result).toHaveLength(7);
        // First point: only 1 value → 10
        expect(result[0].value).toBe(10);
        // Last point: average of all 7 values = (10+20+30+40+50+60+70)/7 = 40
        expect(result[6].value).toBe(40);
    });

    it('handles null values by skipping them in window calculation', () => {
        const data: MetricDataPoint[] = [
            { date: 1, value: 10 },
            { date: 2, value: null },
            { date: 3, value: 30 },
        ];
        const result = rollingAverage(data, 3);
        // Last point: window [10, null, 30] → average of non-null = (10+30)/2 = 20
        expect(result[2].value).toBe(20);
    });

    it('window larger than data averages available points', () => {
        const data: MetricDataPoint[] = [
            { date: 1, value: 10 },
            { date: 2, value: 20 },
            { date: 3, value: 30 },
        ];
        const result = rollingAverage(data, 100);
        expect(result).toHaveLength(3);
        // All points use whatever is available
        expect(result[0].value).toBe(10); // only 1 point
        expect(result[2].value).toBe(20); // avg(10,20,30)
    });
});

describe('trendLine', () => {
    it('positive slope for increasing data', () => {
        const data: MetricDataPoint[] = [
            { date: 1, value: 1 },
            { date: 2, value: 2 },
            { date: 3, value: 3 },
            { date: 4, value: 4 },
            { date: 5, value: 5 },
        ];
        const result = trendLine(data);
        expect(result.slope).toBeGreaterThan(0);
        expect(result.points).toHaveLength(2);
    });

    it('negative slope for decreasing data', () => {
        const data: MetricDataPoint[] = [
            { date: 1, value: 10 },
            { date: 2, value: 8 },
            { date: 3, value: 6 },
            { date: 4, value: 4 },
            { date: 5, value: 2 },
        ];
        const result = trendLine(data);
        expect(result.slope).toBeLessThan(0);
    });

    it('flat line for constant data', () => {
        const data: MetricDataPoint[] = [
            { date: 1, value: 5 },
            { date: 2, value: 5 },
            { date: 3, value: 5 },
        ];
        const result = trendLine(data);
        expect(result.slope).toBeCloseTo(0);
        expect(result.intercept).toBeCloseTo(5);
    });
});

describe('buildChartDataset', () => {
    it('returns correct Chart.js structure', () => {
        const data: MetricDataPoint[] = [
            { date: new Date('2026-03-01').getTime(), value: 7 },
            { date: new Date('2026-03-02').getTime(), value: 8 },
        ];
        const result = buildChartDataset(data, 'Mood', '#ff0000');
        expect(result.labels).toHaveLength(2);
        expect(result.datasets).toHaveLength(1);
        expect(result.datasets[0].label).toBe('Mood');
        expect(result.datasets[0].data).toEqual([7, 8]);
        expect(result.datasets[0].borderColor).toBe('#ff0000');
    });
});

describe('buildMultiMetricDataset', () => {
    it('multiple series with shared labels', () => {
        const series = [
            {
                data: [
                    { date: new Date('2026-03-01').getTime(), value: 7 },
                    { date: new Date('2026-03-02').getTime(), value: 8 },
                ],
                label: 'Mood',
                color: '#ff0000',
            },
            {
                data: [
                    { date: new Date('2026-03-01').getTime(), value: 6.5 },
                    { date: new Date('2026-03-03').getTime(), value: 7.0 },
                ],
                label: 'Sleep',
                color: '#0000ff',
            },
        ];
        const result = buildMultiMetricDataset(series);
        // Shared labels should contain all 3 unique dates
        expect(result.labels).toHaveLength(3);
        expect(result.datasets).toHaveLength(2);
        expect(result.datasets[0].label).toBe('Mood');
        expect(result.datasets[1].label).toBe('Sleep');
        // Sleep has no data for Mar 2 → null
        expect(result.datasets[1].data[1]).toBeNull();
    });
});
