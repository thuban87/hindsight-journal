import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    getCurrentStreak,
    getLongestStreak,
    getHeatmapData,
    getHabitStreaks,
    getPersonalBests,
    getConsistencyScores,
    getGoalProgress,
    getAdherenceRate,
} from '../../src/services/PulseService';
import type { JournalEntry, FrontmatterField } from '../../src/types';

/** Helper to create a minimal JournalEntry for testing */
function makeEntry(
    overrides: Partial<JournalEntry> & { filePath: string; date: Date }
): JournalEntry {
    return {
        dayOfWeek: 'Monday',
        frontmatter: {},
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 100,
        tasksCompleted: 0,
        tasksTotal: 0,
        ...overrides,
    };
}

/** Create an entry N days ago from the fake "now" */
function entryDaysAgo(daysAgo: number): JournalEntry {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(10, 0, 0, 0);
    return makeEntry({ filePath: `day-${daysAgo}.md`, date });
}

describe('getCurrentStreak', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('5 consecutive days ending today → 5', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [
            entryDaysAgo(0), // today
            entryDaysAgo(1), // yesterday
            entryDaysAgo(2),
            entryDaysAgo(3),
            entryDaysAgo(4),
        ];

        expect(getCurrentStreak(entries)).toBe(5);
    });

    it('gap yesterday → 0 (streak broken, no entry today)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        // No entry today, entries 2 and 3 days ago
        const entries = [
            entryDaysAgo(2),
            entryDaysAgo(3),
        ];

        expect(getCurrentStreak(entries)).toBe(0);
    });

    it('no entry today → 0', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [
            entryDaysAgo(1), // yesterday only
            entryDaysAgo(2),
        ];

        expect(getCurrentStreak(entries)).toBe(0);
    });

    it('single entry today → 1', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [entryDaysAgo(0)];

        expect(getCurrentStreak(entries)).toBe(1);
    });
});

describe('getLongestStreak', () => {
    it('finds longest consecutive run in all entries', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        // Run of 3: days 10, 9, 8 — gap at 7 — run of 5: days 6, 5, 4, 3, 2
        const entries = [
            entryDaysAgo(10),
            entryDaysAgo(9),
            entryDaysAgo(8),
            // gap at day 7
            entryDaysAgo(6),
            entryDaysAgo(5),
            entryDaysAgo(4),
            entryDaysAgo(3),
            entryDaysAgo(2),
        ];

        expect(getLongestStreak(entries)).toBe(5);

        vi.useRealTimers();
    });

    it('multiple streaks of equal length → returns that length', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        // Two runs of 3: days 10,9,8 — gap — days 5,4,3
        const entries = [
            entryDaysAgo(10),
            entryDaysAgo(9),
            entryDaysAgo(8),
            // gap at 7, 6
            entryDaysAgo(5),
            entryDaysAgo(4),
            entryDaysAgo(3),
        ];

        expect(getLongestStreak(entries)).toBe(3);

        vi.useRealTimers();
    });

    it('single entry → 1', () => {
        const entries = [
            makeEntry({ filePath: 'solo.md', date: new Date(2026, 2, 1) }),
        ];

        expect(getLongestStreak(entries)).toBe(1);
    });

    it('empty entries → 0', () => {
        expect(getLongestStreak([])).toBe(0);
    });
});

describe('unsorted input handling', () => {
    it('both functions handle unsorted entry arrays correctly', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        // 5 consecutive days ending today, in random order
        const entries = [
            entryDaysAgo(3),
            entryDaysAgo(0),
            entryDaysAgo(4),
            entryDaysAgo(1),
            entryDaysAgo(2),
        ];

        expect(getCurrentStreak(entries)).toBe(5);
        expect(getLongestStreak(entries)).toBe(5);

        vi.useRealTimers();
    });
});

describe('getHeatmapData', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('maps entries to correct date-value pairs over 12 months', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { mood: 8 } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 5), frontmatter: { mood: 5 } }),
        ];

        const result = getHeatmapData(entries, 'mood', 12);
        // Should span ~365 days
        expect(result.length).toBeGreaterThan(360);

        // Check specific values
        const today = result.find(d => d.date === '2026-03-06');
        expect(today?.value).toBe(8);
        const yesterday = result.find(d => d.date === '2026-03-05');
        expect(yesterday?.value).toBe(5);
    });

    it('returns null for days without entries', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { mood: 7 } }),
        ];

        const result = getHeatmapData(entries, 'mood', 1);
        // Day without entry (e.g. 2026-02-10)
        const missing = result.find(d => d.date === '2026-02-10');
        expect(missing?.value).toBeNull();
    });

    it('handles boolean fields (true→1, false→0)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 5), frontmatter: { workout: false } }),
        ];

        const result = getHeatmapData(entries, 'workout', 1);
        const today = result.find(d => d.date === '2026-03-06');
        expect(today?.value).toBe(1);
        const yesterday = result.find(d => d.date === '2026-03-05');
        expect(yesterday?.value).toBe(0);
    });
});

describe('getHabitStreaks', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    const workoutField: FrontmatterField = {
        key: 'workout',
        type: 'boolean',
        coverage: 0.8,
        total: 100,
    };

    it('returns correct boolean array for 90 days', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 5), frontmatter: { workout: false } }),
        ];

        const result = getHabitStreaks(entries, [workoutField]);
        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('workout');
        expect(result[0].days).toHaveLength(90);
        // Last element (today) should be true
        expect(result[0].days[89]).toBe(true);
        // Second to last (yesterday) should be false
        expect(result[0].days[88]).toBe(false);
    });

    it('current streak counts consecutive true at end', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        // 3 consecutive true days ending today
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 5), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 4), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 2, 3), frontmatter: { workout: false } }),
        ];

        const result = getHabitStreaks(entries, [workoutField]);
        expect(result[0].currentStreak).toBe(3);
    });

    it('longest streak finds the right run', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        // Recent: 2 true days. Older: 5 true days in a row
        const entries = [
            // Recent (short)
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 5), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 4), frontmatter: { workout: false } }),
            // Older (longer)
            makeEntry({ filePath: 'd.md', date: new Date(2026, 1, 20), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'e.md', date: new Date(2026, 1, 21), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'f.md', date: new Date(2026, 1, 22), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'g.md', date: new Date(2026, 1, 23), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'h.md', date: new Date(2026, 1, 24), frontmatter: { workout: true } }),
        ];

        const result = getHabitStreaks(entries, [workoutField]);
        expect(result[0].longestStreak).toBe(5);
    });

    it('empty entries → empty results', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

        const result = getHabitStreaks([], [workoutField]);
        expect(result).toHaveLength(1);
        expect(result[0].currentStreak).toBe(0);
        expect(result[0].longestStreak).toBe(0);
    });
});

describe('getPersonalBests', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    const moodField: FrontmatterField = { key: 'mood', type: 'number', coverage: 1.0, total: 100 };
    const anxietyField: FrontmatterField = { key: 'anxiety', type: 'number', coverage: 1.0, total: 100 };

    it('finds best 7-day rolling average', () => {
        // Create 10 entries with known mood values
        const entries: JournalEntry[] = [];
        for (let i = 0; i < 10; i++) {
            const date = new Date(2026, 0, i + 1);
            // Days 4-10 have mood 9, days 1-3 have mood 3
            const mood = i >= 3 ? 9 : 3;
            entries.push(makeEntry({ filePath: `d${i}.md`, date, frontmatter: { mood } }));
        }

        const result = getPersonalBests(entries, [moodField], {});
        // Should find a best-week entry for mood
        const bestWeek = result.find(r => r.type === 'best-week' && r.field === 'mood');
        expect(bestWeek).toBeDefined();
        expect(bestWeek!.value).toBe(9); // the window of 7x 9s = avg 9
    });

    it('finds most consistent month', () => {
        // January: 31 entries (100% consistent), February: 10 entries
        const entries: JournalEntry[] = [];
        for (let d = 1; d <= 31; d++) {
            entries.push(makeEntry({
                filePath: `jan${d}.md`,
                date: new Date(2026, 0, d),
                frontmatter: { mood: 5 },
            }));
        }
        for (let d = 1; d <= 10; d++) {
            entries.push(makeEntry({
                filePath: `feb${d}.md`,
                date: new Date(2026, 1, d),
                frontmatter: { mood: 5 },
            }));
        }

        const result = getPersonalBests(entries, [moodField], {});
        const bestMonth = result.find(r => r.type === 'most-consistent-month');
        expect(bestMonth).toBeDefined();
        expect(bestMonth!.period).toBe('2026-01');
        expect(bestMonth!.value).toBe(100); // 31/31 days = 100%
    });

    it('respects polarity for lower-is-better fields', () => {
        // Create entries where anxiety goes DOWN (which is better for lower-is-better)
        const entries: JournalEntry[] = [];
        for (let i = 0; i < 10; i++) {
            const date = new Date(2026, 0, i + 1);
            // Anxiety starts high and goes low
            const anxiety = 10 - i;
            entries.push(makeEntry({ filePath: `d${i}.md`, date, frontmatter: { anxiety } }));
        }

        const polarity: Record<string, string> = { anxiety: 'lower-is-better' };
        const result = getPersonalBests(entries, [anxietyField], polarity);

        // Should find a best-week for anxiety where avg is lowest (best for lower-is-better)
        const bestWeek = result.find(r => r.type === 'best-week' && r.field === 'anxiety');
        expect(bestWeek).toBeDefined();
        // Window of last 7 values: [4,3,2,1] → best avg should be the lowest window
        expect(bestWeek!.value).toBeLessThan(5);
    });
});

describe('getConsistencyScores', () => {
    it('returns correct counts for week, month, and all-time', () => {
        // Reference date: 2026-03-06 (Friday)
        const refDate = new Date(2026, 2, 6);

        // Entries: Mon, Tue, Wed of the same week (week starts Sunday)
        const entries = [
            makeEntry({ filePath: 'mon.md', date: new Date(2026, 2, 2) }),
            makeEntry({ filePath: 'tue.md', date: new Date(2026, 2, 3) }),
            makeEntry({ filePath: 'wed.md', date: new Date(2026, 2, 4) }),
        ];

        const scores = getConsistencyScores(entries, refDate, 0);

        // Week (Sun Mar 1 - Sat Mar 7): 7 possible days, 3 entries
        expect(scores.thisWeek.count).toBe(3);
        expect(scores.thisWeek.total).toBe(7);

        // Month (Mar 1-31): 31 possible days, 3 entries
        expect(scores.thisMonth.count).toBe(3);
        expect(scores.thisMonth.total).toBe(31);

        // All time: from earliest (Mar 2) to ref (Mar 6) = 5 days, 3 entries
        expect(scores.allTime.count).toBe(3);
        expect(scores.allTime.total).toBe(5);
    });

    it('handles single entry (all-time total = 1)', () => {
        const refDate = new Date(2026, 2, 6);
        const entries = [
            makeEntry({ filePath: 'today.md', date: new Date(2026, 2, 6) }),
        ];

        const scores = getConsistencyScores(entries, refDate, 0);
        expect(scores.allTime.count).toBe(1);
        expect(scores.allTime.total).toBe(1);
    });
});

describe('getGoalProgress', () => {
    it('sum type accumulates field values in period', () => {
        // Reference: 2026-03-06 (Friday), week starts Sunday (Mar 1)
        const refDate = new Date(2026, 2, 6);

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 2), frontmatter: { study_hours: 2 } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 3), frontmatter: { study_hours: 3 } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 5), frontmatter: { study_hours: 1.5 } }),
            // Outside current week — should not count
            makeEntry({ filePath: 'old.md', date: new Date(2026, 1, 20), frontmatter: { study_hours: 10 } }),
        ];

        const result = getGoalProgress(entries, 'study_hours', 'weekly', 'sum', 10, refDate, 0);
        expect(result.current).toBe(6.5); // 2 + 3 + 1.5
        expect(result.target).toBe(10);
        expect(result.progress).toBeCloseTo(0.65);
    });

    it('count type counts boolean true values in period', () => {
        const refDate = new Date(2026, 2, 6);

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 2), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 3), frontmatter: { workout: true } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 4), frontmatter: { workout: false } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 2, 5), frontmatter: { workout: true } }),
        ];

        const result = getGoalProgress(entries, 'workout', 'weekly', 'count', 5, refDate, 0);
        expect(result.current).toBe(3); // 3 true values
        expect(result.target).toBe(5);
        expect(result.progress).toBeCloseTo(0.6);
    });
});

describe('getAdherenceRate', () => {
    it('calculates correct rate for boolean field', () => {
        const refDate = new Date(2026, 2, 6);

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { meds: true } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 5), frontmatter: { meds: true } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 4), frontmatter: { meds: false } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 2, 3), frontmatter: { meds: true } }),
        ];

        const result = getAdherenceRate(entries, 'meds', 7, refDate);
        expect(result.completed).toBe(3);
        expect(result.total).toBe(4);
        expect(result.rate).toBeCloseTo(0.75);
    });

    it('excludes entries outside the lookback window', () => {
        const refDate = new Date(2026, 2, 6);

        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 6), frontmatter: { meds: true } }),
            // 30 days ago — outside a 7-day window
            makeEntry({ filePath: 'old.md', date: new Date(2026, 1, 4), frontmatter: { meds: true } }),
        ];

        const result = getAdherenceRate(entries, 'meds', 7, refDate);
        expect(result.completed).toBe(1);
        expect(result.total).toBe(1); // only the recent entry counts
        expect(result.rate).toBe(1);
    });
});

