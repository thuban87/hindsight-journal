/**
 * Stats Utilities
 *
 * Color-mapping functions for visualizing metric values.
 * Used by CalendarCell and other metric-aware components.
 * Supports optional calendar color themes.
 */

import { COLOR_THEMES } from './colorThemes';

/**
 * Map a numeric value to a color on a gradient.
 * Uses the specified theme or defaults to red-yellow-green HSL interpolation.
 * Null values return a neutral color.
 *
 * @param value - The numeric value to map
 * @param min - Minimum expected value (maps to low end)
 * @param max - Maximum expected value (maps to high end)
 * @param theme - Optional color theme name
 * @returns CSS color string (hsl or var reference)
 */
export function mapValueToColor(
    value: number | null,
    min: number,
    max: number,
    theme?: string
): string {
    const themeObj = theme ? COLOR_THEMES[theme] : undefined;

    if (value === null || value === undefined) {
        return themeObj
            ? `var(${themeObj.emptyColorVar})`
            : 'var(--background-modifier-border)';
    }

    // Avoid division by zero when min equals max
    if (min === max) {
        return themeObj ? themeObj.mapValue(0.5) : 'hsl(60, 70%, 45%)';
    }

    // Clamp value to [min, max]
    const clamped = Math.max(min, Math.min(max, value));

    // Normalize to 0-1
    const ratio = (clamped - min) / (max - min);

    if (themeObj) {
        return themeObj.mapValue(ratio);
    }

    // Default: interpolate hue: 0 (red) → 120 (green)
    const hue = Math.round(ratio * 120);
    return `hsl(${hue}, 70%, 45%)`;
}

/**
 * Map a boolean value to a color.
 * true → green (success), false/null → red (error).
 *
 * @param value - Boolean value or null
 * @returns CSS variable reference string
 */
export function mapBooleanToColor(value: boolean | null): string {
    if (value === true) {
        return 'var(--text-success)';
    }
    return 'var(--text-error)';
}

/**
 * Get badge color for a field value based on polarity setting.
 * - 'higher-is-better': high=green, low=red (default HSL gradient)
 * - 'lower-is-better': high=red, low=green (inverted gradient)
 * - 'neutral': consistent blue (no directional meaning)
 *
 * Supports optional calendar color theme for themed views.
 *
 * @param value - The numeric value to color
 * @param min - Minimum expected value
 * @param max - Maximum expected value
 * @param polarity - Field polarity setting
 * @param theme - Optional color theme name
 * @returns CSS color string
 */
export function getPolarityColor(
    value: number | null,
    min: number,
    max: number,
    polarity: 'higher-is-better' | 'lower-is-better' | 'neutral',
    theme?: string
): string {
    const themeObj = theme ? COLOR_THEMES[theme] : undefined;

    if (value === null || value === undefined) {
        return themeObj
            ? `var(${themeObj.emptyColorVar})`
            : 'var(--background-modifier-border)';
    }

    if (polarity === 'neutral') {
        return 'hsl(210, 60%, 50%)'; // Consistent blue
    }

    // Avoid division by zero
    if (min === max) {
        return themeObj ? themeObj.mapValue(0.5) : 'hsl(60, 70%, 45%)';
    }

    // Clamp value to [min, max]
    const clamped = Math.max(min, Math.min(max, value));

    // Normalize to 0-1
    const ratio = (clamped - min) / (max - min);

    // For lower-is-better, invert the ratio
    const effectiveRatio = polarity === 'lower-is-better' ? 1 - ratio : ratio;

    if (themeObj) {
        return themeObj.mapValue(effectiveRatio);
    }

    // Default: 0 (red) → 120 (green)
    const hue = Math.round(effectiveRatio * 120);
    return `hsl(${hue}, 70%, 45%)`;
}

