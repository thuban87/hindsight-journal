/**
 * Tiered Sections Tests
 *
 * Tests for hot/cold tier section storage and ensureSectionsLoaded
 * lazy-loading behavior in the journalStore.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock obsidian module
vi.mock('obsidian', () => ({
    Platform: { isMobile: false },
    normalizePath: (p: string) => p.replace(/\\/g, '/'),
}));

import { useJournalStore, clearInFlightMap } from '../../src/store/journalStore';
import { useAppStore } from '../../src/store/appStore';
import type { JournalEntry } from '../../src/types';
import type { HindsightPluginInterface } from '../../src/types/plugin';

/** Create a hot-tier entry (recent, with full sections) */
function makeHotEntry(filePath: string, daysAgo: number): JournalEntry {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
        filePath,
        date,
        dayOfWeek: 'Monday',
        frontmatter: {},
        sections: {
            'What Actually Happened': 'Today I went to the park.',
            'Mood': 'Felt great!',
        },
        wordCount: 50,
        imagePaths: [],
        mtime: date.getTime(),
        fullyIndexed: true,
        qualityScore: 80,
    };
}

/** Create a cold-tier entry (old, with empty sections but sectionHeadings) */
function makeColdEntry(filePath: string, daysAgo: number): JournalEntry {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
        filePath,
        date,
        dayOfWeek: 'Monday',
        frontmatter: {},
        sections: {}, // Empty — cold tier
        sectionHeadings: ['What Actually Happened', 'Mood'],
        firstSectionExcerpt: 'A long time ago...',
        wordCount: 50,
        imagePaths: [],
        mtime: date.getTime(),
        fullyIndexed: true,
        qualityScore: 70,
    };
}

/** Set up a mock app with a fake vault for file reading */
function setupMockApp(fileContents: Record<string, string>) {
    const mockApp = {
        workspace: {},
        vault: {
            getFileByPath: (path: string) => {
                if (path in fileContents) {
                    return { path } as unknown;
                }
                return null;
            },
            cachedRead: vi.fn(async (file: { path: string }) => {
                return fileContents[file.path] ?? '';
            }),
        },
        metadataCache: {},
    } as unknown as import('obsidian').App;

    const mockPlugin: HindsightPluginInterface = {
        settings: {} as HindsightPluginInterface['settings'],
        saveSettings: vi.fn(),
        services: { journalIndex: null },
    };

    useAppStore.getState().setApp(mockApp, mockPlugin);
    return mockApp;
}

describe('Tiered Sections', () => {
    beforeEach(() => {
        useJournalStore.getState().reset();
        clearInFlightMap();
        useAppStore.getState().reset();
    });

    describe('Hot tier', () => {
        it('entries within HOT_TIER_DAYS have full sections populated', () => {
            const entry = makeHotEntry('Journal/recent.md', 5);
            useJournalStore.getState().upsertEntry(entry);

            const stored = useJournalStore.getState().entries.get('Journal/recent.md');
            expect(stored).toBeDefined();
            expect(Object.keys(stored!.sections).length).toBeGreaterThan(0);
            expect(stored!.sections['What Actually Happened']).toBeTruthy();
        });
    });

    describe('Cold tier', () => {
        it('entries older than HOT_TIER_DAYS have empty sections with populated sectionHeadings and firstSectionExcerpt', () => {
            const entry = makeColdEntry('Journal/old.md', 200);
            useJournalStore.getState().upsertEntry(entry);

            const stored = useJournalStore.getState().entries.get('Journal/old.md');
            expect(stored).toBeDefined();
            expect(Object.keys(stored!.sections)).toHaveLength(0);
            expect(stored!.sectionHeadings).toBeDefined();
            expect(stored!.sectionHeadings!.length).toBeGreaterThan(0);
            expect(stored!.firstSectionExcerpt).toBeTruthy();
        });
    });

    describe('ensureSectionsLoaded', () => {
        it('lazy-loads full sections for a cold entry and caches the result', async () => {
            const coldEntry = makeColdEntry('Journal/old.md', 200);
            useJournalStore.getState().upsertEntry(coldEntry);

            setupMockApp({
                'Journal/old.md': '## What Actually Happened\nHad a wonderful day.\n## Mood\nFeeling good!',
            });

            const result = await useJournalStore.getState().ensureSectionsLoaded('Journal/old.md');
            expect(result).not.toBeNull();
            expect(Object.keys(result!.sections).length).toBeGreaterThan(0);

            // Verify it's also cached in the store
            const cached = useJournalStore.getState().entries.get('Journal/old.md');
            expect(Object.keys(cached!.sections).length).toBeGreaterThan(0);
        });

        it('returns immediately for a hot entry (already has full sections)', async () => {
            const hotEntry = makeHotEntry('Journal/recent.md', 5);
            useJournalStore.getState().upsertEntry(hotEntry);

            // No mock app needed — should return entry directly
            const result = await useJournalStore.getState().ensureSectionsLoaded('Journal/recent.md');
            expect(result).not.toBeNull();
            expect(result!.sections['What Actually Happened']).toBeTruthy();
        });

        it('handles missing file gracefully (file deleted between index and load)', async () => {
            const coldEntry = makeColdEntry('Journal/deleted.md', 200);
            useJournalStore.getState().upsertEntry(coldEntry);

            // Mock app where the file no longer exists
            setupMockApp({});

            const result = await useJournalStore.getState().ensureSectionsLoaded('Journal/deleted.md');
            // Should return the entry (without crashing), sections remain empty
            expect(result).not.toBeNull();
        });

        it('concurrent callers for the same filePath receive the same promise (dedup)', async () => {
            const coldEntry = makeColdEntry('Journal/shared.md', 200);
            useJournalStore.getState().upsertEntry(coldEntry);

            const mockApp = setupMockApp({
                'Journal/shared.md': '## Section\nContent here.',
            });

            // Start two concurrent loads for the same file
            const promise1 = useJournalStore.getState().ensureSectionsLoaded('Journal/shared.md');
            const promise2 = useJournalStore.getState().ensureSectionsLoaded('Journal/shared.md');

            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Both should resolve to the same result
            expect(result1).not.toBeNull();
            expect(result2).not.toBeNull();

            // vault.cachedRead should only be called once (dedup)
            expect(mockApp.vault.cachedRead).toHaveBeenCalledTimes(1);
        });

        it('concurrent callers for different filePaths run independently', async () => {
            const cold1 = makeColdEntry('Journal/file1.md', 200);
            const cold2 = makeColdEntry('Journal/file2.md', 200);
            useJournalStore.getState().upsertEntry(cold1);
            useJournalStore.getState().upsertEntry(cold2);

            const mockApp = setupMockApp({
                'Journal/file1.md': '## Section A\nContent A.',
                'Journal/file2.md': '## Section B\nContent B.',
            });

            const promise1 = useJournalStore.getState().ensureSectionsLoaded('Journal/file1.md');
            const promise2 = useJournalStore.getState().ensureSectionsLoaded('Journal/file2.md');

            await Promise.all([promise1, promise2]);

            // Both files should have been read independently
            expect(mockApp.vault.cachedRead).toHaveBeenCalledTimes(2);
        });
    });
});
