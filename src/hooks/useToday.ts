/**
 * useToday Hook
 *
 * Returns today's date as a stable reference.
 * Automatically refreshes at midnight so the sidebar
 * never shows stale data if left open overnight.
 */

import { useState, useEffect } from 'react';
import { startOfDay, formatDateISO } from '../utils/dateUtils';

export function useToday(): Date {
    const [today, setToday] = useState(() => startOfDay(new Date()));

    useEffect(() => {
        const check = setInterval(() => {
            const now = startOfDay(new Date());
            if (formatDateISO(now) !== formatDateISO(today)) {
                setToday(now);
            }
        }, 60_000); // check every 60 seconds
        return () => clearInterval(check);
    }, [today]);

    return today;
}
