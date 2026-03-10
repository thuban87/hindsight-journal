/**
 * Habit Streaks Grid
 *
 * Boolean field streak visualization — one row per boolean field
 * with last 90 days as small colored squares and current streak count.
 * Performance: memoized on journalStore.revision + field keys.
 */

import React from 'react';
import type { FrontmatterField } from '../../types';
import { useJournalStore } from '../../store/journalStore';
import { getHabitStreaks } from '../../services/PulseService';
import { EmptyState } from '../shared/EmptyState';

interface HabitStreaksGridProps {
    booleanFields: FrontmatterField[];
}

export function HabitStreaksGrid({ booleanFields }: HabitStreaksGridProps): React.ReactElement {
    const entries = useJournalStore(s => s.entries);
    const revision = useJournalStore(s => s.revision);

    // Stable field key hash for memoization
    const fieldKeyHash = React.useMemo(
        () => booleanFields.map(f => f.key).join(','),
        [booleanFields]
    );

    const streakData = React.useMemo(() => {
        const entryArray = Array.from(entries.values());
        return getHabitStreaks(entryArray, booleanFields);
    }, [revision, fieldKeyHash]);

    if (streakData.length === 0) {
        return <EmptyState message="No boolean fields detected for habit tracking." />;
    }

    return (
        <div className="hindsight-habit-grid">
            {streakData.map(row => (
                <div key={row.field} className="hindsight-habit-row">
                    <span className="hindsight-habit-label">{row.field}</span>
                    <svg
                        className="hindsight-habit-squares"
                        role="img"
                        aria-label={`Habit streak for ${row.field}: ${row.currentStreak} day${row.currentStreak !== 1 ? 's' : ''} current streak`}
                        width={90 * 9 + 89}
                        height={8}
                    >
                        {row.days.map((val, i) => {
                            const today = new Date();
                            today.setDate(today.getDate() - (89 - i));
                            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                            let fill: string;
                            if (val === true) {
                                fill = 'var(--text-success)';
                            } else if (val === false) {
                                fill = 'var(--text-error)';
                            } else {
                                fill = 'var(--background-modifier-border)';
                            }

                            const status = val === true ? 'completed' : val === false ? 'not completed' : 'no entry';

                            return (
                                <rect
                                    key={i}
                                    x={i * 10}
                                    y={0}
                                    width={8}
                                    height={8}
                                    rx={2}
                                    ry={2}
                                    fill={fill}
                                    aria-label={`${dateStr}: ${status}`}
                                />
                            );
                        })}
                    </svg>
                    <span className="hindsight-habit-streak-count">
                        {row.currentStreak}d
                    </span>
                </div>
            ))}
        </div>
    );
}
