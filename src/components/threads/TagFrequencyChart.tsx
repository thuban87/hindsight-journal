/**
 * Tag Frequency Chart
 *
 * Chart.js horizontal bar chart showing top 20 tags by frequency.
 * Follows the plan-wide Chart.js pattern:
 * - Canvas null guard
 * - try/catch around Chart creation
 * - Tooltip plugin disabled (React tooltip instead)
 * - css-change subscription for theme reactivity
 * - chart.destroy() in cleanup
 *
 * IMPORTANT: The tooltip state is managed via refs (not useState) to avoid
 * re-rendering the component on hover, which would destroy and recreate the
 * Chart.js instance (causing the janky re-render loop).
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Chart } from '../../utils/chartSetup';
import type { ChartConfiguration, ChartEvent, ActiveElement } from 'chart.js';
import { useAppStore } from '../../store/appStore';
import type { TagFrequencyResult } from '../../services/ThreadsService';

/** Maximum number of tags to display in the chart */
const MAX_DISPLAYED_TAGS = 20;

interface TagFrequencyChartProps {
    /** Tag frequency data (pre-computed via ThreadsService) */
    data: TagFrequencyResult[];
    /** Callback when a tag bar is clicked */
    onTagClick?: (tag: string) => void;
}

/** Read a CSS variable value from the document body */
function getCSSVar(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

export function TagFrequencyChart({ data, onTagClick }: TagFrequencyChartProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [chartError, setChartError] = useState(false);

    // Tooltip managed via refs to avoid re-renders on hover
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipDataRef = useRef({ visible: false, x: 0, y: 0, content: '' });

    // Memoize displayData to prevent buildConfig from changing on every render
    const displayData = useMemo(
        () => data.slice(0, MAX_DISPLAYED_TAGS),
        [data]
    );

    // Stable ref for displayData so onHover/onClick closures don't go stale
    const displayDataRef = useRef(displayData);
    displayDataRef.current = displayData;

    const onTagClickRef = useRef(onTagClick);
    onTagClickRef.current = onTagClick;

    const updateTooltip = useCallback((visible: boolean, x: number, y: number, content: string) => {
        tooltipDataRef.current = { visible, x, y, content };
        if (tooltipRef.current) {
            if (visible) {
                tooltipRef.current.style.setProperty('display', 'block');
                tooltipRef.current.style.setProperty('--hindsight-tooltip-x', `${x}px`);
                tooltipRef.current.style.setProperty('--hindsight-tooltip-y', `${y}px`);
                tooltipRef.current.textContent = content;
            } else {
                tooltipRef.current.style.setProperty('display', 'none');
            }
        }
    }, []);

    // Build config once based on display data — stable reference
    const buildConfig = useCallback((): Record<string, unknown> | null => {
        const items = displayDataRef.current;
        if (items.length === 0) return null;

        const accentColor = getCSSVar('--interactive-accent', '#7c3aed');
        const textColor = getCSSVar('--text-normal', '#dcddde');
        const mutedColor = getCSSVar('--text-muted', '#888');
        const gridColor = getCSSVar('--background-modifier-border', '#333');

        const labels = items.map(d => d.tag);
        const values = items.map(d => d.count);

        // Varying opacity for visual hierarchy
        const bgColors = items.map((_d, i) => {
            const opacity = 1 - (i / items.length) * 0.6;
            return `${accentColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
        });

        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    borderRadius: 3,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: false },
                },
                scales: {
                    x: {
                        ticks: { color: mutedColor },
                        grid: { color: gridColor, drawBorder: false },
                    },
                    y: {
                        ticks: { color: textColor, font: { size: 12 } },
                        grid: { display: false },
                    },
                },
                onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
                    if (elements.length > 0 && onTagClickRef.current) {
                        const idx = elements[0].index as number;
                        onTagClickRef.current(displayDataRef.current[idx].tag);
                    }
                },
                onHover: (event: ChartEvent, elements: ActiveElement[]) => {
                    if (elements.length === 0) {
                        updateTooltip(false, 0, 0, '');
                        return;
                    }

                    const element = elements[0];
                    const idx = element.index;
                    const item = displayDataRef.current[idx];

                    const nativeEvent = event.native as MouseEvent | undefined;
                    if (!nativeEvent || !item) return;

                    updateTooltip(
                        true,
                        nativeEvent.offsetX,
                        nativeEvent.offsetY,
                        `${item.tag}: ${item.count} entries (${item.percentage}%)`,
                    );
                },
            },
        };
    }, [displayData, updateTooltip]);

    // Chart.js lifecycle — only recreates when displayData actually changes
    useEffect(() => {
        if (!canvasRef.current || !app) return;

        const config = buildConfig();
        if (!config) return;

        let chart: Chart | null = null;
        try {
            chart = new Chart(canvasRef.current, config as unknown as ChartConfiguration);
            setChartError(false);
        } catch (err) {
            console.error('[Hindsight] TagFrequencyChart initialization failed:', err);
            setChartError(true);
            return;
        }

        // Theme reactivity
        let themeDebounce: ReturnType<typeof setTimeout> | null = null;

        const onThemeChange = () => {
            if (themeDebounce) clearTimeout(themeDebounce);
            themeDebounce = setTimeout(() => {
                themeDebounce = null;
                if (!chart) return;

                const textColor = getCSSVar('--text-normal', '#dcddde');
                const mutedColor = getCSSVar('--text-muted', '#888');
                const gridColor = getCSSVar('--background-modifier-border', '#333');

                const xScale = chart.options.scales?.['x'];
                const yScale = chart.options.scales?.['y'];
                if (xScale) {
                    (xScale as Record<string, unknown>).ticks = { color: mutedColor };
                    (xScale as Record<string, unknown>).grid = { color: gridColor, drawBorder: false };
                }
                if (yScale) {
                    (yScale as Record<string, unknown>).ticks = { color: textColor, font: { size: 12 } };
                }

                try {
                    chart.update('none');
                } catch (err) {
                    console.error('[Hindsight] TagFrequencyChart theme update failed:', err);
                }
            }, 200);
        };

        app.workspace.on('css-change', onThemeChange);

        return () => {
            app.workspace.off('css-change', onThemeChange);
            if (themeDebounce) clearTimeout(themeDebounce);
            chart?.destroy();
        };
    }, [app, buildConfig]);

    if (!app) return null;
    if (chartError) {
        return (
            <div className="hindsight-tag-frequency">
                <p>Tag frequency chart failed to render.</p>
            </div>
        );
    }

    if (displayData.length === 0) {
        return (
            <div className="hindsight-tag-frequency">
                <p className="hindsight-tag-timeline-empty">No tags found in journal entries.</p>
            </div>
        );
    }

    // Dynamic height based on number of tags
    const chartHeight = Math.max(200, displayData.length * 28);

    return (
        <div
            className="hindsight-tag-frequency"
            ref={containerRef => {
                if (containerRef) {
                    containerRef.style.setProperty('--hindsight-chart-height', `${chartHeight}px`);
                }
            }}
        >
            <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Horizontal bar chart showing top ${displayData.length} tags by frequency`}
                height={chartHeight}
            />
            <div
                className="hindsight-tag-frequency-tooltip"
                ref={tooltipRef}
            />
        </div>
    );
}
