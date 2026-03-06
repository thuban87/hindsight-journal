import { describe, it, expect } from 'vitest';
import { applyFilters, applySorting } from '../../src/utils/filterUtils';
import type { JournalEntry } from '../../src/types';
import type { IndexFilterConfig, IndexSortConfig } from '../../src/utils/filterUtils';

/**
 * Filter Integration Tests — Phase 4.5
 *
 * Tests the extracted filter and sort logic with realistic journal data.
 */

/** Helper to create a minimal JournalEntry */
function makeEntry(
    filePath: string,
    date: Date,
    overrides?: Partial<JournalEntry>
): JournalEntry {
    return {
        filePath,
        date,
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
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

/** Helper for empty filter config */
function emptyFilters(): IndexFilterConfig {
    return { search: '', dateRange: null, fieldFilters: [] };
}

/** Shared test data */
const testEntries: JournalEntry[] = [
    makeEntry('jan15.md', new Date(2026, 0, 15), {
        frontmatter: { mood: 5, energy: 3 },
        sections: { 'What Actually Happened': 'Felt anxious about the meeting' },
        wordCount: 120,
    }),
    makeEntry('feb10.md', new Date(2026, 1, 10), {
        frontmatter: { mood: 8, energy: 7 },
        sections: { 'What Actually Happened': 'Great day at work, very productive' },
        wordCount: 250,
    }),
    makeEntry('feb20.md', new Date(2026, 1, 20), {
        frontmatter: { mood: 3, energy: 2 },
        sections: { 'What Actually Happened': 'Bad day, crohns flare up' },
        wordCount: 80,
    }),
    makeEntry('mar05.md', new Date(2026, 2, 5), {
        frontmatter: { mood: 7, energy: 6 },
        sections: { 'What Actually Happened': 'Workout helped with anxiety' },
        wordCount: 180,
    }),
    makeEntry('mar06.md', new Date(2026, 2, 6), {
        frontmatter: { energy: 4 }, // mood is missing/null
        sections: { 'What Actually Happened': 'Quiet day, nothing special' },
        wordCount: 50,
    }),
];

describe('filter-integration', () => {
    describe('text search', () => {
        it('matches content substring, case insensitive', () => {
            const filters = { ...emptyFilters(), search: 'ANXIOUS' };
            const result = applyFilters(testEntries, filters);
            expect(result).toHaveLength(1);
            expect(result[0].filePath).toBe('jan15.md');
        });

        it('partial word match (searching "anxi" finds "anxious")', () => {
            const filters = { ...emptyFilters(), search: 'anxi' };
            const result = applyFilters(testEntries, filters);
            // Should match jan15 ("anxious") and mar05 ("anxiety")
            expect(result).toHaveLength(2);
            const paths = result.map(e => e.filePath);
            expect(paths).toContain('jan15.md');
            expect(paths).toContain('mar05.md');
        });

        it('no match returns empty', () => {
            const filters = { ...emptyFilters(), search: 'unicorn' };
            const result = applyFilters(testEntries, filters);
            expect(result).toHaveLength(0);
        });
    });

    describe('date range', () => {
        it('entries inside range returned, outside excluded', () => {
            const filters: IndexFilterConfig = {
                ...emptyFilters(),
                dateRange: {
                    start: new Date(2026, 1, 1),
                    end: new Date(2026, 1, 28),
                },
            };
            const result = applyFilters(testEntries, filters);
            expect(result).toHaveLength(2);
            const paths = result.map(e => e.filePath);
            expect(paths).toContain('feb10.md');
            expect(paths).toContain('feb20.md');
        });

        it('boundary dates included (inclusive)', () => {
            const filters: IndexFilterConfig = {
                ...emptyFilters(),
                dateRange: {
                    start: new Date(2026, 1, 10),
                    end: new Date(2026, 1, 20),
                },
            };
            const result = applyFilters(testEntries, filters);
            expect(result).toHaveLength(2);
            expect(result.map(e => e.filePath)).toContain('feb10.md');
            expect(result.map(e => e.filePath)).toContain('feb20.md');
        });
    });

    describe('field filters', () => {
        it('mood >= 7 returns only entries with mood 7+', () => {
            const filters: IndexFilterConfig = {
                ...emptyFilters(),
                fieldFilters: [{ field: 'mood', operator: '>=', value: 7 }],
            };
            const result = applyFilters(testEntries, filters);
            expect(result).toHaveLength(2);
            const paths = result.map(e => e.filePath);
            expect(paths).toContain('feb10.md'); // mood 8
            expect(paths).toContain('mar05.md'); // mood 7
        });

        it('mood >= 7 excludes entries with null/undefined mood', () => {
            const filters: IndexFilterConfig = {
                ...emptyFilters(),
                fieldFilters: [{ field: 'mood', operator: '>=', value: 7 }],
            };
            const result = applyFilters(testEntries, filters);
            // mar06 has no mood field — should be excluded
            expect(result.map(e => e.filePath)).not.toContain('mar06.md');
        });
    });

    describe('combined filters', () => {
        it('text search + date range + field filter applied together', () => {
            const filters: IndexFilterConfig = {
                search: 'day',
                dateRange: {
                    start: new Date(2026, 1, 1),
                    end: new Date(2026, 2, 31),
                },
                fieldFilters: [{ field: 'mood', operator: '>=', value: 5 }],
            };
            const result = applyFilters(testEntries, filters);
            // "day" matches feb10 ("Great day"), feb20 ("Bad day"), mar06 ("Quiet day")
            // date range excludes jan15
            // mood >= 5 excludes feb20 (mood 3), mar06 (no mood)
            // Only feb10 survives all three
            expect(result).toHaveLength(1);
            expect(result[0].filePath).toBe('feb10.md');
        });

        it('all filters empty returns all entries', () => {
            const result = applyFilters(testEntries, emptyFilters());
            expect(result).toHaveLength(testEntries.length);
        });
    });

    describe('sorting', () => {
        it('ascending by date returns oldest first', () => {
            const sort: IndexSortConfig = { field: 'date', direction: 'asc' };
            const result = applySorting(testEntries, sort);
            expect(result[0].filePath).toBe('jan15.md');
            expect(result[result.length - 1].filePath).toBe('mar06.md');
        });

        it('descending by mood returns highest mood first', () => {
            const sort: IndexSortConfig = { field: 'mood', direction: 'desc' };
            const result = applySorting(testEntries, sort);
            // feb10 has mood 8 (highest)
            expect(result[0].filePath).toBe('feb10.md');
        });

        it('entries with null values for sort field placed at end', () => {
            const sort: IndexSortConfig = { field: 'mood', direction: 'asc' };
            const result = applySorting(testEntries, sort);
            // mar06 has no mood → placed at end
            expect(result[result.length - 1].filePath).toBe('mar06.md');
        });
    });
});
