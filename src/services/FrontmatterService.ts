/**
 * Frontmatter Service
 *
 * Analyzes frontmatter across entries to detect fields dynamically.
 * Pure functions — no Obsidian API dependency.
 */

import type { JournalEntry, FrontmatterField, MetricDataPoint } from '../types';

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

        // Compute range for numeric fields
        if (type === 'number') {
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
 *        else → 'string'
 */
export function inferFieldType(values: unknown[]): FrontmatterField['type'] {
    // Filter out null, undefined, and empty strings
    const nonEmpty = values.filter(v =>
        v !== null && v !== undefined && v !== ''
    );

    if (nonEmpty.length === 0) return 'string';

    // Check boolean first (typeof true === 'object' is false, so this is safe)
    if (nonEmpty.every(v => typeof v === 'boolean')) return 'boolean';

    // Check number (must be actual numbers, not strings that parse as numbers)
    if (nonEmpty.every(v => typeof v === 'number' && !isNaN(v as number))) return 'number';

    // Check array
    if (nonEmpty.every(v => Array.isArray(v))) return 'string[]';

    // Check ISO date pattern (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (nonEmpty.every(v => typeof v === 'string' && isoDateRegex.test(v))) return 'date';

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
        let value: number | null = null;

        if (raw !== null && raw !== undefined && raw !== '') {
            const num = Number(raw);
            if (!isNaN(num)) {
                value = num;
            }
        }

        return {
            date: entry.date.getTime(),
            value,
        };
    });
}
