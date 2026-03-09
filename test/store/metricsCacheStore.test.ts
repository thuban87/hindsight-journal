import { describe, it, expect, beforeEach } from 'vitest';
import { useMetricsCacheStore } from '../../src/store/metricsCacheStore';

describe('metricsCacheStore', () => {
    beforeEach(() => {
        useMetricsCacheStore.getState().reset();
    });

    it('starts with stale = false', () => {
        expect(useMetricsCacheStore.getState().stale).toBe(false);
    });

    it('markStale() sets stale to true', () => {
        useMetricsCacheStore.getState().markStale();
        expect(useMetricsCacheStore.getState().stale).toBe(true);
    });

    it('invalidateCache() sets stale to false', () => {
        useMetricsCacheStore.getState().markStale();
        expect(useMetricsCacheStore.getState().stale).toBe(true);

        useMetricsCacheStore.getState().invalidateCache([]);
        expect(useMetricsCacheStore.getState().stale).toBe(false);
    });

    it('invalidateCache() with specific keys sets stale to false', () => {
        useMetricsCacheStore.getState().markStale();
        useMetricsCacheStore.getState().invalidateCache(['mood', 'sleep']);
        expect(useMetricsCacheStore.getState().stale).toBe(false);
    });

    it('reset() returns to initial state', () => {
        useMetricsCacheStore.getState().markStale();
        useMetricsCacheStore.getState().reset();
        expect(useMetricsCacheStore.getState().stale).toBe(false);
    });
});
