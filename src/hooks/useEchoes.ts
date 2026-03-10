/**
 * useEchoes Hook
 *
 * Combines the journal store's dateIndex with useToday()
 * to provide echo data (entries from the same date/week in past years).
 * Also exposes today's entry for metric comparison in ActionableEcho.
 */

import { useMemo } from 'react';
import { useJournalStore } from '../store/journalStore';
import { useToday } from './useToday';
import { getOnThisDay, getThisWeekLastYear } from '../services/EchoesService';
import type { JournalEntry } from '../types';

export function useEchoes() {
    const dateIndex = useJournalStore(state => state.dateIndex);
    const entries = useJournalStore(state => state.getAllEntriesSorted());
    const getEntryByDate = useJournalStore(state => state.getEntryByDate);
    const today = useToday();

    // Use month-day string as memo key so it only recomputes when the day changes
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const todayEntry: JournalEntry | undefined = useMemo(
        () => getEntryByDate(today),
        [getEntryByDate, today]
    );

    return useMemo(() => ({
        onThisDay: getOnThisDay(today, dateIndex),
        thisWeekLastYear: getThisWeekLastYear(today, entries),
        todayEntry,
    }), [monthDay, dateIndex, entries, todayEntry]);
}
