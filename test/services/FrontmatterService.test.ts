import { describe, it, expect } from 'vitest';
import {
    detectFields,
    inferFieldType,
    getFieldTimeSeries,
    isNumericField,
    getNumericValue,
    extractNumericPart,
    getBooleanValue,
} from '../../src/services/FrontmatterService';
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

    it('coerces numeric strings via Number() for time series', () => {
        const numericTextEntries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 1), frontmatter: { productivity: '7' } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 2), frontmatter: { productivity: '3.5' } }),
        ];
        const series = getFieldTimeSeries(numericTextEntries, 'productivity');
        expect(series[0].value).toBe(7);
        expect(series[1].value).toBe(3.5);
    });
});

describe('inferFieldType — numeric-text', () => {
    it('infers numeric-text when all string values are numeric', () => {
        expect(inferFieldType(['1', '2', '3', '7.5'])).toBe('numeric-text');
    });

    it('infers numeric-text when ≥80% string values are numeric', () => {
        // 4 out of 5 = 80% → should be numeric-text
        expect(inferFieldType(['1', '2', '3', '4', 'N/A'])).toBe('numeric-text');
    });

    it('falls back to string when <80% string values are numeric', () => {
        // 3 out of 5 = 60% → should be string
        expect(inferFieldType(['1', '2', '3', 'hello', 'world'])).toBe('string');
    });

    it('returns number (not numeric-text) for native JS numbers', () => {
        expect(inferFieldType([1, 2, 3])).toBe('number');
    });

    it('returns string for mixed types (numbers + non-numeric strings)', () => {
        // Mix of native numbers and non-numeric strings → string
        expect(inferFieldType([1, 'hello', 3])).toBe('string');
    });

    it('returns numeric-text for mixed native numbers and numeric strings', () => {
        // This is the real-world case: older entries have `anxiety: 6` (number)
        // and newer entries have `anxiety: "3"` (quoted string)
        expect(inferFieldType([6, '3', 7, '5', '4'])).toBe('numeric-text');
    });

    it('handles negative and decimal numeric strings', () => {
        expect(inferFieldType(['-3.5', '0', '7.2', '100'])).toBe('numeric-text');
    });

    it('returns string when all strings are empty after filtering', () => {
        expect(inferFieldType(['', '', null, undefined])).toBe('string');
    });
});

describe('isNumericField', () => {
    it('returns true for number type', () => {
        const field: FrontmatterField = { key: 'mood', type: 'number', coverage: 10, total: 10 };
        expect(isNumericField(field)).toBe(true);
    });

    it('returns true for numeric-text type', () => {
        const field: FrontmatterField = { key: 'productivity', type: 'numeric-text', coverage: 10, total: 10 };
        expect(isNumericField(field)).toBe(true);
    });

    it('returns false for boolean type', () => {
        const field: FrontmatterField = { key: 'workout', type: 'boolean', coverage: 10, total: 10 };
        expect(isNumericField(field)).toBe(false);
    });

    it('returns false for string type', () => {
        const field: FrontmatterField = { key: 'notes', type: 'string', coverage: 10, total: 10 };
        expect(isNumericField(field)).toBe(false);
    });
});

describe('getNumericValue', () => {
    it('returns number for native numbers', () => {
        expect(getNumericValue(7)).toBe(7);
        expect(getNumericValue(3.5)).toBe(3.5);
        expect(getNumericValue(0)).toBe(0);
        expect(getNumericValue(-1)).toBe(-1);
    });

    it('returns number for numeric strings', () => {
        expect(getNumericValue('7')).toBe(7);
        expect(getNumericValue('3.5')).toBe(3.5);
        expect(getNumericValue('0')).toBe(0);
        expect(getNumericValue('-1')).toBe(-1);
    });

    it('returns null for non-numeric strings', () => {
        expect(getNumericValue('hello')).toBeNull();
        expect(getNumericValue('N/A')).toBeNull();
        expect(getNumericValue('')).toBeNull();
    });

    it('returns null for null/undefined', () => {
        expect(getNumericValue(null)).toBeNull();
        expect(getNumericValue(undefined)).toBeNull();
    });

    it('returns null for NaN', () => {
        expect(getNumericValue(NaN)).toBeNull();
    });

    it('returns null for Infinity strings', () => {
        expect(getNumericValue('Infinity')).toBeNull();
        expect(getNumericValue('-Infinity')).toBeNull();
    });

    it('returns null for non-string/non-number types', () => {
        expect(getNumericValue(true)).toBeNull();
        expect(getNumericValue(false)).toBeNull();
        expect(getNumericValue([])).toBeNull();
        expect(getNumericValue({})).toBeNull();
    });
});

describe('detectFields — numeric-text range', () => {
    it('computes min/max range for numeric-text fields', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 1), frontmatter: { productivity: '3' } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 2), frontmatter: { productivity: '9' } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 3), frontmatter: { productivity: '5' } }),
        ];

        const fields = detectFields(entries);
        const prodField = fields.find(f => f.key === 'productivity');

        expect(prodField?.type).toBe('numeric-text');
        expect(prodField?.range?.min).toBe(3);
        expect(prodField?.range?.max).toBe(9);
    });
});

describe('extractNumericPart', () => {
    it('returns number for clean numeric strings', () => {
        expect(extractNumericPart('7')).toBe(7);
        expect(extractNumericPart('3.5')).toBe(3.5);
        expect(extractNumericPart('0')).toBe(0);
        expect(extractNumericPart('-1')).toBe(-1);
    });

    it('extracts number from unit-suffixed strings', () => {
        expect(extractNumericPart('182 lbs')).toBe(182);
        expect(extractNumericPart('6h')).toBe(6);
        expect(extractNumericPart('7.5 kg')).toBe(7.5);
        expect(extractNumericPart('95%')).toBe(95);
        expect(extractNumericPart('180 lbs')).toBe(180);
    });

    it('returns null for non-numeric strings', () => {
        expect(extractNumericPart('Walk')).toBeNull();
        expect(extractNumericPart('Stable')).toBeNull();
        expect(extractNumericPart('true')).toBeNull();
        expect(extractNumericPart('Good')).toBeNull();
        expect(extractNumericPart('Minor Flare')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractNumericPart('')).toBeNull();
    });

    it('handles whitespace around values', () => {
        expect(extractNumericPart('  182 lbs  ')).toBe(182);
        expect(extractNumericPart('  7  ')).toBe(7);
    });
});

describe('getBooleanValue', () => {
    it('returns boolean for native booleans', () => {
        expect(getBooleanValue(true)).toBe(true);
        expect(getBooleanValue(false)).toBe(false);
    });

    it('returns boolean for string booleans', () => {
        expect(getBooleanValue('true')).toBe(true);
        expect(getBooleanValue('false')).toBe(false);
        expect(getBooleanValue('True')).toBe(true);
        expect(getBooleanValue('FALSE')).toBe(false);
    });

    it('returns null for non-boolean values', () => {
        expect(getBooleanValue('yes')).toBeNull();
        expect(getBooleanValue('no')).toBeNull();
        expect(getBooleanValue(1)).toBeNull();
        expect(getBooleanValue(0)).toBeNull();
        expect(getBooleanValue(null)).toBeNull();
        expect(getBooleanValue(undefined)).toBeNull();
        expect(getBooleanValue('Walk')).toBeNull();
    });
});

describe('inferFieldType — string booleans', () => {
    it('detects string "true"/"false" as boolean', () => {
        expect(inferFieldType(['true', 'false', 'true'])).toBe('boolean');
    });

    it('detects mixed native + string booleans as boolean', () => {
        expect(inferFieldType([true, 'false', true, 'true'])).toBe('boolean');
    });

    it('handles case-insensitive string booleans', () => {
        expect(inferFieldType(['True', 'FALSE', 'true'])).toBe('boolean');
    });
});

describe('inferFieldType — unit-suffixed numerics', () => {
    it('detects unit-suffixed values as numeric-text', () => {
        expect(inferFieldType(['182 lbs', '179 lbs', '180 lbs'])).toBe('numeric-text');
    });

    it('detects mixed clean numbers and unit-suffixed as numeric-text', () => {
        expect(inferFieldType([180, '182 lbs', '179 lbs', 178])).toBe('numeric-text');
    });

    it('detects hour-suffixed values as numeric-text', () => {
        expect(inferFieldType(['6h', '7h', '8h', '6h'])).toBe('numeric-text');
    });

    it('real-world: weight field with mostly units, one clean', () => {
        // 16 entries with units, 1 entry without
        const values: unknown[] = [];
        for (let i = 0; i < 16; i++) values.push(`${178 + i % 5} lbs`);
        values.push(180);
        expect(inferFieldType(values)).toBe('numeric-text');
    });
});

describe('getNumericValue — unit-suffixed', () => {
    it('extracts number from unit-suffixed string', () => {
        expect(getNumericValue('182 lbs')).toBe(182);
        expect(getNumericValue('6h')).toBe(6);
        expect(getNumericValue('7.5 kg')).toBe(7.5);
    });

    it('still returns null for non-numeric strings', () => {
        expect(getNumericValue('Walk')).toBeNull();
        expect(getNumericValue('Stable')).toBeNull();
    });
});

describe('getFieldTimeSeries — unit-suffixed values', () => {
    it('extracts numeric values from unit-suffixed entries', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 2, 1), frontmatter: { weight: '182 lbs' } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 2, 2), frontmatter: { weight: 180 } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 3), frontmatter: { weight: '178 lbs' } }),
        ];
        const series = getFieldTimeSeries(entries, 'weight');
        expect(series[0].value).toBe(182);
        expect(series[1].value).toBe(180);
        expect(series[2].value).toBe(178);
    });
});
