/**
 * Section Reader Entry
 *
 * Renders a single entry's section content within the Section Reader feed.
 * Supports rich rendering via MarkdownRenderer.renderMarkdown() or
 * plain text via stripMarkdown().
 *
 * Features:
 * - Clickable date header → opens full note
 * - Cold-tier loading: skeleton → ensureSectionsLoaded → content
 * - Rich mode: MarkdownRenderer with Component lifecycle, 5s timeout, 50KB limit
 * - Simple mode: stripMarkdown output with HighlightText
 * - Collapse long sections (>500 words) with expand button
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Component as ObsidianComponent, MarkdownRenderer } from 'obsidian';
import type { JournalEntry } from '../../types/journal';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';
import { stripMarkdown, countWords } from '../../services/SectionParserService';
import { HighlightText } from '../shared/HighlightText';

/** Maximum content size for rich rendering (50KB) */
const MAX_RICH_RENDER_SIZE = 50 * 1024;
/** Word count threshold for collapsing */
const COLLAPSE_WORD_THRESHOLD = 500;
/** Render timeout in ms */
const RENDER_TIMEOUT_MS = 5000;

interface SectionReaderEntryProps {
    entry: JournalEntry;
    heading: string;
    simpleView: boolean;
    searchQuery: string;
}

/**
 * Format a date for display in the section reader header.
 */
function formatEntryDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function SectionReaderEntry({
    entry,
    heading,
    simpleView,
    searchQuery,
}: SectionReaderEntryProps): React.ReactElement {
    const app = useAppStore(s => s.app);

    // Local sections state for cold-tier lazy loading
    const [sections, setSections] = useState<Record<string, string> | null>(
        entry.sections && Object.keys(entry.sections).length > 0 ? entry.sections : null
    );
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [renderError, setRenderError] = useState<string | null>(null);
    const richContentRef = useRef<HTMLDivElement>(null);
    const componentRef = useRef<ObsidianComponent | null>(null);

    // Cold-tier loading
    useEffect(() => {
        if (sections) return;
        let cancelled = false;

        void useJournalStore.getState().ensureSectionsLoaded(entry.filePath).then(loaded => {
            if (!cancelled && loaded) {
                setSections(loaded.sections && Object.keys(loaded.sections).length > 0
                    ? loaded.sections
                    : {});
            }
        });

        return () => { cancelled = true; };
    }, [entry.filePath, entry.mtime, sections]);

    // Get section content
    const content = sections?.[heading] ?? null;
    const wordCount = content ? countWords(content) : 0;
    const shouldCollapse = wordCount > COLLAPSE_WORD_THRESHOLD;
    const isLargeContent = content ? content.length > MAX_RICH_RENDER_SIZE : false;

    // Determine what text to display
    const displayContent: string | null = (() => {
        if (!content) return null;
        if (shouldCollapse && isCollapsed) {
            // Show first ~500 words worth of content (rough char estimate)
            const words = content.split(/\s+/);
            return words.slice(0, COLLAPSE_WORD_THRESHOLD).join(' ') + '...';
        }
        return content;
    })();

    // Rich rendering via MarkdownRenderer
    useEffect(() => {
        if (simpleView || !displayContent || isLargeContent) return;
        const el = richContentRef.current;
        if (!el) return;
        if (!app) return;

        // sourcePath must be entry.filePath for correct link resolution (A14)
        if (!entry.filePath) {
            setRenderError('Missing file path — using simple view.');
            return;
        }

        setRenderError(null);

        const component = new ObsidianComponent();
        component.load();
        componentRef.current = component;

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        // 5s render timeout
        timeoutId = setTimeout(() => {
            if (!cancelled) {
                component.unload();
                if (el) {
                    // Clear with replaceChildren (NOT innerHTML)
                    el.replaceChildren();
                }
                setRenderError('Section rendering timed out — switch to simple view.');
            }
        }, RENDER_TIMEOUT_MS);

        void MarkdownRenderer.render(
            app,
            displayContent,
            el,
            entry.filePath,
            component
        ).then(() => {
            if (cancelled) {
                component.unload();
            }
            if (timeoutId) clearTimeout(timeoutId);
        }).catch(() => {
            if (!cancelled) {
                setRenderError('Rendering failed — switch to simple view.');
            }
            if (timeoutId) clearTimeout(timeoutId);
        });

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
            component.unload();
            componentRef.current = null;
        };
    }, [displayContent, simpleView, isLargeContent, app, entry.filePath]);

    // Open the full note
    const handleDateClick = useCallback(() => {
        if (!app) return;
        void app.workspace.openLinkText(entry.filePath, '', false);
    }, [app, entry.filePath]);

    // Skeleton while loading cold entry
    if (!sections) {
        return (
            <div className="hindsight-section-reader-entry">
                <div
                    className="hindsight-section-reader-date"
                    role="button"
                    tabIndex={0}
                    onClick={handleDateClick}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDateClick(); }}
                >
                    {formatEntryDate(entry.date)}
                </div>
                <div className="hindsight-section-reader-skeleton">
                    <div className="hindsight-section-reader-skeleton-line" />
                    <div className="hindsight-section-reader-skeleton-line" />
                    <div className="hindsight-section-reader-skeleton-line hindsight-section-reader-skeleton-short" />
                </div>
            </div>
        );
    }

    // No content for this heading
    if (!content) {
        return (
            <div className="hindsight-section-reader-entry">
                <div
                    className="hindsight-section-reader-date"
                    role="button"
                    tabIndex={0}
                    onClick={handleDateClick}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDateClick(); }}
                >
                    {formatEntryDate(entry.date)}
                </div>
                <div className="hindsight-section-reader-empty">
                    No content for this section.
                </div>
            </div>
        );
    }

    // Decide rendering mode
    const useSimple = simpleView || isLargeContent || renderError;

    return (
        <div className="hindsight-section-reader-entry">
            <div
                className="hindsight-section-reader-date"
                role="button"
                tabIndex={0}
                onClick={handleDateClick}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDateClick(); }}
            >
                {formatEntryDate(entry.date)}
            </div>

            {renderError && (
                <div className="hindsight-section-reader-notice">{renderError}</div>
            )}

            {isLargeContent && !simpleView && (
                <div className="hindsight-section-reader-notice">
                    Section too large for rich rendering.
                </div>
            )}

            {useSimple ? (
                <div className="hindsight-section-reader-content-simple">
                    {searchQuery ? (
                        <HighlightText
                            text={stripMarkdown(displayContent ?? '')}
                            query={searchQuery}
                        />
                    ) : (
                        stripMarkdown(displayContent ?? '')
                    )}
                </div>
            ) : (
                <div
                    ref={richContentRef}
                    className="hindsight-section-reader-content-rich"
                />
            )}

            {shouldCollapse && (
                <button
                    className="hindsight-section-reader-collapse-btn"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? 'Show full section' : 'Collapse'}
                </button>
            )}
        </div>
    );
}
