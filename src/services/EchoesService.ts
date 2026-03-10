/**
 * Echoes Service
 *
 * Pure functions for finding "on this day" entries from previous years,
 * comparing metrics between entries, detecting milestones, and
 * surfacing coping strategies from similar past entries.
 * No Obsidian API dependency — fully testable.
 */

import type { JournalEntry, FrontmatterField, MetricComparison, Milestone } from '../types';
import { getWeekOfYear } from '../utils/dateUtils';
import { isNumericField, getNumericValue } from './FrontmatterService';

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

/**
 * Compare today's metrics with a past echo entry.
 * Returns field-by-field comparison with direction and magnitude.
 * Only compares fields that exist in both entries and are numeric.
 *
 * @param todayEntry - Today's journal entry (may be undefined if not yet created)
 * @param echoEntry - The past echo entry to compare against
 * @param fields - Detected frontmatter fields for type checking
 * @param polarity - Per-field polarity setting (higher-is-better, lower-is-better, neutral)
 */
export function compareMetrics(
    todayEntry: JournalEntry | undefined,
    echoEntry: JournalEntry,
    fields: FrontmatterField[],
    polarity: Record<string, string>
): MetricComparison[] {
    if (!todayEntry) return [];

    const comparisons: MetricComparison[] = [];
    const numericFields = fields.filter(f => isNumericField(f));

    for (const field of numericFields) {
        const todayRaw = todayEntry.frontmatter[field.key];
        const echoRaw = echoEntry.frontmatter[field.key];

        const todayVal = getNumericValue(todayRaw);
        const echoVal = getNumericValue(echoRaw);

        // Only compare if both entries have a numeric value for this field
        if (todayVal === null || echoVal === null) continue;

        const change = todayVal - echoVal;
        const fieldPolarity = polarity[field.key] ?? 'neutral';

        let direction: 'improved' | 'declined' | 'unchanged';
        if (change === 0) {
            direction = 'unchanged';
        } else if (fieldPolarity === 'higher-is-better') {
            direction = change > 0 ? 'improved' : 'declined';
        } else if (fieldPolarity === 'lower-is-better') {
            direction = change < 0 ? 'improved' : 'declined';
        } else {
            direction = 'unchanged'; // neutral polarity → no directional meaning
        }

        comparisons.push({
            field: field.key,
            today: todayVal,
            then: echoVal,
            direction,
            change,
        });
    }

    return comparisons;
}

/**
 * "Last time you felt this way" — find entries where a specific field
 * had a similar value to today (within ± tolerance).
 * Returns the N most recent matches, excluding today.
 * Sorted newest first.
 *
 * @param entries - All journal entries
 * @param fieldKey - The frontmatter field to match on
 * @param targetValue - The value to search for (today's value)
 * @param tolerance - Acceptable range (e.g., ±1 for mood 1-10)
 * @param limit - Maximum results to return (default 5)
 */
export function findSimilarEntries(
    entries: JournalEntry[],
    fieldKey: string,
    targetValue: number,
    tolerance: number,
    limit: number = 5
): JournalEntry[] {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return entries
        .filter(entry => {
            // Exclude today's entry
            const entryDate = entry.date;
            const entryStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
            if (entryStr === todayStr) return false;

            const raw = entry.frontmatter[fieldKey];
            const val = getNumericValue(raw);
            if (val === null) return false;

            return Math.abs(val - targetValue) <= tolerance;
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limit);
}

/**
 * Detect milestone entries.
 * Returns milestones like "100th entry", "1 year of journaling", "365-day streak".
 *
 * @param entries - All journal entries
 * @param currentStreak - Current journaling streak in consecutive days
 * @param referenceDate - Date to check against (usually today)
 */
export function detectMilestones(
    entries: JournalEntry[],
    currentStreak: number,
    referenceDate: Date
): Milestone[] {
    const milestones: Milestone[] = [];
    const count = entries.length;

    // Entry count milestones
    const countMilestones = [50, 100, 200, 365, 500, 1000, 1500, 2000];
    for (const m of countMilestones) {
        if (count === m) {
            milestones.push({
                type: 'entry-count',
                title: `This is your ${m}th journal entry!`,
                value: m,
            });
        }
    }

    // Anniversary milestones (1 year, 2 years, etc.)
    if (entries.length > 0) {
        const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
        const firstEntry = sorted[0];
        const daysSinceFirst = Math.floor(
            (referenceDate.getTime() - firstEntry.date.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check for exact year anniversaries (allow ±1 day for timezone edge cases)
        for (let years = 1; years <= 10; years++) {
            const anniversaryDays = years * 365;
            if (Math.abs(daysSinceFirst - anniversaryDays) <= 1) {
                milestones.push({
                    type: 'anniversary',
                    title: years === 1
                        ? '1 year of journaling!'
                        : `${years} years of journaling!`,
                    value: years,
                });
            }
        }
    }

    // Streak milestones
    const streakMilestones = [7, 30, 60, 90, 100, 180, 365];
    for (const m of streakMilestones) {
        if (currentStreak === m) {
            milestones.push({
                type: 'streak',
                title: `${m}-day journaling streak!`,
                value: m,
            });
        }
    }

    return milestones;
}

/**
 * Get echoes for additional time periods beyond "on this day" and "this week last year":
 * - "This time last month" — same day of month in previous months
 * - "This time last quarter" — same relative day, 3/6/9/12 months ago
 *
 * @param entries - All journal entries
 * @param referenceDate - Date to find echoes for (usually today)
 */
export function getExtendedEchoes(
    entries: JournalEntry[],
    referenceDate: Date
): { period: string; entries: JournalEntry[] }[] {
    const results: { period: string; entries: JournalEntry[] }[] = [];
    const refDay = referenceDate.getDate();
    const refMonth = referenceDate.getMonth();
    const refYear = referenceDate.getFullYear();

    // "This time last month" — entries on the same day in each previous month
    const lastMonthEntries: JournalEntry[] = [];
    for (const entry of entries) {
        const entryDate = entry.date;
        if (entryDate.getDate() === refDay) {
            // Same day of month, but not the current month
            const isCurrentMonth = entryDate.getMonth() === refMonth && entryDate.getFullYear() === refYear;
            if (!isCurrentMonth) {
                lastMonthEntries.push(entry);
            }
        }
    }

    if (lastMonthEntries.length > 0) {
        // Sort newest first, limit to last 6 months
        lastMonthEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
        results.push({
            period: 'This time last month',
            entries: lastMonthEntries.slice(0, 6),
        });
    }

    // "Last quarter" — entries 3, 6, 9, 12 months ago (±2 days to catch month-end edge cases)
    const quarterEntries: JournalEntry[] = [];
    const quarterOffsets = [3, 6, 9, 12];

    for (const offset of quarterOffsets) {
        const targetDate = new Date(refYear, refMonth - offset, refDay);
        // Look for entries within ±2 days of the target date
        for (const entry of entries) {
            const diffMs = Math.abs(entry.date.getTime() - targetDate.getTime());
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays <= 2) {
                quarterEntries.push(entry);
            }
        }
    }

    if (quarterEntries.length > 0) {
        // Deduplicate by filePath
        const seen = new Set<string>();
        const unique = quarterEntries.filter(e => {
            if (seen.has(e.filePath)) return false;
            seen.add(e.filePath);
            return true;
        });
        unique.sort((a, b) => b.date.getTime() - a.date.getTime());
        results.push({
            period: 'Last quarter',
            entries: unique,
        });
    }

    return results;
}
