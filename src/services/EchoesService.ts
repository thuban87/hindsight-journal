/**
 * Echoes Service
 *
 * Pure functions for finding "on this day" entries from previous years.
 * No Obsidian API dependency — fully testable.
 */

import type { JournalEntry } from '../types';
import { isSameWeek } from '../utils/dateUtils';

/**
 * Find entries from the same date in previous years.
 * Uses the store's dateIndex for O(1) lookup by "MM-DD" key.
 * Filters out entries from the current year.
 * Returns entries sorted by year (most recent first).
 */
export function getOnThisDay(
    targetDate: Date,
    dateIndex: Map<string, JournalEntry[]>
): JournalEntry[] {
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const key = `${m}-${d}`;
    const currentYear = targetDate.getFullYear();

    const entries = dateIndex.get(key) ?? [];

    return entries
        .filter(entry => entry.date.getFullYear() !== currentYear)
        .sort((a, b) => b.date.getFullYear() - a.date.getFullYear());
}

/**
 * Find entries from the same ISO week in previous years.
 * Returns entries sorted by year (most recent first).
 */
export function getThisWeekLastYear(
    targetDate: Date,
    entries: JournalEntry[]
): JournalEntry[] {
    const currentYear = targetDate.getFullYear();

    return entries
        .filter(entry =>
            entry.date.getFullYear() !== currentYear &&
            isSameWeek(entry.date, targetDate)
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime());
}
