/**
 * Export Service Tests
 *
 * Tests for generateCSV(), generateJSON(), and generateMarkdownReport().
 * Verifies correct column structure, value formatting, CSV sanitization,
 * and markdown report content generation.
 */

import { describe, it, expect } from 'vitest';
import { generateCSV, generateJSON, generateMarkdownReport } from '../../src/services/ExportService';
import type { JournalEntry, FrontmatterField, DateRange } from '../../src/types';

/** Helper to create a minimal JournalEntry */
function makeEntry(dateStr: string, frontmatter: Record<string, unknown> = {}, overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {
        filePath: `Journal/${dateStr}.md`,
        date: new Date(dateStr + 'T00:00:00'),
        dayOfWeek: 'Monday',
        frontmatter,
        sections: {},
        wordCount: 150,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 80,
        tasksCompleted: 0,
        tasksTotal: 0,
        ...overrides,
    };
}

/** Helper to create a FrontmatterField */
function makeField(key: string, type: FrontmatterField['type'] = 'number'): FrontmatterField {
    return { key, type, coverage: 3, total: 3, range: type === 'number' ? { min: 1, max: 10 } : undefined };
}

const testFields: FrontmatterField[] = [
    makeField('mood', 'number'),
    makeField('energy', 'number'),
    makeField('workout', 'boolean'),
];

const testEntries: JournalEntry[] = [
    makeEntry('2026-03-01', { mood: 7, energy: 6, workout: true, tags: ['therapy', 'good-day'] }),
    makeEntry('2026-03-02', { mood: 5, energy: 4, workout: false, tags: ['rough'] }),
    makeEntry('2026-03-03', { mood: 8, energy: 7, workout: true, tags: ['therapy'] }),
];

// ===== generateCSV =====

describe('generateCSV', () => {
    it('correct header row with all field names', () => {
        const csv = generateCSV(testEntries, testFields);
        const lines = csv.split('\n');
        // Strip BOM from first line
        const headerLine = lines[0].replace(/^\uFEFF/, '');
        // Headers should include fixed + dynamic + tags columns
        expect(headerLine).toContain('"date"');
        expect(headerLine).toContain('"day_of_week"');
        expect(headerLine).toContain('"word_count"');
        expect(headerLine).toContain('"quality_score"');
        expect(headerLine).toContain('"mood"');
        expect(headerLine).toContain('"energy"');
        expect(headerLine).toContain('"workout"');
        expect(headerLine).toContain('"tags"');
    });

    it('values in correct columns', () => {
        const csv = generateCSV(testEntries, testFields);
        const lines = csv.split('\n');
        // First data row (entries sorted by date, so 2026-03-01 first)
        const firstDataRow = lines[1];
        expect(firstDataRow).toContain('"2026-03-01"');
        expect(firstDataRow).toContain('"Monday"');
        expect(firstDataRow).toContain('"7"');  // mood
        expect(firstDataRow).toContain('"6"');  // energy
    });

    it('handles commas in string values (escaped via quote-wrapping)', () => {
        const entries = [makeEntry('2026-03-01', { mood: 7, energy: 5, workout: false, tags: ['Portland, Oregon'] })];
        const csv = generateCSV(entries, testFields);
        // Comma inside string should be preserved inside double quotes
        expect(csv).toContain('Portland, Oregon');
    });

    it('handles null/undefined values (empty cell)', () => {
        const entries = [makeEntry('2026-03-01', { mood: 7 })]; // energy and workout missing
        const csv = generateCSV(entries, testFields);
        // Missing fields produce empty quoted cells
        const lines = csv.split('\n');
        const dataRow = lines[1];
        // Count the cells — should still have correct number of commas
        const cells = dataRow.split(',');
        // Fixed (4) + fields (3) + tags (1) = 8 minimum cells
        expect(cells.length).toBeGreaterThanOrEqual(8);
    });

    it('uses sanitizeCsvCell — output includes BOM prefix and cells are quote-wrapped', () => {
        const csv = generateCSV(testEntries, testFields);
        // UTF-8 BOM prefix
        expect(csv.charCodeAt(0)).toBe(0xFEFF);
        // All cells should be quote-wrapped (sanitizeCsvCell always wraps)
        const lines = csv.split('\n');
        const headerCells = lines[0].replace(/^\uFEFF/, '').split(',');
        for (const cell of headerCells) {
            expect(cell.startsWith('"')).toBe(true);
            expect(cell.endsWith('"')).toBe(true);
        }
    });
});

// ===== generateJSON =====

describe('generateJSON', () => {
    it('valid JSON output (parseable)', () => {
        const json = generateJSON(testEntries, testFields);
        const data = JSON.parse(json);
        expect(Array.isArray(data)).toBe(true);
    });

    it('all entries present with correct fields', () => {
        const json = generateJSON(testEntries, testFields);
        const data = JSON.parse(json) as Record<string, unknown>[];
        expect(data).toHaveLength(3);
        // First entry (sorted by date)
        expect(data[0].date).toBe('2026-03-01');
        expect(data[0].mood).toBe(7);
        expect(data[0].energy).toBe(6);
        expect(data[0].workout).toBe(true);
        expect(data[0].word_count).toBe(150);
        expect(data[0].quality_score).toBe(80);
        expect(data[0].tags).toEqual(['therapy', 'good-day']);
    });
});

// ===== generateMarkdownReport =====

describe('generateMarkdownReport', () => {
    const dateRange: DateRange = {
        start: new Date('2026-03-01T00:00:00'),
        end: new Date('2026-03-03T00:00:00'),
    };

    it('contains period header', () => {
        const report = generateMarkdownReport(testEntries, testFields, dateRange);
        expect(report).toContain('# Journal Report: 2026-03-01 to 2026-03-03');
        expect(report).toContain('3 entries');
    });

    it('contains averages for numeric fields', () => {
        const report = generateMarkdownReport(testEntries, testFields, dateRange);
        expect(report).toContain('## Averages');
        expect(report).toContain('mood');
        expect(report).toContain('energy');
        // Mood average: (7+5+8)/3 = 6.7
        expect(report).toContain('6.7');
    });

    it('contains best/worst day highlights', () => {
        const report = generateMarkdownReport(testEntries, testFields, dateRange);
        expect(report).toContain('## Highlights');
        expect(report).toContain('Best day');
        expect(report).toContain('Worst day');
        // Best mood is 8 (2026-03-03), worst is 5 (2026-03-02)
        expect(report).toContain('2026-03-03');
        expect(report).toContain('2026-03-02');
    });
});
