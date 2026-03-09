import { describe, it, expect } from 'vitest';
import {
    getWeekBounds,
    getMonthBounds,
    getEntriesInPeriod,
    aggregateByPeriod,
} from '../../src/utils/periodUtils';
import type { JournalEntry } from '../../src/types';

/** Helper to create a minimal JournalEntry for testing */
function makeEntry(dateStr: string, frontmatter: Record<string, unknown> = {}): JournalEntry {
    return {
        filePath: `Journal/${dateStr}.md`,
        date: new Date(dateStr + 'T00:00:00'),
        dayOfWeek: '',
        frontmatter,
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 100,
    };
}

describe('getWeekBounds', () => {
    it('returns Sunday-Saturday for weekStartDay=0', () => {
        // Wednesday, March 5, 2026
        const ref = new Date(2026, 2, 5);
        const { start, end } = getWeekBounds(ref, 0);
        expect(start.getDay()).toBe(0); // Sunday
        expect(end.getDay()).toBe(6);   // Saturday
        expect(start.getDate()).toBe(1); // March 1
        expect(end.getDate()).toBe(7);   // March 7
    });

    it('returns Monday-Sunday for weekStartDay=1', () => {
        // Wednesday, March 5, 2026
        const ref = new Date(2026, 2, 5);
        const { start, end } = getWeekBounds(ref, 1);
        expect(start.getDay()).toBe(1); // Monday
        expect(end.getDay()).toBe(0);   // Sunday
        expect(start.getDate()).toBe(2); // March 2
        expect(end.getDate()).toBe(8);   // March 8
    });

    it('handles week spanning month boundary', () => {
        // Friday, January 2, 2026
        const ref = new Date(2026, 0, 2);
        const { start, end } = getWeekBounds(ref, 0);
        expect(start.getMonth()).toBe(11); // December (previous month)
        expect(start.getFullYear()).toBe(2025);
        expect(end.getMonth()).toBe(0);    // January
    });

    it('handles reference date on start of week', () => {
        // Sunday, March 1, 2026
        const ref = new Date(2026, 2, 1);
        const { start, end } = getWeekBounds(ref, 0);
        expect(start.getDate()).toBe(1); // Same day
        expect(end.getDate()).toBe(7);
    });

    it('handles reference date on end of week', () => {
        // Saturday, March 7, 2026
        const ref = new Date(2026, 2, 7);
        const { start, end } = getWeekBounds(ref, 0);
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(7); // Same day
    });
});

describe('getMonthBounds', () => {
    it('returns first and last day of month', () => {
        const ref = new Date(2026, 2, 15); // March 15
        const { start, end } = getMonthBounds(ref);
        expect(start.getDate()).toBe(1);
        expect(start.getMonth()).toBe(2);
        expect(end.getDate()).toBe(31);
        expect(end.getMonth()).toBe(2);
    });

    it('handles February in non-leap year', () => {
        const ref = new Date(2026, 1, 10); // Feb 10, 2026
        const { start, end } = getMonthBounds(ref);
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(28);
    });

    it('handles February in leap year', () => {
        const ref = new Date(2024, 1, 10); // Feb 10, 2024
        const { start, end } = getMonthBounds(ref);
        expect(end.getDate()).toBe(29);
    });

    it('handles December', () => {
        const ref = new Date(2026, 11, 25); // Dec 25
        const { start, end } = getMonthBounds(ref);
        expect(start.getMonth()).toBe(11);
        expect(end.getDate()).toBe(31);
    });
});

describe('getEntriesInPeriod', () => {
    const entries = [
        makeEntry('2026-03-01'),
        makeEntry('2026-03-03'),
        makeEntry('2026-03-05'),
        makeEntry('2026-03-08'),
        makeEntry('2026-03-15'),
    ];

    it('filters entries to current week', () => {
        // March 5 is in the week Sun Mar 1 - Sat Mar 7 (weekStart=0)
        const result = getEntriesInPeriod(entries, 'week', new Date(2026, 2, 5), 0);
        expect(result).toHaveLength(3); // Mar 1, 3, 5
    });

    it('filters entries to current month', () => {
        const result = getEntriesInPeriod(entries, 'month', new Date(2026, 2, 15));
        expect(result).toHaveLength(5); // All March entries
    });

    it('returns empty for no matching entries', () => {
        const result = getEntriesInPeriod(entries, 'week', new Date(2026, 3, 1), 0);
        expect(result).toHaveLength(0);
    });
});

describe('aggregateByPeriod', () => {
    const entries = [
        makeEntry('2026-03-01', { mood: 7 }),
        makeEntry('2026-03-02', { mood: 8 }),
        makeEntry('2026-03-03', { mood: 6 }),
        makeEntry('2026-03-08', { mood: 9 }),
        makeEntry('2026-03-09', { mood: 5 }),
    ];

    it('returns daily data points', () => {
        const result = aggregateByPeriod(entries, 'mood', 'daily');
        expect(result).toHaveLength(5);
        expect(result[0].value).toBe(7);
        expect(result[4].value).toBe(5);
    });

    it('returns null for missing field values', () => {
        const mixedEntries = [
            makeEntry('2026-03-01', { mood: 7 }),
            makeEntry('2026-03-02', {}), // no mood
        ];
        const result = aggregateByPeriod(mixedEntries, 'mood', 'daily');
        expect(result[1].value).toBeNull();
    });

    it('aggregates weekly averages', () => {
        const result = aggregateByPeriod(entries, 'mood', 'weekly', 0);
        expect(result.length).toBeGreaterThan(0);
        // Each result should be an average
        for (const point of result) {
            if (point.value !== null) {
                expect(point.value).toBeGreaterThanOrEqual(5);
                expect(point.value).toBeLessThanOrEqual(9);
            }
        }
    });

    it('returns empty for empty entries', () => {
        const result = aggregateByPeriod([], 'mood', 'daily');
        expect(result).toHaveLength(0);
    });
});
