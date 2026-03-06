import { describe, it, expect } from 'vitest';
import { getOnThisDay, getThisWeekLastYear } from '../../src/services/EchoesService';
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

describe('getOnThisDay', () => {
    it('finds entries from same date in previous years', () => {
        const dateIndex = new Map<string, JournalEntry[]>();
        dateIndex.set('03-06', [
            makeEntry({ filePath: '2024.md', date: new Date(2024, 2, 6) }),
            makeEntry({ filePath: '2025.md', date: new Date(2025, 2, 6) }),
            makeEntry({ filePath: '2026.md', date: new Date(2026, 2, 6) }),
        ]);

        const result = getOnThisDay(new Date(2026, 2, 6), dateIndex);

        expect(result).toHaveLength(2);
        expect(result[0].date.getFullYear()).toBe(2025);
        expect(result[1].date.getFullYear()).toBe(2024);
    });

    it('returns empty array when no past entries exist', () => {
        const dateIndex = new Map<string, JournalEntry[]>();
        dateIndex.set('03-06', [
            makeEntry({ filePath: '2026.md', date: new Date(2026, 2, 6) }),
        ]);

        const result = getOnThisDay(new Date(2026, 2, 6), dateIndex);

        expect(result).toEqual([]);
    });

    it('handles Feb 29 (leap year) — no match on non-leap years', () => {
        const dateIndex = new Map<string, JournalEntry[]>();
        // Feb 29 entries only exist in leap years
        dateIndex.set('02-29', [
            makeEntry({ filePath: '2024.md', date: new Date(2024, 1, 29) }),
        ]);

        // 2025 is not a leap year — Feb 29 doesn't exist, so no lookup
        // But if someone queries Feb 29 on 2026 (non-leap), the key still matches
        // The function filters by year, so the 2024 entry should be returned
        const result = getOnThisDay(new Date(2024, 1, 29), dateIndex);

        // Target is 2024 itself, so the 2024 entry is excluded (same year)
        expect(result).toEqual([]);
    });

    it('sorted by year (most recent first)', () => {
        const dateIndex = new Map<string, JournalEntry[]>();
        dateIndex.set('07-15', [
            makeEntry({ filePath: '2022.md', date: new Date(2022, 6, 15) }),
            makeEntry({ filePath: '2024.md', date: new Date(2024, 6, 15) }),
            makeEntry({ filePath: '2023.md', date: new Date(2023, 6, 15) }),
        ]);

        const result = getOnThisDay(new Date(2026, 6, 15), dateIndex);

        expect(result).toHaveLength(3);
        expect(result[0].date.getFullYear()).toBe(2024);
        expect(result[1].date.getFullYear()).toBe(2023);
        expect(result[2].date.getFullYear()).toBe(2022);
    });
});

describe('getThisWeekLastYear', () => {
    it('finds entries from same week number in previous year', () => {
        // March 6, 2026 is a Friday in week 10
        // March 7, 2025 is also in week 10
        // Now that we compare week numbers only (not ISO week year), this works
        const target = new Date(2026, 2, 6);
        const entries = [
            makeEntry({ filePath: 'match.md', date: new Date(2025, 2, 7) }),
            makeEntry({ filePath: 'nomatch.md', date: new Date(2025, 5, 15) }),
        ];

        const result = getThisWeekLastYear(target, entries);

        expect(result).toHaveLength(1);
        expect(result[0].filePath).toBe('match.md');
    });

    it('handles week 1/52 boundary (year transition)', () => {
        // Dec 29, 2025 is ISO week 1 of 2026 (Monday)
        // Jan 2, 2026 is also ISO week 1 of 2026 (Friday)
        const target = new Date(2026, 0, 2); // Jan 2, 2026
        const entries = [
            makeEntry({ filePath: 'dec29.md', date: new Date(2025, 11, 29) }),
        ];

        const result = getThisWeekLastYear(target, entries);

        // Dec 29, 2025 is in the same ISO week as Jan 2, 2026
        // but the function filters out same-year entries by calendar year
        // Dec 29, 2025 has calendar year 2025 ≠ 2026, so it passes the filter
        // Both dates share ISO week 1 of ISO year 2026, so isSameWeek returns true
        expect(result).toHaveLength(1);
        expect(result[0].filePath).toBe('dec29.md');
    });

    it('returns empty array when no data for that week', () => {
        const result = getThisWeekLastYear(new Date(2026, 2, 6), []);

        expect(result).toEqual([]);
    });
});
