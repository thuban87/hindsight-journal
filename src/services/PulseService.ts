/**
 * Pulse Service
 *
 * Writing streak calculations and analytics. Pure functions — no Obsidian API dependency.
 * Expanded in Phase 6a with heatmap data, habit streaks, personal bests, and consistency scores.
 */

import type { JournalEntry, FrontmatterField, PersonalBest } from '../types';
import { formatDateISO, startOfDay } from '../utils/dateUtils';
import { getWeekBounds, getMonthBounds } from '../utils/periodUtils';

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

/**
 * Generate heatmap data: date → value mapping for a field over N months.
 * Returns one entry per day in the range, with null for days without entries.
 *
 * @param entries - All journal entries
 * @param fieldKey - Frontmatter field to extract values from
 * @param months - Number of months to look back (default 12)
 * @returns Array of { date: 'YYYY-MM-DD', value: number | null }
 */
export function getHeatmapData(
    entries: JournalEntry[],
    fieldKey: string,
    months = 12
): { date: string; value: number | null }[] {
    // Build a lookup map: ISO date string → field value
    const dateValueMap = new Map<string, number | null>();
    for (const entry of entries) {
        const iso = formatDateISO(startOfDay(entry.date));
        const raw = entry.frontmatter[fieldKey];
        const value = typeof raw === 'number' ? raw
            : (raw === true ? 1 : (raw === false ? 0 : null));
        dateValueMap.set(iso, value);
    }

    // Generate all dates in the range
    const end = startOfDay(new Date());
    const start = new Date(end);
    start.setMonth(start.getMonth() - months);

    const result: { date: string; value: number | null }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const iso = formatDateISO(cursor);
        result.push({ date: iso, value: dateValueMap.get(iso) ?? null });
        cursor.setDate(cursor.getDate() + 1);
    }

    return result;
}

/**
 * Compute habit streaks for all boolean fields.
 * Returns per-field: last 90 days as boolean/null array, current streak count, longest streak.
 *
 * @param entries - All journal entries
 * @param booleanFields - Detected boolean fields to track
 * @returns Array of streak data per field
 */
export function getHabitStreaks(
    entries: JournalEntry[],
    booleanFields: FrontmatterField[]
): { field: string; days: (boolean | null)[]; currentStreak: number; longestStreak: number }[] {
    const today = startOfDay(new Date());
    const daysBack = 90;

    // Build date → entry map for O(1) lookups
    const dateMap = new Map<string, JournalEntry>();
    for (const entry of entries) {
        dateMap.set(formatDateISO(startOfDay(entry.date)), entry);
    }

    return booleanFields.map(field => {
        const days: (boolean | null)[] = [];

        // Walk backwards from today for 90 days
        for (let i = daysBack - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const iso = formatDateISO(d);
            const entry = dateMap.get(iso);

            if (!entry) {
                days.push(null);
            } else {
                const val = entry.frontmatter[field.key];
                days.push(typeof val === 'boolean' ? val : null);
            }
        }

        // Current streak: count backwards from today (end of array)
        let currentStreak = 0;
        for (let i = days.length - 1; i >= 0; i--) {
            if (days[i] === true) {
                currentStreak++;
            } else {
                break;
            }
        }

        // Longest streak
        let longestStreak = 0;
        let current = 0;
        for (const val of days) {
            if (val === true) {
                current++;
                if (current > longestStreak) longestStreak = current;
            } else {
                current = 0;
            }
        }

        return { field: field.key, days, currentStreak, longestStreak };
    });
}

/**
 * Find personal bests across all numeric fields.
 * Returns best week (rolling 7-day average), most consistent month,
 * and best trend period. Limits to top 5 results.
 *
 * Per plan: uses fixed trend windows [7, 14, 30] days.
 * If >10 numeric fields detected, limits to top 5 by data coverage.
 *
 * @param entries - All journal entries
 * @param fields - Detected frontmatter fields
 * @param polarity - Per-field polarity settings
 * @returns Top 5 personal bests sorted by significance
 */
export function getPersonalBests(
    entries: JournalEntry[],
    fields: FrontmatterField[],
    polarity: Record<string, string>
): PersonalBest[] {
    if (entries.length === 0) return [];

    // Filter to numeric fields only
    let numericFields = fields.filter(f => f.type === 'number');
    if (numericFields.length === 0) return [];

    // If >10 numeric fields, limit to top 5 by coverage
    if (numericFields.length > 10) {
        numericFields = numericFields
            .sort((a, b) => b.coverage - a.coverage)
            .slice(0, 5);
    }

    const bests: PersonalBest[] = [];

    // Sort entries by date ascending for sliding windows
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());

    // 1. Best 7-day rolling average for each numeric field
    for (const field of numericFields) {
        const values: { date: Date; value: number }[] = [];
        for (const entry of sorted) {
            const val = entry.frontmatter[field.key];
            if (typeof val === 'number') {
                values.push({ date: entry.date, value: val });
            }
        }

        if (values.length < 7) continue;

        const fieldPolarity = polarity[field.key] ?? 'higher-is-better';
        let bestAvg = fieldPolarity === 'lower-is-better' ? Infinity : -Infinity;
        let bestStart = 0;
        let bestEnd = 0;

        // Sliding window of 7 values (not 7 calendar days, since entries may have gaps)
        for (let i = 0; i <= values.length - 7; i++) {
            const windowValues = values.slice(i, i + 7);
            const avg = windowValues.reduce((sum, v) => sum + v.value, 0) / 7;

            const isBetter = fieldPolarity === 'lower-is-better'
                ? avg < bestAvg
                : avg > bestAvg;

            if (isBetter) {
                bestAvg = avg;
                bestStart = i;
                bestEnd = i + 6;
            }
        }

        if (bestAvg !== Infinity && bestAvg !== -Infinity) {
            const startDate = values[bestStart].date;
            const endDate = values[bestEnd].date;
            const startStr = formatDateISO(startDate);
            const endStr = formatDateISO(endDate);

            bests.push({
                type: 'best-week',
                field: field.key,
                title: `Highest ${field.key} week: ${startStr} to ${endStr}`,
                value: Math.round(bestAvg * 100) / 100,
                period: `${startStr} – ${endStr}`,
            });
        }
    }

    // 2. Most consistent month (highest entry count / days ratio)
    const monthMap = new Map<string, { count: number; daysInMonth: number }>();
    for (const entry of sorted) {
        const d = entry.date;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap.has(key)) {
            const bounds = getMonthBounds(d);
            const daysInMonth = bounds.end.getDate();
            monthMap.set(key, { count: 0, daysInMonth });
        }
        monthMap.get(key)!.count++;
    }

    let bestMonth = '';
    let bestRatio = 0;
    let bestMonthCount = 0;
    let bestMonthTotal = 0;
    for (const [key, data] of monthMap.entries()) {
        const ratio = data.count / data.daysInMonth;
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestMonth = key;
            bestMonthCount = data.count;
            bestMonthTotal = data.daysInMonth;
        }
    }

    if (bestMonth) {
        bests.push({
            type: 'most-consistent-month',
            field: 'entries',
            title: `Most consistent month: ${bestMonth} (${bestMonthCount}/${bestMonthTotal} days)`,
            value: Math.round(bestRatio * 100),
            period: bestMonth,
        });
    }

    // 3. Best trend: largest positive movement over fixed windows [7, 14, 30]
    const trendWindows = [7, 14, 30];
    for (const field of numericFields) {
        const values: { date: Date; value: number }[] = [];
        for (const entry of sorted) {
            const val = entry.frontmatter[field.key];
            if (typeof val === 'number') {
                values.push({ date: entry.date, value: val });
            }
        }

        const fieldPolarity = polarity[field.key] ?? 'higher-is-better';

        for (const windowSize of trendWindows) {
            if (values.length < windowSize) continue;

            let bestTrendDelta = 0;
            let bestTrendStart = 0;
            let bestTrendEnd = 0;

            for (let i = 0; i <= values.length - windowSize; i++) {
                const startVal = values[i].value;
                const endVal = values[i + windowSize - 1].value;
                const delta = endVal - startVal;

                // "Positive" direction depends on polarity
                const improvement = fieldPolarity === 'lower-is-better' ? -delta : delta;

                if (improvement > bestTrendDelta) {
                    bestTrendDelta = improvement;
                    bestTrendStart = i;
                    bestTrendEnd = i + windowSize - 1;
                }
            }

            if (bestTrendDelta > 0) {
                const startVal = values[bestTrendStart].value;
                const endVal = values[bestTrendEnd].value;
                const startDate = formatDateISO(values[bestTrendStart].date);
                const endDate = formatDateISO(values[bestTrendEnd].date);

                bests.push({
                    type: 'best-trend',
                    field: field.key,
                    title: `Best ${field.key} trend: ${startVal} → ${endVal} over ${windowSize} entries`,
                    value: bestTrendDelta,
                    period: `${startDate} – ${endDate}`,
                });
            }
        }
    }

    // Sort by value descending and return top 5
    return bests
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
}

/**
 * Compute consistency scores for various periods.
 * Shows how consistently the user is journaling.
 *
 * @param entries - All journal entries
 * @param referenceDate - The date to compute consistency around
 * @param weekStartDay - 0 for Sunday, 1 for Monday (default 0)
 * @returns Counts and totals for thisWeek, thisMonth, and allTime
 */
export function getConsistencyScores(
    entries: JournalEntry[],
    referenceDate: Date,
    weekStartDay: 0 | 1 = 0
): {
    thisWeek: { count: number; total: number };
    thisMonth: { count: number; total: number };
    allTime: { count: number; total: number };
} {
    // Get unique entry dates for deduplication
    const entryDates = new Set<string>();
    for (const entry of entries) {
        entryDates.add(formatDateISO(startOfDay(entry.date)));
    }

    // This week
    const weekBounds = getWeekBounds(referenceDate, weekStartDay);
    let weekCount = 0;
    const weekCursor = new Date(weekBounds.start);
    let weekTotal = 0;
    while (weekCursor <= weekBounds.end) {
        weekTotal++;
        if (entryDates.has(formatDateISO(weekCursor))) {
            weekCount++;
        }
        weekCursor.setDate(weekCursor.getDate() + 1);
    }

    // This month
    const monthBounds = getMonthBounds(referenceDate);
    let monthCount = 0;
    const monthCursor = new Date(monthBounds.start);
    let monthTotal = 0;
    while (monthCursor <= monthBounds.end) {
        monthTotal++;
        if (entryDates.has(formatDateISO(monthCursor))) {
            monthCount++;
        }
        monthCursor.setDate(monthCursor.getDate() + 1);
    }

    // All time: from earliest entry to referenceDate
    let allTimeCount = entryDates.size;
    let allTimeTotal = 1;
    if (entries.length > 0) {
        const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
        const earliest = startOfDay(sorted[0].date);
        const latest = startOfDay(referenceDate);
        const diffMs = latest.getTime() - earliest.getTime();
        allTimeTotal = Math.max(1, Math.round(diffMs / 86400000) + 1);
    }

    return {
        thisWeek: { count: weekCount, total: weekTotal },
        thisMonth: { count: monthCount, total: monthTotal },
        allTime: { count: allTimeCount, total: allTimeTotal },
    };
}
