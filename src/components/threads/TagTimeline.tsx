/**
 * Tag Timeline
 *
 * Entries for a specific tag, sorted chronologically with pagination.
 * Shows tag-specific metric averages at the top, then paginated EntryCard list.
 */

import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { EntryCard } from '../timeline/EntryCard';
import * as ThreadsService from '../../services/ThreadsService';
import { isNumericField } from '../../services/FrontmatterService';
import type { FrontmatterField } from '../../types';

/** Number of entries per page */
const PAGE_SIZE = 10;

interface TagTimelineProps {
    /** Tag to display timeline for */
    tag: string;
    /** Metric field for average display */
    metricField: string;
    /** All numeric fields for the metric picker */
    numericFields: FrontmatterField[];
    /** Callback when metric changes */
    onMetricChange: (field: string) => void;
}

export function TagTimeline({
    tag,
    metricField,
    numericFields,
    onMetricChange,
}: TagTimelineProps): React.ReactElement {
    const app = useAppStore(s => s.app);
    const { entries, detectedFields } = useJournalEntries();
    const [page, setPage] = useState(0);

    // Reset to page 0 when tag changes
    const prevTag = React.useRef(tag);
    if (prevTag.current !== tag) {
        prevTag.current = tag;
        setPage(0);
    }

    const entryArray = useMemo(
        () => Array.from(entries.values()),
        [entries]
    );

    const timelineEntries = useMemo(
        () => ThreadsService.getTagTimeline(entryArray, tag),
        [entryArray, tag]
    );

    // Get metric averages for this tag
    const metricAverage = useMemo(() => {
        if (!metricField) return null;
        const averages = ThreadsService.getMetricAveragesByTag(entryArray, metricField);
        return averages.find(a => a.tag === tag.trim().toLowerCase()) ?? null;
    }, [entryArray, metricField, tag]);

    const handleEntryClick = React.useCallback(
        (filePath: string) => {
            if (!app) return;
            void app.workspace.openLinkText(filePath, '');
        },
        [app]
    );

    // Pagination
    const totalPages = Math.ceil(timelineEntries.length / PAGE_SIZE);
    const paginatedEntries = timelineEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const displayFields = useMemo(
        () => detectedFields.filter(f => isNumericField(f) || f.type === 'boolean'),
        [detectedFields]
    );

    if (timelineEntries.length === 0) {
        return <p className="hindsight-tag-timeline-empty">No entries found with tag "{tag}".</p>;
    }

    return (
        <div className="hindsight-tag-timeline">
            <div className="hindsight-tag-timeline-header">
                <span>{timelineEntries.length} entries tagged "{tag}"</span>
                {numericFields.length > 0 && (
                    <span className="hindsight-tag-metric-avg">
                        <label htmlFor="hindsight-tag-metric-select">Show avg:</label>
                        <select
                            id="hindsight-tag-metric-select"
                            value={metricField}
                            onChange={e => onMetricChange(e.target.value)}
                            aria-label="Select metric for tag averages"
                        >
                            {numericFields.map(f => (
                                <option key={f.key} value={f.key}>{f.key}</option>
                            ))}
                        </select>
                        {metricAverage && (
                            <span> = {metricAverage.average} ({metricAverage.count} entries)</span>
                        )}
                    </span>
                )}
            </div>

            {paginatedEntries.map(entry => (
                <EntryCard
                    key={entry.filePath}
                    entry={entry}
                    detectedFields={displayFields}
                    sectionKey={null}
                    onClick={() => handleEntryClick(entry.filePath)}
                />
            ))}

            {/* Pagination controls */}
            {totalPages > 1 && (
                <div className="hindsight-tag-timeline-pagination">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        aria-label="Previous page"
                    >
                        ← Previous
                    </button>
                    <span className="hindsight-tag-timeline-page">
                        Page {page + 1} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        aria-label="Next page"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
