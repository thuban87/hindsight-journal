/**
 * Charts Panel
 *
 * The Charts sub-tab content within the Insights group.
 * Provides field selection, date range controls, rolling average
 * and trend line toggles, renders MetricChart, and collapsible
 * sections for Correlations, Scatter Plot, and Trend Alerts.
 */

import React, { useState, useCallback } from 'react';
import { useJournalStore } from '../../store/journalStore';
import { useChartUiStore } from '../../store/chartUiStore';
import { useAppStore } from '../../store/appStore';
import { MetricChart } from './MetricChart';
import { CorrelationCards } from './CorrelationCards';
import { ScatterPlot } from './ScatterPlot';
import { TrendAlertsPanel } from '../insights/TrendAlertsPanel';
import { EmptyState } from '../shared/EmptyState';

/** Date range preset options */
const DATE_PRESETS = [
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '1yr', days: 365 },
    { label: 'All', days: 0 },
] as const;

export function ChartsPanel(): React.ReactElement | null {
    const plugin = useAppStore(s => s.plugin);
    const detectedFields = useJournalStore(s => s.detectedFields);
    const selectedFields = useChartUiStore(s => s.selectedChartFields);
    const setSelectedFields = useChartUiStore(s => s.setSelectedChartFields);
    const chartDateRange = useChartUiStore(s => s.chartDateRange);
    const setChartDateRange = useChartUiStore(s => s.setChartDateRange);
    const rollingWindow = useChartUiStore(s => s.rollingWindow);
    const setRollingWindow = useChartUiStore(s => s.setRollingWindow);

    const [showRolling, setShowRolling] = useState(false);
    const [showTrend, setShowTrend] = useState(false);

    // Collapsible section state
    const [showCorrelations, setShowCorrelations] = useState(true);
    const [showScatter, setShowScatter] = useState(false);
    const [showAlerts, setShowAlerts] = useState(true);

    // Scatter plot field pre-selection from correlation card click
    const [scatterFieldX, setScatterFieldX] = useState<string | undefined>();
    const [scatterFieldY, setScatterFieldY] = useState<string | undefined>();

    // Filter to numeric fields only
    const numericFields = detectedFields.filter(f => f.type === 'number');

    // Persist chart field selections to settings
    const handleFieldToggle = useCallback((fieldKey: string) => {
        const current = useChartUiStore.getState().selectedChartFields;
        let next: string[];
        if (current.includes(fieldKey)) {
            next = current.filter(k => k !== fieldKey);
        } else {
            next = [...current, fieldKey];
        }
        setSelectedFields(next);

        // Mirror to settings for persistence
        if (plugin) {
            plugin.settings.selectedChartFields = next;
            void plugin.saveSettings();
        }
    }, [plugin, setSelectedFields]);

    // Handle rolling window change
    const handleWindowChange = useCallback((value: number) => {
        setRollingWindow(value);
        if (plugin) {
            plugin.settings.rollingWindow = value;
            void plugin.saveSettings();
        }
    }, [plugin, setRollingWindow]);

    // Handle date range preset
    const handlePreset = useCallback((days: number) => {
        if (days === 0) {
            setChartDateRange(null);
            return;
        }
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setChartDateRange({ start, end });
    }, [setChartDateRange]);

    // Detect which preset is active based on current chartDateRange
    const getActivePreset = useCallback((): number => {
        if (!chartDateRange) return 0; // 'All'
        const now = new Date();
        const diffDays = Math.round((now.getTime() - chartDateRange.start.getTime()) / 86_400_000);
        for (const preset of DATE_PRESETS) {
            if (preset.days > 0 && Math.abs(diffDays - preset.days) <= 2) {
                return preset.days;
            }
        }
        return -1; // Custom range
    }, [chartDateRange]);

    const activePresetDays = getActivePreset();

    // Format Date for input value
    const formatDateInput = (d: Date): string =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Handle correlation card click → pre-select scatter plot fields
    const handleCorrelationSelect = useCallback((fieldA: string, fieldB: string) => {
        setScatterFieldX(fieldA);
        setScatterFieldY(fieldB);
        setShowScatter(true);
    }, []);

    if (numericFields.length === 0) {
        return <EmptyState message="No numeric fields detected. Add numeric frontmatter to your journal entries to see charts." />;
    }

    return (
        <div className="hindsight-charts-panel">
            {/* Field selector */}
            <div className="hindsight-chart-controls">
                <div className="hindsight-chart-field-selector">
                    <span className="hindsight-chart-control-label">Fields</span>
                    <div className="hindsight-chart-field-list">
                        {numericFields.map(field => (
                            <label key={field.key} className="hindsight-chart-field-option">
                                <input
                                    type="checkbox"
                                    checked={selectedFields.includes(field.key)}
                                    onChange={() => handleFieldToggle(field.key)}
                                />
                                <span>{field.key}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Date range presets */}
                <div className="hindsight-chart-range-buttons">
                    <span className="hindsight-chart-control-label">Range</span>
                    {DATE_PRESETS.map(preset => {
                        const isActive = preset.days === activePresetDays;
                        return (
                            <button
                                key={preset.label}
                                className={`hindsight-chart-range-btn ${isActive ? 'hindsight-chart-range-btn-active' : ''}`}
                                onClick={() => handlePreset(preset.days)}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>

                {/* Custom date picker */}
                <div className="hindsight-chart-date-pickers">
                    <span className="hindsight-chart-control-label">Custom range</span>
                    <input
                        type="date"
                        className="hindsight-chart-date-picker"
                        value={chartDateRange ? formatDateInput(chartDateRange.start) : ''}
                        onChange={(e) => {
                            const dateStr = e.target.value;
                            if (!dateStr) return;
                            const start = new Date(dateStr + 'T00:00:00');
                            const end = chartDateRange?.end ?? new Date();
                            setChartDateRange({ start, end });
                        }}
                        aria-label="Chart start date"
                    />
                    <span className="hindsight-chart-date-separator">to</span>
                    <input
                        type="date"
                        className="hindsight-chart-date-picker"
                        value={chartDateRange ? formatDateInput(chartDateRange.end) : ''}
                        onChange={(e) => {
                            const dateStr = e.target.value;
                            if (!dateStr) return;
                            const end = new Date(dateStr + 'T23:59:59');
                            const start = chartDateRange?.start ?? new Date(end.getTime() - 30 * 86_400_000);
                            setChartDateRange({ start, end });
                        }}
                        aria-label="Chart end date"
                    />
                </div>

                {/* Rolling average toggle */}
                <div className="hindsight-chart-toggle-group">
                    <label className="hindsight-chart-toggle">
                        <input
                            type="checkbox"
                            checked={showRolling}
                            onChange={(e) => setShowRolling(e.target.checked)}
                        />
                        <span>Rolling avg</span>
                    </label>
                    {showRolling && (
                        <select
                            className="hindsight-chart-window-select"
                            value={rollingWindow}
                            onChange={(e) => handleWindowChange(Number(e.target.value))}
                            aria-label="Rolling average window"
                        >
                            <option value={7}>7 days</option>
                            <option value={14}>14 days</option>
                            <option value={30}>30 days</option>
                        </select>
                    )}
                </div>

                {/* Trend line toggle */}
                <label className="hindsight-chart-toggle">
                    <input
                        type="checkbox"
                        checked={showTrend}
                        onChange={(e) => setShowTrend(e.target.checked)}
                    />
                    <span>Trend line</span>
                </label>
            </div>

            {/* Chart */}
            {selectedFields.length > 0 ? (
                <MetricChart
                    fields={selectedFields}
                    showRolling={showRolling}
                    showTrend={showTrend}
                />
            ) : (
                <div className="hindsight-chart-empty-state">
                    <p>Select one or more fields above to visualize your data</p>
                </div>
            )}

            {/* Collapsible: Correlations */}
            <div className="hindsight-chart-section">
                <button
                    className="hindsight-chart-section-header"
                    onClick={() => setShowCorrelations(!showCorrelations)}
                >
                    <span className={`hindsight-chart-section-arrow ${showCorrelations ? '' : 'collapsed'}`}>▼</span>
                    <span>Correlations</span>
                </button>
                {showCorrelations && (
                    <div className="hindsight-chart-section-content">
                        <CorrelationCards onSelectFields={handleCorrelationSelect} />
                    </div>
                )}
            </div>

            {/* Collapsible: Scatter Plot */}
            <div className="hindsight-chart-section">
                <button
                    className="hindsight-chart-section-header"
                    onClick={() => setShowScatter(!showScatter)}
                >
                    <span className={`hindsight-chart-section-arrow ${showScatter ? '' : 'collapsed'}`}>▼</span>
                    <span>Scatter plot</span>
                </button>
                {showScatter && (
                    <div className="hindsight-chart-section-content">
                        <ScatterPlot
                            initialFieldX={scatterFieldX}
                            initialFieldY={scatterFieldY}
                        />
                    </div>
                )}
            </div>

            {/* Collapsible: Trend Alerts */}
            <div className="hindsight-chart-section">
                <button
                    className="hindsight-chart-section-header"
                    onClick={() => setShowAlerts(!showAlerts)}
                >
                    <span className={`hindsight-chart-section-arrow ${showAlerts ? '' : 'collapsed'}`}>▼</span>
                    <span>Trend alerts</span>
                </button>
                {showAlerts && (
                    <div className="hindsight-chart-section-content">
                        <TrendAlertsPanel />
                    </div>
                )}
            </div>
        </div>
    );
}
