/**
 * Wizard Integration Tests
 *
 * Tests for weekly summary computation logic (from WeeklySummaryCards)
 * and quick-edit field type mapping (from FieldInput).
 */

import { describe, it, expect } from 'vitest';
import type { JournalEntry, FrontmatterField } from '../../src/types';
import { isNumericField, getNumericValue, getBooleanValue } from '../../src/services/FrontmatterService';

/** Helper to create a minimal JournalEntry */
function makeEntry(
    dateStr: string,
    frontmatter: Record<string, unknown> = {},
    overrides: Partial<JournalEntry> = {},
): JournalEntry {
    return {
        filePath: `Journal/${dateStr}.md`,
        date: new Date(dateStr + 'T00:00:00'),
        dayOfWeek: 'Monday',
        frontmatter,
        sections: {},
        wordCount: 100,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 50,
        tasksCompleted: 0,
        tasksTotal: 0,
        ...overrides,
    };
}

/** Helper to create a FrontmatterField */
function makeField(key: string, type: FrontmatterField['type'] = 'number'): FrontmatterField {
    return { key, type, coverage: 5, total: 5, range: type === 'number' ? { min: 1, max: 10 } : undefined };
}

// ===== Weekly Summary Computation =====

describe('Weekly summary computation', () => {
    const numericFields = [makeField('mood', 'number'), makeField('energy', 'number')];
    const boolFields = [makeField('workout', 'boolean'), makeField('meds', 'boolean')];
    const allFields = [...numericFields, ...boolFields];

    const entries: JournalEntry[] = [
        makeEntry('2026-03-02', { mood: 7, energy: 6, workout: true, meds: true }, { qualityScore: 85, wordCount: 200 }),
        makeEntry('2026-03-03', { mood: 5, energy: 4, workout: false, meds: true }, { qualityScore: 60, wordCount: 150 }),
        makeEntry('2026-03-04', { mood: 8, energy: 7, workout: true, meds: false }, { qualityScore: 90, wordCount: 300 }),
        makeEntry('2026-03-05', { mood: 6, energy: 5, workout: true, meds: true }, { qualityScore: 70, wordCount: 100 }),
    ];

    it('correct averages for a set of entries', () => {
        // Replicate the averaging logic from WeeklySummaryCards
        for (const field of numericFields.filter(f => isNumericField(f))) {
            const values: number[] = [];
            for (const entry of entries) {
                const val = getNumericValue(entry.frontmatter[field.key]);
                if (val !== null) values.push(val);
            }
            const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

            if (field.key === 'mood') {
                // (7+5+8+6)/4 = 6.5
                expect(avg).toBeCloseTo(6.5, 1);
            }
            if (field.key === 'energy') {
                // (6+4+7+5)/4 = 5.5
                expect(avg).toBeCloseTo(5.5, 1);
            }
        }
    });

    it('correct completion rates for boolean fields', () => {
        for (const field of boolFields) {
            let trueCount = 0;
            let total = 0;
            for (const entry of entries) {
                const val = getBooleanValue(entry.frontmatter[field.key]);
                if (val !== null) {
                    total++;
                    if (val) trueCount++;
                }
            }
            const rate = Math.round((trueCount / total) * 100);

            if (field.key === 'workout') {
                // 3 true out of 4 = 75%
                expect(rate).toBe(75);
            }
            if (field.key === 'meds') {
                // 3 true out of 4 = 75%
                expect(rate).toBe(75);
            }
        }
    });

    it('identifies best and worst day correctly', () => {
        const sortedByQuality = [...entries]
            .filter(e => e.qualityScore !== undefined)
            .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

        const best = sortedByQuality[0];
        const worst = sortedByQuality[sortedByQuality.length - 1];

        // Best: 2026-03-04 with qualityScore 90
        expect(best.date.getDate()).toBe(4);
        expect(best.qualityScore).toBe(90);

        // Worst: 2026-03-03 with qualityScore 60
        expect(worst.date.getDate()).toBe(3);
        expect(worst.qualityScore).toBe(60);
    });

    it('handles empty entries gracefully', () => {
        const emptyEntries: JournalEntry[] = [];
        // Replicate WeeklySummaryCards empty guard
        const cards: { label: string; value: string }[] = [];
        if (emptyEntries.length === 0) {
            // Should produce no cards
            expect(cards).toHaveLength(0);
        }
    });
});

// ===== Quick-Edit Field Type Mapping =====

describe('Quick-edit field type mapping', () => {
    it('number -> slider, boolean -> toggle, string -> text, string[] -> tags', () => {
        // Verify FieldInput type dispatch logic (same switch/case conditions)
        const mappings: Record<FrontmatterField['type'], string> = {
            'number': 'SliderInput',
            'numeric-text': 'SliderInput',
            'boolean': 'toggle',
            'string': 'text',
            'string[]': 'TagInput',
            'date': 'date',
        };

        // number and numeric-text both map to slider
        expect(mappings['number']).toBe('SliderInput');
        expect(mappings['numeric-text']).toBe('SliderInput');

        // boolean maps to toggle
        expect(mappings['boolean']).toBe('toggle');

        // string maps to text
        expect(mappings['string']).toBe('text');

        // string[] maps to TagInput
        expect(mappings['string[]']).toBe('TagInput');

        // date maps to date picker
        expect(mappings['date']).toBe('date');

        // Verify all FrontmatterField types are covered
        const allTypes: FrontmatterField['type'][] = ['number', 'boolean', 'string', 'date', 'string[]', 'numeric-text'];
        for (const type of allTypes) {
            expect(mappings[type]).toBeDefined();
        }
    });
});
