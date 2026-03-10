/**
 * Lens Integration Tests — Phase 7.5
 *
 * Tests compound filtering, saved filter serialization, and random entry logic.
 */

import { describe, it, expect } from 'vitest';
import { applyLensFilters, sortEntries } from '../../src/utils/lensUtils';
import type { JournalEntry, LensFilterRow, FilterConfig } from '../../src/types';

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
        tasksCompleted: 0,
        tasksTotal: 0,
        ...overrides,
    };
}

/** Shared test data */
const testEntries: JournalEntry[] = [
    makeEntry('jan15.md', new Date(2026, 0, 15), {
        frontmatter: { mood: 5, energy: 3, tags: ['work', 'stress'] },
        sections: { 'What Actually Happened': 'Felt anxious about the meeting' },
        wordCount: 120,
        qualityScore: 60,
    }),
    makeEntry('feb10.md', new Date(2026, 1, 10), {
        frontmatter: { mood: 8, energy: 7, tags: ['exercise', 'therapy'] },
        sections: { 'What Actually Happened': 'Great day at work, very productive' },
        wordCount: 250,
        qualityScore: 90,
        imagePaths: ['img/photo.jpg'],
    }),
    makeEntry('feb20.md', new Date(2026, 1, 20), {
        frontmatter: { mood: 3, energy: 2, tags: ['health'] },
        sections: { 'What Actually Happened': 'Bad day, crohns flare up' },
        wordCount: 80,
        qualityScore: 40,
    }),
    makeEntry('mar05.md', new Date(2026, 2, 5), {
        frontmatter: { mood: 7, energy: 6, tags: ['exercise', 'work'] },
        sections: { 'What Actually Happened': 'Workout helped with anxiety' },
        wordCount: 180,
        qualityScore: 75,
    }),
    makeEntry('mar06.md', new Date(2026, 2, 6), {
        frontmatter: { energy: 4, tags: ['rest'] }, // mood is missing
        sections: { 'What Actually Happened': 'Quiet day, nothing special' },
        wordCount: 50,
        qualityScore: 30,
    }),
];

describe('lens compound filters', () => {
    it('date range + field filter applied together', () => {
        const filters: LensFilterRow[] = [
            { type: 'dateRange', startDate: '2026-02-01', endDate: '2026-02-28' },
            { type: 'field', fieldKey: 'mood', operator: '>=', value: 5 },
        ];

        const { filtered } = applyLensFilters(testEntries, '', filters, null);

        // Date range: feb10 + feb20
        // mood >= 5: feb10 (mood 8)
        expect(filtered).toHaveLength(1);
        expect(filtered[0].filePath).toBe('feb10.md');
    });

    it('tag filter narrows results correctly', () => {
        const filters: LensFilterRow[] = [
            { type: 'tag', tag: 'exercise' },
        ];

        const { filtered } = applyLensFilters(testEntries, '', filters, null);

        // exercise tag: feb10, mar05
        expect(filtered).toHaveLength(2);
        const paths = filtered.map(e => e.filePath);
        expect(paths).toContain('feb10.md');
        expect(paths).toContain('mar05.md');
    });

    it('all filters empty returns all entries', () => {
        const { filtered } = applyLensFilters(testEntries, '', [], null);

        expect(filtered).toHaveLength(testEntries.length);
    });

    it('text search with multi-term AND logic', () => {
        // "day work" should match entries containing both "day" AND "work"
        const { filtered } = applyLensFilters(testEntries, 'day work', [], null);

        // "Great day at work" in feb10 matches both terms
        expect(filtered.length).toBeGreaterThanOrEqual(1);
        const paths = filtered.map(e => e.filePath);
        expect(paths).toContain('feb10.md');
    });

    it('word count filter works', () => {
        const filters: LensFilterRow[] = [
            { type: 'wordCount', min: 100, max: 200 },
        ];

        const { filtered } = applyLensFilters(testEntries, '', filters, null);

        // 120 (jan15), 180 (mar05) are in range; 250 (feb10), 80 (feb20), 50 (mar06) are not
        expect(filtered).toHaveLength(2);
        const paths = filtered.map(e => e.filePath);
        expect(paths).toContain('jan15.md');
        expect(paths).toContain('mar05.md');
    });

    it('hasImages filter works', () => {
        const filters: LensFilterRow[] = [
            { type: 'hasImages', enabled: true },
        ];

        const { filtered } = applyLensFilters(testEntries, '', filters, null);

        // Only feb10 has images
        expect(filtered).toHaveLength(1);
        expect(filtered[0].filePath).toBe('feb10.md');
    });
});

describe('lens saved filters', () => {
    it('serialization/deserialization roundtrip', () => {
        const savedFilter: { name: string; config: FilterConfig } = {
            name: 'High mood days',
            config: {
                searchQuery: 'productive',
                filters: [
                    { type: 'field', fieldKey: 'mood', operator: '>=', value: 7 },
                    { type: 'tag', tag: 'work' },
                ],
            },
        };

        // Serialize to JSON (simulates saving to data.json)
        const json = JSON.stringify(savedFilter);
        // Deserialize (simulates loading from data.json)
        const loaded = JSON.parse(json) as typeof savedFilter;

        expect(loaded.name).toBe('High mood days');
        expect(loaded.config.searchQuery).toBe('productive');
        expect(loaded.config.filters).toHaveLength(2);
        expect(loaded.config.filters[0].type).toBe('field');
        expect(loaded.config.filters[1].type).toBe('tag');

        // Verify the deserialized config actually works with applyLensFilters
        const { filtered } = applyLensFilters(
            testEntries,
            loaded.config.searchQuery,
            loaded.config.filters,
            null
        );
        // "productive" + mood >= 7 + tag "work" → mar05 has mood 7 + tag "work" + "Workout helped with anxiety" (no "productive")
        // So only feb10 if it matches "productive" in "very productive" AND mood 8 AND has "work" tag → no, feb10 tags are ['exercise', 'therapy']
        // Actually feb10 has tags ['exercise', 'therapy'], not 'work'.
        // mar05 has tags ['exercise', 'work'], mood 7, section "Workout helped with anxiety" — no "productive" match
        // So result should be empty — this is a valid test of AND logic
        expect(filtered).toHaveLength(0);
    });

    it('removing a saved filter works', () => {
        const savedFilters: { name: string; config: FilterConfig }[] = [
            { name: 'Filter A', config: { searchQuery: '', filters: [] } },
            { name: 'Filter B', config: { searchQuery: 'test', filters: [] } },
            { name: 'Filter C', config: { searchQuery: '', filters: [] } },
        ];

        // Remove "Filter B" (simulates user deleting a saved filter)
        const updated = savedFilters.filter(f => f.name !== 'Filter B');

        expect(updated).toHaveLength(2);
        expect(updated.map(f => f.name)).toEqual(['Filter A', 'Filter C']);
    });
});

describe('lens random entry', () => {
    it('returns an entry from filtered set', () => {
        const { filtered } = applyLensFilters(testEntries, '', [], null);

        // Simulate random entry selection
        const randomIdx = Math.floor(Math.random() * filtered.length);
        const entry = filtered[randomIdx];

        expect(entry).toBeDefined();
        expect(entry.filePath).toBeTruthy();
        expect(testEntries.map(e => e.filePath)).toContain(entry.filePath);
    });

    it('empty filtered set has no entries to select', () => {
        // Use a filter that eliminates all entries
        const filters: LensFilterRow[] = [
            { type: 'field', fieldKey: 'mood', operator: '>=', value: 100 },
        ];
        const { filtered } = applyLensFilters(testEntries, '', filters, null);

        expect(filtered).toHaveLength(0);
        // Random selection on empty set would return undefined
        const entry = filtered.length > 0 ? filtered[0] : null;
        expect(entry).toBeNull();
    });
});

describe('lens sorting', () => {
    it('sorts by date newest first', () => {
        const sorted = sortEntries(testEntries, 'date-newest');
        expect(sorted[0].filePath).toBe('mar06.md');
        expect(sorted[sorted.length - 1].filePath).toBe('jan15.md');
    });

    it('sorts by quality high to low', () => {
        const sorted = sortEntries(testEntries, 'quality-high');
        expect(sorted[0].filePath).toBe('feb10.md'); // quality 90
        expect(sorted[sorted.length - 1].filePath).toBe('mar06.md'); // quality 30
    });

    it('sorts by word count low to high', () => {
        const sorted = sortEntries(testEntries, 'wordcount-low');
        expect(sorted[0].filePath).toBe('mar06.md'); // 50 words
        expect(sorted[sorted.length - 1].filePath).toBe('feb10.md'); // 250 words
    });
});
