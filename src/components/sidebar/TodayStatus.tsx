/**
 * Today Status
 *
 * Shows whether today's journal entry exists and
 * displays key stats: filled fields, writing streak, sparklines.
 * Phase 6b: expanded with goal progress, gap alerts, and morning briefing
 * as scrollable sections.
 */

import React from 'react';
import { useJournalEntries, useTodayEntry } from '../../hooks/useJournalEntries';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getCurrentStreak } from '../../services/PulseService';
import { getFieldTimeSeries } from '../../services/FrontmatterService';

import { useToday } from '../../hooks/useToday';
import { EmptyState } from '../shared/EmptyState';
import { SparklineRow } from './SparklineRow';
import { GoalTracker } from '../pulse/GoalTracker';
import { GapAlerts } from './GapAlerts';
import { MorningBriefing } from './MorningBriefing';

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

                {/* Section 2: Goal progress (even without today's entry) */}
                {hasGoals && (
                    <GoalTracker
                        entries={allEntries}
                        goals={settings.goalTargets}
                        referenceDate={today}
                        compact
                    />
                )}

                {/* Section 4: Gap alerts */}
                <GapAlerts entries={allEntries} fields={detectedFields} referenceDate={today} />

                {/* Section 5: Morning briefing */}
                <MorningBriefing entries={allEntries} fields={detectedFields} referenceDate={today} />
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

    // Numeric fields for sparklines
    const numericFields = detectedFields.filter(f => f.type === 'number');

    return (
        <div className="hindsight-today-status">
            {/* Section 1: Entry status (existing) */}
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

            {/* Section 2: Goal progress rings (compact) */}
            {hasGoals && (
                <GoalTracker
                    entries={allEntries}
                    goals={settings.goalTargets}
                    referenceDate={today}
                    compact
                />
            )}

            {/* Section 3: Sparklines for numeric fields */}
            {numericFields.length > 0 && (
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
            )}

            {/* Section 4: Gap alerts */}
            <GapAlerts entries={allEntries} fields={detectedFields} referenceDate={today} />

            {/* Section 5: Morning briefing */}
            <MorningBriefing entries={allEntries} fields={detectedFields} referenceDate={today} />
        </div>
    );
}
