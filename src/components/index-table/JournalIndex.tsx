/**
 * Journal Index
 *
 * Sortable data table for all journal entries.
 * Columns: Date, Day, Word count, dynamic numeric/boolean fields, Tags.
 * Click row to open note. Click column header to sort.
 * Filters applied from uiStore.indexFilters.
 */

import React, { useMemo } from 'react';
import type { FrontmatterField } from '../../types';
import { useJournalStore } from '../../store/journalStore';
import { useUIStore } from '../../store/uiStore';
import { useAppStore } from '../../store/appStore';
import { applyFilters, applySorting } from '../../utils/filterUtils';
import { IndexFilters } from './IndexFilters';
import { EmptyState } from '../shared/EmptyState';
import { isNumericField } from '../../services/FrontmatterService';

/** Format date for table display */
function formatTableDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function JournalIndex(): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    const detectedFields = useJournalStore(state => state.detectedFields);
    const indexSort = useUIStore(state => state.indexSort);
    const setIndexSort = useUIStore(state => state.setIndexSort);
    const indexFilters = useUIStore(state => state.indexFilters);

    if (!app) return null;

    /** Dynamic columns — numeric and boolean fields only */
    const dynamicColumns = useMemo(() => {
        return detectedFields.filter((f: FrontmatterField) => isNumericField(f) || f.type === 'boolean');
    }, [detectedFields]);

    /** Apply filters */
    const filteredEntries = useMemo(() => {
        return applyFilters(allEntries, indexFilters);
    }, [allEntries, indexFilters]);

    /** Apply sorting */
    const sortedEntries = useMemo(() => {
        return applySorting(filteredEntries, indexSort);
    }, [filteredEntries, indexSort]);

    /** Get sort class for a column header */
    const getSortClass = (field: string): string => {
        if (indexSort.field !== field) return '';
        return indexSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc';
    };

    if (allEntries.length === 0) {
        return <EmptyState message="No journal entries found" icon="📋" />;
    }

    return (
        <div className="hindsight-index-container">
            <IndexFilters detectedFields={detectedFields} />

            <div className="hindsight-index-table-container">
                <table className="hindsight-index-table">
                    <thead>
                        <tr>
                            <th
                                className={getSortClass('date')}
                                onClick={() => setIndexSort('date')}
                            >
                                Date
                            </th>
                            <th
                                className={getSortClass('day')}
                                onClick={() => setIndexSort('day')}
                            >
                                Day
                            </th>
                            <th
                                className={getSortClass('wordCount')}
                                onClick={() => setIndexSort('wordCount')}
                            >
                                Words
                            </th>
                            {dynamicColumns.map(col => (
                                <th
                                    key={col.key}
                                    className={getSortClass(col.key)}
                                    onClick={() => setIndexSort(col.key)}
                                >
                                    {col.key}
                                </th>
                            ))}
                            <th>Tags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map(entry => (
                            <tr
                                key={entry.filePath}
                                onClick={() => {
                                    void app.workspace.openLinkText(entry.filePath, '', false);
                                }}
                                className="hindsight-index-row"
                            >
                                <td>{formatTableDate(entry.date)}</td>
                                <td>{entry.dayOfWeek}</td>
                                <td>{entry.wordCount}</td>
                                {dynamicColumns.map(col => (
                                    <td key={col.key}>
                                        {formatCellValue(entry.frontmatter[col.key], col.type)}
                                    </td>
                                ))}
                                <td>
                                    {Array.isArray(entry.frontmatter.tags)
                                        ? (entry.frontmatter.tags as string[]).join(', ')
                                        : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {sortedEntries.length === 0 && filteredEntries.length === 0 && allEntries.length > 0 && (
                    <div className="hindsight-index-no-results">
                        No entries match your filters
                    </div>
                )}
            </div>
        </div>
    );
}

/** Format a cell value for display */
function formatCellValue(value: unknown, type: string): string {
    if (value == null) return '—';
    if (type === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'number') return String(value);
    return String(value);
}
