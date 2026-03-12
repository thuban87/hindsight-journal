/**
 * Command Menu App
 *
 * React component rendered inside CommandMenuModal.
 * Displays a grid of command cards for quick access to all
 * Hindsight features. Uses Obsidian's setIcon() for icon rendering.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { setIcon } from 'obsidian';
import { useAppStore } from '../store/appStore';
import { SectionReaderModal } from '../modals/SectionReaderModal';
import { EntryWizardModal } from '../modals/EntryWizardModal';
import { WeeklyReviewModal } from '../modals/WeeklyReviewModal';

interface CommandMenuAppProps {
    onClose: () => void;
}

interface CommandItem {
    id: string;
    icon: string;
    label: string;
    description: string;
}

const COMMANDS: CommandItem[] = [
    {
        id: 'journal-view',
        icon: 'book-open',
        label: 'Journal view',
        description: 'Browse your timeline and entries',
    },
    {
        id: 'sidebar',
        icon: 'panel-right',
        label: 'Sidebar',
        description: "Today's summary and echoes",
    },
    {
        id: 'section-reader',
        icon: 'book-text',
        label: 'Section reader',
        description: 'Read sections across entries',
    },
    {
        id: 'guided-entry',
        icon: 'wand-2',
        label: 'Guided entry',
        description: 'Create a new journal entry',
    },
    {
        id: 'weekly-review',
        icon: 'calendar-check',
        label: 'Weekly review',
        description: 'Reflect on your past week',
    },
    {
        id: 'settings',
        icon: 'settings',
        label: 'Settings',
        description: 'Configure Hindsight',
    },
];

function CommandCard({
    item,
    onClick,
}: {
    item: CommandItem;
    onClick: () => void;
}): React.ReactElement {
    const iconRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (iconRef.current) {
            iconRef.current.empty();
            setIcon(iconRef.current, item.icon);
        }
    }, [item.icon]);

    return (
        <button
            className="hindsight-command-menu-card hindsight-touch-target"
            onClick={onClick}
            aria-label={item.label}
        >
            <div className="hindsight-command-menu-card-icon" ref={iconRef} />
            <div className="hindsight-command-menu-card-text">
                <span className="hindsight-command-menu-card-label">{item.label}</span>
                <span className="hindsight-command-menu-card-desc">{item.description}</span>
            </div>
        </button>
    );
}

export function CommandMenuApp({ onClose }: CommandMenuAppProps): React.ReactElement | null {
    const plugin = useAppStore(s => s.plugin);
    const app = useAppStore(s => s.app);

    const handleCommand = useCallback(
        (id: string) => {
            if (!plugin || !app) return;

            switch (id) {
                case 'journal-view':
                    void plugin.activateMainView();
                    break;
                case 'sidebar':
                    void plugin.activateSidebarView();
                    break;
                case 'section-reader':
                    new SectionReaderModal(app, plugin).open();
                    break;
                case 'guided-entry':
                    new EntryWizardModal(app, plugin).open();
                    break;
                case 'weekly-review':
                    new WeeklyReviewModal(app, plugin).open();
                    break;
                case 'settings': {
                    // Open plugin settings tab (app.setting is undocumented but stable)
                    const setting = (app as unknown as Record<string, unknown>).setting;
                    if (setting && typeof (setting as Record<string, unknown>).open === 'function') {
                        (setting as { open: () => void }).open();
                    }
                    // Navigate to the Hindsight tab
                    const settingObj = setting as { openTabById?: (id: string) => void } | undefined;
                    if (settingObj?.openTabById) {
                        settingObj.openTabById('hindsight-journal');
                    }
                    break;
                }
            }

            onClose();
        },
        [plugin, app, onClose]
    );

    if (!plugin || !app) return null;

    return (
        <div className="hindsight-command-menu">
            <h2 className="hindsight-command-menu-title">Hindsight</h2>
            <div className="hindsight-command-menu-grid">
                {COMMANDS.map(cmd => (
                    <CommandCard
                        key={cmd.id}
                        item={cmd}
                        onClick={() => handleCommand(cmd.id)}
                    />
                ))}
            </div>
        </div>
    );
}
