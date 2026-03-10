/**
 * Consistency Score
 *
 * Weekly/monthly/all-time consistency display.
 * Shows how consistently the user is journaling.
 */

import React from 'react';
import type { JournalEntry } from '../../types';
import { getConsistencyScores } from '../../services/PulseService';

interface ConsistencyScoreProps {
    entries: JournalEntry[];
    referenceDate: Date;
}

export function ConsistencyScore({ entries, referenceDate }: ConsistencyScoreProps): React.ReactElement {
    const entryArray = React.useMemo(
        () => Array.from(entries.values ? entries.values() : entries),
        [entries]
    );

    const scores = React.useMemo(
        () => getConsistencyScores(entryArray, referenceDate),
        [entryArray, referenceDate]
    );

    const periods = [
        { label: 'This week', data: scores.thisWeek },
        { label: 'This month', data: scores.thisMonth },
        { label: 'All time', data: scores.allTime },
    ];

    return (
        <div className="hindsight-consistency">
            {periods.map(period => {
                const pct = period.data.total > 0
                    ? Math.round((period.data.count / period.data.total) * 100)
                    : 0;
                return (
                    <div key={period.label} className="hindsight-consistency-period">
                        <div className="hindsight-consistency-value">
                            {period.data.count}/{period.data.total}
                        </div>
                        <div className="hindsight-consistency-bar">
                            <div
                                className="hindsight-consistency-bar-fill"
                                ref={el => {
                                    if (el) el.style.setProperty('width', `${pct}%`);
                                }}
                            />
                        </div>
                        <div className="hindsight-consistency-label">
                            {period.label} ({pct}%)
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
