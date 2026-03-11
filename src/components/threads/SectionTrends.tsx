/**
 * Section Trends
 *
 * Section word count trend sparklines and usage insights.
 * Uses existing Sparkline component for visualization.
 * Data from ThreadsService.getSectionWordCounts() and getSectionInsights().
 */

import React, { useMemo } from 'react';
import { Sparkline } from '../charts/Sparkline';
import * as ThreadsService from '../../services/ThreadsService';
import type { JournalEntry } from '../../types';

interface SectionTrendsProps {
    /** All journal entries */
    entries: JournalEntry[];
}

/** Icon for insight type */
function getInsightIcon(type: 'growth' | 'decline' | 'inactive'): string {
    switch (type) {
        case 'growth': return '📈';
        case 'decline': return '📉';
        case 'inactive': return '💤';
    }
}

export function SectionTrends({ entries }: SectionTrendsProps): React.ReactElement {
    const referenceDate = useMemo(() => new Date(), []);

    const wordCounts = useMemo(
        () => ThreadsService.getSectionWordCounts(entries),
        [entries]
    );

    const insights = useMemo(
        () => ThreadsService.getSectionInsights(entries, referenceDate),
        [entries, referenceDate]
    );

    if (wordCounts.length === 0 && insights.length === 0) {
        return <p className="hindsight-tag-timeline-empty">No section data available.</p>;
    }

    return (
        <div className="hindsight-section-trends">
            <p className="hindsight-section-trends-description">
                Word count trends across your journal sections — see how your writing habits evolve over time.
            </p>

            {/* Sparklines per section */}
            {wordCounts.map(section => {
                const values = section.data.map(d => d.value);
                return (
                    <div key={section.section} className="hindsight-section-trend-row">
                        <span className="hindsight-section-trend-label" title={section.section}>
                            {section.section}
                        </span>
                        <div className="hindsight-section-trend-sparkline">
                            <Sparkline
                                data={values}
                                width={160}
                                height={28}
                                fieldName={`${section.section} word count`}
                            />
                        </div>
                    </div>
                );
            })}

            {/* Section insights */}
            {insights.length > 0 && (
                <div className="hindsight-section-insights">
                    {insights.map(insight => (
                        <div
                            key={insight.section}
                            className={`hindsight-section-insight ${insight.type}`}
                        >
                            <span className="hindsight-section-insight-icon">
                                {getInsightIcon(insight.type)}
                            </span>
                            <span className="hindsight-section-insight-text">
                                {insight.insight}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
