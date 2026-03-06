/**
 * Tab Switcher
 *
 * Reusable tab bar component.
 * 44px minimum touch targets for mobile compatibility.
 */

import React from 'react';

interface Tab {
    id: string;
    label: string;
}

interface TabSwitcherProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
}

export function TabSwitcher({ tabs, activeTab, onTabChange }: TabSwitcherProps): React.ReactElement {
    return (
        <div className="hindsight-tab-bar" role="tablist">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    role="tab"
                    aria-selected={tab.id === activeTab}
                    className={`hindsight-tab ${tab.id === activeTab ? 'hindsight-tab-active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
