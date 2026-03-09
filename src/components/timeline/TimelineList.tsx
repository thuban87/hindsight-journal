/**
 * Timeline List
 *
 * Paginated entry card feed for the Timeline tab.
 * Shows ENTRIES_PER_PAGE entries at a time with a "Load more" button.
 * Supports sort toggle (newest/oldest first) and section selector
 * for choosing which section excerpt to display on cards.
 * Uses VirtualList for scroll performance with 700+ entries.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { useUIStore } from '../../store/uiStore';
import { VirtualList } from '../shared/VirtualList';
import { EntryCard } from './EntryCard';
import { EmptyState } from '../shared/EmptyState';

const ENTRIES_PER_PAGE = 50;

export function TimelineList(): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    const detectedFields = useJournalStore(state => state.detectedFields);

    const timelineSectionKey = useUIStore(state => state.timelineSectionKey);
    const setTimelineSectionKey = useUIStore(state => state.setTimelineSectionKey);
    const timelineScrollToDate = useUIStore(state => state.timelineScrollToDate);
    const setTimelineScrollToDate = useUIStore(state => state.setTimelineScrollToDate);

    const [sortNewest, setSortNewest] = useState(true);
    const [visibleCount, setVisibleCount] = useState(ENTRIES_PER_PAGE);
    const scrollTargetRef = useRef<Date | null>(null);

    // Handle scroll-to-date from calendar context menu
    useEffect(() => {
        if (!timelineScrollToDate) return;

        // Store the target date before clearing
        scrollTargetRef.current = timelineScrollToDate;

        // Ensure newest-first sorting so dates are predictable
        setSortNewest(true);

        // Find the entry index in the sorted list
        const targetTime = timelineScrollToDate.getTime();
        const idx = allEntries.findIndex(e => {
            const d = e.date;
            return d.getFullYear() === timelineScrollToDate.getFullYear() &&
                d.getMonth() === timelineScrollToDate.getMonth() &&
                d.getDate() === timelineScrollToDate.getDate();
        });

        if (idx >= 0) {
            // Ensure the entry is within the visible range
            if (idx >= visibleCount) {
                setVisibleCount(idx + ENTRIES_PER_PAGE);
            }

            // Scroll to the entry after a brief delay to let the DOM render
            setTimeout(() => {
                const entryEl = document.querySelector(
                    `[data-entry-date="${targetTime}"]`
                );
                if (entryEl) {
                    entryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    entryEl.classList.add('hindsight-entry-highlight');
                    // Remove highlight after animation
                    setTimeout(() => {
                        entryEl.classList.remove('hindsight-entry-highlight');
                    }, 2000);
                }
            }, 100);
        }

        // Clear the scroll target after handling
        setTimelineScrollToDate(null);
    }, [timelineScrollToDate, allEntries, visibleCount, setTimelineScrollToDate]);

    if (!app) return null;

    /** Collect unique section headings from entries with loaded sections */
    const sectionHeadings = useMemo(() => {
        const headings = new Set<string>();
        for (const entry of allEntries) {
            for (const key of Object.keys(entry.sections)) {
                headings.add(key);
            }
        }
        return Array.from(headings).sort();
    }, [allEntries]);

    /** Sorted entries — getAllEntriesSorted returns newest-first, reverse for oldest-first */
    const sortedEntries = useMemo(() => {
        return sortNewest ? allEntries : [...allEntries].reverse();
    }, [allEntries, sortNewest]);

    /** Paginated slice */
    const visibleEntries = useMemo(() => {
        return sortedEntries.slice(0, visibleCount);
    }, [sortedEntries, visibleCount]);

    const hasMore = visibleCount < sortedEntries.length;

    if (allEntries.length === 0) {
        return <EmptyState message="No journal entries found" icon="📜" />;
    }

    return (
        <div className="hindsight-timeline">
            <div className="hindsight-timeline-controls">
                <button
                    className="hindsight-sort-toggle"
                    onClick={() => {
                        setSortNewest(prev => !prev);
                        setVisibleCount(ENTRIES_PER_PAGE);
                    }}
                >
                    {sortNewest ? '↓ Newest first' : '↑ Oldest first'}
                </button>

                <div className="hindsight-timeline-section-control">
                    <label
                        className="hindsight-timeline-section-label"
                        htmlFor="timeline-section-select"
                    >
                        Section
                    </label>
                    <select
                        id="timeline-section-select"
                        className="hindsight-timeline-section-select"
                        value={timelineSectionKey ?? '__auto__'}
                        onChange={(e) => {
                            const val = e.target.value;
                            setTimelineSectionKey(val === '__auto__' ? null : val);
                        }}
                    >
                        <option value="__auto__">Auto (best available)</option>
                        {sectionHeadings.map(heading => (
                            <option key={heading} value={heading}>{heading}</option>
                        ))}
                    </select>
                </div>
            </div>

            <VirtualList
                items={visibleEntries}
                estimatedItemHeight={140}
                overscan={10}
                renderItem={(entry, _index) => (
                    <EntryCard
                        key={entry.filePath}
                        entry={entry}
                        detectedFields={detectedFields}
                        sectionKey={timelineSectionKey}
                        onClick={() => {
                            void app.workspace.openLinkText(entry.filePath, '', false);
                        }}
                    />
                )}
            />

            {hasMore && (
                <div className="hindsight-load-more-container">
                    <button
                        className="hindsight-load-more-btn"
                        onClick={() => setVisibleCount(prev => prev + ENTRIES_PER_PAGE)}
                    >
                        Load more ({sortedEntries.length - visibleCount} remaining)
                    </button>
                </div>
            )}
        </div>
    );
}
