/**
 * Actionable Echo
 *
 * Enhanced echo card with metric comparison badges below the standard excerpt.
 * Shows field-by-field comparisons with today's values and encouraging context
 * when improvements are detected across multiple fields.
 */

import React from 'react';
import type { JournalEntry, FrontmatterField } from '../../types';
import { compareMetrics } from '../../services/EchoesService';
import { EchoCard } from './EchoCard';
import { MetricComparisonCard } from './MetricComparisonCard';

interface ActionableEchoProps {
    echoEntry: JournalEntry;
    todayEntry: JournalEntry | undefined;
    fields: FrontmatterField[];
    polarity: Record<string, string>;
    sectionKey: string | null;
    metricKey: string;
}

export function ActionableEcho({
    echoEntry,
    todayEntry,
    fields,
    polarity,
    sectionKey,
    metricKey,
}: ActionableEchoProps): React.ReactElement {
    const comparisons = compareMetrics(todayEntry, echoEntry, fields, polarity);

    const improvementCount = comparisons.filter(c => c.direction === 'improved').length;
    const hasMultipleImprovements = improvementCount >= 2;

    return (
        <div className="hindsight-actionable-echo">
            <EchoCard
                entry={echoEntry}
                sectionKey={sectionKey}
                metricKey={metricKey}
            />
            {comparisons.length > 0 && (
                <div className="hindsight-actionable-echo-comparisons">
                    {comparisons.map(c => (
                        <MetricComparisonCard key={c.field} comparison={c} />
                    ))}
                    {hasMultipleImprovements && (
                        <div className="hindsight-actionable-echo-encouragement">
                            Look how far you&apos;ve come! 🌟
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
