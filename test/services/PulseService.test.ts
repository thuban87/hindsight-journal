import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCurrentStreak, getLongestStreak } from '../../src/services/PulseService';
import type { JournalEntry } from '../../src/types';

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
