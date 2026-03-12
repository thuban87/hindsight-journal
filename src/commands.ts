/**
 * Commands
 *
 * All plugin commands are registered here.
 * main.ts calls registerCommands(this) in onload().
 */

import type HindsightPlugin from '../main';
import { SectionReaderModal } from './modals/SectionReaderModal';
import { EntryWizardModal } from './modals/EntryWizardModal';
import { WeeklyReviewModal } from './modals/WeeklyReviewModal';

/**
 * Register all plugin commands.
 * Called once from plugin.onload().
 */
export function registerCommands(plugin: HindsightPlugin): void {
    plugin.addCommand({
        id: 'open-sidebar',
        name: 'Open sidebar',
        callback: () => {
            void plugin.activateSidebarView();
        },
    });

    plugin.addCommand({
        id: 'open-main',
        name: 'Open journal view',
        callback: () => {
            void plugin.activateMainView();
        },
    });

    plugin.addCommand({
        id: 'open-section-reader',
        name: 'Open section reader',
        callback: () => {
            new SectionReaderModal(plugin.app, plugin).open();
        },
    });

    plugin.addCommand({
        id: 'open-guided-entry',
        name: 'Open guided entry',
        callback: () => {
            new EntryWizardModal(plugin.app, plugin).open();
        },
    });

    plugin.addCommand({
        id: 'open-weekly-review',
        name: 'Open weekly review',
        callback: () => {
            new WeeklyReviewModal(plugin.app, plugin).open();
        },
    });
}
