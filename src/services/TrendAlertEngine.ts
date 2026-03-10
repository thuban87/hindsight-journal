/**
 * Trend Alert Engine
 *
 * User-agnostic heuristic alert engine - pure functions operating on
 * field types and statistical patterns, not semantic meaning.
 * No hardcoded field names. Works for any vault's frontmatter.
 */

import type { JournalEntry, FrontmatterField, TrendAlert, AlertSeverity } from '../types';
import { formatDateISO } from '../utils/dateUtils';
import { isNumericField, getNumericValue } from './FrontmatterService';

/** Maximum alerts to return from generateAlerts */
const MAX_ALERTS = 5;

/**
 * Detect consecutive directional changes in a numeric field.
 * Generates alerts like: "Field X has decreased 3 days in a row."
 * Threshold: 3+ consecutive days in the same direction.
 *
 * @param entries - Journal entries sorted by date (newest first or unsorted - we'll sort)
 * @param fieldKey - Numeric field to analyze
 * @param polarity - Field polarity setting
 */
export function detectConsecutiveChange(
    entries: JournalEntry[],
    fieldKey: string,
    polarity: 'higher-is-better' | 'lower-is-better' | 'neutral'
): TrendAlert | null {
    // Get entries with this field, sorted by date descending (most recent first)
    const withField = entries
        .filter(e => getNumericValue(e.frontmatter[fieldKey]) !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (withField.length < 4) return null; // Need at least 4 values to detect 3 consecutive changes

    // Check consecutive changes from most recent
    let direction: 'increase' | 'decrease' | null = null;
    let streakLength = 0;

    for (let i = 0; i < withField.length - 1; i++) {
        const current = getNumericValue(withField[i].frontmatter[fieldKey]) as number;
        const previous = getNumericValue(withField[i + 1].frontmatter[fieldKey]) as number;

        if (current > previous) {
            if (direction === 'increase' || direction === null) {
                direction = 'increase';
                streakLength++;
            } else {
                break;
            }
        } else if (current < previous) {
            if (direction === 'decrease' || direction === null) {
                direction = 'decrease';
                streakLength++;
            } else {
                break;
            }
        } else {
            break; // Equal values break the streak
        }
    }

    if (streakLength < 3 || direction === null) return null;

    // Determine severity based on polarity and direction
    let severity: AlertSeverity = 'info';
    if (polarity === 'higher-is-better') {
        severity = direction === 'decrease' ? 'warning' : 'positive';
    } else if (polarity === 'lower-is-better') {
        severity = direction === 'decrease' ? 'positive' : 'warning';
    }

    const triggerDate = withField[0].date;
    const directionText = direction === 'decrease' ? 'decreased' : 'increased';

    return {
        id: `consecutive-${direction}-${fieldKey}-${formatDateISO(triggerDate)}`,
        severity,
        title: `${fieldKey} has ${directionText} ${streakLength} days in a row`,
        body: `Your ${fieldKey} has ${directionText} for ${streakLength} consecutive entries.`,
        relatedFields: [fieldKey],
        triggerDate,
        relatedEntryPath: withField[0].filePath,
    };
}

/**
 * Detect anomalies: today's value is >= 2 standard deviations from 30-day average.
 *
 * @param entries - Journal entries
 * @param fieldKey - Numeric field to check
 * @param referenceDate - Current date to check against
 */
export function detectAnomaly(
    entries: JournalEntry[],
    fieldKey: string,
    referenceDate: Date
): TrendAlert | null {
    // Find today's entry
    const todayEntry = entries.find(e =>
        e.date.getFullYear() === referenceDate.getFullYear() &&
        e.date.getMonth() === referenceDate.getMonth() &&
        e.date.getDate() === referenceDate.getDate()
    );

    if (!todayEntry) return null;
    const todayValue = getNumericValue(todayEntry.frontmatter[fieldKey]);
    if (todayValue === null) return null;

    // Get 30-day window (excluding today)
    const thirtyDaysAgo = new Date(referenceDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentValues: number[] = [];
    for (const entry of entries) {
        if (entry === todayEntry) continue;
        const val = getNumericValue(entry.frontmatter[fieldKey]);
        if (val === null) continue;
        if (entry.date >= thirtyDaysAgo && entry.date < referenceDate) {
            recentValues.push(val);
        }
    }

    if (recentValues.length < 7) return null; // Need enough data for meaningful stats

    const mean = recentValues.reduce((s, v) => s + v, 0) / recentValues.length;
    const variance = recentValues.reduce((s, v) => s + (v - mean) ** 2, 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return null; // No variation in data

    const zScore = (todayValue - mean) / stdDev;

    if (Math.abs(zScore) < 2) return null;

    const direction = zScore > 0 ? 'high' : 'low';
    const roundedMean = Math.round(mean * 10) / 10;

    return {
        id: `anomaly-${fieldKey}-${formatDateISO(referenceDate)}`,
        severity: 'info',
        title: `Today's ${fieldKey} (${todayValue}) is unusually ${direction}`,
        body: `Your 30-day average is ${roundedMean}. Today's value is ${Math.abs(Math.round(zScore * 10) / 10)} standard deviations from the mean.`,
        relatedFields: [fieldKey],
        triggerDate: referenceDate,
        relatedEntryPath: todayEntry.filePath,
    };
}

/**
 * Detect gaps in data collection.
 * Only alerts for fields with >= 50% historical coverage.
 *
 * @param entries - Journal entries
 * @param fieldKey - Field to check
 * @param coverage - Field's overall coverage ratio (0-1)
 * @param referenceDate - Current date reference
 */
export function detectFieldGap(
    entries: JournalEntry[],
    fieldKey: string,
    coverage: number,
    referenceDate: Date
): TrendAlert | null {
    // Only alert for frequently-used fields
    if (coverage < 0.5) return null;

    // Find the most recent entry with this field
    const withField = entries
        .filter(e => e.frontmatter[fieldKey] !== undefined && e.frontmatter[fieldKey] !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (withField.length === 0) return null;

    const lastDate = withField[0].date;
    const daysSince = Math.floor(
        (referenceDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince < 5) return null;

    return {
        id: `gap-${fieldKey}-${formatDateISO(referenceDate)}`,
        severity: 'info',
        title: `You haven't logged ${fieldKey} in ${daysSince} days`,
        body: `Your last ${fieldKey} entry was ${daysSince} days ago. You typically log this field ${Math.round(coverage * 100)}% of the time.`,
        relatedFields: [fieldKey],
        triggerDate: referenceDate,
    };
}

/**
 * Pattern recall: find the last time a similar pattern occurred and what happened next.
 * Looks for consecutive-decrease matching current streak length, then reports
 * the recovery trajectory (average of next 5 values after the pattern ended).
 *
 * @param entries - Journal entries
 * @param fieldKey - Numeric field
 * @param currentStreakLength - Current consecutive change streak
 * @param referenceDate - Current date reference
 */
export function patternRecall(
    entries: JournalEntry[],
    fieldKey: string,
    currentStreakLength: number,
    referenceDate: Date
): TrendAlert | null {
    if (currentStreakLength < 3) return null;

    // Get entries with this field, sorted by date ascending
    const sorted = entries
        .filter(e => getNumericValue(e.frontmatter[fieldKey]) !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (sorted.length < currentStreakLength + 5) return null;

    // Find past streaks of the same length (excluding current)
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - currentStreakLength - 1);

    for (let i = sorted.length - currentStreakLength - 6; i >= 0; i--) {
        // Skip if this overlaps with the current period
        if (sorted[i + currentStreakLength].date >= cutoffDate) continue;

        // Check for a decrease streak of at least currentStreakLength
        let isDecreaseStreak = true;
        for (let j = 0; j < currentStreakLength; j++) {
            const curr = getNumericValue(sorted[i + j + 1].frontmatter[fieldKey]) as number;
            const prev = getNumericValue(sorted[i + j].frontmatter[fieldKey]) as number;
            if (curr >= prev) {
                isDecreaseStreak = false;
                break;
            }
        }

        if (!isDecreaseStreak) continue;

        // Found a past matching pattern - check recovery
        const recoveryStart = i + currentStreakLength + 1;
        const recoveryEnd = Math.min(recoveryStart + 5, sorted.length);
        const recoveryValues: number[] = [];

        for (let j = recoveryStart; j < recoveryEnd; j++) {
            const val = sorted[j].frontmatter[fieldKey];
            if (typeof val === 'number') {
                recoveryValues.push(val);
            } else {
                const numVal = getNumericValue(val);
                if (numVal !== null) recoveryValues.push(numVal);
            }
        }

        if (recoveryValues.length < 2) continue;

        const recoveryAvg = Math.round(
            (recoveryValues.reduce((s, v) => s + v, 0) / recoveryValues.length) * 10
        ) / 10;
        const patternDate = sorted[i + currentStreakLength].date;

        return {
            id: `pattern-${fieldKey}-${formatDateISO(referenceDate)}`,
            severity: 'info',
            title: `Similar ${fieldKey} pattern found`,
            body: `Last time ${fieldKey} dropped for ${currentStreakLength}+ days was ${formatDateISO(patternDate)}. Over the next ${recoveryValues.length} days, it averaged ${recoveryAvg}.`,
            relatedFields: [fieldKey],
            triggerDate: referenceDate,
        };
    }

    return null;
}

/**
 * Generate all applicable alerts for the current state.
 * Iterates all numeric fields, runs each heuristic, deduplicates,
 * and returns sorted by severity (warnings first, then info, then positive).
 * Caps at MAX_ALERTS to avoid overwhelming the user.
 *
 * @param entries - Journal entries
 * @param fields - Detected frontmatter fields
 * @param polarity - Per-field polarity settings
 * @param referenceDate - Current date for computations
 */
export function generateAlerts(
    entries: JournalEntry[],
    fields: FrontmatterField[],
    polarity: Record<string, 'higher-is-better' | 'lower-is-better' | 'neutral'>,
    referenceDate: Date
): TrendAlert[] {
    const alerts: TrendAlert[] = [];
    const seenIds = new Set<string>();

    const numericFields = fields.filter(f => isNumericField(f));

    for (const field of numericFields) {
        const fieldPolarity = polarity[field.key] ?? 'neutral';

        // 1. Consecutive change detection
        const consecutive = detectConsecutiveChange(entries, field.key, fieldPolarity);
        if (consecutive && !seenIds.has(consecutive.id)) {
            alerts.push(consecutive);
            seenIds.add(consecutive.id);

            // 2. Pattern recall (only if we found a consecutive change)
            const streakLength = parseInt(consecutive.title.match(/(\d+) days/)?.[1] ?? '0', 10);
            if (streakLength >= 3) {
                const recall = patternRecall(entries, field.key, streakLength, referenceDate);
                if (recall && !seenIds.has(recall.id)) {
                    alerts.push(recall);
                    seenIds.add(recall.id);
                }
            }
        }

        // 3. Anomaly detection
        const anomaly = detectAnomaly(entries, field.key, referenceDate);
        if (anomaly && !seenIds.has(anomaly.id)) {
            alerts.push(anomaly);
            seenIds.add(anomaly.id);
        }

        // 4. Field gap detection
        const gap = detectFieldGap(entries, field.key, field.coverage / field.total, referenceDate);
        if (gap && !seenIds.has(gap.id)) {
            alerts.push(gap);
            seenIds.add(gap.id);
        }
    }

    // Sort by severity: warning > info > positive
    const severityOrder: Record<AlertSeverity, number> = {
        warning: 0,
        info: 1,
        positive: 2,
    };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Cap at MAX_ALERTS
    return alerts.slice(0, MAX_ALERTS);
}
