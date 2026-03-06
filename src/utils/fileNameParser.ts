export interface ParsedFileName {
    date: Date;
    dayOfWeek: string;
}

/**
 * Parse a journal filename into date and day of week.
 * Expected format: "2026-03-05, Thursday.md"
 * Returns null if the filename doesn't match the expected pattern.
 */
export function parseJournalFileName(filename: string): ParsedFileName | null {
    // Regex: YYYY-MM-DD, DayName.md
    const match = filename.match(/^(\d{4})-(\d{2})-(\d{2}),\s+(\w+)\.md$/);
    if (!match) return null;

    const [, year, month, day, dayOfWeek] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    // Validate the date is real (catches things like Feb 31)
    if (isNaN(date.getTime())) return null;
    if (date.getFullYear() !== Number(year)) return null;
    if (date.getMonth() !== Number(month) - 1) return null;
    if (date.getDate() !== Number(day)) return null;

    return { date, dayOfWeek };
}
