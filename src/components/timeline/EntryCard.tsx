/**
 * Entry Card
 *
 * Entry summary card for the timeline feed.
 * Shows date, mood/energy badges, quality score, word count,
 * tags, excerpt, and image count. Clicking opens the note.
 */

import React from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { stripMarkdown } from '../../services/SectionParserService';

interface EntryCardProps {
    entry: JournalEntry;
    detectedFields: FrontmatterField[];
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
 * Get excerpt text — stripMarkdown first, then truncate.
 * Prefers "What Actually Happened", falls back to first non-empty section.
 */
function getExcerpt(entry: JournalEntry): string {
    const preferred = entry.sections['What Actually Happened'];
    let raw = '';
    if (preferred && preferred.trim().length > 0) {
        raw = preferred;
    } else {
        for (const content of Object.values(entry.sections)) {
            if (content && content.trim().length > 0) {
                raw = content;
                break;
            }
        }
    }
    if (!raw) return '';
    const clean = stripMarkdown(raw);
    return clean.length > 150 ? clean.slice(0, 150) + '…' : clean;
}

export function EntryCard({ entry, detectedFields, onClick }: EntryCardProps): React.ReactElement {
    const excerpt = getExcerpt(entry);
    const tags = entry.frontmatter.tags as string[] | undefined;

    // Build badges for all detected numeric/boolean fields that have a value
    const badgeFields = detectedFields.filter(
        f => (f.type === 'number' || f.type === 'boolean') && entry.frontmatter[f.key] != null
    );

    return (
        <div
            className="hindsight-entry-card"
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
