/**
 * Commands
 *
 * All plugin commands are registered here.
 * main.ts calls registerCommands(this) in onload().
 */

import { Notice } from 'obsidian';
import type HindsightPlugin from '../main';
import { SectionReaderModal } from './modals/SectionReaderModal';
import { EntryWizardModal } from './modals/EntryWizardModal';
import { WeeklyReviewModal } from './modals/WeeklyReviewModal';
import { useJournalStore } from './store/journalStore';

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
        id: 'debug-fields',
        name: 'Debug field detection',
        callback: () => {
            const store = useJournalStore.getState();
            const fields = store.detectedFields;
            const entries = Array.from(store.entries.values());

            // eslint-disable-next-line no-console
            console.debug(`[Hindsight] ${fields.length} detected fields from ${entries.length} entries:`);
            for (const f of fields) {
                // Collect sample values WITH their typeof for diagnosis
                const samples = entries
                    .map(e => e.frontmatter[f.key])
                    .filter(v => v !== null && v !== undefined && v !== '')
                    .slice(0, 5)
                    .map(v => `${String(v)} (typeof=${typeof v})`);
                // eslint-disable-next-line no-console
                console.debug(
                    `  ${f.key}: type=${f.type}, coverage=${f.coverage}/${f.total}, samples=[${samples.join(', ')}]`
                );
            }

            // Also log all frontmatter keys from first entry for sanity check
            if (entries.length > 0) {
                const first = entries[0];
                // eslint-disable-next-line no-console
                console.debug(`[Hindsight] First entry (${first.filePath}) raw frontmatter keys:`, Object.keys(first.frontmatter));
                // eslint-disable-next-line no-console
                console.debug('[Hindsight] First entry raw frontmatter:', first.frontmatter);
            }

            new Notice(`Logged ${fields.length} detected fields to console (Ctrl+Shift+I).`);
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
