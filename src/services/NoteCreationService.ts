/**
 * Note Creation Service
 *
 * Creates daily notes and weekly review notes in the vault.
 * Uses ensureFolderExists() before vault.create() and
 * normalizePath() on all constructed paths.
 */

import { type App, type TFile, normalizePath } from 'obsidian';
import { ensureFolderExists, sanitizeFileName } from '../utils/vaultUtils';
import type { DateRange } from '../types';

/**
 * Create a new daily note from a template.
 * Uses the user's detected section headings as template content.
 * Places the note in the journal folder with the correct filename pattern.
 *
 * @param app - Obsidian App instance
 * @param date - Date for the new entry
 * @param journalFolder - Configured journal folder path
 * @param detectedSections - Section headings detected from existing entries
 * @returns The created TFile
 */
export async function createDailyNote(
    app: App,
    date: Date,
    journalFolder: string,
    detectedSections: string[]
): Promise<TFile> {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const dateStr = formatDate(date);
    const fileName = `${dateStr}, ${dayName}.md`;
    const filePath = normalizePath(`${journalFolder}/${fileName}`);

    // Check if file already exists
    const existing = app.vault.getFileByPath(filePath);
    if (existing) {
        return existing;
    }

    // Build template content
    const lines: string[] = [];
    lines.push('---');
    lines.push(`date: ${dateStr}`);
    lines.push('---');
    lines.push('');

    // Add detected section headings
    if (detectedSections.length > 0) {
        for (const heading of detectedSections) {
            lines.push(`## ${heading}`);
            lines.push('');
            lines.push('');
        }
    }

    const content = lines.join('\n');

    // Ensure parent folder exists
    await ensureFolderExists(app.vault, journalFolder);

    // Create the file
    return await app.vault.create(filePath, content);
}

/**
 * Create a weekly review note from digest data.
 * Places in weeklyReviewFolder if configured, otherwise vault root.
 *
 * @param app - Obsidian App instance
 * @param content - Markdown content for the weekly review
 * @param weeklyReviewFolder - Configured weekly review folder path
 * @param dateRange - Date range covered by the review
 * @returns The created TFile
 */
export async function createWeeklyReview(
    app: App,
    content: string,
    weeklyReviewFolder: string,
    dateRange: DateRange
): Promise<TFile> {
    const startStr = formatDate(dateRange.start);
    const endStr = formatDate(dateRange.end);
    const rawFileName = `Weekly Review ${startStr} to ${endStr}`;
    const fileName = sanitizeFileName(rawFileName) + '.md';

    const folder = weeklyReviewFolder || '';
    const filePath = folder
        ? normalizePath(`${folder}/${fileName}`)
        : normalizePath(fileName);

    // Check if file already exists
    const existing = app.vault.getFileByPath(filePath);
    if (existing) {
        return existing;
    }

    // Ensure parent folder exists
    if (folder) {
        await ensureFolderExists(app.vault, folder);
    }

    // Create the file
    return await app.vault.create(filePath, content);
}

/**
 * Format a Date to YYYY-MM-DD.
 */
function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
