/* eslint-disable no-console */
/**
 * Debug Logger
 *
 * Settings-gated debug logger. Only emits output when debugMode
 * is enabled in plugin settings. All debug output across the
 * codebase must go through this function.
 */

import { useSettingsStore } from '../store/settingsStore';

/**
 * Log debug messages to console, gated by the debugMode setting.
 * Only emits when settings.debugMode is true.
 * @param args - Arguments to pass to console.debug
 */
export function debugLog(...args: unknown[]): void {
    if (useSettingsStore.getState().settings.debugMode) {
        console.debug('[Hindsight]', ...args);
    }
}
