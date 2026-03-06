/**
 * Index Filters
 *
 * Search and filter bar above the journal index table.
 * - Text search (case insensitive, 250ms debounce)
 * - Date range filter (from/to)
 * - Numeric field filters (e.g., "mood >= 7")
 * - Clear all button
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { FrontmatterField } from '../../types';
import { useUIStore } from '../../store/uiStore';

interface IndexFiltersProps {
    detectedFields: FrontmatterField[];
}

export function IndexFilters({ detectedFields }: IndexFiltersProps): React.ReactElement {
    const indexFilters = useUIStore(state => state.indexFilters);
    const setSearchFilter = useUIStore(state => state.setSearchFilter);
    const setDateRangeFilter = useUIStore(state => state.setDateRangeFilter);
    const addFieldFilter = useUIStore(state => state.addFieldFilter);
    const removeFieldFilter = useUIStore(state => state.removeFieldFilter);
    const clearAllFilters = useUIStore(state => state.clearAllFilters);

    // Debounced search input
    const [searchInput, setSearchInput] = useState(indexFilters.search);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchFilter(value);
        }, 250);
    }, [setSearchFilter]);

    // Cleanup debounce timer
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Sync searchInput when filters are cleared externally
    useEffect(() => {
        setSearchInput(indexFilters.search);
    }, [indexFilters.search]);

    const numericFields = detectedFields.filter(f => f.type === 'number');

    // New field filter form state
    const [newFilterField, setNewFilterField] = useState(numericFields[0]?.key ?? '');
    const [newFilterOp, setNewFilterOp] = useState<'>=' | '<=' | '='>('>=');
    const [newFilterValue, setNewFilterValue] = useState('');

    const handleAddFilter = () => {
        const value = parseFloat(newFilterValue);
        if (newFilterField && !isNaN(value)) {
            addFieldFilter(newFilterField, newFilterOp, value);
            setNewFilterValue('');
        }
    };

    const hasActiveFilters =
        indexFilters.search !== '' ||
        indexFilters.dateRange !== null ||
        indexFilters.fieldFilters.length > 0;

    return (
        <div className="hindsight-index-filters">
            <div className="hindsight-filter-row">
                <input
                    type="text"
                    className="hindsight-filter-input"
                    placeholder="Search entries…"
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                />

                <input
                    type="date"
                    className="hindsight-filter-input hindsight-filter-date"
                    defaultValue={indexFilters.dateRange?.start
                        ? indexFilters.dateRange.start.toISOString().split('T')[0]
                        : ''}
                    onBlur={(e) => {
                        const val = e.target.value;
                        if (val) {
                            const start = new Date(val + 'T00:00:00');
                            const end = indexFilters.dateRange?.end ?? new Date();
                            setDateRangeFilter({ start, end });
                        } else if (!indexFilters.dateRange?.end) {
                            setDateRangeFilter(null);
                        }
                    }}
                    title="From date"
                />
                <input
                    type="date"
                    className="hindsight-filter-input hindsight-filter-date"
                    defaultValue={indexFilters.dateRange?.end
                        ? indexFilters.dateRange.end.toISOString().split('T')[0]
                        : ''}
                    onBlur={(e) => {
                        const val = e.target.value;
                        if (val) {
                            const end = new Date(val + 'T23:59:59');
                            const start = indexFilters.dateRange?.start ?? new Date(0);
                            setDateRangeFilter({ start, end });
                        } else if (!indexFilters.dateRange?.start) {
                            setDateRangeFilter(null);
                        }
                    }}
                    title="To date"
                />

                {hasActiveFilters && (
                    <button
                        className="hindsight-filter-clear-btn"
                        onClick={clearAllFilters}
                    >
                        Clear all
                    </button>
                )}
            </div>

            {numericFields.length > 0 && (
                <div className="hindsight-filter-row">
                    <select
                        className="hindsight-filter-input"
                        value={newFilterField}
                        onChange={(e) => setNewFilterField(e.target.value)}
                    >
                        {numericFields.map(f => (
                            <option key={f.key} value={f.key}>{f.key}</option>
                        ))}
                    </select>
                    <select
                        className="hindsight-filter-input"
                        value={newFilterOp}
                        onChange={(e) => setNewFilterOp(e.target.value as '>=' | '<=' | '=')}
                    >
                        <option value=">=">≥</option>
                        <option value="<=">≤</option>
                        <option value="=">=</option>
                    </select>
                    <input
                        type="number"
                        className="hindsight-filter-input hindsight-filter-number"
                        placeholder="Value"
                        value={newFilterValue}
                        onChange={(e) => setNewFilterValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddFilter();
                        }}
                    />
                    <button
                        className="hindsight-filter-add-btn"
                        onClick={handleAddFilter}
                    >
                        Add filter
                    </button>
                </div>
            )}

            {indexFilters.fieldFilters.length > 0 && (
                <div className="hindsight-filter-active-filters">
                    {indexFilters.fieldFilters.map((f, i) => (
                        <span key={i} className="hindsight-filter-pill">
                            {f.field} {f.operator} {f.value}
                            <button
                                className="hindsight-filter-pill-remove"
                                onClick={() => removeFieldFilter(i)}
                                title="Remove filter"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
