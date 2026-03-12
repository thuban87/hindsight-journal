/**
 * Slider Input
 *
 * Combined slider + number input for numeric frontmatter fields.
 * Both inputs are synced — changing either updates the parent's
 * pendingChanges ref via the onChange callback.
 */

import React from 'react';

interface SliderInputProps {
    /** Minimum value for the slider range */
    min: number;
    /** Maximum value for the slider range */
    max: number;
    /** Current value (null if no data) */
    value: number | null;
    /** Called when the value changes */
    onChange: (value: number) => void;
}

export function SliderInput({ min, max, value, onChange }: SliderInputProps): React.ReactElement {
    const displayValue = value ?? min;

    return (
        <div className="hindsight-slider-input">
            <input
                type="range"
                className="hindsight-slider-range"
                min={min}
                max={max}
                step={max - min > 20 ? 1 : 0.5}
                value={displayValue}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <input
                type="number"
                className="hindsight-slider-number"
                min={min}
                max={max}
                step={max - min > 20 ? 1 : 0.5}
                value={displayValue}
                onChange={(e) => {
                    const num = Number(e.target.value);
                    if (!isNaN(num)) {
                        onChange(Math.min(max, Math.max(min, num)));
                    }
                }}
            />
            <span className="hindsight-slider-label">{displayValue}</span>
        </div>
    );
}
