/**
 * Store Lifecycle Tests
 *
 * Consolidated reset/lifecycle tests for ALL stores.
 * Verifies that Maps are actually emptied (.size === 0),
 * not just that a new shallow object was set.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock obsidian before importing stores
vi.mock('obsidian', () => ({
    Platform: { isMobile: false },
}));

import { useJournalStore, clearInFlightMap } from '../../src/store/journalStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useUIStore } from '../../src/store/uiStore';
import { useAppStore } from '../../src/store/appStore';
import { useMetricsCacheStore } from '../../src/store/metricsCacheStore';
import { useChartUiStore } from '../../src/store/chartUiStore';
import { DEFAULT_SETTINGS } from '../../src/types/settings';
import type { JournalEntry } from '../../src/types';
import type { HindsightPluginInterface } from '../../src/types/plugin';

/** Helper to create a minimal JournalEntry */
function makeEntry(filePath: string, date: Date): JournalEntry {
    return {
        filePath,
        date,
        dayOfWeek: 'Monday',
        frontmatter: {},
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 100,
    };
}

describe('Store Lifecycle', () => {
    beforeEach(() => {
        useJournalStore.getState().reset();
        clearInFlightMap();
        useSettingsStore.getState().reset();
        useUIStore.getState().reset();
        useAppStore.getState().reset();
        useMetricsCacheStore.getState().reset();
        useChartUiStore.getState().reset();
    });

    describe('journalStore.clear', () => {
        it('empties entries Map, dateIndex Map, sortedDates, and increments revision', () => {
            // Populate store
            const entries = [
                makeEntry('a.md', new Date(2026, 2, 1)),
                makeEntry('b.md', new Date(2026, 2, 5)),
            ];
            useJournalStore.getState().setEntries(entries);
            const revBefore = useJournalStore.getState().revision;

            useJournalStore.getState().clear();
            const state = useJournalStore.getState();

            expect(state.entries.size).toBe(0);
            expect(state.dateIndex.size).toBe(0);
            expect(state.sortedDates).toEqual([]);
            expect(state.revision).toBe(revBefore + 1);
        });
    });

    describe('journalStore revision', () => {
        it('increments on upsertEntry, upsertEntries, removeEntry, and clear', () => {
            let rev = useJournalStore.getState().revision;

            useJournalStore.getState().upsertEntry(makeEntry('a.md', new Date(2026, 2, 1)));
            expect(useJournalStore.getState().revision).toBe(rev + 1);
            rev = useJournalStore.getState().revision;

            useJournalStore.getState().upsertEntries([
                makeEntry('a.md', new Date(2026, 2, 1)),
            ]);
            expect(useJournalStore.getState().revision).toBe(rev + 1);
            rev = useJournalStore.getState().revision;

            useJournalStore.getState().removeEntry('a.md');
            expect(useJournalStore.getState().revision).toBe(rev + 1);
            rev = useJournalStore.getState().revision;

            useJournalStore.getState().clear();
            expect(useJournalStore.getState().revision).toBe(rev + 1);
        });
    });

    describe('settingsStore.reset', () => {
        it('returns settings to DEFAULT_SETTINGS', () => {
            useSettingsStore.getState().setSettings({
                ...DEFAULT_SETTINGS,
                journalFolder: 'CustomFolder',
                debugMode: true,
            });

            useSettingsStore.getState().reset();
            const settings = useSettingsStore.getState().settings;
            expect(settings.journalFolder).toBe(DEFAULT_SETTINGS.journalFolder);
            expect(settings.debugMode).toBe(DEFAULT_SETTINGS.debugMode);
        });
    });

    describe('uiStore.reset', () => {
        it('returns all state to initial values', () => {
            useUIStore.getState().setActiveGroup('insights');
            useUIStore.getState().setActiveSidebarTab('echoes');

            useUIStore.getState().reset();
            const state = useUIStore.getState();
            expect(state.activeGroup).toBe('journal');
            expect(state.activeSubTab).toBe('calendar');
            expect(state.activeSidebarTab).toBe('today');
        });
    });

    describe('appStore.reset', () => {
        it('sets app and plugin to null', () => {
            const mockApp = { workspace: {} } as unknown as import('obsidian').App;
            const mockPlugin: HindsightPluginInterface = {
                settings: {} as HindsightPluginInterface['settings'],
                saveSettings: vi.fn(),
                services: { journalIndex: null },
            };
            useAppStore.getState().setApp(mockApp, mockPlugin);

            useAppStore.getState().reset();
            expect(useAppStore.getState().app).toBeNull();
            expect(useAppStore.getState().plugin).toBeNull();
        });
    });

    describe('metricsCacheStore.reset', () => {
        it('empties timeSeriesCache Map, nulls correlationResults, sets stale to false', () => {
            // Populate cache
            useMetricsCacheStore.getState().setTimeSeries('mood', [
                { date: 1, value: 7 },
            ]);
            useMetricsCacheStore.getState().setCorrelationResults([
                { fieldA: 'mood', fieldB: 'sleep', r: 0.8, n: 100 },
            ]);
            useMetricsCacheStore.getState().markStale();

            useMetricsCacheStore.getState().reset();
            const state = useMetricsCacheStore.getState();
            expect(state.timeSeriesCache.size).toBe(0);
            expect(state.correlationResults).toBeNull();
            expect(state.stale).toBe(false);
        });
    });

    describe('chartUiStore.reset', () => {
        it('empties selectedChartFields and dismissedAlertIds', () => {
            useChartUiStore.getState().setSelectedChartFields(['mood', 'sleep']);
            useChartUiStore.getState().dismissAlert('alert-1');
            useChartUiStore.getState().dismissAlert('alert-2');

            useChartUiStore.getState().reset();
            const state = useChartUiStore.getState();
            expect(state.selectedChartFields).toEqual([]);
            expect(state.dismissedAlertIds).toEqual([]);
        });
    });
});
