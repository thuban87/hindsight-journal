/**
 * Tab Group
 *
 * Two-tier tab navigation component for the main view.
 * Top bar: group buttons (Journal | Insights | Explore)
 * Secondary bar: sub-tab buttons for the active group
 *
 * ARIA: role="tablist" / role="tab" / aria-selected on both bars.
 * All buttons have 44px minimum touch targets.
 */

import React from 'react';

interface TabDef {
    id: string;
    label: string;
}

interface GroupDef {
    id: string;
    label: string;
    tabs: TabDef[];
}

interface TabGroupProps {
    groups: GroupDef[];
    activeGroup: string;
    activeTab: string;
    onGroupChange: (id: string) => void;
    onTabChange: (id: string) => void;
}

export function TabGroup({
    groups,
    activeGroup,
    activeTab,
    onGroupChange,
    onTabChange,
}: TabGroupProps): React.ReactElement {
    const currentGroup = groups.find(g => g.id === activeGroup);
    const subTabs = currentGroup?.tabs ?? [];

    return (
        <div className="hindsight-tab-group-container">
            {/* Top bar: group switcher */}
            <div className="hindsight-tab-group-bar" role="tablist" aria-label="View groups">
                {groups.map(group => (
                    <button
                        key={group.id}
                        role="tab"
                        aria-selected={group.id === activeGroup}
                        className={`hindsight-tab-group ${group.id === activeGroup ? 'hindsight-tab-group-active' : ''}`}
                        onClick={() => onGroupChange(group.id)}
                    >
                        {group.label}
                    </button>
                ))}
            </div>

            {/* Secondary bar: sub-tabs for active group */}
            <div className="hindsight-tab-sub-bar" role="tablist" aria-label={`${currentGroup?.label ?? ''} tabs`}>
                {subTabs.map(tab => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={tab.id === activeTab}
                        className={`hindsight-tab-sub ${tab.id === activeTab ? 'hindsight-tab-sub-active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
