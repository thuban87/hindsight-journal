import { describe, it, expect } from 'vitest';
import {
    detectFields,
    inferFieldType,
    getFieldTimeSeries,
} from '../../src/services/FrontmatterService';
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

describe('inferFieldType', () => {
    it('infers number when all values are numbers', () => {
        expect(inferFieldType([1, 2, 3, 7.5])).toBe('number');
    });

    it('infers boolean when all values are booleans', () => {
        expect(inferFieldType([true, false, true])).toBe('boolean');
    });

    it('infers string[] when all values are arrays', () => {
        expect(inferFieldType([['a', 'b'], ['c']])).toBe('string[]');
    });

    it('infers date when all values match ISO date pattern', () => {
        expect(inferFieldType(['2026-03-05', '2026-01-01'])).toBe('date');
    });

    it('falls back to string for mixed types', () => {
        expect(inferFieldType([1, 'hello', true])).toBe('string');
    });

    it('falls back to string for empty array', () => {
        expect(inferFieldType([])).toBe('string');
    });

    it('ignores null/undefined/empty when inferring type', () => {
        expect(inferFieldType([null, 5, undefined, 10, ''])).toBe('number');
    });

    it('falls back to string when all values are null/empty', () => {
        expect(inferFieldType([null, undefined, ''])).toBe('string');
    });
});

describe('detectFields', () => {
    it('detects fields with consistent types across entries', () => {
        const entries = [
            makeEntry({
                filePath: 'a.md',
                date: new Date(2026, 2, 1),
                frontmatter: { mood: 7, workout: true, tags: ['health'] },
            }),
            makeEntry({
                filePath: 'b.md',
                date: new Date(2026, 2, 2),
                frontmatter: { mood: 8, workout: false, tags: ['work'] },
            }),
        ];

        const fields = detectFields(entries);
        const moodField = fields.find(f => f.key === 'mood');
        const workoutField = fields.find(f => f.key === 'workout');
        const tagsField = fields.find(f => f.key === 'tags');

        expect(moodField?.type).toBe('number');
        expect(workoutField?.type).toBe('boolean');
        expect(tagsField?.type).toBe('string[]');
    });

    it('calculates coverage correctly', () => {
        const entries: JournalEntry[] = [];
        for (let i = 0; i < 10; i++) {
            entries.push(makeEntry({
                filePath: `entry${i}.md`,
                date: new Date(2026, 2, i + 1),
                frontmatter: i < 7 ? { mood: 5 + i } : {},
            }));
        }

        const fields = detectFields(entries);
        const moodField = fields.find(f => f.key === 'mood');

        expect(moodField?.coverage).toBe(7);
        expect(moodField?.total).toBe(10);
    });

    it('computes correct min/max range for numeric fields', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 1), frontmatter: { mood: 3 } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 2), frontmatter: { mood: 9 } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 3), frontmatter: { mood: 5 } }),
        ];

        const fields = detectFields(entries);
        const moodField = fields.find(f => f.key === 'mood');

        expect(moodField?.range?.min).toBe(3);
        expect(moodField?.range?.max).toBe(9);
    });

    it('does not count null/undefined/empty-string toward coverage', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 1), frontmatter: { mood: 7 } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 2), frontmatter: { mood: null } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 3), frontmatter: { mood: '' } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 2, 4), frontmatter: { mood: undefined } }),
        ];

        const fields = detectFields(entries);
        const moodField = fields.find(f => f.key === 'mood');

        expect(moodField?.coverage).toBe(1); // Only the first entry has a real value
    });

    it('returns empty array for no entries', () => {
        expect(detectFields([])).toEqual([]);
    });
});

describe('getFieldTimeSeries', () => {
    const entries = [
        makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 1), frontmatter: { mood: 7, status: 'good' } }),
        makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 2), frontmatter: { mood: 5, status: 'ok' } }),
        makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 3), frontmatter: {} }),
    ];

    it('returns correct date-value pairs for numeric field', () => {
        const series = getFieldTimeSeries(entries, 'mood');
        expect(series).toHaveLength(3);
        expect(series[0].value).toBe(7);
        expect(series[1].value).toBe(5);
        expect(series[0].date).toBe(entries[0].date.getTime());
    });

    it('returns null for entries missing the field', () => {
        const series = getFieldTimeSeries(entries, 'mood');
        expect(series[2].value).toBeNull();
    });

    it('returns all null values for non-numeric field', () => {
        const series = getFieldTimeSeries(entries, 'status');
        expect(series[0].value).toBeNull();
        expect(series[1].value).toBeNull();
    });
});
