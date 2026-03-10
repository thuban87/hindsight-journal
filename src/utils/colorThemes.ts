/**
 * Color Themes
 *
 * Calendar color palette definitions for heatmap and calendar cell coloring.
 * Each theme maps a 0-1 normalized value to a CSS color string.
 *
 * emptyColorVar is a CSS variable name resolved at render time via
 * getComputedStyle(document.body).getPropertyValue(emptyColorVar).trim()
 */

/** Calendar color palette definition */
export interface ColorTheme {
    name: string;
    /** Maps a 0-1 normalized value to a CSS color string */
    mapValue: (normalized: number) => string;
    /** CSS variable reference for missing/null values (resolved at render time) */
    emptyColorVar: string;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
    default: {
        name: 'Default',
        mapValue: (n: number) => {
            // Red → Yellow → Green HSL interpolation (existing behavior)
            const hue = Math.round(n * 120);
            return `hsl(${hue}, 70%, 45%)`;
        },
        emptyColorVar: '--background-modifier-border',
    },
    monochrome: {
        name: 'Monochrome',
        mapValue: (n: number) => {
            // Gray → Navy
            const lightness = 70 - n * 45; // 70% (light gray) → 25% (navy)
            return `hsl(220, ${Math.round(n * 50)}%, ${Math.round(lightness)}%)`;
        },
        emptyColorVar: '--background-modifier-border',
    },
    warm: {
        name: 'Warm',
        mapValue: (n: number) => {
            // Peach → Orange → Deep orange
            const hue = 30 - n * 15; // 30 (peach) → 15 (deep orange)
            const saturation = 60 + n * 30; // 60% → 90%
            const lightness = 75 - n * 30; // 75% → 45%
            return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
        },
        emptyColorVar: '--background-modifier-border',
    },
    cool: {
        name: 'Cool',
        mapValue: (n: number) => {
            // Cyan → Purple
            const hue = 190 + n * 80; // 190 (cyan) → 270 (purple)
            const saturation = 50 + n * 25; // 50% → 75%
            const lightness = 65 - n * 20; // 65% → 45%
            return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
        },
        emptyColorVar: '--background-modifier-border',
    },
    colorblind: {
        name: 'Color-blind safe',
        mapValue: (n: number) => {
            // Viridis-inspired: Blue → Teal → Orange
            // Accessible to ~8% of males with red-green deficiency
            if (n < 0.5) {
                // Blue (220) → Teal (180)
                const t = n * 2; // 0-1 within first half
                const hue = 220 - t * 40;
                const saturation = 60 + t * 10;
                const lightness = 55 - t * 10;
                return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
            } else {
                // Teal (180) → Orange (30)
                const t = (n - 0.5) * 2; // 0-1 within second half
                const hue = 180 - t * 150;
                const saturation = 70 + t * 20;
                const lightness = 45 + t * 10;
                return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
            }
        },
        emptyColorVar: '--background-modifier-border',
    },
};
