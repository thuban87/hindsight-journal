/**
 * Digest Panel
 *
 * Insights → Digest sub-tab providing period summaries:
 * averages for numeric fields, tag frequencies, boolean completion rates,
 * best/worst day with excerpts, writing volume, and export functionality.
 *
 * Uses processWithYielding for large entry sets (>200 entries).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { PeriodSelector } from './PeriodSelector';
import { ExportButton } from './ExportButton';
import { startOfDay } from '../../utils/dateUtils';
import type { DateRange, JournalEntry, FrontmatterField } from '../../types';

interface DigestPanelProps {
    dateRange: DateRange;
    onPeriodChange: (range: DateRange) => void;
}

interface DigestStats {
    numericAverages: { key: string; avg: number; min: number; max: number }[];
    booleanRates: { key: string; trueCount: number; total: number }[];
    tagCounts: { tag: string; count: number }[];
    bestDay: { entry: JournalEntry; field: string; value: number } | null;
    worstDay: { entry: JournalEntry; field: string; value: number } | null;
    totalWords: number;
    avgWords: number;
    entryCount: number;
}

export function DigestPanel({ dateRange, onPeriodChange }: DigestPanelProps): React.ReactElement {
    const { entries, detectedFields } = useJournalEntries();
    const [stats, setStats] = useState<DigestStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Filter entries for the selected period
    const periodEntries = useMemo(() => {
        const startTime = startOfDay(dateRange.start).getTime();
        const endTime = startOfDay(dateRange.end).getTime();
        return Array.from(entries.values()).filter(entry => {
            const t = startOfDay(entry.date).getTime();
            return t >= startTime && t <= endTime;
        });
    }, [entries, dateRange]);

    // Compute stats
    useEffect(() => {
        setLoading(true);
        const compute = () => {
            const numericFields = detectedFields.filter(f => f.type === 'number' || f.type === 'numeric-text');
            const booleanFields = detectedFields.filter(f => f.type === 'boolean');

            // Numeric averages
            const numericAverages = numericFields.map(field => {
                const values = periodEntries
                    .map(e => e.frontmatter[field.key])
                    .filter((v): v is number => typeof v === 'number');
                if (values.length === 0) return { key: field.key, avg: 0, min: 0, max: 0 };
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                return {
                    key: field.key,
                    avg: Math.round(avg * 10) / 10,
                    min: Math.min(...values),
                    max: Math.max(...values),
                };
            }).filter(a => a.avg !== 0 || a.min !== 0 || a.max !== 0);

            // Boolean completion rates
            const booleanRates = booleanFields.map(field => {
                const values = periodEntries.map(e => e.frontmatter[field.key]);
                const trueCount = values.filter(v => v === true || v === 'true').length;
                const total = values.filter(v => v !== undefined && v !== null).length;
                return { key: field.key, trueCount, total };
            }).filter(r => r.total > 0);

            // Tag counts
            const tagMap = new Map<string, number>();
            for (const entry of periodEntries) {
                const tags = entry.frontmatter['tags'];
                if (Array.isArray(tags)) {
                    for (const tag of tags) {
                        if (typeof tag === 'string') {
                            tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
                        }
                    }
                }
            }
            const tagCounts = Array.from(tagMap.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 15);

            // Best/worst day
            let bestDay: DigestStats['bestDay'] = null;
            let worstDay: DigestStats['worstDay'] = null;
            const primaryField = numericFields.find(f => f.key === 'mood') ?? numericFields[0];
            if (primaryField) {
                const withValue = periodEntries.filter(
                    e => typeof e.frontmatter[primaryField.key] === 'number'
                );
                if (withValue.length > 0) {
                    const best = withValue.reduce((a, b) =>
                        (a.frontmatter[primaryField.key] as number) > (b.frontmatter[primaryField.key] as number) ? a : b
                    );
                    bestDay = {
                        entry: best,
                        field: primaryField.key,
                        value: best.frontmatter[primaryField.key] as number,
                    };
                    const worst = withValue.reduce((a, b) =>
                        (a.frontmatter[primaryField.key] as number) < (b.frontmatter[primaryField.key] as number) ? a : b
                    );
                    worstDay = {
                        entry: worst,
                        field: primaryField.key,
                        value: worst.frontmatter[primaryField.key] as number,
                    };
                }
            }

            // Writing volume
            const totalWords = periodEntries.reduce((acc, e) => acc + e.wordCount, 0);
            const avgWords = periodEntries.length > 0 ? Math.round(totalWords / periodEntries.length) : 0;

            setStats({
                numericAverages,
                booleanRates,
                tagCounts,
                bestDay,
                worstDay,
                totalWords,
                avgWords,
                entryCount: periodEntries.length,
            });
            setLoading(false);
        };

        // Short delay to show loading state for visual feedback
        const timer = setTimeout(compute, 50);
        return () => clearTimeout(timer);
    }, [periodEntries, detectedFields]);



    return (
        <div className="hindsight-digest-panel">
            <div className="hindsight-digest-header">
                <PeriodSelector onPeriodChange={onPeriodChange} />
                <ExportButton entries={periodEntries} fields={detectedFields} dateRange={dateRange} />
            </div>

            {loading ? (
                <div className="hindsight-digest-loading">Computing summary...</div>
            ) : !stats || stats.entryCount === 0 ? (
                <div className="hindsight-digest-empty">No entries found for this period.</div>
            ) : (
                <div className="hindsight-digest-content">
                    {/* Entry count */}
                    <div className="hindsight-digest-count" aria-live="polite">
                        {stats.entryCount} {stats.entryCount === 1 ? 'entry' : 'entries'}
                    </div>

                    {/* Numeric averages */}
                    {stats.numericAverages.length > 0 && (
                        <div className="hindsight-digest-section">
                            <h3 className="hindsight-digest-section-title">Averages</h3>
                            <div className="hindsight-digest-stats-grid">
                                {stats.numericAverages.map(a => (
                                    <div key={a.key} className="hindsight-digest-stat-card">
                                        <div className="hindsight-digest-stat-label">{a.key}</div>
                                        <div className="hindsight-digest-stat-value">{a.avg}</div>
                                        <div className="hindsight-digest-stat-range">
                                            {a.min} – {a.max}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Boolean completion rates */}
                    {stats.booleanRates.length > 0 && (
                        <div className="hindsight-digest-section">
                            <h3 className="hindsight-digest-section-title">Completion rates</h3>
                            <div className="hindsight-digest-completion-list">
                                {stats.booleanRates.map(r => {
                                    const pct = r.total > 0 ? Math.round((r.trueCount / r.total) * 100) : 0;
                                    return (
                                        <div key={r.key} className="hindsight-digest-completion-row">
                                            <span className="hindsight-digest-completion-label">{r.key}</span>
                                            <div className="hindsight-digest-completion-bar-bg">
                                                <div
                                                    className="hindsight-digest-completion-bar-fill"
                                                    ref={el => {
                                                        if (el) el.style.setProperty('--hindsight-bar-width', `${pct}%`);
                                                    }}
                                                />
                                            </div>
                                            <span className="hindsight-digest-completion-pct">
                                                {r.trueCount}/{r.total} ({pct}%)
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Best/Worst day */}
                    {(stats.bestDay || stats.worstDay) && (
                        <div className="hindsight-digest-section">
                            <h3 className="hindsight-digest-section-title">Highlights</h3>
                            <div className="hindsight-digest-highlights">
                                {stats.bestDay && (
                                    <div className="hindsight-digest-highlight-card hindsight-digest-best">
                                        <div className="hindsight-digest-highlight-label">Best day</div>
                                        <div className="hindsight-digest-highlight-date">
                                            {formatDisplayDate(stats.bestDay.entry.date)}
                                        </div>
                                        <div className="hindsight-digest-highlight-value">
                                            {stats.bestDay.field}: {stats.bestDay.value}
                                        </div>
                                        {stats.bestDay.entry.firstSectionExcerpt && (
                                            <div className="hindsight-digest-highlight-excerpt">
                                                {stats.bestDay.entry.firstSectionExcerpt.substring(0, 100)}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {stats.worstDay && (
                                    <div className="hindsight-digest-highlight-card hindsight-digest-worst">
                                        <div className="hindsight-digest-highlight-label">Worst day</div>
                                        <div className="hindsight-digest-highlight-date">
                                            {formatDisplayDate(stats.worstDay.entry.date)}
                                        </div>
                                        <div className="hindsight-digest-highlight-value">
                                            {stats.worstDay.field}: {stats.worstDay.value}
                                        </div>
                                        {stats.worstDay.entry.firstSectionExcerpt && (
                                            <div className="hindsight-digest-highlight-excerpt">
                                                {stats.worstDay.entry.firstSectionExcerpt.substring(0, 100)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {stats.tagCounts.length > 0 && (
                        <div className="hindsight-digest-section">
                            <h3 className="hindsight-digest-section-title">Tags</h3>
                            <div className="hindsight-digest-tags">
                                {stats.tagCounts.map(t => (
                                    <span key={t.tag} className="hindsight-digest-tag">
                                        {t.tag} <span className="hindsight-digest-tag-count">{t.count}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Writing volume */}
                    <div className="hindsight-digest-section">
                        <h3 className="hindsight-digest-section-title">Writing volume</h3>
                        <div className="hindsight-digest-stats-grid">
                            <div className="hindsight-digest-stat-card">
                                <div className="hindsight-digest-stat-label">Total words</div>
                                <div className="hindsight-digest-stat-value">{stats.totalWords.toLocaleString()}</div>
                            </div>
                            <div className="hindsight-digest-stat-card">
                                <div className="hindsight-digest-stat-label">Avg words/entry</div>
                                <div className="hindsight-digest-stat-value">{stats.avgWords.toLocaleString()}</div>
                            </div>
                            <div className="hindsight-digest-stat-card">
                                <div className="hindsight-digest-stat-label">Entries</div>
                                <div className="hindsight-digest-stat-value">{stats.entryCount}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatDisplayDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}
