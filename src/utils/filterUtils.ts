/**
 * Filter Utils
 *
 * Pure functions for filtering and sorting journal entries.
 * Extracted from JournalIndex for testability.
 */

import type { JournalEntry, DateRange } from '../types';

/** Filter config matching uiStore.indexFilters shape */
export interface IndexFilterConfig {
    search: string;
    dateRange: DateRange | null;
    fieldFilters: Array<{ field: string; operator: '>=' | '<=' | '='; value: number }>;
}

/** Sort config matching uiStore.indexSort shape */
export interface IndexSortConfig {
    field: string;
    direction: 'asc' | 'desc';
}

/**
 * Apply all filters to journal entries.
 * Applies text search, date range, and field filters in sequence.
 */
export function applyFilters(entries: JournalEntry[], filters: IndexFilterConfig): JournalEntry[] {
    let result = entries;

    // Text search — case insensitive match against section content
    if (filters.search) {
        const query = filters.search.toLowerCase();
        result = result.filter(entry =>
            Object.values(entry.sections).some(
                content => content.toLowerCase().includes(query)
            )
        );
    }

    // Date range filter
    if (filters.dateRange) {
        const { start, end } = filters.dateRange;
        result = result.filter(entry => {
            const t = entry.date.getTime();
            return t >= start.getTime() && t <= end.getTime();
        });
    }

    // Field filters
    for (const ff of filters.fieldFilters) {
        result = result.filter(entry => {
            const val = entry.frontmatter[ff.field];
            if (val == null || typeof val !== 'number') return false;
            switch (ff.operator) {
                case '>=': return val >= ff.value;
                case '<=': return val <= ff.value;
                case '=': return val === ff.value;
                default: return true;
            }
        });
    }

    return result;
}

/**
 * Sort journal entries by the given field and direction.
 * Returns a new sorted array (does not mutate input).
 * Null values for dynamic fields are placed at the end.
 */
export function applySorting(entries: JournalEntry[], sort: IndexSortConfig): JournalEntry[] {
    const sorted = [...entries];
    const { field, direction } = sort;
    const multiplier = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        switch (field) {
            case 'date':
                return multiplier * (a.date.getTime() - b.date.getTime());
            case 'day':
                return multiplier * a.dayOfWeek.localeCompare(b.dayOfWeek);
            case 'wordCount':
                return multiplier * (a.wordCount - b.wordCount);
            default: {
                // Dynamic field sort
                const aVal = a.frontmatter[field] as number | null;
                const bVal = b.frontmatter[field] as number | null;
                // Null values placed at end
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
                return multiplier * (Number(aVal) - Number(bVal));
            }
        }
    });

    return sorted;
}
