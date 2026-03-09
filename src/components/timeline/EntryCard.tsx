/**
 * Entry Card
 *
 * Entry summary card for the timeline feed.
 * Shows date, mood/energy badges, quality score, word count,
 * tags, excerpt, and image count. Clicking opens the note.
 *
 * For cold-tier entries (>hotTierDays old), sections are lazy-loaded
 * via ensureSectionsLoaded() on mount — same pattern as EchoCard.
 */

import React, { useEffect, useState } from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { stripMarkdown } from '../../services/SectionParserService';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';

interface EntryCardProps {
    entry: JournalEntry;
    detectedFields: FrontmatterField[];
    /** Which section to show as the excerpt (null = auto-detect) */
    sectionKey: string | null;
    onClick: () => void;
}

/** Format date with day of week (e.g., "March 5, 2026 — Thursday") */
function formatEntryDate(entry: JournalEntry): string {
    const formatted = entry.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    return `${formatted} — ${entry.dayOfWeek}`;
}

/**
 * Skip past template instruction lines and separators at the start
 * of section content. Skips ALL leading lines that are short (<80 chars)
 * or just punctuation/separators until hitting a line with real content.
 */
function skipInstructionPrefix(text: string): string {
    const lines = text.split('\n');
    let startIdx = 0;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Skip empty lines, short instruction lines, and punctuation-only lines
        if (trimmed.length === 0) {
            startIdx = i + 1;
            continue;
        }
        // If line is short and looks like a template instruction or separator, skip it
        if (trimmed.length < 80 && /^[\s\-–—=_*#>|:;,.!?]+$/.test(trimmed)) {
            startIdx = i + 1;
            continue;
        }
        // If line is a short instruction (< 80 chars) and it's one of the first 2 lines, skip it
        if (i < 2 && trimmed.length < 80) {
            startIdx = i + 1;
            continue;
        }
        // Found a line with real content
        break;
    }

    if (startIdx > 0 && startIdx < lines.length) {
        return lines.slice(startIdx).join('\n').trim();
    }
    return text;
}

/**
 * Check if section content has real journal writing after stripping
 * template instructions and separators. Returns the cleaned content
 * or empty string if the section is template-only.
 */
function getRealContent(raw: string): string {
    const skipped = skipInstructionPrefix(raw);
    const clean = stripMarkdown(skipped).trim();
    // If after skipping instructions the content is very short or just punctuation, it's template-only
    if (clean.length < 5 || /^[\s\-–—=_*#>|:;,.!?]*$/.test(clean)) {
        return '';
    }
    return clean;
}

/**
 * Get excerpt from loaded entry sections.
 * Prefers section containing "What Actually Happened" (partial match for emoji prefixes),
 * then falls back to the first section with real content (skipping template-only sections).
 */
function getExcerpt(entry: JournalEntry, sectionKey: string | null): string {
    // Full sections available (hot-tier or lazy-loaded)
    if (Object.keys(entry.sections).length > 0) {
        // If user selected a specific section, use it directly
        if (sectionKey && entry.sections[sectionKey]) {
            const real = getRealContent(entry.sections[sectionKey]);
            if (real) return real.length > 150 ? real.slice(0, 150) + '…' : real;
        }
        // First: find "What Actually Happened" by partial match (key may have emoji prefix)
        for (const [key, content] of Object.entries(entry.sections)) {
            if (key.includes('What Actually Happened') && content && content.trim().length > 0) {
                const real = getRealContent(content);
                if (real) {
                    return real.length > 150 ? real.slice(0, 150) + '…' : real;
                }
            }
        }

        // Second: find first section with real content (not just template instructions)
        for (const content of Object.values(entry.sections)) {
            if (content && content.trim().length > 0) {
                const real = getRealContent(content);
                if (real) {
                    return real.length > 150 ? real.slice(0, 150) + '…' : real;
                }
            }
        }
    }

    // Cold-tier fallback: use firstSectionExcerpt (already processed)
    const excerpt = entry.firstSectionExcerpt ?? '';
    return excerpt.length > 150 ? excerpt.slice(0, 150) + '…' : excerpt;
}

export function EntryCard({ entry, detectedFields, sectionKey, onClick }: EntryCardProps): React.ReactElement {
    const isUnloading = useAppStore(s => s.isUnloading);

    // Track the loaded version of the entry (may have lazy-loaded sections)
    const [loadedEntry, setLoadedEntry] = useState<JournalEntry>(entry);

    // Lazy-load sections for cold-tier entries (same pattern as EchoCard)
    useEffect(() => {
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

    const excerpt = getExcerpt(loadedEntry, sectionKey);
    const tags = entry.frontmatter.tags as string[] | undefined;

    // Build badges for all detected numeric/boolean fields that have a value
    const badgeFields = detectedFields.filter(
        f => (f.type === 'number' || f.type === 'boolean') && entry.frontmatter[f.key] != null
    );

    return (
        <div
            className="hindsight-entry-card"
            data-entry-date={entry.date.getTime()}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <div className="hindsight-entry-card-date">{formatEntryDate(entry)}</div>

            <div className="hindsight-entry-card-badges">
                {badgeFields.map(f => (
                    <span key={f.key} className="hindsight-entry-card-badge">
                        {f.key}: {String(entry.frontmatter[f.key])}
                    </span>
                ))}
                <span className="hindsight-entry-card-badge">
                    quality: {entry.qualityScore}%
                </span>
                <span className="hindsight-entry-card-badge">
                    {entry.wordCount} words
                </span>
                {entry.imagePaths.length > 0 && (
                    <span className="hindsight-entry-card-badge">
                        {entry.imagePaths.length} image{entry.imagePaths.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {excerpt && (
                <p className="hindsight-entry-card-excerpt">{excerpt}</p>
            )}

            {tags && tags.length > 0 && (
                <div className="hindsight-entry-card-tags">
                    {tags.map((tag, i) => (
                        <span key={i} className="hindsight-entry-card-tag">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
