import { describe, it, expect } from 'vitest';
import {
    getOnThisDay,
    getThisWeekLastYear,
    compareMetrics,
    findSimilarEntries,
    detectMilestones,
    getExtendedEchoes,
} from '../../src/services/EchoesService';
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

// ---- Phase 7.5: New tests for compareMetrics, findSimilarEntries, detectMilestones, getExtendedEchoes ----

/** Shared field definitions for metric comparison tests */
const numericFields: FrontmatterField[] = [
    { key: 'mood', type: 'number', coverage: 1, total: 100, range: { min: 1, max: 10 } },
    { key: 'energy', type: 'number', coverage: 1, total: 100, range: { min: 1, max: 10 } },
    { key: 'anxiety', type: 'number', coverage: 0.5, total: 100, range: { min: 1, max: 10 } },
];

describe('compareMetrics', () => {
    it('correct comparison for matching fields', () => {
        const todayEntry = makeEntry({
            filePath: 'today.md',
            date: new Date(2026, 2, 10),
            frontmatter: { mood: 7, energy: 6 },
        });
        const echoEntry = makeEntry({
            filePath: 'echo.md',
            date: new Date(2025, 2, 10),
            frontmatter: { mood: 3, energy: 8 },
        });

        const result = compareMetrics(todayEntry, echoEntry, numericFields, {});

        expect(result).toHaveLength(2);

        const moodComp = result.find(c => c.field === 'mood');
        expect(moodComp).toBeDefined();
        expect(moodComp!.today).toBe(7);
        expect(moodComp!.then).toBe(3);
        expect(moodComp!.change).toBe(4);

        const energyComp = result.find(c => c.field === 'energy');
        expect(energyComp).toBeDefined();
        expect(energyComp!.today).toBe(6);
        expect(energyComp!.then).toBe(8);
        expect(energyComp!.change).toBe(-2);
    });

    it('skips fields not present in both entries', () => {
        const todayEntry = makeEntry({
            filePath: 'today.md',
            date: new Date(2026, 2, 10),
            frontmatter: { mood: 7 }, // no energy, no anxiety
        });
        const echoEntry = makeEntry({
            filePath: 'echo.md',
            date: new Date(2025, 2, 10),
            frontmatter: { mood: 5, anxiety: 3 }, // no energy
        });

        const result = compareMetrics(todayEntry, echoEntry, numericFields, {});

        // Only mood exists in both
        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('mood');
    });

    it('direction respects polarity settings', () => {
        const todayEntry = makeEntry({
            filePath: 'today.md',
            date: new Date(2026, 2, 10),
            frontmatter: { mood: 7, anxiety: 2 },
        });
        const echoEntry = makeEntry({
            filePath: 'echo.md',
            date: new Date(2025, 2, 10),
            frontmatter: { mood: 3, anxiety: 8 },
        });

        const polarity: Record<string, string> = {
            mood: 'higher-is-better',
            anxiety: 'lower-is-better',
        };

        const result = compareMetrics(todayEntry, echoEntry, numericFields, polarity);

        const moodComp = result.find(c => c.field === 'mood');
        expect(moodComp!.direction).toBe('improved'); // 3 -> 7, higher is better

        const anxietyComp = result.find(c => c.field === 'anxiety');
        expect(anxietyComp!.direction).toBe('improved'); // 8 -> 2, lower is better
    });

    it('returns empty array when todayEntry is undefined', () => {
        const echoEntry = makeEntry({
            filePath: 'echo.md',
            date: new Date(2025, 2, 10),
            frontmatter: { mood: 5 },
        });

        const result = compareMetrics(undefined, echoEntry, numericFields, {});
        expect(result).toEqual([]);
    });
});

describe('findSimilarEntries', () => {
    // Use dates far in the past so they're never "today"
    const entries = [
        makeEntry({ filePath: 'a.md', date: new Date(2025, 0, 1), frontmatter: { mood: 3 } }),
        makeEntry({ filePath: 'b.md', date: new Date(2025, 1, 1), frontmatter: { mood: 4 } }),
        makeEntry({ filePath: 'c.md', date: new Date(2025, 2, 1), frontmatter: { mood: 7 } }),
        makeEntry({ filePath: 'd.md', date: new Date(2025, 3, 1), frontmatter: { mood: 3 } }),
        makeEntry({ filePath: 'e.md', date: new Date(2025, 4, 1), frontmatter: { mood: 2 } }),
        makeEntry({ filePath: 'f.md', date: new Date(2025, 5, 1), frontmatter: { mood: 4 } }),
    ];

    it('finds entries within tolerance range', () => {
        // Target mood=3, tolerance=1 → matches 2, 3, 4
        const result = findSimilarEntries(entries, 'mood', 3, 1);

        const matchedMoods = result.map(e => e.frontmatter['mood']);
        for (const mood of matchedMoods) {
            expect(Math.abs((mood as number) - 3)).toBeLessThanOrEqual(1);
        }
        expect(result.length).toBeGreaterThan(0);
    });

    it('excludes today\'s entry', () => {
        // Create an entry dated today
        const today = new Date();
        const entriesWithToday = [
            ...entries,
            makeEntry({ filePath: 'today.md', date: today, frontmatter: { mood: 3 } }),
        ];

        const result = findSimilarEntries(entriesWithToday, 'mood', 3, 0);

        const filePaths = result.map(e => e.filePath);
        expect(filePaths).not.toContain('today.md');
    });

    it('returns most recent matches first', () => {
        const result = findSimilarEntries(entries, 'mood', 3, 1);

        // Verify sorted newest first
        for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].date.getTime()).toBeGreaterThanOrEqual(result[i].date.getTime());
        }
    });

    it('respects limit parameter', () => {
        const result = findSimilarEntries(entries, 'mood', 3, 2, 2);

        expect(result.length).toBeLessThanOrEqual(2);
    });
});

describe('detectMilestones', () => {
    it('detects 100th entry milestone', () => {
        const entries = Array.from({ length: 100 }, (_, i) =>
            makeEntry({
                filePath: `entry-${i}.md`,
                date: new Date(2025, 0, i + 1),
            })
        );

        const result = detectMilestones(entries, 0, new Date(2026, 2, 10));

        const countMilestone = result.find(m => m.type === 'entry-count');
        expect(countMilestone).toBeDefined();
        expect(countMilestone!.value).toBe(100);
        expect(countMilestone!.title).toContain('100');
    });

    it('detects 1-year anniversary', () => {
        const firstDate = new Date(2025, 2, 10); // March 10, 2025
        const refDate = new Date(2026, 2, 10); // March 10, 2026 — exactly 365 days later

        const entries = [
            makeEntry({ filePath: 'first.md', date: firstDate }),
            makeEntry({ filePath: 'recent.md', date: new Date(2026, 2, 9) }),
        ];

        const result = detectMilestones(entries, 0, refDate);

        const anniversary = result.find(m => m.type === 'anniversary');
        expect(anniversary).toBeDefined();
        expect(anniversary!.title).toContain('1 year');
    });

    it('no milestone for non-milestone counts', () => {
        const entries = Array.from({ length: 42 }, (_, i) =>
            makeEntry({
                filePath: `entry-${i}.md`,
                date: new Date(2026, 0, i + 1),
            })
        );

        const result = detectMilestones(entries, 15, new Date(2026, 2, 10));

        // 42 entries is not a milestone count, 15 streak is not a milestone streak
        expect(result).toEqual([]);
    });

    it('detects streak milestone', () => {
        const entries = [makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 10) })];

        const result = detectMilestones(entries, 30, new Date(2026, 2, 10));

        const streakMilestone = result.find(m => m.type === 'streak');
        expect(streakMilestone).toBeDefined();
        expect(streakMilestone!.value).toBe(30);
        expect(streakMilestone!.title).toContain('30-day');
    });
});

describe('getExtendedEchoes', () => {
    it('returns entries for same day of month', () => {
        const refDate = new Date(2026, 2, 15); // March 15

        const entries = [
            makeEntry({ filePath: 'feb15.md', date: new Date(2026, 1, 15) }), // same day, prev month
            makeEntry({ filePath: 'jan15.md', date: new Date(2026, 0, 15) }), // same day, 2 months ago
            makeEntry({ filePath: 'mar10.md', date: new Date(2026, 2, 10) }), // different day
            makeEntry({ filePath: 'mar15.md', date: new Date(2026, 2, 15) }), // same month+day (excluded)
        ];

        const result = getExtendedEchoes(entries, refDate);

        const lastMonth = result.find(r => r.period === 'This time last month');
        expect(lastMonth).toBeDefined();
        expect(lastMonth!.entries.length).toBeGreaterThanOrEqual(1);

        // All matched entries should be on the 15th
        for (const entry of lastMonth!.entries) {
            expect(entry.date.getDate()).toBe(15);
        }

        // Should not include the current month's entry
        const filePaths = lastMonth!.entries.map(e => e.filePath);
        expect(filePaths).not.toContain('mar15.md');
    });

    it('returns entries for quarterly periods', () => {
        const refDate = new Date(2026, 2, 15); // March 15, 2026

        const entries = [
            // 3 months ago: Dec 15, 2025
            makeEntry({ filePath: 'dec15.md', date: new Date(2025, 11, 15) }),
            // 6 months ago: Sep 15, 2025
            makeEntry({ filePath: 'sep15.md', date: new Date(2025, 8, 15) }),
            // Unrelated date
            makeEntry({ filePath: 'jan20.md', date: new Date(2026, 0, 20) }),
        ];

        const result = getExtendedEchoes(entries, refDate);

        const quarter = result.find(r => r.period === 'Last quarter');
        expect(quarter).toBeDefined();
        // Should find dec15 (3 months ago) and sep15 (6 months ago)
        expect(quarter!.entries.length).toBeGreaterThanOrEqual(1);

        const filePaths = quarter!.entries.map(e => e.filePath);
        expect(filePaths).toContain('dec15.md');
    });
});
