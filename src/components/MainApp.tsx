/**
 * Main App
 *
 * Root component for the full-page view.
 * Tab router with Calendar, Timeline (stub), and Index (stub).
 * Entry count shown in tab labels per plan.
 */

import React from 'react';
import type { App } from 'obsidian';
import type HindsightPlugin from '../../main';
import { useUIStore } from '../store/uiStore';
import { useJournalStore } from '../store/journalStore';
import { TabSwitcher } from './shared/TabSwitcher';
import { EmptyState } from './shared/EmptyState';
import { CalendarNav } from './calendar/CalendarNav';
import { CalendarGrid } from './calendar/CalendarGrid';

interface MainAppProps {
    plugin: HindsightPlugin;
    app: App;
}

export function MainApp({ plugin, app }: MainAppProps): React.ReactElement {
    const activeTab = useUIStore(state => state.activeMainTab);
    const setActiveTab = useUIStore(state => state.setActiveMainTab);
    const calendarMonth = useUIStore(state => state.calendarMonth);
    const calendarYear = useUIStore(state => state.calendarYear);
    const selectedMetric = useUIStore(state => state.selectedMetric);

    const entries = useJournalStore(state => state.entries);
    const detectedFields = useJournalStore(state => state.detectedFields);

    const entryCount = entries.size;

    const tabs = [
        { id: 'calendar', label: 'Calendar' },
        { id: 'timeline', label: `Timeline (${entryCount})` },
        { id: 'index', label: `Index (${entryCount})` },
    ];

    const handleDayClick = (date: Date): void => {
        // Find entry for this date and open the note
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        for (const entry of entries.values()) {
            const entryDate = entry.date;
            const entryStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
            if (entryStr === dateStr) {
                void app.workspace.openLinkText(entry.filePath, '', false);
                return;
            }
        }
    };

    const renderActiveTab = (): React.ReactElement => {
        switch (activeTab) {
            case 'calendar':
                return (
                    <div className="hindsight-calendar-container" tabIndex={0}>
                        <CalendarNav
                            detectedFields={detectedFields}
                        />
                        <CalendarGrid
                            year={calendarYear}
                            month={calendarMonth}
                            entries={entries}
                            selectedMetric={selectedMetric}
                            onDayClick={handleDayClick}
                            app={app}
                        />
                    </div>
                );
            case 'timeline':
                return <EmptyState message="Timeline — coming soon" icon="📜" />;
            case 'index':
                return <EmptyState message="Index — coming soon" icon="📋" />;
            default:
                return <EmptyState message="Unknown tab" />;
        }
    };

    return (
        <div className="hindsight-main">
            <TabSwitcher
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id: string) => setActiveTab(id as 'calendar' | 'timeline' | 'index')}
            />
            <div className="hindsight-main-content">
                {renderActiveTab()}
            </div>
        </div>
    );
}
