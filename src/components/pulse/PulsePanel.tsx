/**
 * Pulse Panel
 *
 * Layout container for the Pulse sub-tab (Insights → Pulse).
 * Renders sections: StatsCards, Heatmap, PersonalBests, ConsistencyScore, HabitStreaksGrid.
 * Each section is collapsible with a header.
 */

import React from 'react';
import { useJournalStore } from '../../store/journalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { StatsCards } from './StatsCards';
import { PersonalBests } from './PersonalBests';
import { ConsistencyScore } from './ConsistencyScore';
import { Heatmap } from '../charts/Heatmap';
import { HabitStreaksGrid } from '../charts/HabitStreaksGrid';
import { QualityDashboard } from './QualityDashboard';
import { EmptyState } from '../shared/EmptyState';
import { isNumericField } from '../../services/FrontmatterService';

interface CollapsibleSectionProps {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps): React.ReactElement {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
        <div className="hindsight-pulse-section">
            <button
                className="hindsight-pulse-section-header"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
            >
                <span className={`hindsight-pulse-section-arrow${open ? '' : ' collapsed'}`}>
                    ▼
                </span>
                {title}
            </button>
            <div className={`hindsight-pulse-section-content${open ? '' : ' collapsed'}`}>
                {children}
            </div>
        </div>
    );
}

export function PulsePanel(): React.ReactElement {
    const { entries, detectedFields } = useJournalEntries();
    const fieldPolarity = useSettingsStore(s => s.settings.fieldPolarity);

    const entryArray = React.useMemo(
        () => Array.from(entries.values()),
        [entries]
    );

    if (detectedFields.length === 0) {
        return <EmptyState message="No journal entries indexed yet. Check your journal folder in settings." />;
    }

    // Fields eligible for heatmap display (numeric + boolean)
    const heatmapFields = React.useMemo(
        () => detectedFields.filter(f => isNumericField(f) || f.type === 'boolean'),
        [detectedFields]
    );

    // Selected heatmap field — default to first numeric, then first boolean
    const [selectedHeatmapField, setSelectedHeatmapField] = React.useState(() => {
        const firstNumeric = heatmapFields.find(f => isNumericField(f));
        return firstNumeric?.key ?? heatmapFields[0]?.key ?? '';
    });

    // Ensure selected field still exists after re-indexing
    const activeHeatmapField = heatmapFields.find(f => f.key === selectedHeatmapField)
        ? selectedHeatmapField
        : (heatmapFields[0]?.key ?? '');

    const heatmapPolarity = activeHeatmapField
        ? (fieldPolarity[activeHeatmapField] ?? 'higher-is-better')
        : 'neutral';

    // Find boolean fields for habit grid
    const booleanFields = detectedFields.filter(f => f.type === 'boolean');

    const referenceDate = React.useMemo(() => new Date(), []);

    return (
        <div className="hindsight-pulse-panel">
            <CollapsibleSection title="Overview">
                <StatsCards entries={entryArray} fields={detectedFields} />
            </CollapsibleSection>

            {heatmapFields.length > 0 && (
                <CollapsibleSection title="Heatmap">
                    <div className="hindsight-heatmap-controls">
                        <select
                            className="hindsight-heatmap-field-select"
                            value={activeHeatmapField}
                            onChange={e => setSelectedHeatmapField(e.target.value)}
                            aria-label="Select field for heatmap"
                        >
                            {heatmapFields.map(f => (
                                <option key={f.key} value={f.key}>
                                    {f.key} ({f.type})
                                </option>
                            ))}
                        </select>
                    </div>
                    <Heatmap
                        fieldKey={activeHeatmapField}
                        polarity={heatmapPolarity}
                    />
                </CollapsibleSection>
            )}

            <CollapsibleSection title="Personal bests">
                <PersonalBests />
            </CollapsibleSection>

            <CollapsibleSection title="Consistency">
                <ConsistencyScore entries={entryArray} referenceDate={referenceDate} />
            </CollapsibleSection>

            {booleanFields.length > 0 && (
                <CollapsibleSection title="Habit streaks">
                    <HabitStreaksGrid booleanFields={booleanFields} />
                </CollapsibleSection>
            )}

            <CollapsibleSection title="Entry quality">
                <QualityDashboard entries={entryArray} />
            </CollapsibleSection>
        </div>
    );
}
