/**
 * Echoes Panel
 *
 * Shows "On this day" entries from past years and "This week last year" entries.
 * Includes dropdowns for selecting which section and which frontmatter metric
 * are displayed on the echo cards.
 */

import React, { useMemo } from 'react';
import { useEchoes } from '../../hooks/useEchoes';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { useUIStore } from '../../store/uiStore';
import { EchoCard } from './EchoCard';
import { EmptyState } from '../shared/EmptyState';

export function EchoesPanel(): React.ReactElement {
    const { onThisDay, thisWeekLastYear } = useEchoes();
    const { detectedFields } = useJournalEntries();

    const echoSectionKey = useUIStore(state => state.echoSectionKey);
    const echoMetricKey = useUIStore(state => state.echoMetricKey);
    const setEchoSectionKey = useUIStore(state => state.setEchoSectionKey);
    const setEchoMetricKey = useUIStore(state => state.setEchoMetricKey);

    // Collect all unique section headings across echo entries
    const allEntries = useMemo(
        () => [...onThisDay, ...thisWeekLastYear],
        [onThisDay, thisWeekLastYear]
    );

    const sectionHeadings = useMemo(() => {
        const headings = new Set<string>();
        for (const entry of allEntries) {
            // Hot-tier entries: headings from sections
            const sectionKeys = Object.keys(entry.sections);
            if (sectionKeys.length > 0) {
                for (const key of sectionKeys) {
                    headings.add(key);
                }
            } else if (entry.sectionHeadings) {
                // Cold-tier entries: headings from sectionHeadings array
                for (const heading of entry.sectionHeadings) {
                    headings.add(heading);
                }
            }
        }
        return Array.from(headings).sort();
    }, [allEntries]);

    // Get frontmatter field keys from detected fields
    const metricFieldKeys = useMemo(
        () => detectedFields.map(f => f.key).sort(),
        [detectedFields]
    );

    const hasAnyEchoes = onThisDay.length > 0 || thisWeekLastYear.length > 0;

    if (!hasAnyEchoes) {
        return (
            <EmptyState message="No past entries for this date yet. Keep journaling!" icon="📅" />
        );
    }

    return (
        <div className="hindsight-echoes-panel">
            {/* Filter controls */}
            <div className="hindsight-echoes-controls">
                <div className="hindsight-echoes-control">
                    <label className="hindsight-echoes-control-label" htmlFor="echo-section-select">
                        Section
                    </label>
                    <select
                        id="echo-section-select"
                        className="hindsight-echoes-select"
                        value={echoSectionKey ?? '__auto__'}
                        onChange={(e) => {
                            const val = e.target.value;
                            setEchoSectionKey(val === '__auto__' ? null : val);
                        }}
                    >
                        <option value="__auto__">Auto (first available)</option>
                        {sectionHeadings.map(heading => (
                            <option key={heading} value={heading}>{heading}</option>
                        ))}
                    </select>
                </div>

                <div className="hindsight-echoes-control">
                    <label className="hindsight-echoes-control-label" htmlFor="echo-metric-select">
                        Metric
                    </label>
                    <select
                        id="echo-metric-select"
                        className="hindsight-echoes-select"
                        value={echoMetricKey}
                        onChange={(e) => setEchoMetricKey(e.target.value)}
                    >
                        {metricFieldKeys.map(key => (
                            <option key={key} value={key}>{key}</option>
                        ))}
                    </select>
                </div>
            </div>

            {onThisDay.length > 0 && (
                <section className="hindsight-echoes-section">
                    <h3 className="hindsight-echoes-heading">On this day</h3>
                    {onThisDay.map(entry => (
                        <EchoCard
                            key={entry.filePath}
                            entry={entry}
                            sectionKey={echoSectionKey}
                            metricKey={echoMetricKey}
                        />
                    ))}
                </section>
            )}

            {thisWeekLastYear.length > 0 && (
                <section className="hindsight-echoes-section">
                    <h3 className="hindsight-echoes-heading">This week in past years</h3>
                    {thisWeekLastYear.map(entry => (
                        <EchoCard
                            key={entry.filePath}
                            entry={entry}
                            sectionKey={echoSectionKey}
                            metricKey={echoMetricKey}
                        />
                    ))}
                </section>
            )}
        </div>
    );
}
