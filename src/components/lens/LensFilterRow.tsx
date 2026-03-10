/**
 * Lens Filter Row
 *
 * A single stackable filter row in the Lens panel.
 * Supports field, dateRange, tag, wordCount, qualityScore, and hasImages filter types.
 */

import React from 'react';
import type { LensFilterRow as LensFilterRowType, FrontmatterField } from '../../types';
import { isNumericField } from '../../services/FrontmatterService';

interface LensFilterRowProps {
    filter: LensFilterRowType;
    index: number;
    fields: FrontmatterField[];
    tags: string[];
    onUpdate: (index: number, filter: LensFilterRowType) => void;
    onRemove: (index: number) => void;
}

export function LensFilterRow({ filter, index, fields, tags, onUpdate, onRemove }: LensFilterRowProps): React.ReactElement {
    const numericFields = fields.filter(f => isNumericField(f));

    const handleTypeChange = (newType: string) => {
        switch (newType) {
            case 'field':
                onUpdate(index, {
                    type: 'field',
                    fieldKey: numericFields[0]?.key ?? '',
                    operator: '>=',
                    value: 0,
                });
                break;
            case 'dateRange':
                onUpdate(index, { type: 'dateRange', startDate: '', endDate: '' });
                break;
            case 'tag':
                onUpdate(index, { type: 'tag', tag: tags[0] ?? '' });
                break;
            case 'wordCount':
                onUpdate(index, { type: 'wordCount' });
                break;
            case 'qualityScore':
                onUpdate(index, { type: 'qualityScore' });
                break;
            case 'hasImages':
                onUpdate(index, { type: 'hasImages', enabled: true });
                break;
        }
    };

    return (
        <div className="hindsight-lens-filter-row">
            <select
                className="hindsight-lens-filter-type"
                value={filter.type}
                onChange={e => handleTypeChange(e.target.value)}
                aria-label="Filter type"
            >
                <option value="field">Field</option>
                <option value="dateRange">Date range</option>
                <option value="tag">Tag</option>
                <option value="wordCount">Word count</option>
                <option value="qualityScore">Quality score</option>
                <option value="hasImages">Has images</option>
            </select>

            {filter.type === 'field' && (
                <>
                    <select
                        className="hindsight-lens-filter-field"
                        value={filter.fieldKey}
                        onChange={e => onUpdate(index, { ...filter, fieldKey: e.target.value })}
                        aria-label="Field name"
                    >
                        {numericFields.map(f => (
                            <option key={f.key} value={f.key}>{f.key}</option>
                        ))}
                    </select>
                    <select
                        className="hindsight-lens-filter-operator"
                        value={filter.operator}
                        onChange={e => onUpdate(index, { ...filter, operator: e.target.value as '>=' | '<=' | '=' | '!=' })}
                        aria-label="Operator"
                    >
                        <option value=">=">≥</option>
                        <option value="<=">≤</option>
                        <option value="=">=</option>
                        <option value="!=">≠</option>
                    </select>
                    <input
                        type="number"
                        className="hindsight-lens-filter-value"
                        value={typeof filter.value === 'number' ? filter.value : ''}
                        onChange={e => onUpdate(index, { ...filter, value: Number(e.target.value) })}
                        aria-label="Value"
                    />
                </>
            )}

            {filter.type === 'dateRange' && (
                <>
                    <input
                        type="date"
                        className="hindsight-lens-filter-date"
                        value={filter.startDate}
                        onChange={e => onUpdate(index, { ...filter, startDate: e.target.value })}
                        aria-label="Start date"
                    />
                    <span className="hindsight-lens-filter-separator">to</span>
                    <input
                        type="date"
                        className="hindsight-lens-filter-date"
                        value={filter.endDate}
                        onChange={e => onUpdate(index, { ...filter, endDate: e.target.value })}
                        aria-label="End date"
                    />
                </>
            )}

            {filter.type === 'tag' && (
                <select
                    className="hindsight-lens-filter-tag"
                    value={filter.tag}
                    onChange={e => onUpdate(index, { ...filter, tag: e.target.value })}
                    aria-label="Tag"
                >
                    {tags.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            )}

            {filter.type === 'wordCount' && (
                <>
                    <input
                        type="number"
                        className="hindsight-lens-filter-value"
                        placeholder="Min"
                        value={filter.min ?? ''}
                        onChange={e => onUpdate(index, { ...filter, min: e.target.value ? Number(e.target.value) : undefined })}
                        aria-label="Minimum word count"
                    />
                    <span className="hindsight-lens-filter-separator">–</span>
                    <input
                        type="number"
                        className="hindsight-lens-filter-value"
                        placeholder="Max"
                        value={filter.max ?? ''}
                        onChange={e => onUpdate(index, { ...filter, max: e.target.value ? Number(e.target.value) : undefined })}
                        aria-label="Maximum word count"
                    />
                </>
            )}

            {filter.type === 'qualityScore' && (
                <>
                    <input
                        type="number"
                        className="hindsight-lens-filter-value"
                        placeholder="Min"
                        min={0}
                        max={100}
                        value={filter.min ?? ''}
                        onChange={e => onUpdate(index, { ...filter, min: e.target.value ? Number(e.target.value) : undefined })}
                        aria-label="Minimum quality score"
                    />
                    <span className="hindsight-lens-filter-separator">–</span>
                    <input
                        type="number"
                        className="hindsight-lens-filter-value"
                        placeholder="Max"
                        min={0}
                        max={100}
                        value={filter.max ?? ''}
                        onChange={e => onUpdate(index, { ...filter, max: e.target.value ? Number(e.target.value) : undefined })}
                        aria-label="Maximum quality score"
                    />
                </>
            )}

            {filter.type === 'hasImages' && (
                <label className="hindsight-lens-filter-checkbox">
                    <input
                        type="checkbox"
                        checked={filter.enabled}
                        onChange={e => onUpdate(index, { ...filter, enabled: e.target.checked })}
                    />
                    Has images
                </label>
            )}

            <button
                className="hindsight-lens-filter-remove"
                onClick={() => onRemove(index)}
                type="button"
                aria-label="Remove filter"
            >
                ×
            </button>
        </div>
    );
}
