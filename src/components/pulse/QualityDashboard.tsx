/**
 * Quality Dashboard
 *
 * Entry quality score analytics for the Pulse tab.
 * Uses JournalEntry.qualityScore (computed during indexing).
 * Shows average score, distribution bar chart, worst gaps list,
 * and quality trend sparkline.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Chart } from 'chart.js';
import type { JournalEntry } from '../../types';
import { useAppStore } from '../../store/appStore';
import { Sparkline } from '../charts/Sparkline';

interface QualityDashboardProps {
    entries: JournalEntry[];
}

interface QualityTooltipState {
    visible: boolean;
    x: number;
    y: number;
    label: string;
    count: number;
}

export function QualityDashboard({ entries }: QualityDashboardProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartError, setChartError] = useState(false);
    const [tooltip, setTooltip] = useState<QualityTooltipState>({ visible: false, x: 0, y: 0, label: '', count: 0 });

    // Compute average quality score
    const avgScore = useMemo(() => {
        if (entries.length === 0) return 0;
        const total = entries.reduce((sum, e) => sum + e.qualityScore, 0);
        return Math.round(total / entries.length);
    }, [entries]);

    // Compute score distribution (5 buckets)
    const distribution = useMemo(() => {
        const buckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
        for (const entry of entries) {
            const idx = Math.min(4, Math.floor(entry.qualityScore / 20));
            buckets[idx]++;
        }
        return buckets;
    }, [entries]);

    // Worst gaps: 5 entries with lowest quality scores
    const worstGaps = useMemo(() => {
        return [...entries]
            .sort((a, b) => a.qualityScore - b.qualityScore)
            .slice(0, 5);
    }, [entries]);

    // Quality trend sparkline data (last 90 days)
    const trendData = useMemo(() => {
        const now = Date.now();
        const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
        return entries
            .filter(e => e.date.getTime() >= ninetyDaysAgo)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(e => e.qualityScore as number | null);
    }, [entries]);

    const bucketLabels = ['0–20', '20–40', '40–60', '60–80', '80–100'];

    // Chart.js bar chart
    useEffect(() => {
        if (!canvasRef.current) return;

        let chart: Chart | null = null;

        try {
            const accentColor = getComputedStyle(document.body)
                .getPropertyValue('--interactive-accent')
                .trim() || 'hsl(210, 60%, 50%)';

            chart = new Chart(canvasRef.current, {
                type: 'bar',
                data: {
                    labels: bucketLabels,
                    datasets: [{
                        label: 'Entries',
                        data: distribution,
                        backgroundColor: accentColor,
                        borderRadius: 4,
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
                            beginAtZero: true,
                            ticks: {
                                color: getComputedStyle(document.body)
                                    .getPropertyValue('--text-muted').trim() || '#999',
                                stepSize: 1,
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
                            },
                            grid: { display: false },
                        },
                    },
                    onHover: (_event, elements) => {
                        if (elements.length > 0) {
                            const idx = elements[0].index;
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (rect) {
                                setTooltip({
                                    visible: true,
                                    x: elements[0].element.x,
                                    y: elements[0].element.y - 10,
                                    label: bucketLabels[idx],
                                    count: distribution[idx],
                                });
                            }
                        } else {
                            setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
                        }
                    },
                },
            });
        } catch (err) {
            console.error('[Hindsight] Quality chart initialization failed:', err);
            setChartError(true);
            return;
        }

        const onThemeChange = () => {
            if (!chart) return;
            const accentColor = getComputedStyle(document.body)
                .getPropertyValue('--interactive-accent')
                .trim() || 'hsl(210, 60%, 50%)';
            chart.data.datasets[0].backgroundColor = accentColor;
            chart.update();
        };

        app?.workspace.on('css-change', onThemeChange);

        return () => {
            if (app) {
                app.workspace.off('css-change', onThemeChange);
            }
            chart?.destroy();
        };
    }, [distribution, app]);

    const openEntry = useCallback(
        (entry: JournalEntry) => {
            if (app) {
                void app.workspace.openLinkText(entry.filePath, '');
            }
        },
        [app]
    );

    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="hindsight-quality-dashboard" ref={containerRef}>
            <h3 className="hindsight-section-heading">Entry quality</h3>

            <div className="hindsight-quality-summary">
                <div className="hindsight-quality-avg">
                    <span className="hindsight-quality-avg-value">{avgScore}</span>
                    <span className="hindsight-quality-avg-label">avg score</span>
                </div>
                {trendData.length > 5 && (
                    <div className="hindsight-quality-trend">
                        <Sparkline
                            data={trendData}
                            width={100}
                            height={30}
                            fieldName="quality"
                        />
                        <span className="hindsight-quality-trend-label">90-day trend</span>
                    </div>
                )}
            </div>

            <div className="hindsight-quality-chart-container"
                aria-label="Bar chart showing entry quality score distribution">
                {chartError ? (
                    <p className="hindsight-chart-error">Could not render quality chart.</p>
                ) : (
                    <canvas ref={canvasRef} />
                )}
                {tooltip.visible && (
                    <div
                        className="hindsight-chart-tooltip"
                        ref={(el) => {
                            if (el) {
                                el.style.setProperty('--tooltip-x', `${tooltip.x}px`);
                                el.style.setProperty('--tooltip-y', `${tooltip.y}px`);
                            }
                        }}
                    >
                        {tooltip.label}: {tooltip.count} {tooltip.count === 1 ? 'entry' : 'entries'}
                    </div>
                )}
            </div>

            {worstGaps.length > 0 && (
                <div className="hindsight-worst-gaps">
                    <h4 className="hindsight-subsection-heading">Lowest quality entries</h4>
                    <ul className="hindsight-worst-gaps-list">
                        {worstGaps.map(entry => (
                            <li key={entry.filePath} className="hindsight-worst-gap-item">
                                <button
                                    className="hindsight-worst-gap-btn"
                                    onClick={() => openEntry(entry)}
                                >
                                    <span className="hindsight-worst-gap-date">
                                        {entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="hindsight-worst-gap-score">{entry.qualityScore}%</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
