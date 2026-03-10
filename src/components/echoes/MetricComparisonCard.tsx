/**
 * Metric Comparison Card
 *
 * Displays a single field-by-field metric comparison between today and an echo entry.
 * Arrow icon, field name, "then" → "now" values, change amount.
 * Color-coded by polarity: green for improvement, red for regression, gray for neutral.
 */

import React from 'react';
import type { MetricComparison } from '../../types';

interface MetricComparisonCardProps {
    comparison: MetricComparison;
}

export function MetricComparisonCard({ comparison }: MetricComparisonCardProps): React.ReactElement {
    const { field, today, then, direction, change } = comparison;

    const arrow = direction === 'improved' ? '↑' : direction === 'declined' ? '↓' : '→';

    let colorClass: string;
    if (direction === 'improved') {
        colorClass = 'hindsight-metric-comparison--improved';
    } else if (direction === 'declined') {
        colorClass = 'hindsight-metric-comparison--declined';
    } else {
        colorClass = 'hindsight-metric-comparison--neutral';
    }

    const changeStr = change > 0 ? `+${change}` : String(change);

    return (
        <div className={`hindsight-metric-comparison ${colorClass}`}>
            <span className="hindsight-metric-comparison-arrow">{arrow}</span>
            <span className="hindsight-metric-comparison-field">{field}</span>
            <span className="hindsight-metric-comparison-values">
                {then} → {today}
            </span>
            <span className="hindsight-metric-comparison-change">({changeStr})</span>
        </div>
    );
}
