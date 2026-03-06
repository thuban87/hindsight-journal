/**
 * useEchoes Hook
 *
 * Combines the journal store's dateIndex with useToday()
 * to provide echo data (entries from the same date/week in past years).
 */

import { useMemo } from 'react';
import { useJournalStore } from '../store/journalStore';
import { useToday } from './useToday';
import { getOnThisDay, getThisWeekLastYear } from '../services/EchoesService';

export function useEchoes() {
    const dateIndex = useJournalStore(state => state.dateIndex);
    const entries = useJournalStore(state => state.getAllEntriesSorted());
    const today = useToday();

    // Use month-day string as memo key so it only recomputes when the day changes
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return useMemo(() => ({
        onThisDay: getOnThisDay(today, dateIndex),
        thisWeekLastYear: getThisWeekLastYear(today, entries),
    }), [monthDay, dateIndex, entries]);
}
