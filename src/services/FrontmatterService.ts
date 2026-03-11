/**
 * Frontmatter Service
 *
 * Analyzes frontmatter across entries to detect fields dynamically.
 * Pure functions — no Obsidian API dependency.
 */

import type { JournalEntry, FrontmatterField, MetricDataPoint } from '../types';

/** Minimum ratio of non-empty values that must parse as numbers for numeric-text detection */
const NUMERIC_TEXT_THRESHOLD = 0.8;

/**
 * Extract the numeric portion from a string that may have a trailing unit suffix.
 * Examples: "182 lbs" → 182, "6h" → 6, "7.5 kg" → 7.5
 * Returns null for non-numeric strings like "Walk", "Stable", "true".
 */
export function extractNumericPart(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    if (isFinite(num)) return num; // fast path: clean number
    // Try leading number with optional trailing unit (e.g., "182 lbs", "6h", "95%")
    const match = trimmed.match(/^(-?\d+\.?\d*)\s*[a-zA-Z%]+$/);
    return match ? Number(match[1]) : null;
}

/**
 * Check if a field is numeric (either native number or text containing numbers).
 * Use this instead of `f.type === 'number'` to include numeric-text fields.
 */
export function isNumericField(field: FrontmatterField): boolean {
    return field.type === 'number' || field.type === 'numeric-text';
}

/**
 * Coerce a frontmatter value to a number, or return null.
 * Handles both native numbers and numeric strings.
 */
export function getNumericValue(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return isNaN(raw) ? null : raw;
    if (typeof raw === 'string') return extractNumericPart(raw);
    return null;
}

/**
 * Coerce a frontmatter value to a boolean, or return null.
 * Handles both native booleans and string "true"/"false".
 */
export function getBooleanValue(raw: unknown): boolean | null {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
        const lower = raw.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
    }
    return null;
}

/**
 * Scan all entries and detect what frontmatter fields exist,
 * their types, coverage (how many entries have them), and ranges.
 */
export function detectFields(entries: JournalEntry[]): FrontmatterField[] {
    if (entries.length === 0) return [];

    // Collect all unique keys across all entries
    const fieldMap = new Map<string, unknown[]>();

    for (const entry of entries) {
        for (const [key, value] of Object.entries(entry.frontmatter)) {
            if (!fieldMap.has(key)) {
                fieldMap.set(key, []);
            }
            fieldMap.get(key)!.push(value);
        }
    }

    const fields: FrontmatterField[] = [];

    for (const [key, values] of fieldMap.entries()) {
        const type = inferFieldType(values);

        // Count non-empty values for coverage
        const nonEmpty = values.filter(v =>
            v !== null && v !== undefined && v !== ''
        );
        const coverage = nonEmpty.length;

        const field: FrontmatterField = {
            key,
            type,
            coverage,
            total: entries.length,
        };

        // Compute range for numeric and numeric-text fields
        if (type === 'number' || type === 'numeric-text') {
            const numValues = nonEmpty
                .map(v => Number(v))
                .filter(n => !isNaN(n));
            if (numValues.length > 0) {
                field.range = {
                    min: Math.min(...numValues),
                    max: Math.max(...numValues),
                };
            }
        }

        fields.push(field);
    }

    return fields;
}

/**
 * Infer the type of a frontmatter field from its values across entries.
 * Rules: if all non-null values are numbers → 'number',
 *        if all are true/false → 'boolean',
 *        if all are arrays → 'string[]',
 *        if all match ISO date pattern → 'date',
 *        if ≥80% of string values parse as finite numbers → 'numeric-text',
 *        else → 'string'
 */
export function inferFieldType(values: unknown[]): FrontmatterField['type'] {
    // Filter out null, undefined, and empty strings
    const nonEmpty = values.filter(v =>
        v !== null && v !== undefined && v !== ''
    );

    if (nonEmpty.length === 0) return 'string';

    // Check boolean — handles native booleans, string "true"/"false", and allows
    // a minority of non-boolean outliers (same 80% threshold as numeric-text).
    // This handles real-world data where a few entries out of 300+ may have a
    // different format (e.g., a number 1/0 instead of true/false).
    const isBoolLike = (v: unknown): boolean =>
        typeof v === 'boolean' ||
        (typeof v === 'string' && (v.toLowerCase() === 'true' || v.toLowerCase() === 'false'));
    const boolCount = nonEmpty.filter(v => isBoolLike(v)).length;
    if (boolCount / nonEmpty.length >= NUMERIC_TEXT_THRESHOLD) return 'boolean';

    // Check number (must be actual numbers, not strings that parse as numbers)
    if (nonEmpty.every(v => typeof v === 'number' && !isNaN(v as number))) return 'number';

    // Check array
    if (nonEmpty.every(v => Array.isArray(v))) return 'string[]';

    // Check ISO date pattern (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (nonEmpty.every(v => typeof v === 'string' && isoDateRegex.test(v))) return 'date';

    // Check numeric-text: values that are a mix of native numbers and numeric strings,
    // or all strings where ≥80% parse as finite numbers.
    // This handles fields where older entries have `anxiety: 6` (native number)
    // and newer entries have `anxiety: "3"` (quoted string).
    const numericCount = nonEmpty.filter(v => {
        if (typeof v === 'number') return !isNaN(v);
        if (typeof v === 'string') return extractNumericPart(v) !== null;
        return false;
    }).length;
    if (numericCount / nonEmpty.length >= NUMERIC_TEXT_THRESHOLD) {
        // If ALL are native numbers, we already returned 'number' above.
        // If we reach here, at least some are strings, so it's 'numeric-text'.
        return 'numeric-text';
    }

    return 'string';
}

/**
 * Extract a specific field as time-series data points.
 * Returns { date (ms timestamp), value (number or null) } for each entry.
 * Non-numeric fields return null values.
 */
export function getFieldTimeSeries(
    entries: JournalEntry[],
    fieldKey: string
): MetricDataPoint[] {
    return entries.map(entry => {
        const raw = entry.frontmatter[fieldKey];
        return {
            date: entry.date.getTime(),
            value: getNumericValue(raw),
        };
    });
}
