/**
 * Main App
 *
 * Root component for the full-page Hindsight view.
 * Two-tier tab group navigation:
 *   Journal  → Calendar | Timeline | Index
 *   Insights → Charts   | Pulse    | Digest
 *   Explore  → Lens     | Threads  | Gallery
 */

import React from 'react';
import { useUIStore } from '../store/uiStore';
import type { TabGroup as TabGroupType, SubTab } from '../store/uiStore';
import { useJournalStore } from '../store/journalStore';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { CalendarNav } from './calendar/CalendarNav';
import { CalendarGrid } from './calendar/CalendarGrid';
import { TimelineList } from './timeline/TimelineList';
import { JournalIndex } from './index-table/JournalIndex';
import { ChartsPanel } from './charts/ChartsPanel';
import { PulsePanel } from './pulse/PulsePanel';
import { TabGroup } from './shared/TabGroup';
import { EmptyState } from './shared/EmptyState';
import { TaskVolatility } from './dashboard/TaskVolatility';
import { FrontmatterDash } from './dashboard/FrontmatterDash';
import { LensPanel } from './lens/LensPanel';
import { ThreadsPanel } from './threads/ThreadsPanel';
import { GalleryView } from './gallery/GalleryView';
import { DigestPanel } from './digest/DigestPanel';
import { useAppStore } from '../store/appStore';

/** Tab group definitions for the two-tier navigation */
const TAB_GROUPS = [
    {
        id: 'journal',
        label: 'Journal',
        tabs: [
            { id: 'calendar', label: 'Calendar' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'index', label: 'Index' },
        ],
    },
    {
        id: 'insights',
        label: 'Insights',
        tabs: [
            { id: 'charts', label: 'Charts' },
            { id: 'pulse', label: 'Pulse' },
            { id: 'digest', label: 'Digest' },
        ],
    },
    {
        id: 'explore',
        label: 'Explore',
        tabs: [
            { id: 'lens', label: 'Lens' },
            { id: 'threads', label: 'Threads' },
            { id: 'gallery', label: 'Gallery' },
        ],
    },
];

export function MainApp(): React.ReactElement {
    const activeGroup = useUIStore(state => state.activeGroup);
    const activeSubTab = useUIStore(state => state.activeSubTab);
    const setActiveGroup = useUIStore(state => state.setActiveGroup);
    const setActiveSubTab = useUIStore(state => state.setActiveSubTab);
    const loading = useJournalStore(state => state.loading);

    if (loading) {
        return <div className="hindsight-main-loading">Loading journal entries...</div>;
    }

    return (
        <div className="hindsight-main-container">
            <TabGroup
                groups={TAB_GROUPS}
                activeGroup={activeGroup}
                activeTab={activeSubTab}
                onGroupChange={(id) => setActiveGroup(id as TabGroupType)}
                onTabChange={(id) => setActiveSubTab(id as SubTab)}
            />
            <div className="hindsight-main-content" role="tabpanel">
                <MainContent activeTab={activeSubTab} />
            </div>
        </div>
    );
}

/**
 * Renders content for the active sub-tab.
 * Extracted as a separate component so CalendarView can use hooks.
 */
function MainContent({ activeTab }: { activeTab: string }): React.ReactElement {
    switch (activeTab) {
        case 'calendar':
            return <CalendarContent />;
        case 'timeline':
            return <TimelineList />;
        case 'index':
            return <JournalIndex />;
        case 'charts':
            return <ChartsPanel />;
        case 'pulse':
            return <PulsePanel />;
        case 'digest':
            return <DigestContent />;
        case 'lens':
            return <LensPanel />;
        case 'threads':
            return <ThreadsPanel />;
        case 'gallery':
            return <GalleryView />;
        default:
            return <CalendarContent />;
    }
}

/**
 * Calendar content wrapper — composes CalendarNav + CalendarGrid inline
 * (no standalone CalendarView component exists).
 */
function CalendarContent(): React.ReactElement {
    const app = useAppStore(s => s.app);
    const { entries, detectedFields } = useJournalEntries();
    const calendarMonth = useUIStore(state => state.calendarMonth);
    const calendarYear = useUIStore(state => state.calendarYear);
    const selectedMetric = useUIStore(state => state.selectedMetric);

    const handleDayClick = React.useCallback(
        (date: Date) => {
            if (!app) return;
            // Find entry for this date
            for (const entry of entries.values()) {
                if (
                    entry.date.getFullYear() === date.getFullYear() &&
                    entry.date.getMonth() === date.getMonth() &&
                    entry.date.getDate() === date.getDate()
                ) {
                    void app.workspace.openLinkText(entry.filePath, '');
                    return;
                }
            }
        },
        [app, entries]
    );

    return (
        <div className="hindsight-calendar-container" tabIndex={0}>
            <CalendarNav detectedFields={detectedFields} />
            <CalendarGrid
                year={calendarYear}
                month={calendarMonth}
                entries={entries}
                selectedMetric={selectedMetric}
                onDayClick={handleDayClick}
            />
        </div>
    );
}

/**
 * Digest content wrapper — composes TaskVolatility + FrontmatterDash.
 */
function DigestContent(): React.ReactElement {
    const { entries, detectedFields } = useJournalEntries();
    const entryArray = React.useMemo(
        () => Array.from(entries.values()),
        [entries]
    );

    return (
        <div className="hindsight-digest-container">
            <DigestPanel />
            <TaskVolatility />
            <FrontmatterDash entries={entryArray} fields={detectedFields} />
        </div>
    );
}

