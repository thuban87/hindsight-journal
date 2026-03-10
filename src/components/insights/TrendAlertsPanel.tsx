/**
 * Trend Alerts Panel
 *
 * Container for trend alerts. Reads from metricsCacheStore.cachedAlerts.
 * Cache-miss triggers generateAlerts() and stores results.
 */

import React, { useEffect, useMemo } from 'react';
import { useJournalStore } from '../../store/journalStore';
import { useMetricsCacheStore } from '../../store/metricsCacheStore';
import { useChartUiStore } from '../../store/chartUiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { generateAlerts } from '../../services/TrendAlertEngine';
import { TrendAlertCard } from './TrendAlertCard';

export function TrendAlertsPanel(): React.ReactElement {
    const entries = useJournalStore(s => s.entries);
    const detectedFields = useJournalStore(s => s.detectedFields);
    const revision = useJournalStore(s => s.revision);
    const cachedAlerts = useMetricsCacheStore(s => s.cachedAlerts);
    const stale = useMetricsCacheStore(s => s.stale);
    const dismissedIds = useChartUiStore(s => s.dismissedAlertIds);
    const dismissAlert = useChartUiStore(s => s.dismissAlert);
    const settings = useSettingsStore(s => s.settings);

    const entriesArray = useMemo(() => Array.from(entries.values()), [entries]);

    // Trigger computation on cache miss
    useEffect(() => {
        if (cachedAlerts !== null) return;
        if (entriesArray.length === 0 || detectedFields.length === 0) return;

        const alerts = generateAlerts(
            entriesArray,
            detectedFields,
            settings.fieldPolarity,
            new Date()
        );

        useMetricsCacheStore.getState().setAlerts(alerts);
    }, [cachedAlerts, entriesArray, detectedFields, settings.fieldPolarity, revision]);

    // Filter out dismissed alerts
    const visibleAlerts = useMemo(() => {
        if (!cachedAlerts) return [];
        return cachedAlerts.filter(a => !dismissedIds.includes(a.id));
    }, [cachedAlerts, dismissedIds]);

    if (stale) {
        return (
            <div className="hindsight-trend-alerts">
                <div className="hindsight-trend-alerts-header">
                    <span>Trend alerts</span>
                    <span className="hindsight-updating-indicator">Updating...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="hindsight-trend-alerts">
            <div className="hindsight-trend-alerts-header" aria-live="polite">
                <span>Trend alerts</span>
                {visibleAlerts.length > 0 && (
                    <span className="hindsight-trend-alert-count">{visibleAlerts.length}</span>
                )}
            </div>

            {visibleAlerts.length === 0 ? (
                <div className="hindsight-trend-alerts-empty">
                    No notable trends right now. Keep journaling!
                </div>
            ) : (
                visibleAlerts.map(alert => (
                    <TrendAlertCard
                        key={alert.id}
                        alert={alert}
                        onDismiss={dismissAlert}
                    />
                ))
            )}
        </div>
    );
}
