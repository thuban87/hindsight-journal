/**
 * Correlation Cards
 *
 * Auto-generated insight cards showing significant correlations
 * and conditional averages. Reads from metricsCacheStore (cached).
 */

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Platform } from 'obsidian';
import { useJournalStore } from '../../store/journalStore';
import { useMetricsCacheStore } from '../../store/metricsCacheStore';
import { useChartUiStore } from '../../store/chartUiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { findCorrelations, findConditionalInsights } from '../../services/MetricsEngine';
import { EmptyState } from '../shared/EmptyState';

interface CorrelationCardsProps {
    /** Callback when user clicks a correlation card to view scatter plot */
    onSelectFields?: (fieldX: string, fieldY: string) => void;
}

export function CorrelationCards({ onSelectFields }: CorrelationCardsProps): React.ReactElement {
    const entries = useJournalStore(s => s.entries);
    const detectedFields = useJournalStore(s => s.detectedFields);
    const revision = useJournalStore(s => s.revision);
    const correlationResults = useMetricsCacheStore(s => s.correlationResults);
    const conditionalInsights = useMetricsCacheStore(s => s.cachedConditionalInsights);
    const stale = useMetricsCacheStore(s => s.stale);
    const analyzeAll = useChartUiStore(s => s.analyzeAllFields);
    const setAnalyzeAll = useChartUiStore(s => s.setAnalyzeAllFields);
    const selectedChartFields = useChartUiStore(s => s.selectedChartFields);
    const settings = useSettingsStore(s => s.settings);

    const [computing, setComputing] = useState(false);
    const computeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const signalRef = useRef<{ cancelled: boolean }>({ cancelled: false });
    const tokenRef = useRef(0);

    const entriesArray = useMemo(() => Array.from(entries.values()), [entries]);
    const numericCount = useMemo(
        () => detectedFields.filter(f => f.type === 'number').length,
        [detectedFields]
    );
    const limit = Platform.isMobile ? 10 : 20;
    const isCapped = numericCount > limit && !analyzeAll;

    // Trigger computation on cache miss (debounced 500ms)
    useEffect(() => {
        if (correlationResults !== null && conditionalInsights !== null) return;
        if (entriesArray.length === 0 || detectedFields.length === 0) return;

        // Cancel any pending computation
        if (computeTimerRef.current) {
            clearTimeout(computeTimerRef.current);
        }
        signalRef.current.cancelled = true;

        computeTimerRef.current = setTimeout(() => {
            const signal = { cancelled: false };
            signalRef.current = signal;
            const token = ++tokenRef.current;

            setComputing(true);

            void (async () => {
                try {
                    const corrResult = await findCorrelations(
                        entriesArray,
                        detectedFields,
                        selectedChartFields,
                        signal
                    );

                    if (signal.cancelled || token !== tokenRef.current) return;

                    const condResult = findConditionalInsights(entriesArray, detectedFields);

                    if (signal.cancelled || token !== tokenRef.current) return;

                    useMetricsCacheStore.getState().setCorrelationResults(corrResult.results);
                    useMetricsCacheStore.getState().setConditionalInsights(condResult);
                } catch (err) {
                    console.error('[Hindsight] Correlation computation failed:', err);
                } finally {
                    if (token === tokenRef.current) {
                        setComputing(false);
                    }
                }
            })();
        }, 500);

        return () => {
            if (computeTimerRef.current) {
                clearTimeout(computeTimerRef.current);
            }
            signalRef.current.cancelled = true;
        };
    }, [correlationResults, conditionalInsights, entriesArray, detectedFields, selectedChartFields, revision, analyzeAll]);

    const handleCardClick = useCallback((fieldA: string, fieldB: string) => {
        if (onSelectFields) {
            onSelectFields(fieldA, fieldB);
        }
    }, [onSelectFields]);

    if (entriesArray.length === 0 || detectedFields.length === 0) {
        return <EmptyState message="No journal entries indexed yet. Check your journal folder in settings." />;
    }

    if (computing || stale) {
        return (
            <div className="hindsight-correlation-cards">
                <div className="hindsight-correlation-computing">Analyzing correlations...</div>
            </div>
        );
    }

    const hasCorrelations = correlationResults && correlationResults.length > 0;
    const hasConditional = conditionalInsights && conditionalInsights.length > 0;

    if (!hasCorrelations && !hasConditional) {
        return (
            <div className="hindsight-correlation-cards">
                <div className="hindsight-correlation-empty">
                    No significant correlations found. Keep journaling — patterns emerge with more data.
                </div>
            </div>
        );
    }

    return (
        <div className="hindsight-correlation-cards">
            {isCapped && (
                <div className="hindsight-correlation-cap-notice">
                    Analyzing top {limit} of {numericCount} fields by data coverage.
                    <label className="hindsight-analyze-all-toggle">
                        <input
                            type="checkbox"
                            checked={analyzeAll}
                            onChange={e => setAnalyzeAll(e.target.checked)}
                        />
                        <span>Analyze all fields</span>
                    </label>
                </div>
            )}

            {/* Correlation results */}
            {correlationResults?.slice(0, 10).map(result => (
                <button
                    key={`corr-${result.fieldA}-${result.fieldB}`}
                    className="hindsight-correlation-card"
                    onClick={() => handleCardClick(result.fieldA, result.fieldB)}
                    aria-label={`Correlation: ${result.fieldA} and ${result.fieldB}, r = ${result.r}`}
                >
                    <div className="hindsight-correlation-card-title">
                        {result.fieldA} and {result.fieldB} are {Math.abs(result.r) >= 0.7 ? 'strongly' : 'moderately'} correlated
                    </div>
                    <div className="hindsight-correlation-card-detail">
                        r = {result.r.toFixed(3)}, based on {result.n} entries
                    </div>
                </button>
            ))}

            {/* Conditional insights */}
            {conditionalInsights?.slice(0, 5).map(insight => (
                <button
                    key={`cond-${insight.numericField}-${insight.booleanField}`}
                    className="hindsight-correlation-card hindsight-conditional-card"
                    onClick={() => handleCardClick(insight.numericField, insight.booleanField)}
                    aria-label={`Conditional: ${insight.numericField} on ${insight.booleanField} days`}
                >
                    <div className="hindsight-correlation-card-title">
                        Your average {insight.numericField} on {insight.booleanField} days is {insight.whenTrue} vs {insight.whenFalse}
                    </div>
                    <div className="hindsight-correlation-card-detail">
                        Difference: {insight.difference > 0 ? '+' : ''}{insight.difference} ({insight.sampleSizeTrue} + {insight.sampleSizeFalse} entries)
                    </div>
                </button>
            ))}
        </div>
    );
}
