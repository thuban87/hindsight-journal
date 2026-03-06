import { describe, it, expect } from 'vitest';

/**
 * Calendar date math tests.
 *
 * The calendar grid uses native Date for its computations:
 * - new Date(year, month + 1, 0).getDate() for days in month
 * - new Date(year, month, 1).getDay() for first day of week
 *
 * These tests validate that the native Date math produces correct
 * results for edge cases we depend on (leap years, month boundaries).
 */

describe('days in month', () => {
    function daysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    it('January has 31 days', () => {
        expect(daysInMonth(2026, 0)).toBe(31);
    });

    it('February has 28 days in a non-leap year', () => {
        expect(daysInMonth(2025, 1)).toBe(28);
    });

    it('February has 29 days in a leap year (2024)', () => {
        expect(daysInMonth(2024, 1)).toBe(29);
    });

    it('February has 29 days in century leap year (2000)', () => {
        expect(daysInMonth(2000, 1)).toBe(29);
    });

    it('February has 28 days in century non-leap year (1900)', () => {
        expect(daysInMonth(1900, 1)).toBe(28);
    });

    it('April has 30 days', () => {
        expect(daysInMonth(2026, 3)).toBe(30);
    });

    it('December has 31 days', () => {
        expect(daysInMonth(2026, 11)).toBe(31);
    });
});

describe('first day of week alignment', () => {
    // Convert JS getDay() (0=Sun) to Mon-based (0=Mon,...,6=Sun)
    function firstDayMon(year: number, month: number): number {
        const raw = new Date(year, month, 1).getDay();
        return raw === 0 ? 6 : raw - 1;
    }

    it('March 2026 starts on Sunday (index 6 in Mon-based)', () => {
        // March 1, 2026 is a Sunday
        expect(firstDayMon(2026, 2)).toBe(6);
    });

    it('January 2026 starts on Thursday (index 3 in Mon-based)', () => {
        // Jan 1, 2026 is Thursday
        expect(firstDayMon(2026, 0)).toBe(3);
    });

    it('September 2026 starts on Tuesday (index 1 in Mon-based)', () => {
        // Sep 1, 2026 is Tuesday
        expect(firstDayMon(2026, 8)).toBe(1);
    });

    it('February 2024 starts on Thursday (index 3 in Mon-based, leap year)', () => {
        // Feb 1, 2024 is Thursday
        expect(firstDayMon(2024, 1)).toBe(3);
    });
});

describe('month navigation boundary crossing', () => {
    it('Dec → Jan crosses year boundary', () => {
        // Navigating from Dec to next month
        const month = 11; // December
        const year = 2025;
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        expect(nextMonth).toBe(0); // January
        expect(nextYear).toBe(2026);
    });

    it('Jan → Dec crosses year boundary backward', () => {
        // Navigating from Jan to previous month
        const month = 0; // January
        const year = 2026;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        expect(prevMonth).toBe(11); // December
        expect(prevYear).toBe(2025);
    });

    it('mid-year navigation stays in same year', () => {
        const month = 5; // June
        const year = 2026;
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        expect(nextMonth).toBe(6); // July
        expect(nextYear).toBe(2026);
    });
});
