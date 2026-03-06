import { describe, it, expect } from 'vitest';
import {
    isSameDay,
    isSameWeek,
    getISOWeek,
    getDatesInRange,
    formatDateISO,
    startOfDay,
    daysBetween,
    isInRange,
} from '../../src/utils/dateUtils';

describe('isSameDay', () => {
    it('returns true for same day', () => {
        const a = new Date(2026, 2, 5, 10, 30);
        const b = new Date(2026, 2, 5, 22, 0);
        expect(isSameDay(a, b)).toBe(true);
    });

    it('returns false for different day', () => {
        const a = new Date(2026, 2, 5);
        const b = new Date(2026, 2, 6);
        expect(isSameDay(a, b)).toBe(false);
    });

    it('returns false across midnight (different calendar day)', () => {
        const a = new Date(2026, 2, 5, 23, 59);
        const b = new Date(2026, 2, 6, 0, 1);
        expect(isSameDay(a, b)).toBe(false);
    });

    it('returns false for same day different month', () => {
        const a = new Date(2026, 2, 5);
        const b = new Date(2026, 3, 5);
        expect(isSameDay(a, b)).toBe(false);
    });
});

describe('isSameWeek', () => {
    it('returns true for dates in same ISO week', () => {
        // Mon March 2 and Fri March 6, 2026 are in the same ISO week
        const mon = new Date(2026, 2, 2);
        const fri = new Date(2026, 2, 6);
        expect(isSameWeek(mon, fri)).toBe(true);
    });

    it('returns false for Sunday vs Monday (ISO week boundary)', () => {
        // Sunday March 8, 2026 is end of week 10; Monday March 9 is start of week 11
        const sun = new Date(2026, 2, 8);
        const mon = new Date(2026, 2, 9);
        expect(isSameWeek(sun, mon)).toBe(false);
    });

    it('returns true for cross-year ISO weeks when in the same ISO week', () => {
        // Dec 29, 2025 (Monday) and Jan 4, 2026 (Sunday) are both ISO week 1 of 2026
        const dec29 = new Date(2025, 11, 29);
        const jan4 = new Date(2026, 0, 4);
        expect(isSameWeek(dec29, jan4)).toBe(true);
    });

    it('returns false for different weeks', () => {
        const a = new Date(2026, 2, 2);
        const b = new Date(2026, 2, 16);
        expect(isSameWeek(a, b)).toBe(false);
    });
});

describe('getISOWeek', () => {
    it('returns correct week for a known date', () => {
        // March 5, 2026 is ISO week 10
        expect(getISOWeek(new Date(2026, 2, 5))).toBe(10);
    });

    it('handles Jan 1 that falls in previous year ISO week', () => {
        // Jan 1, 2026 is Thursday — ISO week 1 of 2026
        expect(getISOWeek(new Date(2026, 0, 1))).toBe(1);
    });

    it('handles Dec 31 that may be in week 1 of next year', () => {
        // Dec 31, 2025 is Wednesday — ISO week 1 of 2026
        expect(getISOWeek(new Date(2025, 11, 31))).toBe(1);
    });
});

describe('getDatesInRange', () => {
    it('returns all dates between start and end inclusive', () => {
        const dates = getDatesInRange(new Date(2026, 2, 1), new Date(2026, 2, 3));
        expect(dates).toHaveLength(3);
        expect(formatDateISO(dates[0])).toBe('2026-03-01');
        expect(formatDateISO(dates[1])).toBe('2026-03-02');
        expect(formatDateISO(dates[2])).toBe('2026-03-03');
    });

    it('returns single date when start equals end', () => {
        const dates = getDatesInRange(new Date(2026, 2, 5), new Date(2026, 2, 5));
        expect(dates).toHaveLength(1);
    });
});

describe('formatDateISO', () => {
    it('formats date as YYYY-MM-DD', () => {
        expect(formatDateISO(new Date(2026, 2, 5))).toBe('2026-03-05');
    });

    it('pads single-digit month and day', () => {
        expect(formatDateISO(new Date(2026, 0, 3))).toBe('2026-01-03');
    });

    it('handles December', () => {
        expect(formatDateISO(new Date(2026, 11, 25))).toBe('2026-12-25');
    });
});

describe('startOfDay', () => {
    it('returns midnight for a date with time', () => {
        const d = startOfDay(new Date(2026, 2, 5, 14, 30, 45));
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
        expect(d.getMilliseconds()).toBe(0);
    });

    it('does not mutate the original date', () => {
        const original = new Date(2026, 2, 5, 14, 30);
        startOfDay(original);
        expect(original.getHours()).toBe(14);
    });
});

describe('daysBetween', () => {
    it('returns 0 for same day', () => {
        expect(daysBetween(new Date(2026, 2, 5), new Date(2026, 2, 5))).toBe(0);
    });

    it('returns 1 for adjacent days', () => {
        expect(daysBetween(new Date(2026, 2, 5), new Date(2026, 2, 6))).toBe(1);
    });

    it('returns correct count across months', () => {
        // March 30 to April 2 = 3 days
        expect(daysBetween(new Date(2026, 2, 30), new Date(2026, 3, 2))).toBe(3);
    });

    it('is order-independent', () => {
        expect(daysBetween(new Date(2026, 2, 6), new Date(2026, 2, 5))).toBe(1);
    });
});

describe('isInRange', () => {
    const range = { start: new Date(2026, 2, 1), end: new Date(2026, 2, 31) };

    it('returns true for date inside range', () => {
        expect(isInRange(new Date(2026, 2, 15), range)).toBe(true);
    });

    it('returns true on start boundary', () => {
        expect(isInRange(new Date(2026, 2, 1), range)).toBe(true);
    });

    it('returns true on end boundary', () => {
        expect(isInRange(new Date(2026, 2, 31), range)).toBe(true);
    });

    it('returns false for date before range', () => {
        expect(isInRange(new Date(2026, 1, 28), range)).toBe(false);
    });

    it('returns false for date after range', () => {
        expect(isInRange(new Date(2026, 3, 1), range)).toBe(false);
    });
});
