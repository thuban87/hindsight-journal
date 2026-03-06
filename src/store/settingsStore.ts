/**
 * Settings Store
 *
 * Reactive mirror of plugin settings for React components.
 * Updated by main.ts whenever settings change.
 */

import { create } from 'zustand';
import type { HindsightSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface SettingsState {
    settings: HindsightSettings;
    setSettings(settings: HindsightSettings): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    settings: DEFAULT_SETTINGS,
    setSettings: (settings) => set({ settings }),
}));
