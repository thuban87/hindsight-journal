/**
 * Field Input
 *
 * Dynamic input renderer based on frontmatter field type.
 * Maps field types from inferFieldType() to appropriate UI controls:
 * - number / numeric-text → SliderInput (with min/max from field.range) + numeric text
 * - boolean → toggle switch
 * - string → text input
 * - string[] → TagInput (comma-separated, rendered as removable pills)
 * - date → date picker input
 */

import React from 'react';
import type { FrontmatterField } from '../../types';
import { SliderInput } from './SliderInput';
import { TagInput } from './TagInput';

interface FieldInputProps {
    /** Field definition with type, key, and range info */
    field: FrontmatterField;
    /** Current value of this field */
    value: unknown;
    /** Called when the value changes */
    onChange: (value: unknown) => void;
}

export function FieldInput({ field, value, onChange }: FieldInputProps): React.ReactElement {
    const { type, key, range } = field;

    switch (type) {
        case 'number':
        case 'numeric-text': {
            const numValue = value !== undefined && value !== null && value !== ''
                ? (isNaN(Number(value)) ? null : Number(value))
                : null;
            const min = range?.min ?? 0;
            const max = range?.max ?? 10;
            return (
                <div className="hindsight-field-input">
                    <label className="hindsight-field-label">{key}</label>
                    <SliderInput
                        min={min}
                        max={max}
                        value={numValue}
                        onChange={(v) => onChange(v)}
                    />
                </div>
            );
        }

        case 'boolean': {
            const boolValue = typeof value === 'boolean'
                ? value
                : (typeof value === 'string'
                    ? value.toLowerCase() === 'true'
                    : false);
            return (
                <div className="hindsight-field-input">
                    <label className="hindsight-field-label">{key}</label>
                    <div
                        className={`hindsight-field-toggle ${boolValue ? 'is-enabled' : ''}`}
                        role="switch"
                        aria-checked={boolValue}
                        aria-label={key}
                        tabIndex={0}
                        onClick={() => onChange(!boolValue)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onChange(!boolValue);
                            }
                        }}
                    >
                        <div className="hindsight-field-toggle-thumb" />
                    </div>
                </div>
            );
        }

        case 'string[]': {
            const tags = Array.isArray(value)
                ? value.map(String)
                : (typeof value === 'string' && value
                    ? value.split(',').map(s => s.trim()).filter(Boolean)
                    : []);
            return (
                <div className="hindsight-field-input">
                    <label className="hindsight-field-label">{key}</label>
                    <TagInput tags={tags} onChange={onChange} />
                </div>
            );
        }

        case 'date': {
            const dateStr = typeof value === 'string' ? value : '';
            return (
                <div className="hindsight-field-input">
                    <label className="hindsight-field-label">{key}</label>
                    <input
                        type="date"
                        className="hindsight-field-date"
                        value={dateStr}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
            );
        }

        default: {
            // string type — basic text input
            const strValue = value !== undefined && value !== null
                ? String(value)
                : '';
            return (
                <div className="hindsight-field-input">
                    <label className="hindsight-field-label">{key}</label>
                    <input
                        type="text"
                        className="hindsight-field-text"
                        value={strValue}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
            );
        }
    }
}
