import type { DateRange } from '../types';

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/** Check if two dates are in the same ISO week */
export function isSameWeek(a: Date, b: Date): boolean {
    const weekA = getISOWeek(a);
    const weekB = getISOWeek(b);
    // Must also be in the same ISO year to handle year boundaries
    const yearA = getISOWeekYear(a);
    const yearB = getISOWeekYear(b);
    return weekA === weekB && yearA === yearB;
}

/** Get ISO week number for a date */
export function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
}

/**
 * Get the ISO week-numbering year for a date.
 * This may differ from the calendar year around Jan 1.
 */
function getISOWeekYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return d.getUTCFullYear();
}

/** Get all dates in a range (inclusive) */
export function getDatesInRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = startOfDay(start);
    const endDay = startOfDay(end);
    while (current <= endDay) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/** Format date as YYYY-MM-DD string */
export function formatDateISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Get start of day (midnight) for a date */
export function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Get the number of days between two dates */
export function daysBetween(a: Date, b: Date): number {
    const aDay = startOfDay(a);
    const bDay = startOfDay(b);
    return Math.round(Math.abs(aDay.getTime() - bDay.getTime()) / 86400000);
}

/** Check if a date falls within a range (inclusive) */
export function isInRange(date: Date, range: DateRange): boolean {
    const d = startOfDay(date);
    const s = startOfDay(range.start);
    const e = startOfDay(range.end);
    return d >= s && d <= e;
}
