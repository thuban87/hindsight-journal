/**
 * Personal Bests
 *
 * Achievement-style cards showing best week, most consistent month,
 * and best trend. Informational, not gamified.
 * Cached in metricsCacheStore with 2-second debounce recomputation.
 */

import React from 'react';
import { useJournalStore } from '../../store/journalStore';
import { useMetricsCacheStore } from '../../store/metricsCacheStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getPersonalBests } from '../../services/PulseService';
import { EmptyState } from '../shared/EmptyState';

/** Debounce delay for personal bests recomputation (ms) */
const PERSONAL_BESTS_DEBOUNCE_MS = 2000;

export function PersonalBests(): React.ReactElement {
    const entries = useJournalStore(s => s.entries);
    const detectedFields = useJournalStore(s => s.detectedFields);
    const revision = useJournalStore(s => s.revision);
    const fieldPolarity = useSettingsStore(s => s.settings.fieldPolarity);
    const cachedPersonalBests = useMetricsCacheStore(s => s.cachedPersonalBests);
    const personalBestsStale = useMetricsCacheStore(s => s.personalBestsStale);

    // Debounced recomputation when stale
    React.useEffect(() => {
        if (!personalBestsStale && cachedPersonalBests !== null) return;

        const timer = setTimeout(() => {
            const entryArray = Array.from(entries.values());
            if (entryArray.length === 0) {
                useMetricsCacheStore.getState().setPersonalBests([]);
                return;
            }
            const bests = getPersonalBests(entryArray, detectedFields, fieldPolarity);
            useMetricsCacheStore.getState().setPersonalBests(bests);
        }, PERSONAL_BESTS_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [personalBestsStale, revision, entries, detectedFields, fieldPolarity, cachedPersonalBests]);

    if (!cachedPersonalBests || cachedPersonalBests.length === 0) {
        return <EmptyState message="Not enough data for personal bests yet." />;
    }

    return (
        <div className="hindsight-personal-bests">
            {cachedPersonalBests.map((best, i) => (
                <div key={`${best.type}-${best.field}-${i}`} className="hindsight-personal-best-card">
                    <div className="hindsight-personal-best-title">{best.title}</div>
                    <div className="hindsight-personal-best-period">{best.period}</div>
                </div>
            ))}
        </div>
    );
}
