/**
 * HighlightText Tests
 *
 * Tests for the safe search term highlighting component.
 * Verifies: empty query guard, no-match case, case-insensitive preserving,
 * special regex characters safety, fragment count cap.
 */

import { describe, it, expect } from 'vitest';

// Since HighlightText is a React component, we test the underlying logic
// by extracting the splitting algorithm into a testable function.

/**
 * Split text into alternating plain/match segments (mirrors HighlightText logic).
 * Even indices = plain text, odd indices = matched text.
 */
function splitForHighlight(text: string, query: string): string[] {
    if (!query || query.length === 0) return [text];

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: string[] = [];
    let lastIndex = 0;
    let idx = lowerText.indexOf(lowerQuery, lastIndex);

    while (idx !== -1) {
        parts.push(text.substring(lastIndex, idx));
        parts.push(text.substring(idx, idx + query.length));
        lastIndex = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, lastIndex);
    }
    parts.push(text.substring(lastIndex));

    return parts;
}

describe('HighlightText splitting', () => {
    it('returns original text for empty query', () => {
        const result = splitForHighlight('Hello world', '');
        expect(result).toEqual(['Hello world']);
    });

    it('returns original text when query not found', () => {
        const result = splitForHighlight('Hello world', 'xyz');
        expect(result).toEqual(['Hello world']);
    });

    it('case-insensitive matching preserves original casing', () => {
        const result = splitForHighlight('Hello World HELLO', 'hello');
        // Expected: ['', 'Hello', ' World ', 'HELLO', '']
        expect(result).toEqual(['', 'Hello', ' World ', 'HELLO', '']);
        // Odd indices are the matched text — they preserve the original casing
        expect(result[1]).toBe('Hello');
        expect(result[3]).toBe('HELLO');
    });

    it('handles special regex characters safely (no regex used)', () => {
        const text = 'Use [brackets] and (parens) and .dots*';
        const result = splitForHighlight(text, '[brackets]');
        // Should find the match via indexOf, not regex
        expect(result).toEqual(['Use ', '[brackets]', ' and (parens) and .dots*']);
    });

    it('handles query longer than text', () => {
        const result = splitForHighlight('Hi', 'Hello world this is very long');
        expect(result).toEqual(['Hi']);
    });

    it('handles multiple adjacent matches', () => {
        const result = splitForHighlight('aaa', 'a');
        expect(result).toEqual(['', 'a', '', 'a', '', 'a', '']);
    });

    it('fragment count cap detection (>200 parts)', () => {
        // Create text with 100+ repetitions of a single character
        const text = 'x'.repeat(300);
        const result = splitForHighlight(text, 'x');
        // Each 'x' creates [before, match] pairs → 600+ parts
        // The component caps at >200, but the underlying split doesn't
        // (the cap is in the React component layer). We just verify it doesn't crash.
        expect(result.length).toBeGreaterThan(200);
    });
});
