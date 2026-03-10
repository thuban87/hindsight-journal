/**
 * Scatter Plot
 *
 * Interactive scatter plot using Chart.js Scatter type.
 * Two dropdowns: X-axis field, Y-axis field (numeric only).
 * Optional third dropdown: color-by (boolean fields).
 * Shows Pearson r value, regression line, and click-to-open.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Chart, ScatterController, PointElement, LinearScale } from 'chart.js';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { pearsonCorrelation } from '../../services/MetricsEngine';
import { getTimeSeries } from '../../services/ChartDataService';
import { EmptyState } from '../shared/EmptyState';
import { Notice } from 'obsidian';
import { isNumericField } from '../../services/FrontmatterService';

// Ensure scatter controller is registered
Chart.register(ScatterController, PointElement, LinearScale);

interface ScatterPlotProps {
    /** Pre-selected X field (e.g. from correlation card click) */
    initialFieldX?: string;
    /** Pre-selected Y field */
    initialFieldY?: string;
}

export function ScatterPlot({ initialFieldX, initialFieldY }: ScatterPlotProps): React.ReactElement {
    const app = useAppStore(s => s.app);
    const entries = useJournalStore(s => s.entries);
    const detectedFields = useJournalStore(s => s.detectedFields);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [chartError, setChartError] = useState(false);

    const numericFields = useMemo(
        () => detectedFields.filter(f => isNumericField(f)),
        [detectedFields]
    );
    const booleanFields = useMemo(
        () => detectedFields.filter(f => f.type === 'boolean'),
        [detectedFields]
    );

    const [fieldX, setFieldX] = useState(initialFieldX ?? numericFields[0]?.key ?? '');
    const [fieldY, setFieldY] = useState(initialFieldY ?? numericFields[1]?.key ?? '');
    const [colorBy, setColorBy] = useState('');

    // Sync pre-selection when props change
    useEffect(() => {
        if (initialFieldX) setFieldX(initialFieldX);
        if (initialFieldY) setFieldY(initialFieldY);
    }, [initialFieldX, initialFieldY]);

    // Compute data points and r value
    const entriesArray = useMemo(() => Array.from(entries.values()), [entries]);

    const { dataPoints, rValue } = useMemo(() => {
        if (!fieldX || !fieldY || fieldX === fieldY) {
            return { dataPoints: [], rValue: null };
        }

        const seriesX = getTimeSeries(entriesArray, fieldX);
        const seriesY = getTimeSeries(entriesArray, fieldY);
        const r = pearsonCorrelation(seriesX, seriesY);

        // Build scatter data: match by timestamp
        const yMap = new Map<number, number>();
        for (const p of seriesY) {
            if (p.value !== null) yMap.set(p.date, p.value);
        }

        const points: { x: number; y: number; date: number; filePath: string; colorVal?: boolean }[] = [];
        for (const p of seriesX) {
            if (p.value === null) continue;
            const yVal = yMap.get(p.date);
            if (yVal === undefined) continue;

            // Find entry for this date to get filePath and colorBy value
            const entry = entriesArray.find(e => e.date.getTime() === p.date);
            if (!entry) continue;

            const point: { x: number; y: number; date: number; filePath: string; colorVal?: boolean } = {
                x: p.value,
                y: yVal,
                date: p.date,
                filePath: entry.filePath,
            };

            if (colorBy && entry.frontmatter[colorBy] !== undefined) {
                point.colorVal = Boolean(entry.frontmatter[colorBy]);
            }

            points.push(point);
        }

        return { dataPoints: points, rValue: r };
    }, [entriesArray, fieldX, fieldY, colorBy]);

    // Click handler: open note on dot click
    const handleClick = useCallback((filePath: string) => {
        if (!app) return;
        const file = app.vault.getFileByPath(filePath);
        if (!file) {
            new Notice('Entry file no longer exists.');
            return;
        }
        void app.workspace.openLinkText(filePath, '');
    }, [app]);

    // Chart.js render effect
    useEffect(() => {
        if (!canvasRef.current || dataPoints.length === 0) return;

        setChartError(false);
        let chart: Chart | null = null;

        try {
            // Separate datasets for boolean coloring
            let datasets;
            if (colorBy) {
                const truePoints = dataPoints.filter(p => p.colorVal === true);
                const falsePoints = dataPoints.filter(p => p.colorVal !== true);
                datasets = [
                    {
                        label: `${colorBy} = true`,
                        data: truePoints.map(p => ({ x: p.x, y: p.y })),
                        backgroundColor: 'rgba(75, 192, 75, 0.7)',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    },
                    {
                        label: `${colorBy} = false`,
                        data: falsePoints.map(p => ({ x: p.x, y: p.y })),
                        backgroundColor: 'rgba(150, 150, 150, 0.7)',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    },
                ];
            } else {
                datasets = [{
                    label: `${fieldX} vs ${fieldY}`,
                    data: dataPoints.map(p => ({ x: p.x, y: p.y })),
                    backgroundColor: 'rgba(75, 130, 192, 0.7)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }];
            }

            // Add regression line if we have enough points
            if (dataPoints.length >= 2 && rValue !== null) {
                const xVals = dataPoints.map(p => p.x);
                const yVals = dataPoints.map(p => p.y);
                const n = xVals.length;
                const sumX = xVals.reduce((s, v) => s + v, 0);
                const sumY = yVals.reduce((s, v) => s + v, 0);
                const sumXY = xVals.reduce((s, v, i) => s + v * yVals[i], 0);
                const sumX2 = xVals.reduce((s, v) => s + v * v, 0);

                const denom = n * sumX2 - sumX * sumX;
                if (denom !== 0) {
                    const slope = (n * sumXY - sumX * sumY) / denom;
                    const intercept = (sumY - slope * sumX) / n;
                    const minX = Math.min(...xVals);
                    const maxX = Math.max(...xVals);

                    datasets.push({
                        label: 'Trend',
                        data: [
                            { x: minX, y: slope * minX + intercept },
                            { x: maxX, y: slope * maxX + intercept },
                        ],
                        backgroundColor: 'transparent',
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...(({ borderColor: 'rgba(255, 99, 132, 0.5)', borderWidth: 2, showLine: true, borderDash: [5, 5] }) as Record<string, unknown> as any),
                    });
                }
            }

            const style = getComputedStyle(document.body);

            chart = new Chart(canvasRef.current, {
                type: 'scatter',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: { enabled: false },
                        legend: { display: !!colorBy },
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: fieldX,
                                color: style.getPropertyValue('--text-muted').trim() || '#999',
                            },
                            ticks: { color: style.getPropertyValue('--text-muted').trim() || '#999' },
                            grid: { color: style.getPropertyValue('--background-modifier-border').trim() || '#333' },
                        },
                        y: {
                            title: {
                                display: true,
                                text: fieldY,
                                color: style.getPropertyValue('--text-muted').trim() || '#999',
                            },
                            ticks: { color: style.getPropertyValue('--text-muted').trim() || '#999' },
                            grid: { color: style.getPropertyValue('--background-modifier-border').trim() || '#333' },
                        },
                    },
                    onClick: (_event, elements) => {
                        if (elements.length > 0) {
                            const idx = elements[0].index;
                            const dsIdx = elements[0].datasetIndex;
                            // Map back to data point
                            let points;
                            if (colorBy) {
                                points = dsIdx === 0
                                    ? dataPoints.filter(p => p.colorVal === true)
                                    : dataPoints.filter(p => p.colorVal !== true);
                            } else {
                                points = dataPoints;
                            }
                            if (points[idx]) {
                                handleClick(points[idx].filePath);
                            }
                        }
                    },
                },
            });
        } catch (err) {
            console.error('[Hindsight] ScatterPlot chart initialization failed:', err);
            setChartError(true);
            chart?.destroy();
            return;
        }

        // Theme reactivity
        const onThemeChange = (): void => {
            if (!chart) return;
            const s = getComputedStyle(document.body);
            const mutedColor = s.getPropertyValue('--text-muted').trim() || '#999';
            const borderColor = s.getPropertyValue('--background-modifier-border').trim() || '#333';

            if (chart.options.scales?.['x']) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const xScale = chart.options.scales['x'] as any;
                if (xScale.title) xScale.title.color = mutedColor;
                if (xScale.ticks) xScale.ticks.color = mutedColor;
                if (xScale.grid) xScale.grid.color = borderColor;
            }
            if (chart.options.scales?.['y']) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const yScale = chart.options.scales['y'] as any;
                if (yScale.title) yScale.title.color = mutedColor;
                if (yScale.ticks) yScale.ticks.color = mutedColor;
                if (yScale.grid) yScale.grid.color = borderColor;
            }
            chart.update('none');
        };

        app?.workspace.on('css-change', onThemeChange);

        return () => {
            if (app) {
                app.workspace.off('css-change', onThemeChange);
            }
            chart?.destroy();
        };
    }, [dataPoints, fieldX, fieldY, colorBy, rValue, app, handleClick]);

    if (numericFields.length < 2) {
        return <EmptyState message="Need at least 2 numeric fields for scatter plot." />;
    }

    if (chartError) {
        return <div className="hindsight-chart-error">Chart failed to initialize. Try selecting different fields.</div>;
    }

    return (
        <div className="hindsight-scatter-plot">
            <div className="hindsight-scatter-controls">
                <label>
                    <span>X axis</span>
                    <select value={fieldX} onChange={e => setFieldX(e.target.value)} aria-label="X axis field">
                        {numericFields.map(f => (
                            <option key={f.key} value={f.key}>{f.key}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>Y axis</span>
                    <select value={fieldY} onChange={e => setFieldY(e.target.value)} aria-label="Y axis field">
                        {numericFields.map(f => (
                            <option key={f.key} value={f.key}>{f.key}</option>
                        ))}
                    </select>
                </label>
                {booleanFields.length > 0 && (
                    <label>
                        <span>Color by</span>
                        <select value={colorBy} onChange={e => setColorBy(e.target.value)} aria-label="Color by field">
                            <option value="">None</option>
                            {booleanFields.map(f => (
                                <option key={f.key} value={f.key}>{f.key}</option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            {rValue !== null && (
                <div className="hindsight-scatter-r-value">
                    r = {rValue.toFixed(3)} ({dataPoints.length} entries)
                </div>
            )}

            <div className="hindsight-scatter-canvas-container">
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={`Scatter plot showing ${fieldX} vs ${fieldY}`}
                />
            </div>
        </div>
    );
}
