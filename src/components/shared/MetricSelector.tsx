/**
 * Metric Selector
 *
 * Dropdown for selecting a frontmatter field to color-code the calendar.
 * Filters to only numeric and boolean fields (only these can be color-mapped).
 * Uses native <select> element styled with Obsidian CSS variables.
 */

import React from 'react';
import type { FrontmatterField } from '../../types';

interface MetricSelectorProps {
    fields: FrontmatterField[];
    selected: string | null;
    onChange: (key: string | null) => void;
}

export function MetricSelector({ fields, selected, onChange }: MetricSelectorProps): React.ReactElement {
    // Filter to only numeric and boolean fields (only these can be color-mapped)
    const colorableFields = fields.filter(
        f => f.type === 'number' || f.type === 'boolean'
    );

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        const value = e.target.value;
        onChange(value === '' ? null : value);
    };

    return (
        <select
            className="hindsight-metric-selector dropdown"
            value={selected ?? ''}
            onChange={handleChange}
            aria-label="Color-code by metric"
        >
            <option value="">None</option>
            {colorableFields.map(field => (
                <option key={field.key} value={field.key}>
                    {field.key}
                </option>
            ))}
        </select>
    );
}
