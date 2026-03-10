/**
 * Gap Alerts
 *
 * Gentle sidebar nudges when entries or fields have gaps.
 * Only nags about fields with >50% historical coverage to
 * avoid pestering about rarely-used fields.
 */

import React from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { startOfDay, formatDateISO } from '../../utils/dateUtils';
import { isNumericField } from '../../services/FrontmatterService';

interface GapAlertsProps {
    entries: JournalEntry[];
    fields: FrontmatterField[];
    referenceDate: Date;
}

interface GapAlert {
    message: string;
    priority: number; // lower = more important
}

export function GapAlerts({
    entries,
    fields,
    referenceDate,
}: GapAlertsProps): React.ReactElement | null {
    const alerts: GapAlert[] = [];
    const ref = startOfDay(referenceDate);

    // 1. No entry for 3+ days
    if (entries.length > 0) {
        const sorted = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime());
        const mostRecent = startOfDay(sorted[0].date);
        const daysSince = Math.round((ref.getTime() - mostRecent.getTime()) / 86400000);
        if (daysSince >= 3) {
            alerts.push({
                message: `You haven't logged in ${daysSince} days`,
                priority: 0,
            });
        }
    }

    // Build a date lookup for the last 7 days
    const last7Dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(ref);
        d.setDate(d.getDate() - i);
        last7Dates.push(formatDateISO(d));
    }

    const dateEntryMap = new Map<string, JournalEntry>();
    for (const entry of entries) {
        dateEntryMap.set(formatDateISO(startOfDay(entry.date)), entry);
    }

    // 2. Field-specific gaps for high-coverage numeric fields
    const numericFields = fields.filter(f => isNumericField(f) && f.coverage > 0.5);
    for (const field of numericFields) {
        let missing = 0;
        for (const dateStr of last7Dates) {
            const entry = dateEntryMap.get(dateStr);
            if (!entry || entry.frontmatter[field.key] === undefined || entry.frontmatter[field.key] === null) {
                missing++;
            }
        }

        if (missing >= 4) {
            alerts.push({
                message: `${field.key} data has gaps — ${missing} of last 7 days missing`,
                priority: 1,
            });
        }
    }

    // 3. Boolean field gaps
    const booleanFields = fields.filter(f => f.type === 'boolean' && f.coverage > 0.5);
    for (const field of booleanFields) {
        // Count consecutive days without the field being tracked
        let daysWithout = 0;
        for (const dateStr of last7Dates) {
            const entry = dateEntryMap.get(dateStr);
            if (!entry || entry.frontmatter[field.key] === undefined || entry.frontmatter[field.key] === null) {
                daysWithout++;
            } else {
                break; // Stop at first day it was tracked
            }
        }

        if (daysWithout >= 5) {
            alerts.push({
                message: `${field.key} not tracked in ${daysWithout} days`,
                priority: 2,
            });
        }
    }

    // Sort by priority, limit to 3
    const topAlerts = alerts.sort((a, b) => a.priority - b.priority).slice(0, 3);

    if (topAlerts.length === 0) return null;

    return (
        <div className="hindsight-gap-alerts">
            {topAlerts.map((alert, i) => (
                <div className="hindsight-gap-alert" key={i}>
                    <span className="hindsight-gap-alert-icon">ℹ</span>
                    <span className="hindsight-gap-alert-text">{alert.message}</span>
                </div>
            ))}
        </div>
    );
}
