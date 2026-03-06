/**
 * Journal Entries Hook
 *
 * Thin selector hooks wrapping useJournalStore for
 * common access patterns in React components.
 */

import { useJournalStore } from '../store/journalStore';
import { formatDateISO, startOfDay } from '../utils/dateUtils';

/**
 * Select the core journal data needed by most components.
 */
export function useJournalEntries() {
    return useJournalStore(state => ({
        entries: state.entries,
        loading: state.loading,
        error: state.error,
        detectedFields: state.detectedFields,
    }));
}

/**
 * Select today's journal entry from the store (if it exists).
 */
export function useTodayEntry() {
    const todayISO = formatDateISO(startOfDay(new Date()));
    return useJournalStore(state => {
        for (const entry of state.entries.values()) {
            if (formatDateISO(startOfDay(entry.date)) === todayISO) {
                return entry;
            }
        }
        return undefined;
    });
}
