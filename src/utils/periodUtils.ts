/**
 * Period Utilities
 *
 * Shared hub for all period-based aggregation — weekly averages,
 * monthly counts, period slicing. MetricsEngine, PulseService,
 * and ChartDataService all import from here rather than each
 * implementing their own iteration logic.
 */

import type { JournalEntry, MetricDataPoint } from '../types';
import { startOfDay } from './dateUtils';

/**
 * Get the default week start day from the user's locale.
 * Falls back to 0 (Sunday) on environments where Intl.Locale is unavailable
 * (e.g., older mobile WebViews).
 *
 * @returns 0 for Sunday, 1 for Monday
 */
export function getDefaultWeekStart(): 0 | 1 {
    try {
        if (typeof Intl === 'undefined' || typeof Intl.Locale !== 'function') return 0;
        const locale = new Intl.Locale(navigator.language);
        if ('weekInfo' in locale) {
            return (locale as { weekInfo: { firstDay: number } }).weekInfo.firstDay === 1 ? 1 : 0;
        }
    } catch {
        // Intl.Locale constructor or weekInfo access failed — fall through to default
    }
    return 0; // Sunday fallback
}

/**
 * Get start and end dates of the week containing referenceDate.
 *
 * @param referenceDate - The date to find the week for
 * @param weekStartDay - 0 for Sunday, 1 for Monday (default: auto-detect)
 * @returns { start, end } both at midnight
 */
export function getWeekBounds(
    referenceDate: Date,
    weekStartDay: 0 | 1 = 0
): { start: Date; end: Date } {
    const d = startOfDay(referenceDate);
    const currentDay = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Calculate days since the start of the week
    let diff = currentDay - weekStartDay;
    if (diff < 0) diff += 7;

    const start = new Date(d);
    start.setDate(d.getDate() - diff);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
}

/**
 * Get start and end dates of the month containing referenceDate.
 *
 * @param referenceDate - The date to find the month for
 * @returns { start, end } both at midnight
 */
export function getMonthBounds(referenceDate: Date): { start: Date; end: Date } {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();

    const start = new Date(year, month, 1);
    start.setHours(0, 0, 0, 0);

    // Last day of month: day 0 of next month
    const end = new Date(year, month + 1, 0);
    end.setHours(0, 0, 0, 0);

    return { start, end };
}

/**
 * Get entries within the current week or month containing referenceDate.
 *
 * @param entries - All journal entries
 * @param period - 'week' or 'month'
 * @param referenceDate - The date to find the period for
 * @param weekStartDay - 0 for Sunday, 1 for Monday
 * @returns Entries within the period
 */
export function getEntriesInPeriod(
    entries: JournalEntry[],
    period: 'week' | 'month',
    referenceDate: Date,
    weekStartDay: 0 | 1 = 0
): JournalEntry[] {
    const bounds = period === 'week'
        ? getWeekBounds(referenceDate, weekStartDay)
        : getMonthBounds(referenceDate);

    const startTime = bounds.start.getTime();
    const endTime = bounds.end.getTime();

    return entries.filter(entry => {
        const t = startOfDay(entry.date).getTime();
        return t >= startTime && t <= endTime;
    });
}

/**
 * Aggregate entries by period, extracting a numeric field as data points.
 *
 * @param entries - All journal entries (will be sorted internally)
 * @param fieldKey - Frontmatter field key to extract
 * @param period - Aggregation granularity
 * @param weekStartDay - 0 for Sunday, 1 for Monday
 * @returns Aggregated data points sorted by date
 */
export function aggregateByPeriod(
    entries: JournalEntry[],
    fieldKey: string,
    period: 'daily' | 'weekly' | 'monthly',
    weekStartDay: 0 | 1 = 0
): MetricDataPoint[] {
    if (entries.length === 0) return [];

    if (period === 'daily') {
        // No aggregation — one point per entry
        return entries
            .map(e => ({
                date: startOfDay(e.date).getTime(),
                value: typeof e.frontmatter[fieldKey] === 'number'
                    ? e.frontmatter[fieldKey] as number
                    : null,
            }))
            .sort((a, b) => a.date - b.date);
    }

    // Group entries by period key
    const groups = new Map<string, { date: number; values: number[] }>();

    for (const entry of entries) {
        const bounds = period === 'weekly'
            ? getWeekBounds(entry.date, weekStartDay)
            : getMonthBounds(entry.date);

        const key = bounds.start.toISOString();
        const value = entry.frontmatter[fieldKey];

        if (!groups.has(key)) {
            groups.set(key, { date: bounds.start.getTime(), values: [] });
        }

        if (typeof value === 'number') {
            groups.get(key)!.values.push(value);
        }
    }

    // Compute averages per period
    const result: MetricDataPoint[] = [];
    for (const group of groups.values()) {
        if (group.values.length === 0) {
            result.push({ date: group.date, value: null });
        } else {
            const avg = group.values.reduce((a, b) => a + b, 0) / group.values.length;
            result.push({ date: group.date, value: Math.round(avg * 100) / 100 });
        }
    }

    return result.sort((a, b) => a.date - b.date);
}
