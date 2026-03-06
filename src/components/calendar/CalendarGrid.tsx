/**
 * Calendar Grid
 *
 * Month grid component for the calendar view.
 * Renders a 7-column CSS grid with day-of-week headers and CalendarCell components.
 */

import React, { useMemo } from 'react';
import type { App } from 'obsidian';
import type { JournalEntry } from '../../types';
import { CalendarCell } from './CalendarCell';

interface CalendarGridProps {
    year: number;
    month: number; // 0-11
    entries: Map<string, JournalEntry>;
    selectedMetric: string | null;
    onDayClick: (date: Date) => void;
    app: App;
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Build a map of day-of-month → JournalEntry for the given month.
 */
function buildDayEntryMap(
    year: number,
    month: number,
    entries: Map<string, JournalEntry>
): Map<number, JournalEntry> {
    const map = new Map<number, JournalEntry>();
    for (const entry of entries.values()) {
        const d = entry.date;
        if (d.getFullYear() === year && d.getMonth() === month) {
            map.set(d.getDate(), entry);
        }
    }
    return map;
}

/**
 * Compute the min/max values across all entries for a given metric field.
 */
function computeMetricRange(
    entries: Map<string, JournalEntry>,
    metricKey: string
): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const entry of entries.values()) {
        const raw = entry.frontmatter[metricKey];
        if (raw !== null && raw !== undefined && raw !== '') {
            const num = Number(raw);
            if (!isNaN(num)) {
                if (num < min) min = num;
                if (num > max) max = num;
            }
        }
    }
    if (min === Infinity) {
        return { min: 0, max: 0 };
    }
    return { min, max };
}

export function CalendarGrid({
    year,
    month,
    entries,
    selectedMetric,
    onDayClick,
    app,
}: CalendarGridProps): React.ReactElement {
    // Days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Day of week for the 1st (0=Sun → convert to Mon-based: 0=Mon,...,6=Sun)
    const firstDayRaw = new Date(year, month, 1).getDay(); // 0=Sun,1=Mon,...,6=Sat
    const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // Convert to Mon-based

    // Number of leading empty cells
    const leadingBlanks = firstDayMon;

    // Map day-of-month to entries for this month
    const dayEntryMap = useMemo(
        () => buildDayEntryMap(year, month, entries),
        [year, month, entries]
    );

    // Compute metric range across ALL entries (not just this month)
    const metricRange = useMemo(
        () => selectedMetric ? computeMetricRange(entries, selectedMetric) : null,
        [selectedMetric, entries]
    );

    // Today's date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    return (
        <div className="hindsight-calendar-grid">
            {/* Day-of-week headers */}
            {DAY_HEADERS.map(day => (
                <div key={day} className="hindsight-calendar-header">
                    {day}
                </div>
            ))}

            {/* Leading empty cells */}
            {Array.from({ length: leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} className="hindsight-calendar-cell hindsight-calendar-cell-empty" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const date = new Date(year, month, dayNum);
                const entry = dayEntryMap.get(dayNum);
                const isToday = isCurrentMonth && today.getDate() === dayNum;

                return (
                    <CalendarCell
                        key={dayNum}
                        date={date}
                        entry={entry}
                        selectedMetric={selectedMetric}
                        metricRange={metricRange}
                        isToday={isToday}
                        onClick={() => onDayClick(date)}
                        app={app}
                    />
                );
            })}
        </div>
    );
}
