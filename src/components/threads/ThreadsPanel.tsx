/**
 * Threads Panel
 *
 * Layout container for the Threads sub-tab (Explore → Threads).
 * Renders sections: Tag Frequency, Tag Timeline (when selected), Tag Co-Occurrence, Section Trends.
 * Uses collapsible sections for organization (same pattern as PulsePanel).
 */

import React, { useMemo, useState } from 'react';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { EmptyState } from '../shared/EmptyState';
import { TagFrequencyChart } from './TagFrequencyChart';
import { TagCoOccurrence } from './TagCoOccurrence';
import { TagTimeline } from './TagTimeline';
import { SectionTrends } from './SectionTrends';
import * as ThreadsService from '../../services/ThreadsService';
import { isNumericField } from '../../services/FrontmatterService';

/** Collapsible section component (same pattern as PulsePanel) */
function CollapsibleSection({
    title,
    defaultOpen = true,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}): React.ReactElement {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="hindsight-threads-section">
            <button
                className="hindsight-threads-section-header"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
            >
                <span className={`hindsight-threads-section-arrow${open ? '' : ' collapsed'}`}>
                    ▼
                </span>
                {title}
            </button>
            <div className={`hindsight-threads-section-content${open ? '' : ' collapsed'}`}>
                {children}
            </div>
        </div>
    );
}

export function ThreadsPanel(): React.ReactElement {
    const { entries, detectedFields } = useJournalEntries();
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<string>('');

    const entryArray = useMemo(
        () => Array.from(entries.values()),
        [entries]
    );

    // Compute tag data
    const tagFrequency = useMemo(
        () => ThreadsService.getTagFrequency(entryArray),
        [entryArray]
    );

    const tagCoOccurrence = useMemo(
        () => ThreadsService.getTagCoOccurrence(entryArray),
        [entryArray]
    );

    // Get numeric fields for metric selector
    const numericFields = useMemo(
        () => detectedFields.filter(f => isNumericField(f)),
        [detectedFields]
    );

    // Default to first numeric field if none selected
    const activeMetric = selectedMetric || numericFields[0]?.key || '';

    if (detectedFields.length === 0) {
        return <EmptyState message="No journal entries indexed yet. Check your journal folder in settings." />;
    }

    if (tagFrequency.length === 0) {
        return (
            <div className="hindsight-threads-panel">
                <EmptyState message="No tags found in journal entries. Add tags to your daily notes to see analytics here." />
                <CollapsibleSection title="Section trends" defaultOpen={true}>
                    <SectionTrends entries={entryArray} />
                </CollapsibleSection>
            </div>
        );
    }

    return (
        <div className="hindsight-threads-panel">
            {/* Tag Frequency Chart */}
            <CollapsibleSection title="Tag frequency">
                <p className="hindsight-section-trends-description">
                    Click a tag bar to see its timeline below.
                </p>
                <TagFrequencyChart
                    data={tagFrequency}
                    onTagClick={tag => setSelectedTag(tag)}
                />
            </CollapsibleSection>

            {/* Tag Timeline — immediately after frequency (when a tag is selected) */}
            {selectedTag && (
                <CollapsibleSection title={`Tag timeline: ${selectedTag}`}>
                    <button
                        className="hindsight-tag-clear-btn"
                        onClick={() => setSelectedTag(null)}
                        aria-label="Clear tag selection"
                    >
                        ✕ Clear selection
                    </button>
                    <TagTimeline
                        tag={selectedTag}
                        metricField={activeMetric}
                        numericFields={numericFields}
                        onMetricChange={setSelectedMetric}
                    />
                </CollapsibleSection>
            )}

            {/* Tag Co-Occurrence Matrix */}
            <CollapsibleSection title="Tag co-occurrence" defaultOpen={false}>
                <TagCoOccurrence
                    tagFrequency={tagFrequency}
                    coOccurrence={tagCoOccurrence}
                />
            </CollapsibleSection>

            {/* Section Trends */}
            <CollapsibleSection title="Section trends" defaultOpen={false}>
                <SectionTrends entries={entryArray} />
            </CollapsibleSection>
        </div>
    );
}
