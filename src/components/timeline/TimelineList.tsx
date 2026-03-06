/**
 * Timeline List
 *
 * Paginated entry card feed for the Timeline tab.
 * Shows ENTRIES_PER_PAGE entries at a time with a "Load more" button.
 * Supports sort toggle (newest/oldest first).
 * Uses VirtualList for scroll performance with 700+ entries.
 */

import React, { useState, useMemo } from 'react';
import type { App } from 'obsidian';
import { useJournalStore } from '../../store/journalStore';
import { VirtualList } from '../shared/VirtualList';
import { EntryCard } from './EntryCard';
import { EmptyState } from '../shared/EmptyState';

const ENTRIES_PER_PAGE = 50;

interface TimelineListProps {
    app: App;
}

export function TimelineList({ app }: TimelineListProps): React.ReactElement {
    const allEntries = useJournalStore(state => state.getAllEntriesSorted());
    const detectedFields = useJournalStore(state => state.detectedFields);

    const [sortNewest, setSortNewest] = useState(true);
    const [visibleCount, setVisibleCount] = useState(ENTRIES_PER_PAGE);

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
