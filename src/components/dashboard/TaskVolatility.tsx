/**
 * Task Volatility
 *
 * Task completion tracking from pre-computed checkbox counts.
 * Reads entry.tasksCompleted and entry.tasksTotal (computed during Pass 2 indexing).
 * Displays productivity score trend line and weekly comparison.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Chart } from 'chart.js';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { startOfDay } from '../../utils/dateUtils';
import type { DateRange } from '../../types';

interface TaskVolatilityProps {
    dateRange: DateRange;
}

export function TaskVolatility({ dateRange }: TaskVolatilityProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [chartError, setChartError] = useState(false);

    // Filter to entries with checkboxes
    const entriesWithTasks = useMemo(
        () => allEntries.filter(e => e.tasksTotal > 0),
        [allEntries]
    );

    // Productivity score per entry (filtered by dateRange)
    const productivityData = useMemo(() => {
        const startTime = startOfDay(dateRange.start).getTime();
        const endTime = startOfDay(dateRange.end).getTime();
        return entriesWithTasks
            .filter(e => {
                const t = startOfDay(e.date).getTime();
                return t >= startTime && t <= endTime;
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(e => ({
                date: e.date,
                score: Math.round((e.tasksCompleted / e.tasksTotal) * 100),
            }));
    }, [entriesWithTasks, dateRange]);

    // Period average completion rate
    const periodAverage = useMemo(() => {
        if (productivityData.length === 0) return null;
        const sum = productivityData.reduce((s, d) => s + d.score, 0);
        return Math.round(sum / productivityData.length);
    }, [productivityData]);

    // Chart.js trend line
    useEffect(() => {
        if (!canvasRef.current || productivityData.length < 2) return;

        let chart: Chart | null = null;

        try {
            const accentColor = getComputedStyle(document.body)
                .getPropertyValue('--interactive-accent')
                .trim() || 'hsl(210, 60%, 50%)';

            chart = new Chart(canvasRef.current, {
                type: 'line',
                data: {
                    labels: productivityData.map(d =>
                        d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    ),
                    datasets: [{
                        label: 'Productivity',
                        data: productivityData.map(d => d.score),
                        borderColor: accentColor,
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: { enabled: false },
                        legend: { display: false },
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                color: getComputedStyle(document.body)
                                    .getPropertyValue('--text-muted').trim() || '#999',
                                callback: (v) => `${v}%`,
                            },
                            grid: {
                                color: getComputedStyle(document.body)
                                    .getPropertyValue('--background-modifier-border').trim() || '#333',
                            },
                        },
                        x: {
                            ticks: {
                                color: getComputedStyle(document.body)
                                    .getPropertyValue('--text-muted').trim() || '#999',
                                maxTicksLimit: 8,
                            },
                            grid: { display: false },
                        },
                    },
                },
            });
        } catch (err) {
            console.error('[Hindsight] Task volatility chart failed:', err);
            setChartError(true);
            return;
        }

        const onThemeChange = () => {
            if (!chart) return;
            const accentColor = getComputedStyle(document.body)
                .getPropertyValue('--interactive-accent')
                .trim() || 'hsl(210, 60%, 50%)';
            chart.data.datasets[0].borderColor = accentColor;
            chart.update();
        };

        app?.workspace.on('css-change', onThemeChange);

        return () => {
            if (app) {
                app.workspace.off('css-change', onThemeChange);
            }
            chart?.destroy();
        };
    }, [productivityData, app]);

    if (entriesWithTasks.length === 0) {
        return null;
    }

    return (
        <div className="hindsight-task-volatility">
            <h3 className="hindsight-section-heading">Task completion</h3>

            <div className="hindsight-task-weekly-comparison">
                <div className="hindsight-task-week-stat">
                    <span className="hindsight-task-week-label">Period average</span>
                    <span className="hindsight-task-week-value">
                        {periodAverage !== null ? `${periodAverage}%` : '—'}
                    </span>
                </div>
                <div className="hindsight-task-week-stat">
                    <span className="hindsight-task-week-label">Entries</span>
                    <span className="hindsight-task-week-value">
                        {productivityData.length}
                    </span>
                </div>
            </div>

            {productivityData.length >= 2 && (
                <div className="hindsight-task-chart-container"
                    aria-label="Line chart showing productivity score for the selected period">
                    {chartError ? (
                        <p className="hindsight-chart-error">Could not render productivity chart.</p>
                    ) : (
                        <canvas ref={canvasRef} />
                    )}
                </div>
            )}
        </div>
    );
}
