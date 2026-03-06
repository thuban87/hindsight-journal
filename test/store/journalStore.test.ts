import { describe, it, expect, beforeEach } from 'vitest';
import { useJournalStore } from '../../src/store/journalStore';
import type { JournalEntry } from '../../src/types';
import { formatDateISO } from '../../src/utils/dateUtils';

/** Helper to create a minimal JournalEntry */
function makeEntry(
    filePath: string,
    date: Date,
    overrides?: Partial<JournalEntry>
): JournalEntry {
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
        ...overrides,
    };
}

describe('journalStore', () => {
    beforeEach(() => {
        // Reset store to default state before each test
        useJournalStore.getState().clear();
    });

    describe('setEntries', () => {
        it('populates entries map and sortedDates', () => {
            const entries = [
                makeEntry('a.md', new Date(2026, 2, 1)),
                makeEntry('b.md', new Date(2026, 2, 3)),
                makeEntry('c.md', new Date(2026, 2, 2)),
            ];

            useJournalStore.getState().setEntries(entries);
            const state = useJournalStore.getState();

            expect(state.entries.size).toBe(3);
            expect(state.sortedDates).toHaveLength(3);
            // Should be sorted ascending
            expect(formatDateISO(state.sortedDates[0])).toBe('2026-03-01');
            expect(formatDateISO(state.sortedDates[1])).toBe('2026-03-02');
            expect(formatDateISO(state.sortedDates[2])).toBe('2026-03-03');
        });

        it('builds dateIndex for echo lookups', () => {
            const entries = [
                makeEntry('a.md', new Date(2026, 2, 5)),
                makeEntry('b.md', new Date(2025, 2, 5)),
            ];

            useJournalStore.getState().setEntries(entries);
            const state = useJournalStore.getState();

            // Both entries are March 5 → key "03-05"
            const echoes = state.dateIndex.get('03-05');
            expect(echoes).toHaveLength(2);
        });
    });

    describe('upsertEntry', () => {
        it('adds a new entry', () => {
            const entry = makeEntry('new.md', new Date(2026, 2, 5));
            useJournalStore.getState().upsertEntry(entry);

            const state = useJournalStore.getState();
            expect(state.entries.size).toBe(1);
            expect(state.entries.get('new.md')).toBeDefined();
            expect(state.sortedDates).toHaveLength(1);
        });

        it('updates an existing entry', () => {
            const entry = makeEntry('a.md', new Date(2026, 2, 5), { wordCount: 100 });
            useJournalStore.getState().upsertEntry(entry);

            const updated = makeEntry('a.md', new Date(2026, 2, 5), { wordCount: 200 });
            useJournalStore.getState().upsertEntry(updated);

            const state = useJournalStore.getState();
            expect(state.entries.size).toBe(1);
            expect(state.entries.get('a.md')?.wordCount).toBe(200);
        });
    });

    describe('removeEntry', () => {
        it('removes entry by filePath', () => {
            const entries = [
                makeEntry('a.md', new Date(2026, 2, 1)),
                makeEntry('b.md', new Date(2026, 2, 2)),
            ];
            useJournalStore.getState().setEntries(entries);
            useJournalStore.getState().removeEntry('a.md');

            const state = useJournalStore.getState();
            expect(state.entries.size).toBe(1);
            expect(state.entries.has('a.md')).toBe(false);
        });

        it('updates sortedDates after removal', () => {
            const entries = [
                makeEntry('a.md', new Date(2026, 2, 1)),
                makeEntry('b.md', new Date(2026, 2, 2)),
            ];
            useJournalStore.getState().setEntries(entries);
            useJournalStore.getState().removeEntry('a.md');

            const state = useJournalStore.getState();
            expect(state.sortedDates).toHaveLength(1);
            expect(formatDateISO(state.sortedDates[0])).toBe('2026-03-02');
        });

        it('no-ops when filePath does not exist', () => {
            const entries = [makeEntry('a.md', new Date(2026, 2, 1))];
            useJournalStore.getState().setEntries(entries);
            useJournalStore.getState().removeEntry('nonexistent.md');

            expect(useJournalStore.getState().entries.size).toBe(1);
        });
    });

    describe('getEntriesInRange', () => {
        beforeEach(() => {
            const entries = [
                makeEntry('jan.md', new Date(2026, 0, 15)),
                makeEntry('feb.md', new Date(2026, 1, 15)),
                makeEntry('mar1.md', new Date(2026, 2, 1)),
                makeEntry('mar15.md', new Date(2026, 2, 15)),
                makeEntry('mar31.md', new Date(2026, 2, 31)),
                makeEntry('apr.md', new Date(2026, 3, 15)),
            ];
            useJournalStore.getState().setEntries(entries);
        });

        it('returns only entries within range (inclusive)', () => {
            const result = useJournalStore.getState().getEntriesInRange({
                start: new Date(2026, 2, 1),
                end: new Date(2026, 2, 31),
            });
            expect(result).toHaveLength(3);
            expect(result.map(e => e.filePath)).toContain('mar1.md');
            expect(result.map(e => e.filePath)).toContain('mar15.md');
            expect(result.map(e => e.filePath)).toContain('mar31.md');
        });

        it('returns empty array for range with no entries', () => {
            const result = useJournalStore.getState().getEntriesInRange({
                start: new Date(2026, 4, 1),
                end: new Date(2026, 4, 31),
            });
            expect(result).toHaveLength(0);
        });
    });

    describe('getEntryByDate', () => {
        it('finds entry matching date', () => {
            const entries = [makeEntry('a.md', new Date(2026, 2, 5))];
            useJournalStore.getState().setEntries(entries);

            const result = useJournalStore.getState().getEntryByDate(new Date(2026, 2, 5));
            expect(result).toBeDefined();
            expect(result?.filePath).toBe('a.md');
        });

        it('returns undefined when no match', () => {
            const entries = [makeEntry('a.md', new Date(2026, 2, 5))];
            useJournalStore.getState().setEntries(entries);

            const result = useJournalStore.getState().getEntryByDate(new Date(2026, 2, 10));
            expect(result).toBeUndefined();
        });
    });

    describe('getAllEntriesSorted', () => {
        it('returns entries sorted newest-first', () => {
            const entries = [
                makeEntry('old.md', new Date(2026, 0, 1)),
                makeEntry('mid.md', new Date(2026, 1, 15)),
                makeEntry('new.md', new Date(2026, 2, 5)),
            ];
            useJournalStore.getState().setEntries(entries);

            const sorted = useJournalStore.getState().getAllEntriesSorted();
            expect(sorted[0].filePath).toBe('new.md');
            expect(sorted[1].filePath).toBe('mid.md');
            expect(sorted[2].filePath).toBe('old.md');
        });
    });

    describe('sortedDates consistency', () => {
        it('stays sorted after multiple upserts', () => {
            useJournalStore.getState().upsertEntry(makeEntry('c.md', new Date(2026, 2, 15)));
            useJournalStore.getState().upsertEntry(makeEntry('a.md', new Date(2026, 2, 1)));
            useJournalStore.getState().upsertEntry(makeEntry('b.md', new Date(2026, 2, 10)));

            const dates = useJournalStore.getState().sortedDates;
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
            }
        });
    });

    describe('getEntriesByMonthDay', () => {
        it('returns entries for a specific month-day', () => {
            const entries = [
                makeEntry('a.md', new Date(2024, 2, 5)),
                makeEntry('b.md', new Date(2025, 2, 5)),
                makeEntry('c.md', new Date(2026, 2, 5)),
                makeEntry('d.md', new Date(2026, 2, 10)),
            ];
            useJournalStore.getState().setEntries(entries);

            const result = useJournalStore.getState().getEntriesByMonthDay('03-05');
            expect(result).toHaveLength(3);
        });

        it('returns empty array for month-day with no entries', () => {
            const result = useJournalStore.getState().getEntriesByMonthDay('12-25');
            expect(result).toHaveLength(0);
        });
    });
});
