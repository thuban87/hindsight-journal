/**
 * Store Wiring
 *
 * Cross-store subscriptions and centralized store reset.
 * Called from main.ts during onload/onunload lifecycle.
 *
 * Subscription dependency graph (must be wired in this order):
 * 1. journalStore.revision → metricsCacheStore.markStale() [debounced 2s]
 *    (Entry changes trigger cache invalidation after a 2-second settle period)
 *
 * INVARIANT: No subscription may synchronously write to the store it reads from.
 * All cross-store updates must be async (setTimeout, debounce) to prevent re-entrant loops.
 */

import type { HindsightPluginInterface } from './types/plugin';
import { useJournalStore, clearInFlightMap } from './store/journalStore';
import { useMetricsCacheStore } from './store/metricsCacheStore';
import { useSettingsStore } from './store/settingsStore';
import { useUIStore } from './store/uiStore';
import { useAppStore } from './store/appStore';
import { useChartUiStore } from './store/chartUiStore';
import { debugLog } from './utils/debugLog';

/** Debounce delay for revision → markStale subscription (ms) */
const REVISION_DEBOUNCE_MS = 2000;

/**
 * Wire all cross-store subscriptions.
 * Returns an array of unsubscribe functions for cleanup in onunload().
 *
 * @param _plugin - Plugin interface (used for debugLog context in future subscriptions)
 * @returns Array of unsubscribe functions
 */
export function wireStoreSubscriptions(_plugin: HindsightPluginInterface): (() => void)[] {
    const unsubscribers: (() => void)[] = [];

    // Subscription #1: journalStore.revision → metricsCacheStore.markStale() [debounced 2s]
    let revisionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastKnownRevision = useJournalStore.getState().revision;

    const unsubRevision = useJournalStore.subscribe((state) => {
        if (state.revision !== lastKnownRevision) {
            lastKnownRevision = state.revision;
            debugLog('Store event: journalStore.revision changed →', state.revision);

            // Debounce the markStale call to coalesce rapid changes
            if (revisionDebounceTimer) {
                clearTimeout(revisionDebounceTimer);
            }
            revisionDebounceTimer = setTimeout(() => {
                revisionDebounceTimer = null;

                const store = useJournalStore.getState();
                const cacheStore = useMetricsCacheStore.getState();

                // Check what kind of invalidation is needed
                if (store.fullInvalidation) {
                    cacheStore.invalidateCache([]);
                    store.clearPendingChanges();
                    debugLog('Cache invalidated: full (bulk change)');
                } else if (store.pendingChangedFieldKeys.size > 0) {
                    const changedKeys = Array.from(store.pendingChangedFieldKeys);
                    cacheStore.invalidateCache(changedKeys);
                    store.clearPendingChanges();
                    debugLog('Cache invalidated: fields', changedKeys);
                } else {
                    cacheStore.markStale();
                    debugLog('Cache marked stale');
                }
            }, REVISION_DEBOUNCE_MS);
        }
    });

    // Include timer cleanup in the unsubscriber
    unsubscribers.push(() => {
        unsubRevision();
        if (revisionDebounceTimer) {
            clearTimeout(revisionDebounceTimer);
            revisionDebounceTimer = null;
        }
    });

    // Subscription #5: settingsStore.fieldPolarity → metricsCacheStore.invalidateCache([]) [immediate, full]
    // When polarity changes, all polarity-dependent computed data (trend alerts, badge colors) is stale.
    let lastFieldPolarity = useSettingsStore.getState().settings.fieldPolarity;

    const unsubPolarity = useSettingsStore.subscribe((state) => {
        const currentPolarity = state.settings.fieldPolarity;
        if (currentPolarity !== lastFieldPolarity) {
            lastFieldPolarity = currentPolarity;
            debugLog('Store event: settingsStore.fieldPolarity changed → full cache invalidation');
            useMetricsCacheStore.getState().invalidateCache([]);
        }
    });

    unsubscribers.push(unsubPolarity);

    return unsubscribers;
}

/**
 * Reset all stores to initial state.
 * Called from plugin.onunload() after subscriptions are unsubscribed.
 * Order matters: appStore LAST (components may reference it during cleanup effects).
 */
export function resetAllStores(): void {
    // Clear module-level state
    clearInFlightMap();

    // Reset stores — appStore LAST
    useJournalStore.getState().reset();
    useSettingsStore.getState().reset();
    useMetricsCacheStore.getState().reset();
    useChartUiStore.getState().reset();
    useUIStore.getState().reset();
    useAppStore.getState().reset(); // LAST — components may still access app during teardown
}
