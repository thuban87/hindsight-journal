/**
 * appStore Tests
 *
 * Tests for the App/Plugin Zustand store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock obsidian
vi.mock('obsidian', () => ({}));

import { useAppStore } from '../../src/store/appStore';
import type { HindsightPluginInterface } from '../../src/types/plugin';

describe('appStore', () => {
    beforeEach(() => {
        useAppStore.getState().reset();
    });

    it('initializes with null values and isUnloading false', () => {
        const state = useAppStore.getState();
        expect(state.app).toBeNull();
        expect(state.plugin).toBeNull();
        expect(state.isUnloading).toBe(false);
    });

    it('setApp stores app and plugin', () => {
        const mockApp = { workspace: {} } as unknown as import('obsidian').App;
        const mockPlugin: HindsightPluginInterface = {
            settings: {} as HindsightPluginInterface['settings'],
            saveSettings: vi.fn(),
            services: { journalIndex: null },
        };

        useAppStore.getState().setApp(mockApp, mockPlugin);

        const state = useAppStore.getState();
        expect(state.app).toBe(mockApp);
        expect(state.plugin).toBe(mockPlugin);
        expect(state.isUnloading).toBe(false);
    });

    it('setIsUnloading updates the flag', () => {
        useAppStore.getState().setIsUnloading(true);
        expect(useAppStore.getState().isUnloading).toBe(true);

        useAppStore.getState().setIsUnloading(false);
        expect(useAppStore.getState().isUnloading).toBe(false);
    });

    it('reset clears all state to defaults', () => {
        const mockApp = { workspace: {} } as unknown as import('obsidian').App;
        const mockPlugin: HindsightPluginInterface = {
            settings: {} as HindsightPluginInterface['settings'],
            saveSettings: vi.fn(),
            services: { journalIndex: null },
        };

        useAppStore.getState().setApp(mockApp, mockPlugin);
        useAppStore.getState().setIsUnloading(true);

        useAppStore.getState().reset();

        const state = useAppStore.getState();
        expect(state.app).toBeNull();
        expect(state.plugin).toBeNull();
        expect(state.isUnloading).toBe(false);
    });

    it('setApp resets isUnloading to false (re-enable safety)', () => {
        useAppStore.getState().setIsUnloading(true);

        const mockApp = { workspace: {} } as unknown as import('obsidian').App;
        const mockPlugin: HindsightPluginInterface = {
            settings: {} as HindsightPluginInterface['settings'],
            saveSettings: vi.fn(),
            services: { journalIndex: null },
        };
        useAppStore.getState().setApp(mockApp, mockPlugin);

        expect(useAppStore.getState().isUnloading).toBe(false);
    });
});
