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

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { stripMarkdown } from '../../services/SectionParserService';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getPolarityColor } from '../../utils/statsUtils';
import { isNumericField, getNumericValue } from '../../services/FrontmatterService';
import { Thumbnail } from '../shared/Thumbnail';
import { AnnotationMarker } from '../annotations/AnnotationMarker';
import { AnnotationInput } from '../annotations/AnnotationInput';

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

/**
 * Badge with optional polarity-based background color.
 * Uses ref-based CSS variable to avoid inline style={{}} (per inline style policy).
 */
function BadgeSpan({ color, children }: { color?: string; children: React.ReactNode }): React.ReactElement {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (ref.current && color) {
            ref.current.style.setProperty('--hindsight-badge-bg', color);
        } else if (ref.current) {
            ref.current.style.removeProperty('--hindsight-badge-bg');
        }
    }, [color]);
    return (
        <span ref={ref} className={`hindsight-entry-card-badge${color ? ' has-polarity-color' : ''}`}>
            {children}
        </span>
    );
}

export function EntryCard({ entry, detectedFields, sectionKey, onClick }: EntryCardProps): React.ReactElement {
    const isUnloading = useAppStore(s => s.isUnloading);
    const fieldPolarity = useSettingsStore(s => s.settings.fieldPolarity);
    const thumbnailsEnabled = useSettingsStore(s => s.settings.thumbnailsEnabled);
    const plugin = useAppStore(s => s.plugin);

    // Track the loaded version of the entry (may have lazy-loaded sections)
    const [loadedEntry, setLoadedEntry] = useState<JournalEntry>(entry);

    // Load annotations for this entry
    const [annotations, setAnnotations] = useState<string[]>([]);
    useEffect(() => {
        const annotationService = plugin?.services.annotationService;
        if (!annotationService) return;

        let cancelled = false;
        void annotationService.getAnnotations(entry.filePath).then(anns => {
            if (!cancelled) setAnnotations(anns);
        });
        return () => { cancelled = true; };
    }, [plugin, entry.filePath]);

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
        f => (isNumericField(f) || f.type === 'boolean') && entry.frontmatter[f.key] != null
    );

    // Annotation expand/collapse
    const [showAnnotations, setShowAnnotations] = useState(false);
    const toggleAnnotations = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Don't open the note
        setShowAnnotations(prev => !prev);
        // Refresh annotations when opening
        if (!showAnnotations && plugin?.services.annotationService) {
            void plugin.services.annotationService.getAnnotations(entry.filePath).then(anns => {
                setAnnotations(anns);
            });
        }
    }, [showAnnotations, plugin, entry.filePath]);

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
                {badgeFields.map(f => {
                    const val = entry.frontmatter[f.key];
                    let badgeColor: string | undefined;
                    const numVal = getNumericValue(val);
                    if (isNumericField(f) && numVal !== null) {
                        const polarity = fieldPolarity[f.key] ?? 'neutral';
                        badgeColor = getPolarityColor(numVal, f.range?.min ?? 0, f.range?.max ?? 10, polarity);
                    }
                    return (
                        <BadgeSpan key={f.key} color={badgeColor}>
                            {f.key}: {String(val)}
                        </BadgeSpan>
                    );
                })}
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
                {annotations.length > 0 && (
                    <AnnotationMarker annotations={annotations} compact />
                )}
                <button
                    className="hindsight-entry-card-annotate-btn"
                    onClick={toggleAnnotations}
                    aria-label={showAnnotations ? 'Hide annotations' : 'Add annotation'}
                    aria-expanded={showAnnotations}
                    title={showAnnotations ? 'Hide annotations' : 'Annotate this entry'}
                >
                    📌
                </button>
            </div>

            {(excerpt || (thumbnailsEnabled && entry.imagePaths.length > 0)) && (
                <div className="hindsight-entry-card-body">
                    {excerpt && (
                        <p className="hindsight-entry-card-excerpt">{excerpt}</p>
                    )}
                    {thumbnailsEnabled && entry.imagePaths.length > 0 && (
                        <div className="hindsight-entry-thumbnail">
                            <Thumbnail
                                imagePath={entry.imagePaths[0]}
                                sourceFilePath={entry.filePath}
                                mtime={entry.mtime}
                                size={90}
                            />
                        </div>
                    )}
                </div>
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

            {showAnnotations && (
                <div
                    className="hindsight-entry-card-annotation-section"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="region"
                    aria-label="Annotations"
                >
                    <AnnotationInput filePath={entry.filePath} />
                </div>
            )}
        </div>
    );
}
