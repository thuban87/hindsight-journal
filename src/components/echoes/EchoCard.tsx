/**
 * Echo Card
 *
 * Displays a single journal entry from a past year.
 * Shows date, selected metric badge (color-coded), selected section excerpt, and word count.
 * Clicking opens the note in Obsidian.
 *
 * For cold-tier entries (>90 days old), sections are lazy-loaded via
 * ensureSectionsLoaded() on mount. The card shows firstSectionExcerpt
 * as a placeholder until full sections are available.
 */

import React, { useEffect, useState } from 'react';
import type { JournalEntry } from '../../types';
import { stripMarkdown } from '../../services/SectionParserService';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';

interface EchoCardProps {
    entry: JournalEntry;
    /** Which section to show as the excerpt (null = auto-detect) */
    sectionKey: string | null;
    /** Which frontmatter field to show as the badge */
    metricKey: string;
}

/**
 * Skip past short template instruction lines at the start of section
 * content. Many journal templates have a brief instruction line
 * (e.g., "Record immediately upon waking") before the actual content.
 * If the first paragraph (before the first blank line) is short,
 * skip it and return the rest.
 */
function skipInstructionPrefix(text: string): string {
    const lines = text.split('\n');
    let startIdx = 0;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.length === 0) { startIdx = i + 1; continue; }
        if (trimmed.length < 80 && /^[\s\-–—=_*#>|:;,.!?]+$/.test(trimmed)) {
            startIdx = i + 1; continue;
        }
        if (i < 2 && trimmed.length < 80) { startIdx = i + 1; continue; }
        break;
    }

    if (startIdx > 0 && startIdx < lines.length) {
        return lines.slice(startIdx).join('\n').trim();
    }
    return text;
}

/**
 * Check if section content has real journal writing after stripping
 * template instructions and separators.
 */
function getRealContent(raw: string): string {
    const skipped = skipInstructionPrefix(raw);
    const clean = stripMarkdown(skipped).trim();
    if (clean.length < 5 || /^[\s\-–—=_*#>|:;,.!?]*$/.test(clean)) {
        return '';
    }
    return clean;
}

/**
 * Get section content based on selected key, with fallback.
 * Uses partial matching for section names (keys may have emoji prefixes).
 * Skips template-only sections when auto-detecting.
 */
function getSectionContent(entry: JournalEntry, sectionKey: string | null): string {
    // Full sections available (hot-tier or lazy-loaded)
    if (Object.keys(entry.sections).length > 0) {
        // Exact match for user-selected section key
        if (sectionKey && entry.sections[sectionKey]) {
            return entry.sections[sectionKey];
        }

        // Partial match for "What Actually Happened" (key may have emoji prefix)
        for (const [key, content] of Object.entries(entry.sections)) {
            if (key.includes('What Actually Happened') && content && content.trim().length > 0) {
                const real = getRealContent(content);
                if (real) return content; // Return raw content (caller applies stripMarkdown)
            }
        }

        // Fallback: first section with real content (not just template instructions)
        for (const content of Object.values(entry.sections)) {
            if (content && content.trim().length > 0) {
                const real = getRealContent(content);
                if (real) return content;
            }
        }
    }

    // Cold-tier fallback: use firstSectionExcerpt (already stripped of markdown)
    return entry.firstSectionExcerpt ?? '';
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
    const isUnloading = useAppStore(s => s.isUnloading);

    // Track whether we've attempted to load sections for this cold-tier entry
    const [loadedEntry, setLoadedEntry] = useState<JournalEntry>(entry);

    // Lazy-load sections for cold-tier entries on mount
    useEffect(() => {
        // If sections are already available, just update the ref
        if (Object.keys(entry.sections).length > 0) {
            setLoadedEntry(entry);
            return;
        }

        // Cold-tier: trigger lazy load
        if (isUnloading) return;

        let cancelled = false;
        void useJournalStore.getState().ensureSectionsLoaded(entry.filePath).then(loaded => {
            if (!cancelled && loaded) {
                setLoadedEntry(loaded);
            }
        });

        return () => { cancelled = true; };
    }, [entry.filePath, entry.sections, isUnloading]);

    if (!app) return null;

    const rawExcerpt = getSectionContent(loadedEntry, sectionKey);
    // For raw section content, skip template instruction lines before stripping markdown
    const processed = Object.keys(loadedEntry.sections).length > 0
        ? skipInstructionPrefix(rawExcerpt)
        : rawExcerpt; // firstSectionExcerpt already stripped
    const cleanText = Object.keys(loadedEntry.sections).length > 0
        ? stripMarkdown(processed)
        : processed;
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
