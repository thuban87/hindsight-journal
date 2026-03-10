/**
 * Coping Lookup
 *
 * "Last time you felt this way" panel. Shows entries where a specific
 * metric had a similar value to today, as compact metric cards.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { findSimilarEntries } from '../../services/EchoesService';
import { isNumericField, getNumericValue } from '../../services/FrontmatterService';
import { useAppStore } from '../../store/appStore';

interface CopingLookupProps {
    entries: JournalEntry[];
    todayEntry: JournalEntry;
    fields: FrontmatterField[];
}

export function CopingLookup({ entries, todayEntry, fields }: CopingLookupProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const [selectedField, setSelectedField] = useState<string>('');

    const numericFields = useMemo(
        () => fields.filter(f => isNumericField(f)),
        [fields]
    );

    useEffect(() => {
        if (numericFields.length > 0 && !selectedField) {
            setSelectedField(numericFields[0].key);
        }
    }, [numericFields, selectedField]);

    const todayValue = getNumericValue(todayEntry.frontmatter[selectedField]);

    const similarEntries = useMemo(() => {
        if (!selectedField || todayValue === null) return [];
        const field = numericFields.find(f => f.key === selectedField);
        const range = field?.range ? field.range.max - field.range.min : 10;
        const tolerance = Math.max(1, Math.round(range * 0.1));
        return findSimilarEntries(entries, selectedField, todayValue, tolerance, 5);
    }, [entries, selectedField, todayValue, numericFields]);

    if (numericFields.length === 0 || todayValue === null) return null;
    if (similarEntries.length === 0) return null;

    const handleEntryClick = (filePath: string) => {
        if (!app) return;
        void app.workspace.openLinkText(filePath, '');
    };

    return (
        <div className="hindsight-coping-lookup">
            <div className="hindsight-coping-lookup-header">
                <h3 className="hindsight-echoes-heading">Last time you felt this way</h3>
                <select
                    className="hindsight-echoes-select"
                    value={selectedField}
                    onChange={e => setSelectedField(e.target.value)}
                    aria-label="Select metric for coping lookup"
                >
                    {numericFields.map(f => (
                        <option key={f.key} value={f.key}>{f.key}</option>
                    ))}
                </select>
            </div>
            <div className="hindsight-coping-lookup-results">
                {similarEntries.map(entry => {
                    const val = getNumericValue(entry.frontmatter[selectedField]);
                    return (
                        <button
                            key={entry.filePath}
                            className="hindsight-coping-lookup-chip"
                            onClick={() => handleEntryClick(entry.filePath)}
                            type="button"
                        >
                            <span className="hindsight-coping-lookup-chip-date">
                                {entry.date.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                            <span className="hindsight-coping-lookup-chip-value">
                                {selectedField}: {val}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
