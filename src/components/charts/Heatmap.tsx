/**
 * Heatmap
 *
 * GitHub-style contribution/mood heatmap (React SVG, no external library).
 * Features:
 * - Polarity-aware coloring via getPolarityColor
 * - Event delegation (single onClick/onPointerMove on SVG container)
 * - React-rendered tooltip positioned via state
 * - 1-year view with year navigation
 * - Desktop drag-select → updates chartUiStore.chartDateRange
 * - Mobile: tap-to-show persistent tooltips, no drag
 * - Keyboard navigation: arrow keys, Enter opens note
 * - Accessibility: aria-hidden SVG + visually-hidden table for screen readers
 */

import React from 'react';
import { Platform } from 'obsidian';
import { useJournalStore } from '../../store/journalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';
import { useChartUiStore } from '../../store/chartUiStore';
import { getHeatmapData } from '../../services/PulseService';
import { getPolarityColor } from '../../utils/statsUtils';
import { formatDateISO, startOfDay } from '../../utils/dateUtils';

interface HeatmapProps {
    fieldKey: string;
    polarity: string;
    months?: number;
}

/** Cell size and spacing constants */
const CELL_SIZE = 12;
const CELL_GAP = 2;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;
const LABEL_WIDTH = 30;
const TOP_PADDING = 16;

/** Day labels (Mon, Wed, Fri) */
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export const Heatmap = React.memo(function Heatmap({
    fieldKey,
    polarity,
    months = 12,
}: HeatmapProps): React.ReactElement {
    const entries = useJournalStore(s => s.entries);
    const revision = useJournalStore(s => s.revision);
    const app = useAppStore(s => s.app);
    const isMobile = Platform.isMobile;

    // Year navigation state
    const [yearOffset, setYearOffset] = React.useState(0);

    // Tooltip state
    const [tooltip, setTooltip] = React.useState<{
        date: string;
        value: number | null;
        x: number;
        y: number;
    } | null>(null);

    // Mobile focused cell (persistent tooltip on tap)
    const [focusedCell, setFocusedCell] = React.useState<string | null>(null);

    // Keyboard focus tracking
    const focusedDateRef = React.useRef<string | null>(null);
    const svgContainerRef = React.useRef<HTMLDivElement>(null);

    // Drag state refs (imperative — no React state during drag)
    const dragStartRef = React.useRef<string | null>(null);
    const dragCurrentRef = React.useRef<string | null>(null);
    const isDraggingRef = React.useRef(false);
    const cellMapRef = React.useRef<Map<string, SVGRectElement>>(new Map());

    // Compute heatmap data
    const heatmapData = React.useMemo(() => {
        const entryArray = Array.from(entries.values());
        return getHeatmapData(entryArray, fieldKey, months);
    }, [revision, fieldKey, months]);

    // Filter data to the displayed year
    const displayYear = new Date().getFullYear() - yearOffset;
    const yearData = React.useMemo(() => {
        return heatmapData.filter(d => {
            const year = parseInt(d.date.substring(0, 4), 10);
            return year === displayYear;
        });
    }, [heatmapData, displayYear]);

    // Get min/max for color mapping
    const { min, max } = React.useMemo(() => {
        const values = yearData.filter(d => d.value !== null).map(d => d.value as number);
        if (values.length === 0) return { min: 0, max: 1 };
        return { min: Math.min(...values), max: Math.max(...values) };
    }, [yearData]);

    // Build grid data: organize by week columns, day rows
    const gridData = React.useMemo(() => {
        if (yearData.length === 0) return [];

        const cells: { date: string; value: number | null; col: number; row: number }[] = [];

        // Get first day of the year data range
        const firstDate = new Date(yearData[0].date + 'T00:00:00');
        const firstDow = firstDate.getDay(); // 0=Sun

        let col = 0;
        let row = firstDow;

        for (const d of yearData) {
            const dow = new Date(d.date + 'T00:00:00').getDay();
            // Start a new week column when we hit Sunday
            if (cells.length > 0 && dow === 0) {
                col++;
            }
            row = dow;
            cells.push({ date: d.date, value: d.value, col, row });
        }

        return cells;
    }, [yearData]);

    const totalCols = gridData.length > 0
        ? Math.max(...gridData.map(c => c.col)) + 1
        : 0;

    const svgWidth = LABEL_WIDTH + totalCols * CELL_TOTAL + CELL_GAP;
    const svgHeight = TOP_PADDING + 7 * CELL_TOTAL + CELL_GAP;

    // Ref callback to register cells in the map
    const cellRefCallback = React.useCallback((el: SVGRectElement | null, date: string) => {
        if (el) {
            cellMapRef.current.set(date, el);
        } else {
            cellMapRef.current.delete(date);
        }
    }, []);

    // Find entry file path for a date
    const findEntryPath = React.useCallback((dateStr: string): string | null => {
        for (const entry of entries.values()) {
            if (formatDateISO(startOfDay(entry.date)) === dateStr) {
                return entry.filePath;
            }
        }
        return null;
    }, [entries]);

    // Open note for a date
    const openNote = React.useCallback((dateStr: string) => {
        if (!app) return;
        const path = findEntryPath(dateStr);
        if (path) {
            void app.workspace.openLinkText(path, '');
        }
    }, [app, findEntryPath]);

    // Handle click via event delegation
    const handleClick = React.useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        const target = e.target as SVGElement;
        const dateStr = target.dataset.date;
        if (!dateStr) return;

        if (isMobile) {
            // Tap-to-show persistent tooltip
            if (focusedCell === dateStr) {
                setFocusedCell(null);
                setTooltip(null);
            } else {
                setFocusedCell(dateStr);
                const cell = gridData.find(c => c.date === dateStr);
                if (cell) {
                    setTooltip({
                        date: dateStr,
                        value: cell.value,
                        x: LABEL_WIDTH + cell.col * CELL_TOTAL + CELL_SIZE / 2,
                        y: TOP_PADDING + cell.row * CELL_TOTAL + CELL_SIZE + 4,
                    });
                }
            }
        } else {
            openNote(dateStr);
        }
    }, [isMobile, focusedCell, gridData, openNote]);

    // Hover tooltip (desktop only)
    const handleMouseMove = React.useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (isMobile || isDraggingRef.current) return;
        const target = e.target as SVGElement;
        const dateStr = target.dataset.date;
        if (!dateStr) {
            setTooltip(null);
            return;
        }
        const cell = gridData.find(c => c.date === dateStr);
        if (cell) {
            setTooltip({
                date: dateStr,
                value: cell.value,
                x: LABEL_WIDTH + cell.col * CELL_TOTAL + CELL_SIZE / 2,
                y: TOP_PADDING + cell.row * CELL_TOTAL + CELL_SIZE + 4,
            });
        }
    }, [isMobile, gridData]);

    const handleMouseLeave = React.useCallback(() => {
        if (!isMobile) {
            setTooltip(null);
        }
    }, [isMobile]);

    // Desktop drag-select handlers
    const handlePointerDown = React.useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        if (isMobile) return;
        const target = e.target as SVGElement;
        const dateStr = target.dataset.date;
        if (!dateStr) return;

        isDraggingRef.current = true;
        dragStartRef.current = dateStr;
        dragCurrentRef.current = dateStr;
    }, [isMobile]);

    const handlePointerMove = React.useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        if (!isDraggingRef.current || isMobile) return;
        const target = e.target as SVGElement;
        const dateStr = target.dataset.date;
        if (!dateStr || dateStr === dragCurrentRef.current) return;

        dragCurrentRef.current = dateStr;

        // Apply drag selection CSS classes imperatively
        const start = dragStartRef.current;
        const end = dateStr;
        if (!start) return;

        const [startDate, endDate] = start < end ? [start, end] : [end, start];

        for (const [date, el] of cellMapRef.current.entries()) {
            if (date >= startDate && date <= endDate) {
                el.classList.add('hindsight-heatmap-cell-drag-selected');
            } else {
                el.classList.remove('hindsight-heatmap-cell-drag-selected');
            }
        }
    }, [isMobile]);

    const handlePointerUp = React.useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        const start = dragStartRef.current;
        const end = dragCurrentRef.current;

        // Clear drag selection CSS
        for (const el of cellMapRef.current.values()) {
            el.classList.remove('hindsight-heatmap-cell-drag-selected');
        }

        if (start && end && start !== end) {
            const [startDate, endDate] = start < end ? [start, end] : [end, start];
            useChartUiStore.getState().setChartDateRange({
                start: new Date(startDate + 'T00:00:00'),
                end: new Date(endDate + 'T00:00:00'),
            });
        }

        dragStartRef.current = null;
        dragCurrentRef.current = null;
    }, []);

    const handlePointerCancel = React.useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        for (const el of cellMapRef.current.values()) {
            el.classList.remove('hindsight-heatmap-cell-drag-selected');
        }
        dragStartRef.current = null;
        dragCurrentRef.current = null;
    }, []);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            isDraggingRef.current = false;
        };
    }, []);

    // Mobile: tap outside dismisses tooltip
    React.useEffect(() => {
        if (!isMobile || !focusedCell) return;

        const handleOutsideClick = (e: MouseEvent) => {
            if (svgContainerRef.current && !svgContainerRef.current.contains(e.target as Node)) {
                setFocusedCell(null);
                setTooltip(null);
            }
        };

        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, [isMobile, focusedCell]);

    // Keyboard navigation
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (!gridData.length) return;

        // Initialize focused date if needed
        if (!focusedDateRef.current) {
            focusedDateRef.current = gridData[gridData.length - 1].date;
        }

        const currentIdx = gridData.findIndex(c => c.date === focusedDateRef.current);
        if (currentIdx === -1) return;

        let newIdx = currentIdx;

        switch (e.key) {
            case 'ArrowRight':
                newIdx = Math.min(currentIdx + 1, gridData.length - 1);
                e.preventDefault();
                break;
            case 'ArrowLeft':
                newIdx = Math.max(currentIdx - 1, 0);
                e.preventDefault();
                break;
            case 'ArrowDown':
                // Next week row (same day of week)
                newIdx = Math.min(currentIdx + 7, gridData.length - 1);
                e.preventDefault();
                break;
            case 'ArrowUp':
                newIdx = Math.max(currentIdx - 7, 0);
                e.preventDefault();
                break;
            case 'Enter':
                openNote(gridData[currentIdx].date);
                e.preventDefault();
                return;
            default:
                return;
        }

        const newCell = gridData[newIdx];
        focusedDateRef.current = newCell.date;

        // Remove old focus
        for (const el of cellMapRef.current.values()) {
            el.classList.remove('hindsight-heatmap-cell-focused');
        }
        // Add new focus
        const newEl = cellMapRef.current.get(newCell.date);
        if (newEl) {
            newEl.classList.add('hindsight-heatmap-cell-focused');
        }

        // Update tooltip for focused cell
        setTooltip({
            date: newCell.date,
            value: newCell.value,
            x: LABEL_WIDTH + newCell.col * CELL_TOTAL + CELL_SIZE / 2,
            y: TOP_PADDING + newCell.row * CELL_TOTAL + CELL_SIZE + 4,
        });
    }, [gridData, openNote]);

    return (
        <div className="hindsight-heatmap" ref={svgContainerRef}>
            {/* Year Navigation */}
            <div className="hindsight-heatmap-nav">
                <button
                    onClick={() => setYearOffset(y => y + 1)}
                    aria-label="Previous year"
                >
                    ◀
                </button>
                <span className="hindsight-heatmap-nav-label">{displayYear}</span>
                <button
                    onClick={() => setYearOffset(y => Math.max(0, y - 1))}
                    disabled={yearOffset === 0}
                    aria-label="Next year"
                >
                    ▶
                </button>
            </div>

            {gridData.length === 0 ? (
                <div className="hindsight-digest-empty">No entries for {displayYear}</div>
            ) : (
                <>
                    {/* SVG Heatmap */}
                    <div
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        role="application"
                        aria-labelledby="hindsight-heatmap-label"
                    >
                        <span id="hindsight-heatmap-label" className="sr-only">
                            Heatmap showing {fieldKey} over {displayYear}
                        </span>
                        <svg
                            width={svgWidth}
                            height={svgHeight}
                            aria-hidden="true"
                            onClick={handleClick}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onPointerDown={isMobile ? undefined : handlePointerDown}
                            onPointerMove={isMobile ? undefined : handlePointerMove}
                            onPointerUp={isMobile ? undefined : handlePointerUp}
                            onPointerCancel={isMobile ? undefined : handlePointerCancel}
                        >
                            {/* Day-of-week labels */}
                            {DAY_LABELS.map((label, i) => (
                                label && (
                                    <text
                                        key={i}
                                        x={0}
                                        y={TOP_PADDING + i * CELL_TOTAL + CELL_SIZE - 2}
                                        className="hindsight-heatmap-day-label"
                                    >
                                        {label}
                                    </text>
                                )
                            ))}

                            {/* Cells */}
                            {gridData.map(cell => {
                                const x = LABEL_WIDTH + cell.col * CELL_TOTAL;
                                const y = TOP_PADDING + cell.row * CELL_TOTAL;
                                const color = cell.value !== null
                                    ? getPolarityColor(
                                        cell.value,
                                        min,
                                        max,
                                        polarity as 'higher-is-better' | 'lower-is-better' | 'neutral'
                                    )
                                    : 'var(--background-modifier-border)';

                                return (
                                    <rect
                                        key={cell.date}
                                        ref={el => cellRefCallback(el, cell.date)}
                                        data-date={cell.date}
                                        x={x}
                                        y={y}
                                        width={CELL_SIZE}
                                        height={CELL_SIZE}
                                        fill={color}
                                        className="hindsight-heatmap-cell"
                                    />
                                );
                            })}
                        </svg>

                        {/* Tooltip */}
                        {tooltip && (
                            <div
                                className="hindsight-heatmap-tooltip"
                                ref={el => {
                                    if (el) {
                                        el.style.setProperty('left', `${tooltip.x}px`);
                                        el.style.setProperty('top', `${tooltip.y}px`);
                                    }
                                }}
                            >
                                <span className="hindsight-heatmap-tooltip-date">{tooltip.date}</span>
                                <span className="hindsight-heatmap-tooltip-value">
                                    {tooltip.value !== null ? tooltip.value : '—'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Color Legend */}
                    <div className="hindsight-heatmap-legend">
                        <span className="hindsight-heatmap-legend-label">Less</span>
                        <div className="hindsight-heatmap-legend-gradient">
                            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                                const val = min + ratio * (max - min);
                                const color = getPolarityColor(
                                    val, min, max,
                                    polarity as 'higher-is-better' | 'lower-is-better' | 'neutral'
                                );
                                return (
                                    <div
                                        key={ratio}
                                        className="hindsight-heatmap-legend-swatch"
                                        ref={el => {
                                            if (el) el.style.setProperty('background-color', color);
                                        }}
                                    />
                                );
                            })}
                        </div>
                        <span className="hindsight-heatmap-legend-label">More</span>
                        <span className="hindsight-heatmap-legend-range">
                            {fieldKey}: {min}–{max}
                        </span>
                    </div>

                    {/* Visually-hidden table for screen readers */}
                    <table className="sr-only">
                        <caption>
                            {fieldKey} values over {displayYear}
                        </caption>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {yearData.map(d => (
                                <tr key={d.date}>
                                    <td>{d.date}</td>
                                    <td>{d.value !== null ? d.value : 'No data'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
});
