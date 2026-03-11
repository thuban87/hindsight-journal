/**
 * Tag Co-Occurrence Matrix
 *
 * React SVG grid showing which tags appear together.
 * Cell color intensity = co-occurrence count.
 * Hover tooltip via ref-based DOM manipulation (no re-renders).
 *
 * SVG has role="img" + aria-label per plan-wide rules.
 * Labels render AFTER cells (SVG painter's model — later = on top).
 */

import React, { useState, useRef, useMemo } from 'react';
import type { TagCoOccurrenceResult, TagFrequencyResult } from '../../services/ThreadsService';

interface TagCoOccurrenceProps {
    /** Tag frequency data (used for label ordering) */
    tagFrequency: TagFrequencyResult[];
    /** Co-occurrence pairs */
    coOccurrence: TagCoOccurrenceResult[];
}

/** Size of each cell in the matrix */
const CELL_SIZE = 32;
/** Space reserved above the grid for rotated column labels (text extends upward from anchor) */
const COLUMN_LABEL_AREA = 80;
/** Space reserved left of the grid for row labels */
const ROW_LABEL_AREA = 130;

export function TagCoOccurrence({ tagFrequency, coOccurrence }: TagCoOccurrenceProps): React.ReactElement {
    const [matrixSize, setMatrixSize] = useState(10);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Get top N tags by frequency for the matrix axes
    const tags = useMemo(
        () => tagFrequency.slice(0, matrixSize).map(t => t.tag),
        [tagFrequency, matrixSize]
    );

    // Build lookup map for co-occurrence counts
    const countMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const pair of coOccurrence) {
            map.set(`${pair.tagA}|||${pair.tagB}`, pair.count);
            map.set(`${pair.tagB}|||${pair.tagA}`, pair.count);
        }
        return map;
    }, [coOccurrence]);

    // Find max co-occurrence for color scaling
    const maxCount = useMemo(() => {
        let max = 0;
        for (const pair of coOccurrence) {
            if (pair.count > max) max = pair.count;
        }
        return max || 1;
    }, [coOccurrence]);

    // Grid coordinates: grid starts at (ROW_LABEL_AREA, COLUMN_LABEL_AREA)
    const gridStartX = ROW_LABEL_AREA;
    const gridStartY = COLUMN_LABEL_AREA;
    const gridWidth = tags.length * CELL_SIZE;
    const gridHeight = tags.length * CELL_SIZE;
    const svgWidth = gridStartX + gridWidth;
    const svgHeight = gridStartY + gridHeight;

    const handleCellHover = (
        tagA: string,
        tagB: string,
        count: number,
        event: React.MouseEvent,
    ) => {
        if (!tooltipRef.current || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const x = event.clientX - containerRect.left;
        const y = event.clientY - containerRect.top;

        tooltipRef.current.style.setProperty('display', 'block');
        tooltipRef.current.style.setProperty('left', `${x + 12}px`);
        tooltipRef.current.style.setProperty('top', `${y - 14}px`);
        tooltipRef.current.textContent = `${tagA} + ${tagB}: ${count} co-occurrence${count !== 1 ? 's' : ''}`;
    };

    const handleMouseLeave = () => {
        if (tooltipRef.current) {
            tooltipRef.current.style.setProperty('display', 'none');
        }
    };

    if (tags.length < 2) {
        return <p className="hindsight-tag-timeline-empty">Not enough tags for co-occurrence analysis.</p>;
    }

    return (
        <div className="hindsight-tag-cooccurrence" ref={containerRef}>
            <div className="hindsight-tag-cooccurrence-controls">
                <label htmlFor="hindsight-matrix-size">Matrix size:</label>
                <select
                    id="hindsight-matrix-size"
                    value={matrixSize}
                    onChange={e => setMatrixSize(Number(e.target.value))}
                    aria-label="Select matrix size"
                >
                    {[5, 8, 10, 12, 15, 20].map(n => (
                        <option key={n} value={n}>{n} × {n}</option>
                    ))}
                </select>
                {matrixSize > 15 && (
                    <span className="hindsight-cooccurrence-notice">
                        Larger matrices may take longer to render and be harder to read.
                    </span>
                )}
            </div>
            <svg
                width={svgWidth}
                height={svgHeight}
                role="img"
                aria-label={`Co-occurrence matrix showing relationships between top ${tags.length} tags`}
            >
                {/* 1. Matrix cells — rendered FIRST (SVG painter's model) */}
                {tags.map((rowTag, row) =>
                    tags.map((colTag, col) => {
                        if (row === col) {
                            return (
                                <rect
                                    key={`${row}-${col}`}
                                    x={gridStartX + col * CELL_SIZE}
                                    y={gridStartY + row * CELL_SIZE}
                                    width={CELL_SIZE - 1}
                                    height={CELL_SIZE - 1}
                                    fill="var(--background-modifier-border)"
                                    rx={2}
                                />
                            );
                        }

                        const count = countMap.get(`${rowTag}|||${colTag}`) ?? 0;
                        const intensity = count > 0
                            ? Math.max(0.15, count / maxCount)
                            : 0;

                        return (
                            <rect
                                key={`${row}-${col}`}
                                x={gridStartX + col * CELL_SIZE}
                                y={gridStartY + row * CELL_SIZE}
                                width={CELL_SIZE - 1}
                                height={CELL_SIZE - 1}
                                fill={count > 0
                                    ? 'var(--interactive-accent)'
                                    : 'var(--background-secondary)'
                                }
                                opacity={count > 0 ? intensity : 1}
                                rx={2}
                                onMouseMove={e => handleCellHover(rowTag, colTag, count, e)}
                                onMouseLeave={handleMouseLeave}
                                aria-label={`${rowTag} and ${colTag}: ${count} co-occurrences`}
                            />
                        );
                    })
                )}

                {/* 2. Column labels (top) — textAnchor="start" so -45° rotation extends text UPWARD */}
                {tags.map((tag, i) => (
                    <text
                        key={`col-${tag}`}
                        x={gridStartX + i * CELL_SIZE + CELL_SIZE / 2}
                        y={gridStartY - 6}
                        textAnchor="start"
                        fontSize={10}
                        fill="var(--text-muted)"
                        transform={`rotate(-45, ${gridStartX + i * CELL_SIZE + CELL_SIZE / 2}, ${gridStartY - 6})`}
                    >
                        {tag.length > 14 ? tag.substring(0, 13) + '…' : tag}
                    </text>
                ))}

                {/* 3. Row labels (left) — positioned in the row label area */}
                {tags.map((tag, i) => (
                    <text
                        key={`row-${tag}`}
                        x={ROW_LABEL_AREA - 8}
                        y={gridStartY + i * CELL_SIZE + CELL_SIZE / 2 + 4}
                        textAnchor="end"
                        fontSize={10}
                        fill="var(--text-muted)"
                    >
                        {tag.length > 14 ? tag.substring(0, 13) + '…' : tag}
                    </text>
                ))}
            </svg>

            <div
                className="hindsight-tag-cooccurrence-tooltip"
                ref={tooltipRef}
            />
        </div>
    );
}
