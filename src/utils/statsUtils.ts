/**
 * Stats Utilities
 *
 * Color-mapping functions for visualizing metric values.
 * Used by CalendarCell and other metric-aware components.
 */

/**
 * Map a numeric value to a color on a red-yellow-green gradient.
 * Returns a CSS color string.
 * Uses HSL interpolation: 0 (red, hsl 0) → 60 (yellow) → 120 (green).
 * Null values return a neutral color.
 *
 * @param value - The numeric value to map
 * @param min - Minimum expected value (maps to red)
 * @param max - Maximum expected value (maps to green)
 * @returns CSS color string (hsl or var reference)
 */
export function mapValueToColor(
    value: number | null,
    min: number,
    max: number
): string {
    if (value === null || value === undefined) {
        return 'var(--background-modifier-border)';
    }

    // Avoid division by zero when min equals max
    if (min === max) {
        return 'hsl(60, 70%, 45%)'; // mid color (yellow)
    }

    // Clamp value to [min, max]
    const clamped = Math.max(min, Math.min(max, value));

    // Normalize to 0-1
    const ratio = (clamped - min) / (max - min);

    // Interpolate hue: 0 (red) → 120 (green)
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
 * @param value - The numeric value to color
 * @param min - Minimum expected value
 * @param max - Maximum expected value
 * @param polarity - Field polarity setting
 * @returns CSS color string
 */
export function getPolarityColor(
    value: number | null,
    min: number,
    max: number,
    polarity: 'higher-is-better' | 'lower-is-better' | 'neutral'
): string {
    if (value === null || value === undefined) {
        return 'var(--background-modifier-border)';
    }

    if (polarity === 'neutral') {
        return 'hsl(210, 60%, 50%)'; // Consistent blue
    }

    // Avoid division by zero
    if (min === max) {
        return 'hsl(60, 70%, 45%)'; // mid color (yellow)
    }

    // Clamp value to [min, max]
    const clamped = Math.max(min, Math.min(max, value));

    // Normalize to 0-1
    const ratio = (clamped - min) / (max - min);

    if (polarity === 'higher-is-better') {
        // 0 (red) → 120 (green)
        const hue = Math.round(ratio * 120);
        return `hsl(${hue}, 70%, 45%)`;
    } else {
        // 'lower-is-better': invert — 120 (green) → 0 (red)
        const hue = Math.round((1 - ratio) * 120);
        return `hsl(${hue}, 70%, 45%)`;
    }
}
