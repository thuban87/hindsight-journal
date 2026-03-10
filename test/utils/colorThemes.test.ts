import { describe, it, expect } from 'vitest';
import { COLOR_THEMES } from '../../src/utils/colorThemes';
import type { ColorTheme } from '../../src/utils/colorThemes';

/** Helper: extract HSL components from an HSL string */
function isValidHsl(color: string): boolean {
    return /^hsl\(\d+,\s*\d+%,\s*\d+%\)$/.test(color);
}

describe('colorThemes', () => {
    const themeNames = Object.keys(COLOR_THEMES);

    it('all 5 themes are present', () => {
        expect(themeNames).toContain('default');
        expect(themeNames).toContain('monochrome');
        expect(themeNames).toContain('warm');
        expect(themeNames).toContain('cool');
        expect(themeNames).toContain('colorblind');
        expect(themeNames).toHaveLength(5);
    });

    it.each(themeNames)('%s maps 0 and 1 to valid HSL colors', (name) => {
        const theme: ColorTheme = COLOR_THEMES[name];
        const low = theme.mapValue(0);
        const high = theme.mapValue(1);
        expect(isValidHsl(low)).toBe(true);
        expect(isValidHsl(high)).toBe(true);
        // 0 and 1 should produce different colors
        expect(low).not.toBe(high);
    });

    it.each(themeNames)('%s maps 0.5 to a valid mid-range HSL color', (name) => {
        const theme: ColorTheme = COLOR_THEMES[name];
        const mid = theme.mapValue(0.5);
        expect(isValidHsl(mid)).toBe(true);
    });

    it.each(themeNames)('%s provides an emptyColorVar', (name) => {
        const theme: ColorTheme = COLOR_THEMES[name];
        expect(theme.emptyColorVar).toBeTruthy();
        expect(typeof theme.emptyColorVar).toBe('string');
    });

    it('colorblind theme produces distinct colors at 0, 0.5, and 1', () => {
        const theme = COLOR_THEMES.colorblind;
        const c0 = theme.mapValue(0);
        const c50 = theme.mapValue(0.5);
        const c100 = theme.mapValue(1);
        expect(c0).not.toBe(c50);
        expect(c50).not.toBe(c100);
        expect(c0).not.toBe(c100);
    });
});
