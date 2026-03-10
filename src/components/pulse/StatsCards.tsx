/**
 * Stats Cards
 *
 * Summary stat cards row for the Pulse dashboard.
 * Shows total entries, current streak, average of first numeric field,
 * and this week's entry count.
 */

import React from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { getCurrentStreak } from '../../services/PulseService';
import { getWeekBounds } from '../../utils/periodUtils';
import { formatDateISO, startOfDay } from '../../utils/dateUtils';

interface StatsCardsProps {
    entries: JournalEntry[];
    fields: FrontmatterField[];
}

export function StatsCards({ entries, fields }: StatsCardsProps): React.ReactElement {
    const entryArray = React.useMemo(
        () => Array.from(entries.values ? entries.values() : entries),
        [entries]
    );

    const totalEntries = entryArray.length;
    const streak = React.useMemo(() => getCurrentStreak(entryArray), [entryArray]);

    // Average of first numeric field
    const firstNumeric = fields.find(f => f.type === 'number');
    const avgValue = React.useMemo(() => {
        if (!firstNumeric) return null;
        let sum = 0;
        let count = 0;
        for (const entry of entryArray) {
            const val = entry.frontmatter[firstNumeric.key];
            if (typeof val === 'number') {
                sum += val;
                count++;
            }
        }
        return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
    }, [entryArray, firstNumeric]);

    // This week's entry count
    const thisWeekCount = React.useMemo(() => {
        const now = new Date();
        const bounds = getWeekBounds(now);
        const startTime = bounds.start.getTime();
        const endTime = bounds.end.getTime();
        let count = 0;
        for (const entry of entryArray) {
            const t = startOfDay(entry.date).getTime();
            if (t >= startTime && t <= endTime) count++;
        }
        return count;
    }, [entryArray]);

    return (
        <div className="hindsight-stats-cards">
            <div className="hindsight-stat-card">
                <div className="hindsight-stat-card-value">{totalEntries}</div>
                <div className="hindsight-stat-card-label">Total entries</div>
            </div>
            <div className="hindsight-stat-card">
                <div className="hindsight-stat-card-value">{streak}</div>
                <div className="hindsight-stat-card-label">Current streak</div>
            </div>
            {firstNumeric && avgValue !== null && (
                <div className="hindsight-stat-card">
                    <div className="hindsight-stat-card-value">{avgValue}</div>
                    <div className="hindsight-stat-card-label">Avg {firstNumeric.key}</div>
                </div>
            )}
            <div className="hindsight-stat-card">
                <div className="hindsight-stat-card-value">{thisWeekCount}</div>
                <div className="hindsight-stat-card-label">This week</div>
            </div>
        </div>
    );
}
