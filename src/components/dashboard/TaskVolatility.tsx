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
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';
import { getEntriesInPeriod } from '../../utils/periodUtils';

export function TaskVolatility(): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    const settings = useSettingsStore(s => s.settings);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [chartError, setChartError] = useState(false);

    // Filter to entries with checkboxes
    const entriesWithTasks = useMemo(
        () => allEntries.filter(e => e.tasksTotal > 0),
        [allEntries]
    );

    // Productivity score per entry (last 90 days)
    const productivityData = useMemo(() => {
        const now = Date.now();
        const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
        return entriesWithTasks
            .filter(e => e.date.getTime() >= ninetyDaysAgo)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(e => ({
                date: e.date,
                score: Math.round((e.tasksCompleted / e.tasksTotal) * 100),
            }));
    }, [entriesWithTasks]);

    // Weekly comparison: this week vs last week
    const weeklyComparison = useMemo(() => {
        const now = new Date();
        const thisWeekEntries = getEntriesInPeriod(
            entriesWithTasks, 'week', now, settings.weekStartDay
        );
        const lastWeekDate = new Date(now);
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        const lastWeekEntries = getEntriesInPeriod(
            entriesWithTasks, 'week', lastWeekDate, settings.weekStartDay
        );

        const calcRate = (entries: typeof entriesWithTasks) => {
            const totalCompleted = entries.reduce((s, e) => s + e.tasksCompleted, 0);
            const totalAll = entries.reduce((s, e) => s + e.tasksTotal, 0);
            return totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : null;
        };

        return {
            thisWeek: calcRate(thisWeekEntries),
            lastWeek: calcRate(lastWeekEntries),
        };
    }, [entriesWithTasks, settings.weekStartDay]);

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
                    <span className="hindsight-task-week-label">This week</span>
                    <span className="hindsight-task-week-value">
                        {weeklyComparison.thisWeek !== null ? `${weeklyComparison.thisWeek}%` : '—'}
                    </span>
                </div>
                <div className="hindsight-task-week-stat">
                    <span className="hindsight-task-week-label">Last week</span>
                    <span className="hindsight-task-week-value">
                        {weeklyComparison.lastWeek !== null ? `${weeklyComparison.lastWeek}%` : '—'}
                    </span>
                </div>
            </div>

            {productivityData.length >= 2 && (
                <div className="hindsight-task-chart-container"
                    aria-label="Line chart showing productivity score over the last 90 days">
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
