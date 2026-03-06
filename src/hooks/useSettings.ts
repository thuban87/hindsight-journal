/**
 * useSettings Hook
 *
 * Thin selector hook for accessing plugin settings
 * from React components.
 */

import { useSettingsStore } from '../store/settingsStore';

export function useSettings() {
    return useSettingsStore(state => state.settings);
}
