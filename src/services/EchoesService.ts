/**
 * Echoes Service
 *
 * Pure functions for finding "on this day" entries from previous years.
 * No Obsidian API dependency — fully testable.
 */

import type { JournalEntry } from '../types';
import { getWeekOfYear } from '../utils/dateUtils';

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
 * Find entries from the same week number in previous years.
 * Compares local-time week numbers only (not ISO week year),
 * so "week 10 of 2025" matches "week 10 of 2026".
 * Returns entries sorted by date (most recent first).
 */
export function getThisWeekLastYear(
    targetDate: Date,
    entries: JournalEntry[]
): JournalEntry[] {
    const currentYear = targetDate.getFullYear();
    const targetWeek = getWeekOfYear(targetDate);

    return entries
        .filter(entry =>
            entry.date.getFullYear() !== currentYear &&
            getWeekOfYear(entry.date) === targetWeek
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime());
}
