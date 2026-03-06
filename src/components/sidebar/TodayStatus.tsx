/**
 * Today Status
 *
 * Shows whether today's journal entry exists and
 * displays key stats: filled fields, word count, writing streak.
 */

import React from 'react';
import type { App } from 'obsidian';
import { useJournalEntries, useTodayEntry } from '../../hooks/useJournalEntries';
import { useJournalStore } from '../../store/journalStore';
import { getCurrentStreak } from '../../services/PulseService';

import { useToday } from '../../hooks/useToday';
import { EmptyState } from '../shared/EmptyState';

interface TodayStatusProps {
    app: App;
}

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

export function TodayStatus({ app }: TodayStatusProps): React.ReactElement {
    const todayEntry = useTodayEntry();
    const { detectedFields, loading } = useJournalEntries();
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _today = useToday(); // Subscribe to midnight updates for re-render

    if (loading) {
        return <div className="hindsight-today-status"><p>Loading...</p></div>;
    }

    const streak = getCurrentStreak(allEntries);

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
        </div>
    );
}
