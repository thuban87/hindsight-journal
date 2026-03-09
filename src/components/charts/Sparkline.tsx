/**
 * Sparkline
 *
 * React SVG inline mini-chart. Pure component — no Obsidian API dependency.
 * Null values create gaps in the line (SVG moveTo instead of lineTo).
 */

import React from 'react';

interface SparklineProps {
    /** Data values (null creates a gap) */
    data: (number | null)[];
    /** SVG width in pixels */
    width?: number;
    /** SVG height in pixels */
    height?: number;
    /** Line color (CSS color string) */
    color?: string;
    /** Show a dot on the last data point */
    showDots?: boolean;
    /** Field name for aria-label */
    fieldName?: string;
}

export function Sparkline({
    data,
    width = 80,
    height = 24,
    color = 'var(--interactive-accent)',
    showDots = true,
    fieldName = 'metric',
}: SparklineProps): React.ReactElement {
    // Filter to get min/max for scaling
    const validValues = data.filter((v): v is number => v !== null);

    if (validValues.length < 2) {
        return (
            <svg
                className="hindsight-sparkline"
                width={width}
                height={height}
                role="img"
                aria-label={`Sparkline showing ${fieldName} trend — insufficient data`}
            />
        );
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const range = max - min || 1; // Prevent division by zero

    const padding = 2;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    // Build SVG path with gaps for null values
    const segments: string[] = [];
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastValidX = 0;
    let lastValidY = 0;

    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        if (value === null) {
            lastX = null;
            lastY = null;
            continue;
        }

        const x = padding + (i / (data.length - 1)) * plotWidth;
        const y = padding + plotHeight - ((value - min) / range) * plotHeight;

        if (lastX === null || lastY === null) {
            segments.push(`M ${x} ${y}`);
        } else {
            segments.push(`L ${x} ${y}`);
        }

        lastX = x;
        lastY = y;
        lastValidX = x;
        lastValidY = y;
    }

    const pathD = segments.join(' ');

    return (
        <svg
            className="hindsight-sparkline"
            width={width}
            height={height}
            role="img"
            aria-label={`Sparkline showing ${fieldName} trend`}
        >
            <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {showDots && validValues.length > 0 && (
                <circle
                    cx={lastValidX}
                    cy={lastValidY}
                    r={2}
                    fill={color}
                />
            )}
        </svg>
    );
}
