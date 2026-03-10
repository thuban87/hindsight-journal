import React, { useMemo } from 'react';
import { useJournalEntries, useTodayEntry } from '../../hooks/useJournalEntries';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getCurrentStreak } from '../../services/PulseService';
import { getFieldTimeSeries, isNumericField } from '../../services/FrontmatterService';

import { useToday } from '../../hooks/useToday';
import { EmptyState } from '../shared/EmptyState';
import { SparklineRow } from './SparklineRow';
import { GoalTracker } from '../pulse/GoalTracker';
import { GapAlerts } from './GapAlerts';
import { MorningBriefing } from './MorningBriefing';
import { WidgetContainer } from './WidgetContainer';

/**
 * Format the time difference between now and a date as a relative string.
 */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
}

export function TodayStatus(): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const todayEntry = useTodayEntry();
    const { detectedFields, loading } = useJournalEntries();
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    const today = useToday(); // Subscribe to midnight updates for re-render
    const settings = useSettingsStore(s => s.settings);

    if (!app) return null;

    if (loading) {
        return <div className="hindsight-today-status"><p>Loading...</p></div>;
    }

    const streak = getCurrentStreak(allEntries);
    const goalKeys = Object.keys(settings.goalTargets);
    const hasGoals = goalKeys.length > 0;

    // Numeric fields for sparklines
    const numericFields = detectedFields.filter(f => isNumericField(f));

    // Build widget definitions for WidgetContainer
    const widgets = useMemo(() => {
        const defs = [];

        if (hasGoals) {
            defs.push({
                id: 'goal-rings',
                label: 'Goals',
                component: (
                    <GoalTracker
                        entries={allEntries}
                        goals={settings.goalTargets}
                        referenceDate={today}
                        compact
                    />
                ),
            });
        }

        if (numericFields.length > 0 && todayEntry) {
            defs.push({
                id: 'sparklines',
                label: 'Sparklines',
                component: (
                    <div className="hindsight-today-sparklines">
                        {numericFields.map(field => {
                            const timeSeries = getFieldTimeSeries(allEntries, field.key);
                            const currentValue = todayEntry.frontmatter[field.key];
                            const numValue = currentValue !== undefined && currentValue !== null && currentValue !== ''
                                ? (isNaN(Number(currentValue)) ? null : Number(currentValue))
                                : null;
                            return (
                                <SparklineRow
                                    key={field.key}
                                    fieldKey={field.key}
                                    label={field.key}
                                    currentValue={numValue}
                                    data={timeSeries}
                                />
                            );
                        })}
                    </div>
                ),
            });
        }

        defs.push({
            id: 'gap-alerts',
            label: 'Gap alerts',
            component: <GapAlerts entries={allEntries} fields={detectedFields} referenceDate={today} />,
        });

        if (settings.morningBriefingEnabled) {
            defs.push({
                id: 'morning-briefing',
                label: 'Morning briefing',
                component: <MorningBriefing entries={allEntries} fields={detectedFields} referenceDate={today} />,
            });
        }

        return defs;
    }, [allEntries, detectedFields, today, settings, todayEntry, hasGoals, numericFields]);

    if (!todayEntry) {
        return (
            <div className="hindsight-today-status">
                <div className="hindsight-today-header">
                    <span className="hindsight-today-indicator hindsight-today-indicator-missing">○</span>
                    <span>No entry yet today</span>
                </div>
                {streak === 0 && allEntries.length > 0 && (
                    <p className="hindsight-today-nudge">
                        Last entry: {formatRelativeTime(allEntries[0].date)}
                    </p>
                )}
                {allEntries.length === 0 && (
                    <EmptyState message="No journal entries found. Start journaling!" />
                )}

                <WidgetContainer widgets={widgets} />
            </div>
        );
    }

    // Count filled frontmatter fields
    const totalFields = detectedFields.length;
    const filledFields = detectedFields.filter(field =>
        todayEntry.frontmatter[field.key] !== undefined &&
        todayEntry.frontmatter[field.key] !== null &&
        todayEntry.frontmatter[field.key] !== ''
    ).length;

    return (
        <div className="hindsight-today-status">
            {/* Entry status — always at top, not widgetized */}
            <div className="hindsight-today-header">
                <span className="hindsight-today-indicator hindsight-today-indicator-exists">✓</span>
                <span>Today's entry</span>
            </div>

            <div className="hindsight-today-stats">
                {totalFields > 0 && (
                    <div className="hindsight-today-stat">
                        <span className="hindsight-today-stat-label">Fields</span>
                        <span className="hindsight-today-stat-value">{filledFields}/{totalFields}</span>
                    </div>
                )}
                {streak > 0 && (
                    <div className="hindsight-today-stat">
                        <span className="hindsight-today-stat-label">Streak</span>
                        <span className="hindsight-streak-badge">{streak} day{streak === 1 ? '' : 's'}</span>
                    </div>
                )}
            </div>

            <p className="hindsight-today-nudge">
                Last edited: {formatRelativeTime(new Date(todayEntry.mtime))}
            </p>

            <button
                className="hindsight-today-open-btn"
                onClick={() => {
                    void app.workspace.openLinkText(todayEntry.filePath, '');
                }}
            >
                Open today's note
            </button>

            {/* Reorderable widget sections */}
            <WidgetContainer widgets={widgets} />
        </div>
    );
}

