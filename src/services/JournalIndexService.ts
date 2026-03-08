/**
 * Journal Index Service
 *
 * The core indexing engine. Recursively scans the journal folder,
 * parses daily notes into JournalEntry objects, and keeps the index
 * alive with file event watching.
 *
 * Two-pass initialization:
 *   Pass 1 (instant): frontmatter via MetadataCache (zero file I/O)
 *   Pass 2 (background): full content via cachedRead, time-based yielding
 *
 * File watcher features:
 *   - Debounced metadata changes (400ms per file)
 *   - Debounced detectFields() re-detection (5s after last change)
 *   - Schema-dirty flag (only set when frontmatter KEYS change, not just values)
 *   - Atomic indexing lock (prevents re-entry during initialize/reconfigure)
 *   - Bulk event settling (>10 events in 500ms → wait 2s → full re-index)
 */

import { App, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import type HindsightPlugin from '../../main';
import type { JournalEntry } from '../types';
import { parseJournalFileName } from '../utils/fileNameParser';
import { formatDateISO } from '../utils/dateUtils';
import { parseSections, extractImagePaths, countWords } from '../services/SectionParserService';
import { detectFields } from '../services/FrontmatterService';
import { useJournalStore } from '../store/journalStore';
import { processWithYielding } from '../utils/yieldUtils';
import { debugLog } from '../utils/debugLog';

/** Debounce delay for file change events (ms) */
const DEBOUNCE_MS = 400;
/** Debounce delay for detectFields() re-detection (ms) */
const DETECT_FIELDS_DEBOUNCE_MS = 5000;
/** Bulk event threshold — events within the window */
const BULK_EVENT_THRESHOLD = 10;
/** Bulk event window (ms) */
const BULK_EVENT_WINDOW_MS = 500;
/** Bulk settle delay — silence required before re-index (ms) */
const BULK_SETTLE_MS = 2000;

export class JournalIndexService {
    private app: App;
    private plugin: HindsightPlugin;
    private journalFolder: string; // normalizePath'd
    private debounceTimers: Map<string, ReturnType<typeof setTimeout>>;

    // Item 9: Debounced detectFields
    private detectFieldsTimer: ReturnType<typeof setTimeout> | null = null;

    // Item 9a: Atomic indexing lock
    private isIndexing = false;
    private needsReindex = false;

    // Item 9b: Bulk event settling
    private bulkEventTimestamps: number[] = [];
    private bulkSettleTimer: ReturnType<typeof setTimeout> | null = null;
    private inBulkMode = false;

    constructor(app: App, plugin: HindsightPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.journalFolder = normalizePath(plugin.settings.journalFolder);
        this.debounceTimers = new Map();
    }

    /**
     * Two-pass initialization. Delegates to runPass1() and runPass2().
     * Called once on plugin load via workspace.onLayoutReady().
     * Protected by atomic indexing lock (item 9a).
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
     *     If the folder doesn't exist, shows a Notice and returns early.
     *     This implicitly blocks path traversal (../../ won't resolve).
     *   - Recursively scan for .md files matching filename pattern
     *   - For each candidate: metadataCache.getFileCache(file) for frontmatter
     *   - Extract date from frontmatter `date` field (authoritative), fall back to filename
     *   - Create JournalEntry with frontmatter populated, sections/wordCount/imagePaths empty
     *   - Set fullyIndexed = false
     *   - Uses store.setEntries() (bulk) — sorts sortedDates once
     *   - Calls detectFields() ONCE after all entries are populated
     *   - Updates store.indexingProgress to { phase: 1, processed: N, total: N }
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
     * PASS 2 (background, time-based yielding via processWithYielding):
     *   - For each entry: vault.cachedRead() → parse sections, word count, image paths
     *   - Yields to main thread based on time budget (not fixed batch size)
     *   - Collects updated entries and bulk upserts at the end
     *   - Set fullyIndexed = true per entry
     *   - Compute qualityScore per entry based on detected fields vs filled fields
     *   - Updates store.indexingProgress as batches complete
     *   - Calls detectFields() ONE MORE TIME after all entries finish
     *     (for accurate coverage/ranges with full data)
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
     * Returns TFile references for all matching files.
     */
    private scanFolder(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                files.push(...this.scanFolder(child));
            } else if (child instanceof TFile) {
                // Only process .md files that match the journal filename pattern
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
     * Date is sourced from frontmatter `date` field; falls back to filename regex.
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
        };
    }

    /**
     * Parse full content for an entry (pass 2).
     * Uses vault.cachedRead() for content.
     * Uses SectionParserService for sections, word count, and images.
     * Updates the existing entry in place.
     */
    async parseEntryContent(file: TFile, entry: JournalEntry): Promise<void> {
        const content = await this.app.vault.cachedRead(file);

        entry.sections = parseSections(content);
        entry.wordCount = countWords(content);
        entry.imagePaths = extractImagePaths(content);
        entry.mtime = file.stat.mtime;
        entry.fullyIndexed = true;
    }

    /**
     * Compute quality score: percentage of detected fields that are filled.
     */
    private computeQualityScore(
        entry: JournalEntry,
        detectedFields: { key: string }[]
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
     * Called when the user changes the folder in settings (via onBlur).
     * Clears the store, updates this.journalFolder, and re-runs both passes.
     * Protected by atomic indexing lock (item 9a).
     */
    async reconfigure(newFolder: string): Promise<void> {
        this.journalFolder = normalizePath(newFolder);
        useJournalStore.getState().clear();
        await this.initialize();
    }

    /**
     * Debounced detectFields() — waits 5 seconds after last trigger.
     * Direct calls remain in runPass1/runPass2/reconfigure; watchers use this.
     */
    private debouncedDetectFields(): void {
        if (this.detectFieldsTimer) {
            clearTimeout(this.detectFieldsTimer);
        }
        this.detectFieldsTimer = setTimeout(() => {
            this.detectFieldsTimer = null;
            const store = useJournalStore.getState();
            const allEntries = Array.from(store.entries.values());
            store.setDetectedFields(detectFields(allEntries));
            store.setSchemaDirty(false);
            debugLog('detectFields() completed (debounced)');
        }, DETECT_FIELDS_DEBOUNCE_MS);
    }

    /**
     * Check if a file change altered the frontmatter KEY set (not just values).
     * If keys changed, set schemaDirty = true for UI feedback.
     */
    private checkSchemaChange(entry: JournalEntry): void {
        const store = useJournalStore.getState();
        const currentKeys = new Set(store.detectedFields.map(f => f.key));
        const entryKeys = Object.keys(entry.frontmatter);

        // Check if any key in the entry is NOT in detectedFields
        for (const key of entryKeys) {
            if (!currentKeys.has(key)) {
                store.setSchemaDirty(true);
                debugLog('Schema change detected: new key', key);
                return;
            }
        }
    }

    /**
     * Track a file watcher event for bulk event settling.
     * If >BULK_EVENT_THRESHOLD events occur within BULK_EVENT_WINDOW_MS,
     * switch to bulk mode: pause individual processing, wait for
     * BULK_SETTLE_MS of silence, then run full re-index.
     *
     * Returns true if the event should be handled individually (normal mode),
     * or false if bulk mode is active (caller should skip individual processing).
     */
    private trackBulkEvent(): boolean {
        const now = Date.now();

        // Add this event timestamp
        this.bulkEventTimestamps.push(now);

        // Remove timestamps older than the window
        this.bulkEventTimestamps = this.bulkEventTimestamps.filter(
            ts => now - ts < BULK_EVENT_WINDOW_MS
        );

        // Check if we've exceeded the threshold
        if (this.bulkEventTimestamps.length >= BULK_EVENT_THRESHOLD) {
            if (!this.inBulkMode) {
                this.inBulkMode = true;
                debugLog('Bulk event mode activated:', this.bulkEventTimestamps.length, 'events in window');
            }

            // Reset settle timer — wait for silence
            if (this.bulkSettleTimer) {
                clearTimeout(this.bulkSettleTimer);
            }
            this.bulkSettleTimer = setTimeout(() => {
                this.bulkSettleTimer = null;
                this.inBulkMode = false;
                this.bulkEventTimestamps = [];
                debugLog('Bulk settle complete — running full re-index');
                void this.initialize();
            }, BULK_SETTLE_MS);

            return false; // Skip individual processing
        }

        // Also reset settle timer in bulk mode (any event extends the settle wait)
        if (this.inBulkMode) {
            if (this.bulkSettleTimer) {
                clearTimeout(this.bulkSettleTimer);
            }
            this.bulkSettleTimer = setTimeout(() => {
                this.bulkSettleTimer = null;
                this.inBulkMode = false;
                this.bulkEventTimestamps = [];
                debugLog('Bulk settle complete — running full re-index');
                void this.initialize();
            }, BULK_SETTLE_MS);
            return false;
        }

        return true; // Normal mode — handle individually
    }

    /**
     * Register file watchers for create/delete/rename events AND metadata changes.
     * Uses plugin.registerEvent() for automatic cleanup on unload.
     *
     * EVENT ARCHITECTURE:
     *   - metadataCache.on('changed', (file, data, cache) => ...)
     *     → Used for frontmatter updates. This fires AFTER the cache has been
     *       updated, avoiding the race condition of vault.on('modify') + getFileCache().
     *     → Debounced by DEBOUNCE_MS to avoid re-parsing on every keystroke.
     *     → Checks file.stat.mtime against stored entry.mtime to skip no-ops.
     *   - vault.on('create', callback)
     *     → Parses if it matches filename pattern, adds to store.
     *   - vault.on('delete', callback)
     *     → Removes from store.
     *   - vault.on('rename', (file, oldPath) => ...)
     *     → Removes old path, adds new if it matches pattern.
     *
     * All handlers check file instanceof TFile and file.path starts with journalFolder.
     * All handlers check bulk event settling before processing individually.
     * detectFields() is debounced at 5 seconds — watchers never call it directly.
     */
    registerFileWatchers(): void {
        const store = useJournalStore;

        // Metadata change handler (debounced)
        this.plugin.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                if (!(file instanceof TFile)) return;
                if (!file.path.startsWith(this.journalFolder)) return;
                if (!parseJournalFileName(file.name)) return;

                // Bulk event check
                if (!this.trackBulkEvent()) return;

                // Check mtime to skip no-ops
                const existing = store.getState().entries.get(file.path);
                if (existing && existing.mtime === file.stat.mtime) return;

                // Debounce by file path
                const existingTimer = this.debounceTimers.get(file.path);
                if (existingTimer) clearTimeout(existingTimer);

                this.debounceTimers.set(
                    file.path,
                    setTimeout(() => {
                        void (async () => {
                            try {
                                this.debounceTimers.delete(file.path);
                                const entry = this.parseEntryFrontmatterOnly(file);
                                if (entry) {
                                    await this.parseEntryContent(file, entry);
                                    const detectedFields = store.getState().detectedFields;
                                    entry.qualityScore = this.computeQualityScore(entry, detectedFields);

                                    // Check schema before upserting
                                    this.checkSchemaChange(entry);

                                    store.getState().upsertEntry(entry);

                                    // Debounced field re-detection (5s)
                                    this.debouncedDetectFields();
                                }
                            } catch (err) {
                                console.error('[Hindsight] File watcher error:', err);
                            }
                        })();
                    }, DEBOUNCE_MS)
                );
            })
        );

        // New file handler
        this.plugin.registerEvent(
            this.app.vault.on('create', (file) => {
                void (async () => {
                    try {
                        if (!(file instanceof TFile)) return;
                        if (!file.path.startsWith(this.journalFolder)) return;

                        // Bulk event check
                        if (!this.trackBulkEvent()) return;

                        const entry = this.parseEntryFrontmatterOnly(file);
                        if (entry) {
                            await this.parseEntryContent(file, entry);
                            const detectedFields = store.getState().detectedFields;
                            entry.qualityScore = this.computeQualityScore(entry, detectedFields);

                            this.checkSchemaChange(entry);
                            store.getState().upsertEntry(entry);
                            this.debouncedDetectFields();
                        }
                    } catch (err) {
                        console.error('[Hindsight] File watcher error:', err);
                    }
                })();
            })
        );

        // Delete handler
        this.plugin.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (!(file instanceof TFile)) return;
                if (!file.path.startsWith(this.journalFolder)) return;

                // Bulk event check
                if (!this.trackBulkEvent()) return;

                store.getState().removeEntry(file.path);
                this.debouncedDetectFields();
            })
        );

        // Rename handler
        this.plugin.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                void (async () => {
                    try {
                        if (!(file instanceof TFile)) return;

                        // Bulk event check
                        if (!this.trackBulkEvent()) return;

                        // Remove old path if it was in our index
                        if (oldPath.startsWith(this.journalFolder)) {
                            store.getState().removeEntry(oldPath);
                        }

                        // Add new path if it matches pattern and is in our folder
                        if (file.path.startsWith(this.journalFolder)) {
                            const entry = this.parseEntryFrontmatterOnly(file);
                            if (entry) {
                                await this.parseEntryContent(file, entry);
                                const detectedFields = store.getState().detectedFields;
                                entry.qualityScore = this.computeQualityScore(entry, detectedFields);
                                this.checkSchemaChange(entry);
                                store.getState().upsertEntry(entry);
                            }
                        }

                        this.debouncedDetectFields();
                    } catch (err) {
                        console.error('[Hindsight] File watcher error:', err);
                    }
                })();
            })
        );
    }

    /** Clean up debounce timers and any resources (called from plugin.onunload()) */
    destroy(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        if (this.detectFieldsTimer) {
            clearTimeout(this.detectFieldsTimer);
            this.detectFieldsTimer = null;
        }

        if (this.bulkSettleTimer) {
            clearTimeout(this.bulkSettleTimer);
            this.bulkSettleTimer = null;
        }

        this.bulkEventTimestamps = [];
        this.inBulkMode = false;
    }
}
