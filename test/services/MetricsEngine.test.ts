/**
 * MetricsEngine Tests
 *
 * Tests for statistical analysis functions:
 * pearsonCorrelation, conditionalAverage, findCorrelations,
 * findConditionalInsights, weeklyComparison.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock obsidian Platform before importing MetricsEngine
vi.mock('obsidian', () => ({
    Platform: { isMobile: false },
}));

import {
    pearsonCorrelation,
    conditionalAverage,
    findCorrelations,
    findConditionalInsights,
    weeklyComparison,
} from '../../src/services/MetricsEngine';
import type { JournalEntry, FrontmatterField, MetricDataPoint } from '../../src/types';

/** Helper to create a minimal JournalEntry */
function makeEntry(dateStr: string, frontmatter: Record<string, unknown> = {}): JournalEntry {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        filePath: `Journal/${dateStr}.md`,
        date: d,
        dayOfWeek: 'Monday',
        frontmatter,
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: d.getTime(),
        fullyIndexed: true,
        qualityScore: 100,
    };
}

/** Helper: create a MetricDataPoint with a given day offset and value */
function makePoint(dayIndex: number, value: number | null): MetricDataPoint {
    return { date: new Date(2026, 2, dayIndex).getTime(), value };
}

describe('pearsonCorrelation', () => {
    it('returns ~1 for perfect positive correlation (identical series)', () => {
        const series: MetricDataPoint[] = [
            makePoint(1, 1), makePoint(2, 2), makePoint(3, 3),
            makePoint(4, 4), makePoint(5, 5),
        ];
        const r = pearsonCorrelation(series, series);
        expect(r).not.toBeNull();
        expect(r).toBeCloseTo(1, 5);
    });

    it('returns ~-1 for perfect negative correlation (inverse series)', () => {
        const seriesA: MetricDataPoint[] = [
            makePoint(1, 1), makePoint(2, 2), makePoint(3, 3),
            makePoint(4, 4), makePoint(5, 5),
        ];
        const seriesB: MetricDataPoint[] = [
            makePoint(1, 5), makePoint(2, 4), makePoint(3, 3),
            makePoint(4, 2), makePoint(5, 1),
        ];
        const r = pearsonCorrelation(seriesA, seriesB);
        expect(r).not.toBeNull();
        expect(r).toBeCloseTo(-1, 5);
    });

    it('returns near zero for unrelated data', () => {
        // Values chosen to have near-zero Pearson correlation
        const seriesA: MetricDataPoint[] = [
            makePoint(1, 1), makePoint(2, 2), makePoint(3, 3),
            makePoint(4, 4), makePoint(5, 5),
        ];
        const seriesB: MetricDataPoint[] = [
            makePoint(1, 3), makePoint(2, 1), makePoint(3, 5),
            makePoint(4, 1), makePoint(5, 3),
        ];
        const r = pearsonCorrelation(seriesA, seriesB);
        expect(r).not.toBeNull();
        expect(Math.abs(r!)).toBeLessThan(0.5);
    });

    it('returns null with fewer than 5 paired points', () => {
        const series: MetricDataPoint[] = [
            makePoint(1, 1), makePoint(2, 2), makePoint(3, 3), makePoint(4, 4),
        ];
        const r = pearsonCorrelation(series, series);
        expect(r).toBeNull();
    });

    it('handles null values by excluding them from calculation', () => {
        const seriesA: MetricDataPoint[] = [
            makePoint(1, 1), makePoint(2, null), makePoint(3, 3),
            makePoint(4, 4), makePoint(5, 5), makePoint(6, 6),
            makePoint(7, 7),
        ];
        const seriesB: MetricDataPoint[] = [
            makePoint(1, 1), makePoint(2, 2), makePoint(3, null),
            makePoint(4, 4), makePoint(5, 5), makePoint(6, 6),
            makePoint(7, 7),
        ];
        const r = pearsonCorrelation(seriesA, seriesB);
        // Points 2 and 3 are excluded (one has null)
        // Remaining: (1,1), (4,4), (5,5), (6,6), (7,7) → 5 pairs → r = 1
        expect(r).not.toBeNull();
        expect(r).toBeCloseTo(1, 5);
    });
});

describe('conditionalAverage', () => {
    it('computes correct averages for true/false groups', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 8, workout: true }),
            makeEntry('2026-03-02', { mood: 7, workout: true }),
            makeEntry('2026-03-03', { mood: 9, workout: true }),
            makeEntry('2026-03-04', { mood: 5, workout: false }),
            makeEntry('2026-03-05', { mood: 4, workout: false }),
            makeEntry('2026-03-06', { mood: 6, workout: false }),
        ];

        const result = conditionalAverage(entries, 'mood', 'workout');
        expect(result).not.toBeNull();
        expect(result!.whenTrue).toBe(8); // (8+7+9)/3
        expect(result!.whenFalse).toBe(5); // (5+4+6)/3
        expect(result!.difference).toBe(3); // 8 - 5
        expect(result!.sampleSizeTrue).toBe(3);
        expect(result!.sampleSizeFalse).toBe(3);
    });

    it('returns null with insufficient sample size', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 8, workout: true }),
            makeEntry('2026-03-02', { mood: 7, workout: true }),
            // Only 2 true entries, need >= 3
            makeEntry('2026-03-03', { mood: 5, workout: false }),
            makeEntry('2026-03-04', { mood: 4, workout: false }),
            makeEntry('2026-03-05', { mood: 6, workout: false }),
        ];
        const result = conditionalAverage(entries, 'mood', 'workout');
        expect(result).toBeNull();
    });
});

describe('findCorrelations', () => {
    it('returns pairs sorted by |r|, filtered by threshold', async () => {
        // Create entries where mood and sleep are perfectly correlated
        // but mood and random are not
        const entries: JournalEntry[] = [];
        for (let i = 1; i <= 20; i++) {
            entries.push(makeEntry(`2026-03-${String(i).padStart(2, '0')}`, {
                mood: i,
                sleep: i, // perfect correlation with mood
                random: (i * 7 + 13) % 10, // pseudo-random, low correlation
            }));
        }

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 20, total: 20, range: { min: 1, max: 20 } },
            { key: 'sleep', type: 'number', coverage: 20, total: 20, range: { min: 1, max: 20 } },
            { key: 'random', type: 'number', coverage: 20, total: 20, range: { min: 0, max: 9 } },
        ];

        const { results } = await findCorrelations(entries, fields, []);
        // mood-sleep should be there with r ≈ 1
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].fieldA).toBeDefined();
        expect(results[0].fieldB).toBeDefined();
        expect(Math.abs(results[0].r)).toBeGreaterThanOrEqual(0.4);
        // Should be sorted by |r| descending
        for (let i = 1; i < results.length; i++) {
            expect(Math.abs(results[i].r)).toBeLessThanOrEqual(Math.abs(results[i - 1].r));
        }
    });

    it('excludes self-correlations (fieldA !== fieldB)', async () => {
        const entries: JournalEntry[] = [];
        for (let i = 1; i <= 10; i++) {
            entries.push(makeEntry(`2026-03-${String(i).padStart(2, '0')}`, {
                mood: i,
                sleep: i,
            }));
        }

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 10, total: 10, range: { min: 1, max: 10 } },
            { key: 'sleep', type: 'number', coverage: 10, total: 10, range: { min: 1, max: 10 } },
        ];

        const { results } = await findCorrelations(entries, fields, []);
        for (const result of results) {
            expect(result.fieldA).not.toBe(result.fieldB);
        }
    });
});

describe('findConditionalInsights', () => {
    it('finds significant boolean-numeric relationships', () => {
        const entries: JournalEntry[] = [];
        // Workout days: high mood (7-9)
        for (let i = 0; i < 10; i++) {
            entries.push(makeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`, {
                mood: 7 + (i % 3), workout: true,
            }));
        }
        // Non-workout days: low mood (3-5)
        for (let i = 0; i < 10; i++) {
            entries.push(makeEntry(`2026-02-${String(i + 1).padStart(2, '0')}`, {
                mood: 3 + (i % 3), workout: false,
            }));
        }

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 20, total: 20, range: { min: 3, max: 9 } },
            { key: 'workout', type: 'boolean', coverage: 20, total: 20 },
        ];

        const results = findConditionalInsights(entries, fields);
        expect(results.length).toBeGreaterThanOrEqual(1);
        const moodResult = results.find(r => r.numericField === 'mood' && r.booleanField === 'workout');
        expect(moodResult).toBeDefined();
        expect(moodResult!.difference).toBeGreaterThan(0);
    });
});

describe('weeklyComparison', () => {
    it('computes correct change calculation between two weeks', () => {
        // This week (Sunday-start week containing March 5, 2026):
        // Week is Mar 1 (Sun) - Mar 7 (Sat)
        const entries = [
            // This week
            makeEntry('2026-03-02', { mood: 8 }),
            makeEntry('2026-03-03', { mood: 9 }),
            makeEntry('2026-03-04', { mood: 7 }),
            // Last week (Feb 22 - Feb 28)
            makeEntry('2026-02-23', { mood: 5 }),
            makeEntry('2026-02-24', { mood: 4 }),
            makeEntry('2026-02-25', { mood: 6 }),
        ];

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 6, total: 6, range: { min: 4, max: 9 } },
        ];

        const results = weeklyComparison(entries, fields, new Date(2026, 2, 5), 0);
        expect(results.length).toBeGreaterThanOrEqual(1);
        const moodResult = results.find(r => r.field === 'mood');
        expect(moodResult).toBeDefined();
        // This week avg: (8+9+7)/3 = 8, Last week avg: (5+4+6)/3 = 5
        expect(moodResult!.thisWeek).toBe(8);
        expect(moodResult!.lastWeek).toBe(5);
        expect(moodResult!.change).toBe(3);
    });

    it('handles missing data in either week', () => {
        const entries = [
            // This week only
            makeEntry('2026-03-02', { mood: 8 }),
            // Last week has no mood entries
            makeEntry('2026-02-23', { sleep: 7 }),
        ];

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 1, total: 2, range: { min: 8, max: 8 } },
        ];

        const results = weeklyComparison(entries, fields, new Date(2026, 2, 5), 0);
        // Mood has no entries in last week → should not appear in results
        const moodResult = results.find(r => r.field === 'mood');
        expect(moodResult).toBeUndefined();
    });
});
