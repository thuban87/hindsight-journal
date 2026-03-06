/**
 * Pulse Service
 *
 * Writing streak calculations. Pure functions — no Obsidian API dependency.
 * Expanded in Phase 6 with additional analytics.
 */

import type { JournalEntry } from '../types';
import { formatDateISO, startOfDay } from '../utils/dateUtils';

/**
 * Calculate the current writing streak (consecutive days with entries ending today).
 * Returns 0 if no entry today.
 */
export function getCurrentStreak(entries: JournalEntry[]): number {
    if (entries.length === 0) return 0;

    // Get unique dates sorted descending (most recent first)
    const uniqueDates = getUniqueDatesSorted(entries);

    if (uniqueDates.length === 0) return 0;

    // Check if there's an entry for today
    const todayISO = formatDateISO(startOfDay(new Date()));
    if (uniqueDates[0] !== todayISO) return 0;

    // Count consecutive days backwards from today
    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i - 1]);
        const prevDate = new Date(uniqueDates[i]);

        // Check if the previous date is exactly 1 day before
        const diffMs = currentDate.getTime() - prevDate.getTime();
        const diffDays = Math.round(diffMs / 86400000);

        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Calculate the longest-ever writing streak.
 */
export function getLongestStreak(entries: JournalEntry[]): number {
    if (entries.length === 0) return 0;

    // Get unique dates sorted ascending (oldest first)
    const uniqueDates = getUniqueDatesSorted(entries).reverse();

    if (uniqueDates.length === 0) return 0;

    let longest = 1;
    let current = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currentDate = new Date(uniqueDates[i]);

        const diffMs = currentDate.getTime() - prevDate.getTime();
        const diffDays = Math.round(diffMs / 86400000);

        if (diffDays === 1) {
            current++;
            if (current > longest) {
                longest = current;
            }
        } else {
            current = 1;
        }
    }

    return longest;
}

/**
 * Get unique ISO date strings from entries, sorted descending (most recent first).
 */
function getUniqueDatesSorted(entries: JournalEntry[]): string[] {
    const dateSet = new Set<string>();
    for (const entry of entries) {
        dateSet.add(formatDateISO(startOfDay(entry.date)));
    }
    return Array.from(dateSet).sort().reverse();
}
