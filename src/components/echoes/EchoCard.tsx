/**
 * Echo Card
 *
 * Displays a single journal entry from a past year.
 * Shows date, selected metric badge (color-coded), selected section excerpt, and word count.
 * Clicking opens the note in Obsidian.
 */

import React from 'react';
import type { JournalEntry } from '../../types';
import { stripMarkdown } from '../../services/SectionParserService';
import { useAppStore } from '../../store/appStore';

interface EchoCardProps {
    entry: JournalEntry;
    /** Which section to show as the excerpt (null = auto-detect) */
    sectionKey: string | null;
    /** Which frontmatter field to show as the badge */
    metricKey: string;
}

/**
 * Get section content based on selected key, with fallback.
 */
function getSectionContent(entry: JournalEntry, sectionKey: string | null): string {
    if (sectionKey && entry.sections[sectionKey]) {
        return entry.sections[sectionKey];
    }

    // Fallback: prefer "What Actually Happened", then first non-empty
    const preferred = entry.sections['What Actually Happened'];
    if (preferred && preferred.trim().length > 0) {
        return preferred;
    }

    for (const content of Object.values(entry.sections)) {
        if (content && content.trim().length > 0) {
            return content;
        }
    }

    return '';
}

/**
 * Format a date nicely for display (e.g., "March 6, 2024").
 */
function formatEchoDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}


/**
 * Format a metric value for display.
 */
function formatMetricValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'string') return value.length > 20 ? value.slice(0, 20) + '…' : value;
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

export function EchoCard({ entry, sectionKey, metricKey }: EchoCardProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    if (!app) return null;

    const rawExcerpt = getSectionContent(entry, sectionKey);
    const cleanText = stripMarkdown(rawExcerpt);
    const excerpt = cleanText.length > 100 ? cleanText.slice(0, 100) + '…' : cleanText;

    const metricValue = entry.frontmatter[metricKey];
    const displayValue = formatMetricValue(metricValue);

    return (
        <div
            className="hindsight-echo-card"
            onClick={() => {
                void app.workspace.openLinkText(entry.filePath, '');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void app.workspace.openLinkText(entry.filePath, '');
                }
            }}
        >
            <div className="hindsight-echo-card-header">
                <span className="hindsight-echo-date">{formatEchoDate(entry.date)}</span>
                {displayValue && (
                    <span className="hindsight-echo-metric-badge">
                        {metricKey}: {displayValue}
                    </span>
                )}
            </div>

            {excerpt && (
                <p className="hindsight-echo-excerpt">{excerpt}</p>
            )}

            <div className="hindsight-echo-card-footer">
                <span className="hindsight-echo-word-count">{entry.wordCount} words</span>
            </div>
        </div>
    );
}
