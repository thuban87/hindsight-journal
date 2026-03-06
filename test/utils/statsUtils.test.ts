import { describe, it, expect } from 'vitest';
import { mapValueToColor, mapBooleanToColor } from '../../src/utils/statsUtils';

describe('mapValueToColor', () => {
    it('returns red-ish hue for min value', () => {
        const color = mapValueToColor(0, 0, 10);
        // hue = 0 → red
        expect(color).toBe('hsl(0, 70%, 45%)');
    });

    it('returns green-ish hue for max value', () => {
        const color = mapValueToColor(10, 0, 10);
        // hue = 120 → green
        expect(color).toBe('hsl(120, 70%, 45%)');
    });

    it('returns yellow-ish hue for mid value', () => {
        const color = mapValueToColor(5, 0, 10);
        // hue = 60 → yellow
        expect(color).toBe('hsl(60, 70%, 45%)');
    });

    it('returns neutral color for null value', () => {
        const color = mapValueToColor(null, 0, 10);
        expect(color).toBe('var(--background-modifier-border)');
    });

    it('clamps value below min to red', () => {
        const color = mapValueToColor(-5, 0, 10);
        // Clamped to 0 → hue = 0
        expect(color).toBe('hsl(0, 70%, 45%)');
    });

    it('clamps value above max to green', () => {
        const color = mapValueToColor(15, 0, 10);
        // Clamped to 10 → hue = 120
        expect(color).toBe('hsl(120, 70%, 45%)');
    });

    it('returns mid color when min equals max (avoids division by zero)', () => {
        const color = mapValueToColor(5, 5, 5);
        // Should return yellow (mid color)
        expect(color).toBe('hsl(60, 70%, 45%)');
    });

    it('handles negative ranges correctly', () => {
        // Scale from -10 to 0: value -5 is midpoint → yellow
        const color = mapValueToColor(-5, -10, 0);
        expect(color).toBe('hsl(60, 70%, 45%)');
    });

    it('handles large ranges', () => {
        // 50 out of 0-100 is 50% → hue 60
        const color = mapValueToColor(50, 0, 100);
        expect(color).toBe('hsl(60, 70%, 45%)');
    });

    it('returns correct hue for 25% value', () => {
        // 25 out of 0-100 → ratio 0.25 → hue = 30
        const color = mapValueToColor(25, 0, 100);
        expect(color).toBe('hsl(30, 70%, 45%)');
    });
});

describe('mapBooleanToColor', () => {
    it('returns success color for true', () => {
        expect(mapBooleanToColor(true)).toBe('var(--text-success)');
    });

    it('returns error color for false', () => {
        expect(mapBooleanToColor(false)).toBe('var(--text-error)');
    });

    it('returns error color for null', () => {
        expect(mapBooleanToColor(null)).toBe('var(--text-error)');
    });
});
