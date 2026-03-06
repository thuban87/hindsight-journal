import { describe, it, expect } from 'vitest';
import { parseJournalFileName } from '../../src/utils/fileNameParser';

describe('parseJournalFileName', () => {
    describe('valid filenames', () => {
        it('parses standard filename with correct date and dayOfWeek', () => {
            const result = parseJournalFileName('2026-03-05, Thursday.md');
            expect(result).not.toBeNull();
            expect(result!.date.getFullYear()).toBe(2026);
            expect(result!.date.getMonth()).toBe(2); // March = 2 (0-indexed)
            expect(result!.date.getDate()).toBe(5);
            expect(result!.dayOfWeek).toBe('Thursday');
        });

        it('parses Monday', () => {
            const result = parseJournalFileName('2026-03-02, Monday.md');
            expect(result).not.toBeNull();
            expect(result!.dayOfWeek).toBe('Monday');
        });

        it('parses Tuesday', () => {
            const result = parseJournalFileName('2026-03-03, Tuesday.md');
            expect(result).not.toBeNull();
            expect(result!.dayOfWeek).toBe('Tuesday');
        });

        it('parses Wednesday', () => {
            const result = parseJournalFileName('2026-03-04, Wednesday.md');
            expect(result).not.toBeNull();
            expect(result!.dayOfWeek).toBe('Wednesday');
        });

        it('parses Friday', () => {
            const result = parseJournalFileName('2026-03-06, Friday.md');
            expect(result).not.toBeNull();
            expect(result!.dayOfWeek).toBe('Friday');
        });

        it('parses Saturday', () => {
            const result = parseJournalFileName('2026-03-07, Saturday.md');
            expect(result).not.toBeNull();
            expect(result!.dayOfWeek).toBe('Saturday');
        });

        it('parses Sunday', () => {
            const result = parseJournalFileName('2026-03-08, Sunday.md');
            expect(result).not.toBeNull();
            expect(result!.dayOfWeek).toBe('Sunday');
        });

        it('parses different years and months', () => {
            const result = parseJournalFileName('2024-11-15, Friday.md');
            expect(result).not.toBeNull();
            expect(result!.date.getFullYear()).toBe(2024);
            expect(result!.date.getMonth()).toBe(10); // November
            expect(result!.date.getDate()).toBe(15);
        });

        it('parses Jan 1', () => {
            const result = parseJournalFileName('2026-01-01, Thursday.md');
            expect(result).not.toBeNull();
            expect(result!.date.getMonth()).toBe(0);
            expect(result!.date.getDate()).toBe(1);
        });

        it('parses Dec 31', () => {
            const result = parseJournalFileName('2026-12-31, Wednesday.md');
            expect(result).not.toBeNull();
            expect(result!.date.getMonth()).toBe(11);
            expect(result!.date.getDate()).toBe(31);
        });

        it('parses Feb 29 on leap year', () => {
            const result = parseJournalFileName('2024-02-29, Thursday.md');
            expect(result).not.toBeNull();
            expect(result!.date.getMonth()).toBe(1);
            expect(result!.date.getDate()).toBe(29);
        });

        it('parses Feb 28', () => {
            const result = parseJournalFileName('2026-02-28, Saturday.md');
            expect(result).not.toBeNull();
            expect(result!.date.getMonth()).toBe(1);
            expect(result!.date.getDate()).toBe(28);
        });
    });

    describe('invalid filenames', () => {
        it('returns null for missing day of week', () => {
            expect(parseJournalFileName('2026-03-05.md')).toBeNull();
        });

        it('returns null for wrong extension', () => {
            expect(parseJournalFileName('2026-03-05, Thursday.txt')).toBeNull();
        });

        it('returns null for impossible date (Feb 31)', () => {
            expect(parseJournalFileName('2026-02-31, Monday.md')).toBeNull();
        });

        it('returns null for Feb 29 on non-leap year', () => {
            expect(parseJournalFileName('2026-02-29, Sunday.md')).toBeNull();
        });

        it('returns null for no comma separator', () => {
            expect(parseJournalFileName('2026-03-05 Thursday.md')).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(parseJournalFileName('')).toBeNull();
        });

        it('returns null for random text', () => {
            expect(parseJournalFileName('hello world')).toBeNull();
        });

        it('returns null for just the date with no extension', () => {
            expect(parseJournalFileName('2026-03-05, Thursday')).toBeNull();
        });

        it('returns null for month 13', () => {
            expect(parseJournalFileName('2026-13-05, Thursday.md')).toBeNull();
        });

        it('returns null for day 00', () => {
            expect(parseJournalFileName('2026-03-00, Thursday.md')).toBeNull();
        });
    });
});
