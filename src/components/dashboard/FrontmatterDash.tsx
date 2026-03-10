/**
 * Frontmatter Dashboard
 *
 * Field completion overview showing which frontmatter fields
 * are filled vs missing across the last 30 days.
 * SVG heatmap-style grid: rows = fields, columns = days.
 */

import React, { useMemo } from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';

interface FrontmatterDashProps {
    entries: JournalEntry[];
    fields: FrontmatterField[];
}

export function FrontmatterDash({ entries, fields }: FrontmatterDashProps): React.ReactElement | null {
    // Generate last 30 days as date strings
    const days = useMemo(() => {
        const result: Date[] = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            result.push(d);
        }
        return result;
    }, []);

    // Build lookup: dateKey → entry
    const entryByDate = useMemo(() => {
        const map = new Map<string, JournalEntry>();
        for (const entry of entries) {
            const key = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}-${String(entry.date.getDate()).padStart(2, '0')}`;
            map.set(key, entry);
        }
        return map;
    }, [entries]);

    // Compute completion percentages per field
    const fieldStats = useMemo(() => {
        return fields.map(field => {
            let filled = 0;
            let total = 0;
            for (const day of days) {
                const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const entry = entryByDate.get(key);
                if (entry) {
                    total++;
                    const val = entry.frontmatter[field.key];
                    if (val !== null && val !== undefined && val !== '') {
                        filled++;
                    }
                }
            }
            return {
                field,
                filled,
                total,
                percentage: total > 0 ? Math.round((filled / total) * 100) : 0,
            };
        });
    }, [fields, days, entryByDate]);

    if (fields.length === 0) {
        return null;
    }

    const cellSize = 14;
    const cellGap = 2;
    const labelWidth = 100;
    const pctWidth = 40;
    const gridWidth = days.length * (cellSize + cellGap);
    const svgWidth = labelWidth + gridWidth + pctWidth + 10;
    const svgHeight = fields.length * (cellSize + cellGap) + 20;

    return (
        <div className="hindsight-frontmatter-dash">
            <h3 className="hindsight-section-heading">Field completion</h3>

            <div className="hindsight-frontmatter-dash-scroll">
                <svg
                    width={svgWidth}
                    height={svgHeight}
                    role="img"
                    aria-label="Field completion grid for the last 30 days"
                >
                    {/* Day labels (every 5th day) */}
                    {days.map((day, col) => {
                        if (col % 5 !== 0) return null;
                        return (
                            <text
                                key={`day-${col}`}
                                x={labelWidth + col * (cellSize + cellGap) + cellSize / 2}
                                y={10}
                                textAnchor="middle"
                                className="hindsight-frontmatter-dash-day-label"
                            >
                                {day.getDate()}
                            </text>
                        );
                    })}

                    {/* Rows: one per field */}
                    {fieldStats.map((stat, row) => {
                        const y = 15 + row * (cellSize + cellGap);
                        return (
                            <g key={stat.field.key}>
                                {/* Field label */}
                                <text
                                    x={labelWidth - 5}
                                    y={y + cellSize / 2 + 4}
                                    textAnchor="end"
                                    className="hindsight-frontmatter-dash-field-label"
                                >
                                    {stat.field.key.length > 12
                                        ? stat.field.key.substring(0, 11) + '…'
                                        : stat.field.key}
                                </text>

                                {/* Cells */}
                                {days.map((day, col) => {
                                    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                    const entry = entryByDate.get(dateKey);
                                    const isFilled = entry
                                        ? entry.frontmatter[stat.field.key] !== null
                                        && entry.frontmatter[stat.field.key] !== undefined
                                        && entry.frontmatter[stat.field.key] !== ''
                                        : false;

                                    return (
                                        <rect
                                            key={`${stat.field.key}-${col}`}
                                            x={labelWidth + col * (cellSize + cellGap)}
                                            y={y}
                                            width={cellSize}
                                            height={cellSize}
                                            rx={2}
                                            className={isFilled
                                                ? 'hindsight-frontmatter-dash-cell-filled'
                                                : 'hindsight-frontmatter-dash-cell-empty'
                                            }
                                            aria-label={`${stat.field.key} on ${dateKey}: ${isFilled ? 'filled' : 'missing'}`}
                                        />
                                    );
                                })}

                                {/* Completion percentage */}
                                <text
                                    x={labelWidth + gridWidth + 8}
                                    y={y + cellSize / 2 + 4}
                                    className="hindsight-frontmatter-dash-pct"
                                >
                                    {stat.percentage}%
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
