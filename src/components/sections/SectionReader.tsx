/**
 * Section Reader
 *
 * Composer component for the Section Reader — "read a book of just your dreams."
 * Composes SectionReaderToolbar + VirtualVariableList<SectionReaderEntry>.
 *
 * Handles:
 * - Mobile safeguard: >100 entries on mobile → default to simple view
 * - EmptyState when no headings detected
 * - Search footer display
 * - Fast-scroll → render queue sync (Phase 8c)
 */

import React, { useEffect, useRef } from 'react';
import { Platform, Notice } from 'obsidian';
import { useSectionReaderData } from '../../hooks/useSectionReaderData';
import { SectionReaderToolbar } from './SectionReaderToolbar';
import { SectionReaderEntry } from './SectionReaderEntry';
import { VirtualVariableList } from '../shared/VirtualVariableList';
import { EmptyState } from '../shared/EmptyState';
import { setRenderQueueFastScroll, resetRenderQueue } from '../../hooks/useRenderQueue';

/** Default estimated height for section entries in the virtual list */
const ESTIMATED_ENTRY_HEIGHT = 200;

export function SectionReader(): React.ReactElement {
    const {
        availableHeadings,
        selectedHeading,
        setSelectedHeading,
        dateRange,
        setDateRange,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        searchQuery,
        setSearchQuery,
        filteredEntries,
        isSearching,
        searchFooter,
        simpleView,
        setSimpleView,
        contextVersion,
    } = useSectionReaderData();

    // Track last fast-scroll state to sync with render queue
    const lastFastScrollRef = useRef(false);

    // Reset render queue on unmount
    useEffect(() => {
        return () => {
            resetRenderQueue();
        };
    }, []);

    // Mobile safeguard: >100 entries → default to simple view
    useEffect(() => {
        if (Platform.isMobile && filteredEntries.length > 100 && !simpleView) {
            setSimpleView(true);
            // eslint-disable-next-line no-new
            new Notice('Using simple view for performance. Toggle rich rendering in the header.');
        }
    }, [filteredEntries.length, simpleView, setSimpleView]);

    const overscan = Platform.isMobile ? 2 : 5;

    if (availableHeadings.length === 0) {
        return (
            <div className="hindsight-section-reader">
                <EmptyState
                    icon="search"
                    message="No journal entries indexed yet. Check your journal folder in settings."
                />
            </div>
        );
    }

    return (
        <div className="hindsight-section-reader">
            <SectionReaderToolbar
                availableHeadings={availableHeadings}
                selectedHeading={selectedHeading}
                onHeadingChange={setSelectedHeading}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                customStartDate={customStartDate}
                onCustomStartDateChange={setCustomStartDate}
                customEndDate={customEndDate}
                onCustomEndDateChange={setCustomEndDate}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                resultCount={filteredEntries.length}
                isSearching={isSearching}
                simpleView={simpleView}
                onSimpleViewChange={setSimpleView}
            />

            {filteredEntries.length === 0 ? (
                <EmptyState
                    icon="book-open"
                    message={searchQuery
                        ? 'No entries match your search.'
                        : 'No entries found for this section and date range.'
                    }
                />
            ) : (
                <VirtualVariableList
                    items={filteredEntries}
                    estimatedItemHeight={ESTIMATED_ENTRY_HEIGHT}
                    overscan={overscan}
                    contextVersion={contextVersion}
                    getKey={(index) => {
                        const entry = filteredEntries[index];
                        return `${entry.filePath}::${selectedHeading}::${entry.mtime}`;
                    }}
                    renderItem={(entry, _index, isFastScrolling) => {
                        // Sync fast-scroll state with render queue
                        if (isFastScrolling !== lastFastScrollRef.current) {
                            lastFastScrollRef.current = isFastScrolling;
                            setRenderQueueFastScroll(isFastScrolling);
                        }
                        return (
                            <SectionReaderEntry
                                entry={entry}
                                heading={selectedHeading}
                                simpleView={simpleView}
                                searchQuery={searchQuery}
                                isFastScrolling={isFastScrolling}
                            />
                        );
                    }}
                />
            )}

            {searchFooter && (
                <div className="hindsight-section-reader-footer">
                    {searchFooter}
                </div>
            )}
        </div>
    );
}
