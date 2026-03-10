/**
 * Echoes Panel
 *
 * Shows "On this day" entries from past years, "This week last year" entries,
 * extended echoes (last month, last quarter), milestones, and metric comparisons.
 * Includes "Last time you felt this way" coping lookup section.
 */

import React, { useMemo, useState } from 'react';
import { useEchoes } from '../../hooks/useEchoes';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useJournalStore } from '../../store/journalStore';
import { ActionableEcho } from './ActionableEcho';
import { MilestoneCard } from './MilestoneCard';
import { CopingLookup } from './CopingLookup';
import { EmptyState } from '../shared/EmptyState';
import { getExtendedEchoes, detectMilestones } from '../../services/EchoesService';
import { getCurrentStreak } from '../../services/PulseService';
import { useToday } from '../../hooks/useToday';

type EchoPeriod = 'on-this-day' | 'last-month' | 'last-quarter';

export function EchoesPanel(): React.ReactElement {
    const { onThisDay, thisWeekLastYear, todayEntry } = useEchoes();
    const { detectedFields } = useJournalEntries();
    const allEntriesSorted = useJournalStore(s => s.getAllEntriesSorted());
    const today = useToday();

    const echoSectionKey = useUIStore(state => state.echoSectionKey);
    const echoMetricKey = useUIStore(state => state.echoMetricKey);
    const setEchoSectionKey = useUIStore(state => state.setEchoSectionKey);
    const setEchoMetricKey = useUIStore(state => state.setEchoMetricKey);

    const fieldPolarity = useSettingsStore(s => s.settings.fieldPolarity);

    const [echoPeriod, setEchoPeriod] = useState<EchoPeriod>('on-this-day');

    // Extended echoes for period selector
    const extendedEchoes = useMemo(
        () => getExtendedEchoes(allEntriesSorted, today),
        [allEntriesSorted, today]
    );

    // Milestones
    const currentStreak = useMemo(
        () => getCurrentStreak(allEntriesSorted),
        [allEntriesSorted]
    );
    const milestones = useMemo(
        () => detectMilestones(allEntriesSorted, currentStreak, today),
        [allEntriesSorted, currentStreak, today]
    );

    // Get entries for the selected period
    const periodEntries = useMemo(() => {
        switch (echoPeriod) {
            case 'on-this-day':
                return onThisDay;
            case 'last-month': {
                const group = extendedEchoes.find(e => e.period === 'This time last month');
                return group?.entries ?? [];
            }
            case 'last-quarter': {
                const group = extendedEchoes.find(e => e.period === 'Last quarter');
                return group?.entries ?? [];
            }
            default:
                return onThisDay;
        }
    }, [echoPeriod, onThisDay, extendedEchoes]);

    // Collect all unique section headings across visible entries
    const allVisibleEntries = useMemo(
        () => [...periodEntries, ...thisWeekLastYear],
        [periodEntries, thisWeekLastYear]
    );

    const sectionHeadings = useMemo(() => {
        const headings = new Set<string>();
        for (const entry of allVisibleEntries) {
            const sectionKeys = Object.keys(entry.sections);
            if (sectionKeys.length > 0) {
                for (const key of sectionKeys) {
                    headings.add(key);
                }
            } else if (entry.sectionHeadings) {
                for (const heading of entry.sectionHeadings) {
                    headings.add(heading);
                }
            }
        }
        return Array.from(headings).sort();
    }, [allVisibleEntries]);

    // Get frontmatter field keys from detected fields
    const metricFieldKeys = useMemo(
        () => detectedFields.map(f => f.key).sort(),
        [detectedFields]
    );

    const hasAnyEchoes = periodEntries.length > 0 || thisWeekLastYear.length > 0;

    if (!hasAnyEchoes && milestones.length === 0) {
        return (
            <EmptyState message="No past entries for this date yet. Keep journaling!" icon="📅" />
        );
    }

    const periodLabel = echoPeriod === 'on-this-day' ? 'On this day'
        : echoPeriod === 'last-month' ? 'This time last month'
            : 'Last quarter';

    return (
        <div className="hindsight-echoes-panel">
            {/* Milestones at top */}
            {milestones.length > 0 && (
                <div className="hindsight-echoes-milestones">
                    {milestones.map((m, i) => (
                        <MilestoneCard key={`${m.type}-${i}`} milestone={m} />
                    ))}
                </div>
            )}

            {/* Filter controls */}
            <div className="hindsight-echoes-controls">
                <div className="hindsight-echoes-control">
                    <label className="hindsight-echoes-control-label" htmlFor="echo-period-select">
                        Period
                    </label>
                    <select
                        id="echo-period-select"
                        className="hindsight-echoes-select"
                        value={echoPeriod}
                        onChange={e => setEchoPeriod(e.target.value as EchoPeriod)}
                    >
                        <option value="on-this-day">On this day</option>
                        <option value="last-month">This time last month</option>
                        <option value="last-quarter">Last quarter</option>
                    </select>
                </div>

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

            {/* Period echoes */}
            {periodEntries.length > 0 && (
                <section className="hindsight-echoes-section">
                    <h3 className="hindsight-echoes-heading">{periodLabel}</h3>
                    {periodEntries.map(entry => (
                        <ActionableEcho
                            key={entry.filePath}
                            echoEntry={entry}
                            todayEntry={todayEntry}
                            fields={detectedFields}
                            polarity={fieldPolarity}
                            sectionKey={echoSectionKey}
                            metricKey={echoMetricKey}
                        />
                    ))}
                </section>
            )}

            {/* This week in past years (always visible for on-this-day) */}
            {echoPeriod === 'on-this-day' && thisWeekLastYear.length > 0 && (
                <section className="hindsight-echoes-section">
                    <h3 className="hindsight-echoes-heading">This week in past years</h3>
                    {thisWeekLastYear.map(entry => (
                        <ActionableEcho
                            key={entry.filePath}
                            echoEntry={entry}
                            todayEntry={todayEntry}
                            fields={detectedFields}
                            polarity={fieldPolarity}
                            sectionKey={echoSectionKey}
                            metricKey={echoMetricKey}
                        />
                    ))}
                </section>
            )}

            {/* Coping Lookup at bottom */}
            {todayEntry && (
                <section className="hindsight-echoes-section">
                    <CopingLookup
                        entries={allEntriesSorted}
                        todayEntry={todayEntry}
                        fields={detectedFields}
                    />
                </section>
            )}
        </div>
    );
}
