/**
 * Sparkline Row
 *
 * Displays a field label, current value, and sparkline
 * for the sidebar Today tab. Shows last 14 data points.
 */

import React from 'react';
import { Sparkline } from '../charts/Sparkline';
import type { MetricDataPoint } from '../../types';

interface SparklineRowProps {
    /** Field key (used for identification) */
    fieldKey: string;
    /** Display label for the field */
    label: string;
    /** Current value (today's entry value for this field) */
    currentValue: number | null;
    /** Time series data (last 14 points will be used) */
    data: MetricDataPoint[];
}

export function SparklineRow({
    fieldKey,
    label,
    currentValue,
    data,
}: SparklineRowProps): React.ReactElement {
    // Take the last 14 data points for the sparkline
    const recentData = data.slice(-14).map(p => p.value);

    const formattedValue = currentValue !== null
        ? (Number.isInteger(currentValue) ? String(currentValue) : currentValue.toFixed(1))
        : '—';

    return (
        <div className="hindsight-sparkline-row">
            <span className="hindsight-sparkline-label">{label}</span>
            <span className="hindsight-sparkline-value">{formattedValue}</span>
            <Sparkline
                data={recentData}
                fieldName={fieldKey}
                width={80}
                height={24}
            />
        </div>
    );
}
