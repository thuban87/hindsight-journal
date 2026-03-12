/**
 * NoteCreationService Tests
 *
 * Tests for createDailyNote() and createWeeklyReview().
 * Verifies correct filename generation, template content,
 * and folder placement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDailyNote, createWeeklyReview } from '../../src/services/NoteCreationService';
import type { DateRange } from '../../src/types';

// --- Mock App factory ---

function makeMockApp() {
    const createdFiles: { path: string; content: string }[] = [];
    const existingFolders = new Set<string>();

    const app = {
        vault: {
            getFileByPath: vi.fn().mockReturnValue(null),
            getFolderByPath: vi.fn((p: string) => existingFolders.has(p) ? {} : null),
            create: vi.fn(async (path: string, content: string) => {
                createdFiles.push({ path, content });
                return { path, name: path.split('/').pop() ?? path, extension: 'md', stat: { mtime: Date.now(), ctime: Date.now(), size: content.length } };
            }),
            createFolder: vi.fn(async (path: string) => {
                existingFolders.add(path);
            }),
        },
    };

    return { app, createdFiles, existingFolders };
}

// ===== createDailyNote =====

describe('createDailyNote', () => {
    let mockApp: ReturnType<typeof makeMockApp>;

    beforeEach(() => {
        mockApp = makeMockApp();
    });

    it('generates correct filename from date', async () => {
        // 2026-03-11 is a Wednesday
        const date = new Date(2026, 2, 11); // March 11, 2026
        await createDailyNote(mockApp.app as never, date, 'Journal', ['Mood', 'Notes']);

        expect(mockApp.createdFiles).toHaveLength(1);
        expect(mockApp.createdFiles[0].path).toBe('Journal/2026-03-11, Wednesday.md');
    });

    it('includes detected section headings in template', async () => {
        const date = new Date(2026, 2, 11);
        await createDailyNote(mockApp.app as never, date, 'Journal', ['Morning Routine', 'What Happened', 'Gratitude']);

        const content = mockApp.createdFiles[0].content;
        expect(content).toContain('## Morning Routine');
        expect(content).toContain('## What Happened');
        expect(content).toContain('## Gratitude');
    });

    it('places note in configured journal folder', async () => {
        const date = new Date(2026, 0, 5); // January 5, 2026 (Monday)
        await createDailyNote(mockApp.app as never, date, 'My/Journal/Folder', []);

        expect(mockApp.createdFiles[0].path).toBe('My/Journal/Folder/2026-01-05, Monday.md');
    });
});

// ===== createWeeklyReview =====

describe('createWeeklyReview', () => {
    let mockApp: ReturnType<typeof makeMockApp>;

    beforeEach(() => {
        mockApp = makeMockApp();
    });

    it('places note in configured weekly review folder', async () => {
        const dateRange: DateRange = {
            start: new Date(2026, 2, 2),
            end: new Date(2026, 2, 8),
        };
        await createWeeklyReview(mockApp.app as never, '# Weekly Review\n\nTest content', 'Reviews', dateRange);

        expect(mockApp.createdFiles).toHaveLength(1);
        expect(mockApp.createdFiles[0].path).toContain('Reviews/');
    });

    it('generates filename from date range', async () => {
        const dateRange: DateRange = {
            start: new Date(2026, 2, 2),
            end: new Date(2026, 2, 8),
        };
        await createWeeklyReview(mockApp.app as never, '# Review', 'Reviews', dateRange);

        expect(mockApp.createdFiles[0].path).toContain('Weekly Review 2026-03-02 to 2026-03-08');
        expect(mockApp.createdFiles[0].path).toMatch(/\.md$/);
    });
});
