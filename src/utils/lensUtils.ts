/**
 * Lens Utilities
 *
 * Pure functions for Lens compound filtering and sorting.
 * Extracted from LensPanel.tsx for testability (Phase 7.5).
 */

import type { JournalEntry, LensFilterRow } from '../types';
import { getNumericValue } from '../services/FrontmatterService';

export type SortOption = 'date-newest' | 'date-oldest' | 'quality-high' | 'quality-low' | 'wordcount-high' | 'wordcount-low';

export function sortEntries(entries: JournalEntry[], sort: SortOption): JournalEntry[] {
    const sorted = [...entries];
    switch (sort) {
        case 'date-newest':
            return sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
        case 'date-oldest':
            return sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
        case 'quality-high':
            return sorted.sort((a, b) => b.qualityScore - a.qualityScore);
        case 'quality-low':
            return sorted.sort((a, b) => a.qualityScore - b.qualityScore);
        case 'wordcount-high':
            return sorted.sort((a, b) => b.wordCount - a.wordCount);
        case 'wordcount-low':
            return sorted.sort((a, b) => a.wordCount - b.wordCount);
        default:
            return sorted;
    }
}

/**
 * Apply compound filters and text search to entries.
 */
export function applyLensFilters(
    entries: JournalEntry[],
    searchQuery: string,
    filters: LensFilterRow[],
    searchContexts: Map<string, string> | null
): { filtered: JournalEntry[]; contexts: Map<string, string> } {
    const contexts = new Map<string, string>();
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

    let result = entries;

    // Text search (AND logic for multiple terms)
    if (terms.length > 0) {
        result = result.filter(entry => {
            // Check in-memory sections first
            const sectionValues = Object.values(entry.sections);
            const sectionText = sectionValues.join(' ').toLowerCase();

            // Check full-content search contexts if available
            const fullContent = searchContexts?.get(entry.filePath)?.toLowerCase() ?? '';

            const searchable = sectionText || fullContent;
            if (!searchable) return false;

            const matches = terms.every(term => searchable.includes(term));
            if (matches && terms.length > 0) {
                // Extract context snippet (~150 chars around first match)
                const fullSearchable = sectionText || fullContent;
                const firstTerm = terms[0];
                const matchPos = fullSearchable.indexOf(firstTerm);
                if (matchPos >= 0) {
                    const originalText = sectionValues.join(' ') || searchContexts?.get(entry.filePath) || '';
                    const start = Math.max(0, matchPos - 75);
                    const end = Math.min(originalText.length, matchPos + firstTerm.length + 75);
                    const snippet = (start > 0 ? '...' : '') + originalText.substring(start, end) + (end < originalText.length ? '...' : '');
                    contexts.set(entry.filePath, snippet);
                }
            }
            return matches;
        });
    }

    // Apply compound filters (AND logic)
    for (const filter of filters) {
        switch (filter.type) {
            case 'field': {
                result = result.filter(entry => {
                    const raw = entry.frontmatter[filter.fieldKey];
                    const val = getNumericValue(raw);
                    if (val === null) return false;
                    const target = typeof filter.value === 'number' ? filter.value : Number(filter.value);
                    if (isNaN(target)) return false;
                    switch (filter.operator) {
                        case '>=': return val >= target;
                        case '<=': return val <= target;
                        case '=': return val === target;
                        case '!=': return val !== target;
                        default: return true;
                    }
                });
                break;
            }
            case 'dateRange': {
                const start = filter.startDate ? new Date(filter.startDate + 'T00:00:00') : null;
                const end = filter.endDate ? new Date(filter.endDate + 'T23:59:59') : null;
                result = result.filter(entry => {
                    if (start && entry.date < start) return false;
                    if (end && entry.date > end) return false;
                    return true;
                });
                break;
            }
            case 'tag': {
                result = result.filter(entry => {
                    const tags = entry.frontmatter['tags'];
                    if (Array.isArray(tags)) {
                        return tags.some(t => typeof t === 'string' && t.toLowerCase() === filter.tag.toLowerCase());
                    }
                    return false;
                });
                break;
            }
            case 'wordCount': {
                result = result.filter(entry => {
                    if (filter.min !== undefined && entry.wordCount < filter.min) return false;
                    if (filter.max !== undefined && entry.wordCount > filter.max) return false;
                    return true;
                });
                break;
            }
            case 'qualityScore': {
                result = result.filter(entry => {
                    if (filter.min !== undefined && entry.qualityScore < filter.min) return false;
                    if (filter.max !== undefined && entry.qualityScore > filter.max) return false;
                    return true;
                });
                break;
            }
            case 'hasImages': {
                if (filter.enabled) {
                    result = result.filter(entry => entry.imagePaths.length > 0);
                }
                break;
            }
        }
    }

    return { filtered: result, contexts };
}
