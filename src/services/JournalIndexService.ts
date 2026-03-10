/**
 * Journal Index Service
 *
 * The core indexing engine. Recursively scans the journal folder,
 * parses daily notes into JournalEntry objects via two-pass initialization.
 *
 * Two-pass initialization:
 *   Pass 1 (instant): frontmatter via MetadataCache (zero file I/O)
 *   Pass 2 (background): full content via cachedRead, time-based yielding
 *
 * File watching is handled by FileWatcherService (extracted in Phase 5a).
 */

import { App, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import type HindsightPlugin from '../../main';
import type { JournalEntry, FrontmatterField } from '../types';
import { parseJournalFileName } from '../utils/fileNameParser';
import { parseSections, extractImagePaths, countWords, stripMarkdown } from '../services/SectionParserService';
import { detectFields } from '../services/FrontmatterService';
import { useJournalStore } from '../store/journalStore';
import { processWithYielding } from '../utils/yieldUtils';
import { parseTaskCompletion } from '../utils/taskParser';
import { debugLog } from '../utils/debugLog';

export class JournalIndexService {
    private app: App;
    private plugin: HindsightPlugin;
    private journalFolder: string; // normalizePath'd

    // Atomic indexing lock
    private isIndexing = false;
    private needsReindex = false;

    constructor(app: App, plugin: HindsightPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.journalFolder = normalizePath(plugin.settings.journalFolder);
    }

    /**
     * Two-pass initialization. Delegates to runPass1() and runPass2().
     * Called once on plugin load via workspace.onLayoutReady().
     * Protected by atomic indexing lock.
     */
    async initialize(): Promise<void> {
        // Atomic indexing lock: if already indexing, flag for re-run
        if (this.isIndexing) {
            this.needsReindex = true;
            debugLog('initialize() called while already indexing — will re-run');
            return;
        }

        this.isIndexing = true;
        const store = useJournalStore.getState();
        store.setLoading(true);
        store.setError(null);

        try {
            await this.runPass1();
            await this.runPass2();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            store.setError(message);
            console.error('Hindsight: indexing failed', err);
        } finally {
            store.setLoading(false);
            store.setIndexingProgress(null);
            this.isIndexing = false;

            // Check if a re-index was requested during our run
            if (this.needsReindex) {
                this.needsReindex = false;
                debugLog('Re-index requested during indexing — starting again');
                await this.initialize();
            }
        }
    }

    /**
     * PASS 1 (instant, no file I/O):
     *   - Validates journalFolder by calling getFolderByPath().
     *   - Recursively scan for .md files matching filename pattern
     *   - For each candidate: metadataCache.getFileCache(file) for frontmatter
     *   - Calls detectFields() ONCE after all entries are populated
     */
    private async runPass1(): Promise<void> {
        const store = useJournalStore.getState();

        // Validate journal folder exists
        const folder = this.app.vault.getFolderByPath(this.journalFolder);
        if (!folder) {
            new Notice(`Hindsight: Journal folder "${this.journalFolder}" not found.`);
            store.setError(`Journal folder "${this.journalFolder}" not found.`);
            return;
        }

        // Scan for matching files
        const files = this.scanFolder(folder);
        const total = files.length;
        store.setIndexingProgress({ phase: 1, processed: 0, total });

        // Parse frontmatter for each file
        const entries: JournalEntry[] = [];
        for (let i = 0; i < files.length; i++) {
            const entry = this.parseEntryFrontmatterOnly(files[i]);
            if (entry) {
                entries.push(entry);
            }
            store.setIndexingProgress({ phase: 1, processed: i + 1, total });
        }

        // Bulk set all entries (sorts once)
        store.setEntries(entries);

        // Detect frontmatter fields once after all entries populated
        store.setDetectedFields(detectFields(entries));
    }

    /**
     * PASS 2 (background, time-based yielding):
     *   - For each entry: vault.cachedRead() → parse sections, word count, image paths
     *   - Implements tiered section storage (hot/cold based on hotTierDays)
     *   - Bulk upserts at the end (single revision increment)
     */
    private async runPass2(): Promise<void> {
        const store = useJournalStore.getState();
        const entries = Array.from(store.entries.values());
        const total = entries.length;

        if (total === 0) return;

        store.setIndexingProgress({ phase: 2, processed: 0, total });

        const updatedEntries: JournalEntry[] = [];

        await processWithYielding(
            entries,
            async (entry) => {
                const file = this.app.vault.getFileByPath(entry.filePath);
                if (file && file instanceof TFile) {
                    await this.parseEntryContent(file, entry);
                    updatedEntries.push(entry);
                }
            },
            {
                onProgress: (processed, _total) => {
                    useJournalStore.getState().setIndexingProgress({
                        phase: 2,
                        processed,
                        total: _total,
                    });
                },
                onError: (item, err) => {
                    debugLog('Pass 2 parse error for', item.filePath, err);
                },
            }
        );

        // Compute quality scores after content parsing
        const detectedFields = useJournalStore.getState().detectedFields;
        for (const entry of updatedEntries) {
            entry.qualityScore = this.computeQualityScore(entry, detectedFields);
        }

        // Bulk upsert all updated entries at once (single revision increment)
        if (updatedEntries.length > 0) {
            useJournalStore.getState().upsertEntries(updatedEntries);
        }

        // Re-detect fields with full data for accurate coverage/ranges
        const allEntries = Array.from(useJournalStore.getState().entries.values());
        useJournalStore.getState().setDetectedFields(detectFields(allEntries));
        useJournalStore.getState().setSchemaDirty(false);
    }

    /**
     * Recursively scan a folder for .md files matching the journal filename pattern.
     */
    private scanFolder(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                files.push(...this.scanFolder(child));
            } else if (child instanceof TFile) {
                if (parseJournalFileName(child.name) !== null) {
                    files.push(child);
                }
            }
        }

        return files;
    }

    /**
     * Parse frontmatter-only entry (pass 1).
     * Uses metadataCache.getFileCache() — zero file I/O.
     */
    parseEntryFrontmatterOnly(file: TFile): JournalEntry | null {
        const parsed = parseJournalFileName(file.name);
        if (!parsed) return null;

        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter: Record<string, unknown> = { ...(cache?.frontmatter ?? {}) };

        // Remove Obsidian's internal position metadata from frontmatter
        delete frontmatter['position'];

        // Date: frontmatter `date` field is authoritative, filename is fallback
        let date = parsed.date;
        if (frontmatter['date'] && typeof frontmatter['date'] === 'string') {
            const fmDate = new Date(frontmatter['date'] + 'T00:00:00');
            if (!isNaN(fmDate.getTime())) {
                date = fmDate;
            }
        }

        return {
            filePath: file.path,
            date,
            dayOfWeek: parsed.dayOfWeek,
            frontmatter,
            sections: {},
            wordCount: 0,
            imagePaths: [],
            mtime: file.stat.mtime,
            fullyIndexed: false,
            qualityScore: 0,
            tasksCompleted: 0,
            tasksTotal: 0,
        };
    }

    /**
     * Parse full content for an entry (pass 2).
     * Implements tiered storage: hot-tier (recent) keeps full sections,
     * cold-tier (old) keeps only headings + excerpt + word counts.
     */
    async parseEntryContent(file: TFile, entry: JournalEntry): Promise<void> {
        const content = await this.app.vault.cachedRead(file);

        const sections = parseSections(content);
        entry.wordCount = countWords(content);
        entry.imagePaths = extractImagePaths(content);
        entry.mtime = file.stat.mtime;
        entry.fullyIndexed = true;

        // Always populate firstSectionExcerpt for ALL entries.
        // Prefer "What Actually Happened" (partial match — key may have emoji prefix).
        // Skip sections whose content is only template instructions.
        const sectionKeys = Object.keys(sections);
        let excerptSource = '';

        // First: find "What Actually Happened" by partial match
        for (const key of sectionKeys) {
            if (key.includes('What Actually Happened')) {
                const raw = sections[key];
                if (raw && raw.trim().length > 0) {
                    excerptSource = raw;
                    break;
                }
            }
        }

        // Second: if not found, find first section with real content
        if (!excerptSource) {
            for (const key of sectionKeys) {
                const raw = sections[key];
                if (raw && raw.trim().length > 0) {
                    excerptSource = raw;
                    break;
                }
            }
        }

        if (excerptSource) {
            // Skip template instruction lines and separators at the start.
            // Skips ALL leading lines that are short (<80 chars) or just
            // punctuation/separators until hitting a line with real content.
            const lines = excerptSource.split('\n');
            let startIdx = 0;
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed.length === 0) { startIdx = i + 1; continue; }
                if (trimmed.length < 80 && /^[\s\-–—=_*#>|:;,.!?]+$/.test(trimmed)) {
                    startIdx = i + 1; continue;
                }
                if (i < 2 && trimmed.length < 80) { startIdx = i + 1; continue; }
                break;
            }
            const skipped = startIdx > 0 && startIdx < lines.length
                ? lines.slice(startIdx).join('\n').trim()
                : excerptSource;
            entry.firstSectionExcerpt = stripMarkdown(skipped).substring(0, 200).trim();
        } else {
            entry.firstSectionExcerpt = '';
        }

        // Check entry age against hotTierDays setting
        const hotTierDays = this.plugin.settings.hotTierDays;
        const now = Date.now();
        const entryAge = (now - entry.date.getTime()) / (1000 * 60 * 60 * 24);

        if (entryAge <= hotTierDays) {
            // Hot tier: keep full sections
            entry.sections = sections;
            entry.sectionHeadings = undefined;
            entry.sectionWordCounts = undefined;
        } else {
            // Cold tier: headings + word counts only, no full content
            entry.sections = {};
            entry.sectionHeadings = sectionKeys;
            entry.sectionWordCounts = {};
            for (const key of sectionKeys) {
                entry.sectionWordCounts[key] = countWords(sections[key]);
            }
        }

        // Compute task counts from sections (uses full sections before cold-tier eviction)
        const taskResults = parseTaskCompletion(
            sections,
            this.plugin.settings.productivitySections,
            this.plugin.settings.excludedSections
        );
        entry.tasksCompleted = taskResults.reduce((sum, t) => sum + t.completed, 0);
        entry.tasksTotal = taskResults.reduce((sum, t) => sum + t.total, 0);
    }

    /**
     * Compute quality score: percentage of detected fields that are filled.
     */
    computeQualityScore(
        entry: JournalEntry,
        detectedFields: FrontmatterField[]
    ): number {
        if (detectedFields.length === 0) return 100;

        let filled = 0;
        for (const field of detectedFields) {
            const value = entry.frontmatter[field.key];
            if (value !== null && value !== undefined && value !== '') {
                filled++;
            }
        }

        return Math.round((filled / detectedFields.length) * 100);
    }

    /**
     * Re-index with a new journal folder.
     * Called when the user changes the folder in settings.
     */
    async reconfigure(newFolder: string): Promise<void> {
        this.journalFolder = normalizePath(newFolder);
        useJournalStore.getState().clear();
        await this.initialize();
    }

    /** Clean up resources (called from plugin.onunload()) */
    destroy(): void {
        // File watcher cleanup is now handled by FileWatcherService
        // JournalIndexService only needs to reset its lock state
        this.isIndexing = false;
        this.needsReindex = false;
    }
}
