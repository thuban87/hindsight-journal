/**
 * Commands
 *
 * All plugin commands are registered here.
 * main.ts calls registerCommands(this) in onload().
 */

import type HindsightPlugin from '../main';

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
}
