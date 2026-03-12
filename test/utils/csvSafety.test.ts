/**
 * CSV Safety Tests
 *
 * Tests for sanitizeCsvCell() — CSV formula injection prevention.
 * Verifies the 4-step sanitization pipeline:
 * 1. Coerce to string
 * 2. Numeric bypass
 * 3. Dangerous prefix check + mid-cell sanitization
 * 4. Quote-escape and wrap
 */

import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell } from '../../src/utils/csvSafety';

describe('sanitizeCsvCell', () => {
    it('prefixes cell starting with = with single quote', () => {
        const result = sanitizeCsvCell('=SUM(A1:A10)');
        expect(result).toBe(`"'=SUM(A1:A10)"`);
    });

    it('prefixes cell starting with + with single quote', () => {
        const result = sanitizeCsvCell('+cmd|...');
        expect(result).toBe(`"'+cmd|..."`);
    });

    it('prefixes cell starting with - with single quote (non-numeric)', () => {
        const result = sanitizeCsvCell('-formula');
        expect(result).toBe(`"'-formula"`);
    });

    it('prefixes cell starting with @ with single quote', () => {
        const result = sanitizeCsvCell('@SUM(A1)');
        expect(result).toBe(`"'@SUM(A1)"`);
    });

    it('leaves normal text unchanged (wraps in double quotes)', () => {
        const result = sanitizeCsvCell('Hello World');
        expect(result).toBe('"Hello World"');
    });

    it('handles values with internal commas (escaped via double-quote wrapping)', () => {
        const result = sanitizeCsvCell('Portland, Oregon');
        expect(result).toBe('"Portland, Oregon"');
    });

    it('handles multi-line values — tabs replaced with spaces, CR stripped', () => {
        const result = sanitizeCsvCell('line1\tline2\rline3');
        expect(result).toBe('"line1 line2line3"');
    });

    it('handles formulas with leading whitespace', () => {
        const result = sanitizeCsvCell('  =SUM(A1:A10)');
        expect(result).toBe(`"'  =SUM(A1:A10)"`);
    });

    it('negative numbers are NOT sanitized (-3.5 passes numeric bypass)', () => {
        const result = sanitizeCsvCell('-3.5');
        expect(result).toBe('"-3.5"');
    });

    it('handles null and undefined → empty string wrapped in quotes', () => {
        expect(sanitizeCsvCell(null)).toBe('""');
        expect(sanitizeCsvCell(undefined)).toBe('""');
    });

    it('handles arrays containing formula-like strings — elements individually sanitized', () => {
        const result = sanitizeCsvCell(['=CMD()', 'safe', '-3.5']);
        // =CMD() → '=CMD(), safe → safe, -3.5 → -3.5 (numeric bypass)
        expect(result).toBe(`"'=CMD(); safe; -3.5"`);
    });

    it('handles objects → JSON stringified and wrapped', () => {
        const result = sanitizeCsvCell({ key: 'value' });
        // JSON.stringify produces {"key":"value"}, internal quotes get doubled
        expect(result).toContain('key');
        expect(result).toContain('value');
        // Should start and end with double quotes
        expect(result.startsWith('"')).toBe(true);
        expect(result.endsWith('"')).toBe(true);
    });
});
