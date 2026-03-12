/**
 * Weekly Summary Cards
 *
 * Read-only summary cards for the weekly review wizard (Page 1).
 * Renders stat cards showing averages, completion rates, highlights,
 * and writing volume for a given set of entries.
 */

import React, { useMemo } from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { isNumericField, getNumericValue, getBooleanValue } from '../../services/FrontmatterService';
import { getCurrentStreak } from '../../services/PulseService';
import { stripMarkdown } from '../../services/SectionParserService';

interface WeeklySummaryCardsProps {
    entries: JournalEntry[];
    fields: FrontmatterField[];
}

interface StatCard {
    label: string;
    value: string;
    sublabel?: string;
}

export function WeeklySummaryCards({ entries, fields }: WeeklySummaryCardsProps): React.ReactElement {
    const stats = useMemo(() => {
        const cards: StatCard[] = [];

        if (entries.length === 0) return cards;

        // Entry count and consistency
        cards.push({
            label: 'Entries',
            value: String(entries.length),
            sublabel: `${entries.length} day${entries.length === 1 ? '' : 's'} logged`,
        });

        // Numeric field averages
        const numericFields = fields.filter(f => isNumericField(f));
        for (const field of numericFields) {
            const values: number[] = [];
            for (const entry of entries) {
                const val = getNumericValue(entry.frontmatter[field.key]);
                if (val !== null) values.push(val);
            }
            if (values.length > 0) {
                const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
                cards.push({
                    label: field.key,
                    value: avg.toFixed(1),
                    sublabel: `avg (${values.length} entries)`,
                });
            }
        }

        // Boolean field completion rates
        const boolFields = fields.filter(f => f.type === 'boolean');
        for (const field of boolFields) {
            let trueCount = 0;
            let total = 0;
            for (const entry of entries) {
                const val = getBooleanValue(entry.frontmatter[field.key]);
                if (val !== null) {
                    total++;
                    if (val) trueCount++;
                }
            }
            if (total > 0) {
                const rate = Math.round((trueCount / total) * 100);
                cards.push({
                    label: field.key,
                    value: `${rate}%`,
                    sublabel: `${trueCount}/${total} days`,
                });
            }
        }

        // Writing volume
        const totalWords = entries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0);
        if (totalWords > 0) {
            cards.push({
                label: 'Words written',
                value: totalWords.toLocaleString(),
                sublabel: `avg ${Math.round(totalWords / entries.length)} per entry`,
            });
        }

        // Best and worst day (by quality score)
        const sortedByQuality = [...entries]
            .filter(e => e.qualityScore !== undefined)
            .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

        if (sortedByQuality.length > 0) {
            const best = sortedByQuality[0];
            const bestExcerpt = getExcerpt(best);
            cards.push({
                label: 'Best day',
                value: formatShortDate(best.date),
                sublabel: bestExcerpt,
            });

            if (sortedByQuality.length > 1) {
                const worst = sortedByQuality[sortedByQuality.length - 1];
                const worstExcerpt = getExcerpt(worst);
                cards.push({
                    label: 'Lowest day',
                    value: formatShortDate(worst.date),
                    sublabel: worstExcerpt,
                });
            }
        }

        // Streak
        const streak = getCurrentStreak(entries);
        if (streak > 0) {
            cards.push({
                label: 'Current streak',
                value: `${streak} day${streak === 1 ? '' : 's'}`,
            });
        }

        return cards;
    }, [entries, fields]);

    if (entries.length === 0) {
        return (
            <div className="hindsight-weekly-summary-empty">
                <p>No entries found for this week.</p>
            </div>
        );
    }

    return (
        <div className="hindsight-weekly-summary">
            {stats.map((card, i) => (
                <div key={`${card.label}-${i}`} className="hindsight-weekly-summary-card">
                    <span className="hindsight-weekly-summary-card-label">{card.label}</span>
                    <span className="hindsight-weekly-summary-card-value">{card.value}</span>
                    {card.sublabel && (
                        <span className="hindsight-weekly-summary-card-sublabel">{card.sublabel}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

/** Get a short excerpt from an entry */
function getExcerpt(entry: JournalEntry): string {
    if (entry.firstSectionExcerpt) {
        return stripMarkdown(entry.firstSectionExcerpt).substring(0, 80);
    }
    if (entry.sections) {
        const firstKey = Object.keys(entry.sections)[0];
        if (firstKey) {
            return stripMarkdown(entry.sections[firstKey]).substring(0, 80);
        }
    }
    return '';
}

/** Format a date as "Mon DD" */
function formatShortDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}
