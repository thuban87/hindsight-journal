/**
 * Metric Chart
 *
 * Chart.js Line chart wrapper for visualizing frontmatter field data.
 * Uses the Chart.js cleanup pattern from plan-wide rules:
 * - Canvas null guard before Chart creation
 * - Theme-reactive via css-change subscription (200ms debounce)
 * - Tooltip plugin disabled (uses React <div> tooltip instead)
 * - Error handling with try/catch around Chart initialization
 * - Cleanup: off() + chart.destroy() in useEffect return
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Chart } from '../../utils/chartSetup';
import type { ChartConfiguration as ChartConfig } from 'chart.js';
import { useAppStore } from '../../store/appStore';
import { useChartData } from '../../hooks/useMetrics';
import { useChartUiStore } from '../../store/chartUiStore';
import * as ChartDataService from '../../services/ChartDataService';
import { stripMarkdown } from '../../services/SectionParserService';
import { useJournalStore } from '../../store/journalStore';
import type { MetricDataPoint } from '../../types';

interface MetricChartProps {
    /** Field keys to chart */
    fields: string[];
    /** Show rolling average overlay */
    showRolling?: boolean;
    /** Show trend line overlay */
    showTrend?: boolean;
    /** Chart container height in pixels */
    height?: number;
}

/** Default chart colors (CSS variable-based with fallbacks) */
const CHART_COLORS = [
    'rgb(99, 132, 255)',   // blue
    'rgb(255, 99, 132)',   // red
    'rgb(75, 192, 192)',   // teal
    'rgb(255, 159, 64)',   // orange
    'rgb(153, 102, 255)',  // purple
    'rgb(255, 205, 86)',   // yellow
];

/** Read a CSS variable value from the document body */
function getCSSVar(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

export function MetricChart({
    fields,
    showRolling = false,
    showTrend = false,
    height = 300,
}: MetricChartProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const [chartError, setChartError] = useState(false);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        content: string;
    }>({ visible: false, x: 0, y: 0, content: '' });
    const chartDateRange = useChartUiStore(s => s.chartDateRange);
    const plugin = useAppStore(s => s.plugin);

    // Annotation data for x-axis markers
    const [annotationMap, setAnnotationMap] = useState<Map<string, string[]>>(new Map());

    // Get chart data for each field
    const fieldDataMap = new Map<string, ReturnType<typeof useChartData>>();
    // We need to call hooks unconditionally, so we handle the first field here
    // and use a different approach for multiple fields
    const firstFieldData = useChartData(fields[0] ?? '');
    if (fields[0]) {
        fieldDataMap.set(fields[0], firstFieldData);
    }

    // Load annotations for all visible entries
    useEffect(() => {
        const annotationService = plugin?.services.annotationService;
        if (!annotationService) return;

        let cancelled = false;
        void annotationService.getAllAnnotated().then(allAnnotated => {
            if (cancelled) return;
            const map = new Map<string, string[]>();
            for (const { filePath, annotations } of allAnnotated) {
                // Find the entry to get its date label
                const entries = useJournalStore.getState().entries;
                for (const entry of entries.values()) {
                    if (entry.filePath === filePath) {
                        const label = `${entry.date.getMonth() + 1}/${entry.date.getDate()}`;
                        map.set(label, annotations);
                        break;
                    }
                }
            }
            setAnnotationMap(map);
        });

        return () => { cancelled = true; };
    }, [plugin]);

    // Handle clicking a data point — show excerpt popover
    const handleDataPointClick = useCallback((dateLabel: string) => {
        if (!app) return;

        // Find the entry for this date
        const entries = useJournalStore.getState().entries;
        for (const entry of entries.values()) {
            const entryLabel = `${entry.date.getMonth() + 1}/${entry.date.getDate()}`;
            if (entryLabel === dateLabel) {
                // Get excerpt from first section
                const sectionKeys = Object.keys(entry.sections);
                let excerpt = '';
                for (const key of sectionKeys) {
                    const content = entry.sections[key];
                    if (content && content.trim().length > 0) {
                        excerpt = stripMarkdown(content).substring(0, 200);
                        break;
                    }
                }

                if (excerpt) {
                    setTooltip({
                        visible: true,
                        x: 0,
                        y: 0,
                        content: excerpt,
                    });
                    // Auto-hide after 3 seconds
                    setTimeout(() => {
                        setTooltip(prev => ({ ...prev, visible: false }));
                    }, 3000);
                }

                void app.workspace.openLinkText(entry.filePath, '', false);
                return;
            }
        }
    }, [app]);

    // Build the chart config — returns a plain object; typed loosely
    // because Chart.js generics are overly strict for dynamic dataset creation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildConfig = useCallback((): Record<string, any> | null => {
        if (fields.length === 0) return null;

        const textColor = getCSSVar('--text-normal', '#dcddde');
        const mutedColor = getCSSVar('--text-muted', '#888');
        const gridColor = getCSSVar('--background-modifier-border', '#333');

        // Build multi-metric dataset for all fields
        const allSeries: { data: MetricDataPoint[]; label: string; color: string }[] = [];

        for (let i = 0; i < fields.length; i++) {
            const fieldKey = fields[i];
            let data: MetricDataPoint[];

            if (i === 0) {
                data = firstFieldData.data;
            } else {
                // For additional fields, read from cache directly
                const entries = Array.from(useJournalStore.getState().entries.values());
                data = ChartDataService.getTimeSeries(entries, fieldKey);
            }

            // Apply date range filter at render time
            if (chartDateRange) {
                const startMs = chartDateRange.start.getTime();
                const endMs = chartDateRange.end.getTime();
                data = data.filter(p => p.date >= startMs && p.date <= endMs);
            }

            const color = CHART_COLORS[i % CHART_COLORS.length];
            allSeries.push({ data, label: fieldKey, color });
        }

        const { labels, datasets, needsDualAxis } = ChartDataService.buildMultiMetricDataset(allSeries);

        // Add rolling average datasets if enabled
        if (showRolling) {
            for (let i = 0; i < allSeries.length; i++) {
                const rolling = ChartDataService.rollingAverage(allSeries[i].data);
                const rollingAligned = labels.map(label => {
                    const point = rolling.find(p => formatDateLabel(p.date) === label);
                    return point?.value ?? null;
                });

                datasets.push({
                    label: `${allSeries[i].label} (avg)`,
                    data: rollingAligned,
                    borderColor: allSeries[i].color + '80',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    spanGaps: true,
                    tension: 0.3,
                });
            }
        }

        // Add trend line datasets if enabled
        if (showTrend) {
            for (let i = 0; i < allSeries.length; i++) {
                const trend = ChartDataService.trendLine(allSeries[i].data);
                if (trend.points.length === 2) {
                    const trendAligned = labels.map((label, idx) => {
                        // Linear interpolation between start and end
                        const t = labels.length > 1 ? idx / (labels.length - 1) : 0;
                        return trend.points[0].value! + t * (trend.points[1].value! - trend.points[0].value!);
                    });

                    datasets.push({
                        label: `${allSeries[i].label} (trend)`,
                        data: trendAligned,
                        borderColor: allSeries[i].color + '60',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderDash: [10, 5],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
                        spanGaps: true,
                        tension: 0,
                    });
                }
            }
        }

        // Add annotation marker dots at annotated dates
        const annotationLabels = Array.from(annotationMap.keys());
        if (annotationLabels.length > 0) {
            // Find the y-axis range for marker placement
            const allValues = datasets
                .flatMap((ds: { data: (number | null)[] }) => ds.data)
                .filter((v: number | null): v is number => v !== null);
            const yMax = allValues.length > 0 ? Math.max(...allValues) : 10;

            // Create annotation marker data — null for non-annotated, yMax for annotated
            const annotLineData = labels.map(label =>
                annotationLabels.includes(label) ? yMax : null
            );

            datasets.push({
                label: '📌 Annotations',
                data: annotLineData,
                borderColor: 'transparent',
                backgroundColor: getCSSVar('--text-warning', '#e5c07b'),
                borderWidth: 0,
                pointRadius: 5,
                pointBackgroundColor: getCSSVar('--text-warning', '#e5c07b'),
                pointBorderColor: getCSSVar('--text-warning', '#e5c07b'),
                pointHoverRadius: 7,
                fill: false,
                spanGaps: false,
                showLine: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        }

        const scales: Record<string, unknown> = {
            x: {
                ticks: { color: mutedColor, maxTicksLimit: 10 },
                grid: { color: gridColor, drawBorder: false },
            },
            y: {
                ticks: { color: mutedColor },
                grid: { color: gridColor, drawBorder: false },
            },
        };

        if (needsDualAxis) {
            scales['y1'] = {
                position: 'right',
                ticks: { color: mutedColor },
                grid: { drawOnChartArea: false },
            };
        }

        return {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { enabled: false },
                    legend: {
                        display: fields.length > 1,
                        labels: { color: textColor },
                    },
                },
                scales,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick: (_event: any, elements: any[]) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index as number;
                        const label = labels[idx];
                        handleDataPointClick(label);
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onHover: (event: any, elements: any[]) => {
                    if (elements.length === 0) {
                        setTooltip(prev => ({ ...prev, visible: false }));
                        return;
                    }

                    const element = elements[0];
                    const idx = element.index;
                    const datasetIdx = element.datasetIndex;
                    const value = datasets[datasetIdx]?.data?.[idx];
                    const label = labels[idx];

                    const nativeEvent = event.native as MouseEvent | undefined;
                    if (!nativeEvent) return;

                    // Check if this date has annotations
                    const annotTexts = annotationMap.get(label);
                    const annotStr = annotTexts ? `\n📌 ${annotTexts.join(', ')}` : '';

                    setTooltip({
                        visible: true,
                        x: nativeEvent.offsetX,
                        y: nativeEvent.offsetY,
                        content: `${label}: ${value !== null && value !== undefined ? String(value) : 'N/A'}${annotStr}`,
                    });
                },
            },
        } as unknown as Record<string, unknown>;
    }, [fields, firstFieldData.data, showRolling, showTrend, handleDataPointClick, chartDateRange, annotationMap]);


    // Chart.js lifecycle: create, theme-react, destroy
    useEffect(() => {
        if (!canvasRef.current || !app) return;

        const config = buildConfig();
        if (!config) return;

        let chart: Chart | null = null;
        try {
            chart = new Chart(canvasRef.current, config as unknown as ChartConfig);
            chartRef.current = chart;
            setChartError(false);
        } catch (err) {
            console.error('[Hindsight] Chart initialization failed:', err);
            setChartError(true);
            return;
        }

        // Theme-reactive: re-read CSS vars and update on theme change
        let themeDebounce: ReturnType<typeof setTimeout> | null = null;

        const onThemeChange = () => {
            if (themeDebounce) clearTimeout(themeDebounce);
            themeDebounce = setTimeout(() => {
                themeDebounce = null;
                if (!chart) return;

                const textColor = getCSSVar('--text-normal', '#dcddde');
                const mutedColor = getCSSVar('--text-muted', '#888');
                const gridColor = getCSSVar('--background-modifier-border', '#333');

                // Update scale colors
                const xScale = chart.options.scales?.['x'];
                const yScale = chart.options.scales?.['y'];
                if (xScale) {
                    (xScale as Record<string, unknown>).ticks = { color: mutedColor, maxTicksLimit: 10 };
                    (xScale as Record<string, unknown>).grid = { color: gridColor, drawBorder: false };
                }
                if (yScale) {
                    (yScale as Record<string, unknown>).ticks = { color: mutedColor };
                    (yScale as Record<string, unknown>).grid = { color: gridColor, drawBorder: false };
                }

                // Update legend color
                if (chart.options.plugins?.legend?.labels) {
                    (chart.options.plugins.legend.labels as Record<string, unknown>).color = textColor;
                }

                try {
                    chart.update('none');
                } catch (err) {
                    console.error('[Hindsight] Chart theme update failed:', err);
                }
            }, 200);
        };

        app.workspace.on('css-change', onThemeChange);

        return () => {
            app.workspace.off('css-change', onThemeChange);
            if (themeDebounce) clearTimeout(themeDebounce);
            chart?.destroy();
            chartRef.current = null;
        };
    }, [app, buildConfig]);

    if (!app) return null;

    if (chartError) {
        return (
            <div className="hindsight-chart-container hindsight-chart-error">
                <p>Chart rendering failed. Try selecting different fields.</p>
            </div>
        );
    }

    if (fields.length === 0) {
        return (
            <div className="hindsight-chart-container">
                <p className="hindsight-chart-empty">Select a field to visualize</p>
            </div>
        );
    }

    const ariaLabel = `Line chart showing ${fields.join(' and ')}`;

    return (
        <div className="hindsight-chart-container" ref={containerRef => {
            // Set height via ref
            if (containerRef) {
                containerRef.style.setProperty('--hindsight-chart-height', `${height}px`);
            }
        }}>
            <canvas
                ref={canvasRef}
                role="img"
                aria-label={ariaLabel}
            />
            {tooltip.visible && (
                <div
                    className="hindsight-chart-popover"
                    ref={popoverRef => {
                        if (popoverRef) {
                            popoverRef.style.setProperty('--hindsight-popover-x', `${tooltip.x}px`);
                            popoverRef.style.setProperty('--hindsight-popover-y', `${tooltip.y}px`);
                        }
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}

/** Format a Unix timestamp to MM/DD for matching labels */
function formatDateLabel(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
