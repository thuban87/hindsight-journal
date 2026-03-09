/**
 * Sidebar App
 *
 * Root component for the sidebar view.
 * Contains tab switching between "Today" and "Echoes" panels.
 */

import React from 'react';
import { useUIStore } from '../store/uiStore';
import { TabSwitcher } from './shared/TabSwitcher';
import { TodayStatus } from './sidebar/TodayStatus';
import { EchoesPanel } from './echoes/EchoesPanel';

const SIDEBAR_TABS = [
    { id: 'today', label: 'Today' },
    { id: 'echoes', label: 'Echoes' },
];

export function SidebarApp(): React.ReactElement {
    const activeTab = useUIStore(state => state.activeSidebarTab);
    const setActiveTab = useUIStore(state => state.setActiveSidebarTab);

    return (
        <div className="hindsight-sidebar">
            <TabSwitcher
                tabs={SIDEBAR_TABS}
                activeTab={activeTab}
                onTabChange={(id: string) => setActiveTab(id as 'today' | 'echoes')}
            />
            <div className="hindsight-sidebar-content">
                {activeTab === 'today' && <TodayStatus />}
                {activeTab === 'echoes' && <EchoesPanel />}
            </div>
        </div>
    );
}
