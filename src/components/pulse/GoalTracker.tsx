/**
 * Goal Tracker
 *
 * Displays goal progress as a row of ProgressRings. Used in both
 * the Pulse tab (full mode) and sidebar Today tab (compact mode).
 */

import React from 'react';
import type { JournalEntry, GoalConfig } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { getGoalProgress } from '../../services/PulseService';
import { ProgressRing } from '../charts/ProgressRing';

interface GoalTrackerProps {
    entries: JournalEntry[];
    goals: Record<string, GoalConfig>;
    referenceDate: Date;
    /** Compact mode: smaller rings in horizontal row (sidebar) */
    compact?: boolean;
}

export function GoalTracker({
    entries,
    goals,
    referenceDate,
    compact = false,
}: GoalTrackerProps): React.ReactElement | null {
    const weekStartDay = useSettingsStore(s => s.settings.weekStartDay);
    const goalKeys = Object.keys(goals);

    if (goalKeys.length === 0) return null;

    const ringSize = compact ? 40 : 56;
    const strokeWidth = compact ? 3 : 4;

    return (
        <div className={`hindsight-goal-tracker${compact ? ' hindsight-goal-tracker-compact' : ''}`}>
            {!compact && <h3 className="hindsight-section-heading">Goal progress</h3>}
            <div className="hindsight-goal-tracker-rings">
                {goalKeys.map(fieldKey => {
                    const goal = goals[fieldKey];
                    const result = getGoalProgress(
                        entries,
                        fieldKey,
                        goal.period,
                        goal.type,
                        goal.target,
                        referenceDate,
                        weekStartDay
                    );

                    const sublabel = goal.type === 'count'
                        ? `${result.current}/${goal.target} ${goal.period}`
                        : `${Math.round(result.current * 10) / 10}/${goal.target} ${goal.period}`;

                    return (
                        <ProgressRing
                            key={fieldKey}
                            progress={result.progress}
                            size={ringSize}
                            strokeWidth={strokeWidth}
                            label={fieldKey}
                            sublabel={sublabel}
                        />
                    );
                })}
            </div>
        </div>
    );
}
