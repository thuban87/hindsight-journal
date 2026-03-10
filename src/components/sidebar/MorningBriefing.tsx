/**
 * Morning Briefing
 *
 * Opt-in sidebar section showing yesterday's key metrics, echo excerpt,
 * priorities from yesterday's entry, writing streak, and adherence rates.
 * All data derived from indexed entries — zero network requests.
 */

import React, { useState, useEffect } from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { getOnThisDay } from '../../services/EchoesService';
import { getCurrentStreak, getAdherenceRate } from '../../services/PulseService';
import { startOfDay } from '../../utils/dateUtils';
import { stripMarkdown } from '../../services/SectionParserService';

interface MorningBriefingProps {
    entries: JournalEntry[];
    fields: FrontmatterField[];
    referenceDate: Date;
}

export function MorningBriefing({
    entries,
    fields,
    referenceDate,
}: MorningBriefingProps): React.ReactElement | null {
    const settings = useSettingsStore(s => s.settings);
    const dateIndex = useJournalStore(s => s.dateIndex);
    const app = useAppStore(s => s.app);
    const [collapsed, setCollapsed] = useState(false);

    if (!settings.morningBriefingEnabled || !app) return null;

    // Find yesterday's entry
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEntry = entries.find(e =>
        startOfDay(e.date).getTime() === yesterdayStart.getTime()
    );

    // Yesterday's key metrics
    const numericFields = fields.filter(f => f.type === 'number');
    const yesterdayMetrics: string[] = [];
    if (yesterdayEntry) {
        for (const field of numericFields.slice(0, 4)) {
            const val = yesterdayEntry.frontmatter[field.key];
            if (typeof val === 'number') {
                yesterdayMetrics.push(`${field.key} ${val}`);
            }
        }
    }

    // Echo: 1 year ago
    const echoEntries = getOnThisDay(referenceDate, dateIndex);
    const oneYearAgo = echoEntries.find(
        e => e.date.getFullYear() === referenceDate.getFullYear() - 1
    );

    // Priorities from yesterday
    let priorities: string[] = [];
    if (yesterdayEntry) {
        const heading = settings.prioritySectionHeading;
        // Check sections — try exact match first, then partial match
        const sectionKeys = Object.keys(yesterdayEntry.sections);
        const matchingKey = sectionKeys.find(k => k === heading)
            ?? sectionKeys.find(k => k.includes(heading));

        if (matchingKey) {
            const content = yesterdayEntry.sections[matchingKey];
            if (content) {
                // Extract list items (lines starting with - or *)
                priorities = content
                    .split('\n')
                    .filter(line => /^\s*[-*]\s+/.test(line))
                    .map(line => line.replace(/^\s*[-*]\s+/, '').trim())
                    .filter(line => line.length > 0)
                    .slice(0, 5);
            }
        }
    }

    // Writing streak
    const streak = getCurrentStreak(entries);

    // Boolean field adherence (meds, workout, etc.)
    const booleanFields = fields.filter(f => f.type === 'boolean');
    const adherenceData = booleanFields.slice(0, 3).map(field => {
        const result = getAdherenceRate(entries, field.key, 7, referenceDate);
        return { field: field.key, rate: result.rate };
    });

    // Get echo excerpt
    let echoExcerpt = '';
    if (oneYearAgo) {
        const firstSectionKey = Object.keys(oneYearAgo.sections)[0];
        if (firstSectionKey) {
            const raw = oneYearAgo.sections[firstSectionKey] ?? '';
            echoExcerpt = stripMarkdown(raw).slice(0, 120);
            if (raw.length > 120) echoExcerpt += '…';
        } else if (oneYearAgo.firstSectionExcerpt) {
            echoExcerpt = oneYearAgo.firstSectionExcerpt;
        }
    }

    return (
        <div className="hindsight-morning-briefing">
            <button
                className="hindsight-morning-briefing-header"
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
            >
                <span className="hindsight-morning-briefing-arrow">
                    {collapsed ? '▶' : '▼'}
                </span>
                Morning briefing
            </button>

            {!collapsed && (
                <div className="hindsight-morning-briefing-content">
                    {/* Yesterday's metrics */}
                    {yesterdayMetrics.length > 0 && (
                        <div className="hindsight-briefing-row">
                            <span className="hindsight-briefing-label">Yesterday:</span>
                            <span className="hindsight-briefing-value">
                                {yesterdayMetrics.join(', ')}
                            </span>
                        </div>
                    )}

                    {/* 1 year ago echo */}
                    {echoExcerpt && (
                        <div className="hindsight-briefing-row">
                            <span className="hindsight-briefing-label">1 year ago:</span>
                            <span className="hindsight-briefing-value hindsight-briefing-excerpt">
                                {echoExcerpt}
                            </span>
                        </div>
                    )}

                    {/* Priorities */}
                    {priorities.length > 0 && (
                        <div className="hindsight-briefing-row hindsight-briefing-priorities">
                            <span className="hindsight-briefing-label">Your priorities:</span>
                            <ul className="hindsight-briefing-list">
                                {priorities.map((p, i) => (
                                    <li key={i}>{p}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Writing streak */}
                    {streak > 0 && (
                        <div className="hindsight-briefing-row">
                            <span className="hindsight-briefing-label">Writing streak:</span>
                            <span className="hindsight-briefing-value">
                                {streak} day{streak === 1 ? '' : 's'}
                            </span>
                        </div>
                    )}

                    {/* Boolean field adherence */}
                    {adherenceData.map(({ field, rate }) => (
                        <div className="hindsight-briefing-row" key={field}>
                            <span className="hindsight-briefing-label">{field} this week:</span>
                            <span className="hindsight-briefing-value">
                                {Math.round(rate * 100)}%
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
