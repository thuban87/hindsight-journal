import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../src/store/uiStore';

/**
 * UI Store Tests — Phase 4.5
 *
 * Tests for index sort and filter state management.
 */
describe('uiStore', () => {
    beforeEach(() => {
        // Reset store to defaults
        useUIStore.setState({
            activeSidebarTab: 'today',
            activeGroup: 'journal',
            activeSubTab: 'calendar',
            indexSort: { field: 'date', direction: 'desc' },
            indexFilters: {
                search: '',
                dateRange: null,
                fieldFilters: [],
            },
        });
    });

    describe('setIndexSort', () => {
        it('first click sets field + asc', () => {
            useUIStore.getState().setIndexSort('mood');
            const { indexSort } = useUIStore.getState();
            expect(indexSort.field).toBe('mood');
            expect(indexSort.direction).toBe('asc');
        });

        it('second click on same field toggles to desc', () => {
            useUIStore.getState().setIndexSort('mood');
            useUIStore.getState().setIndexSort('mood');
            const { indexSort } = useUIStore.getState();
            expect(indexSort.field).toBe('mood');
            expect(indexSort.direction).toBe('desc');
        });

        it('click different field resets to asc', () => {
            useUIStore.getState().setIndexSort('mood');
            useUIStore.getState().setIndexSort('mood'); // now desc
            useUIStore.getState().setIndexSort('energy'); // new field → asc
            const { indexSort } = useUIStore.getState();
            expect(indexSort.field).toBe('energy');
            expect(indexSort.direction).toBe('asc');
        });
    });

    describe('setSearchFilter', () => {
        it('updates search string', () => {
            useUIStore.getState().setSearchFilter('anxiety');
            expect(useUIStore.getState().indexFilters.search).toBe('anxiety');
        });
    });

    describe('setDateRangeFilter', () => {
        it('sets range', () => {
            const range = {
                start: new Date(2026, 0, 1),
                end: new Date(2026, 2, 31),
            };
            useUIStore.getState().setDateRangeFilter(range);
            const { dateRange } = useUIStore.getState().indexFilters;
            expect(dateRange).not.toBeNull();
            expect(dateRange!.start.getTime()).toBe(range.start.getTime());
            expect(dateRange!.end.getTime()).toBe(range.end.getTime());
        });

        it('null clears the range', () => {
            useUIStore.getState().setDateRangeFilter({
                start: new Date(2026, 0, 1),
                end: new Date(2026, 2, 31),
            });
            useUIStore.getState().setDateRangeFilter(null);
            expect(useUIStore.getState().indexFilters.dateRange).toBeNull();
        });
    });

    describe('addFieldFilter', () => {
        it('appends new filter', () => {
            useUIStore.getState().addFieldFilter('mood', '>=', 7);
            useUIStore.getState().addFieldFilter('energy', '<=', 5);
            const { fieldFilters } = useUIStore.getState().indexFilters;
            expect(fieldFilters).toHaveLength(2);
            expect(fieldFilters[0]).toEqual({ field: 'mood', operator: '>=', value: 7 });
            expect(fieldFilters[1]).toEqual({ field: 'energy', operator: '<=', value: 5 });
        });
    });

    describe('removeFieldFilter', () => {
        it('removes by index, others shift', () => {
            useUIStore.getState().addFieldFilter('mood', '>=', 7);
            useUIStore.getState().addFieldFilter('energy', '<=', 5);
            useUIStore.getState().addFieldFilter('sleep', '=', 8);
            useUIStore.getState().removeFieldFilter(1); // remove energy filter
            const { fieldFilters } = useUIStore.getState().indexFilters;
            expect(fieldFilters).toHaveLength(2);
            expect(fieldFilters[0].field).toBe('mood');
            expect(fieldFilters[1].field).toBe('sleep');
        });
    });

    describe('clearAllFilters', () => {
        it('resets search, dateRange, fieldFilters to defaults', () => {
            useUIStore.getState().setSearchFilter('test');
            useUIStore.getState().setDateRangeFilter({
                start: new Date(2026, 0, 1),
                end: new Date(2026, 2, 31),
            });
            useUIStore.getState().addFieldFilter('mood', '>=', 7);

            useUIStore.getState().clearAllFilters();
            const { indexFilters } = useUIStore.getState();
            expect(indexFilters.search).toBe('');
            expect(indexFilters.dateRange).toBeNull();
            expect(indexFilters.fieldFilters).toHaveLength(0);
        });
    });

    describe('tab persistence', () => {
        it('activeSidebarTab persists across state reads', () => {
            useUIStore.getState().setActiveSidebarTab('echoes');
            expect(useUIStore.getState().activeSidebarTab).toBe('echoes');
        });

        it('activeGroup/activeSubTab persists across state reads', () => {
            useUIStore.getState().setActiveSubTab('index');
            expect(useUIStore.getState().activeSubTab).toBe('index');
        });
    });

    describe('reset', () => {
        it('resets all state to defaults', () => {
            // Modify various state
            useUIStore.getState().setActiveSidebarTab('echoes');
            useUIStore.getState().setActiveSubTab('index');
            useUIStore.getState().setSearchFilter('test');
            useUIStore.getState().addFieldFilter('mood', '>=', 7);

            // Reset
            useUIStore.getState().reset();

            const state = useUIStore.getState();
            expect(state.activeSidebarTab).toBe('today');
            expect(state.activeGroup).toBe('journal');
            expect(state.activeSubTab).toBe('calendar');
            expect(state.indexFilters.search).toBe('');
            expect(state.indexFilters.fieldFilters).toHaveLength(0);
            expect(state.indexFilters.dateRange).toBeNull();
            expect(state.selectedMetric).toBeNull();
            expect(state.indexSort.field).toBe('date');
            expect(state.indexSort.direction).toBe('desc');
        });
    });
});
