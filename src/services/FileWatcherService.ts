/**
 * File Watcher Service
 *
 * Extracted from JournalIndexService (Phase 5a item 21).
 * Handles vault file event registration, debouncing, schema-dirty
 * detection, and bulk event settling.
 *
 * Event architecture:
 *   - metadataCache.on('changed') → frontmatter updates (debounced)
 *   - vault.on('create') → new journal files
 *   - vault.on('delete') → removed journal files
 *   - vault.on('rename') → moved/renamed journal files
 *
 * All handlers check:
 *   1. file instanceof TFile
 *   2. file.path starts with journalFolder
 *   3. filename matches journal pattern
 *   4. bulk event settling before individual processing
 */

import { TFile, normalizePath } from 'obsidian';
import type HindsightPlugin from '../../main';
import type { JournalEntry } from '../types';
import type { JournalIndexService } from './JournalIndexService';
import { parseJournalFileName } from '../utils/fileNameParser';
import { detectFields } from '../services/FrontmatterService';
import { useJournalStore } from '../store/journalStore';
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

export class FileWatcherService {
    private plugin: HindsightPlugin;
    private indexService: JournalIndexService;
    private journalFolder: string;
    private debounceTimers: Map<string, ReturnType<typeof setTimeout>>;

    // Debounced detectFields
    private detectFieldsTimer: ReturnType<typeof setTimeout> | null = null;

    // Bulk event settling
    private bulkEventTimestamps: number[] = [];
    private bulkSettleTimer: ReturnType<typeof setTimeout> | null = null;
    private inBulkMode = false;

    constructor(plugin: HindsightPlugin, indexService: JournalIndexService, journalFolder: string) {
        this.plugin = plugin;
        this.indexService = indexService;
        this.journalFolder = normalizePath(journalFolder);
        this.debounceTimers = new Map();
    }

    /** Update the journal folder path (called from reconfigure) */
    updateFolder(newFolder: string): void {
        this.journalFolder = normalizePath(newFolder);
    }

    /**
     * Register file watchers for create/delete/rename events AND metadata changes.
     * Uses plugin.registerEvent() for automatic cleanup on unload.
     */
    registerFileWatchers(): void {
        const store = useJournalStore;

        // Metadata change handler (debounced)
        this.plugin.registerEvent(
            this.plugin.app.metadataCache.on('changed', (file) => {
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
                                const entry = this.indexService.parseEntryFrontmatterOnly(file);
                                if (entry) {
                                    await this.indexService.parseEntryContent(file, entry);
                                    const detectedFields = store.getState().detectedFields;
                                    entry.qualityScore = this.indexService.computeQualityScore(entry, detectedFields);

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
            this.plugin.app.vault.on('create', (file) => {
                void (async () => {
                    try {
                        if (!(file instanceof TFile)) return;
                        if (!file.path.startsWith(this.journalFolder)) return;

                        // Bulk event check
                        if (!this.trackBulkEvent()) return;

                        const entry = this.indexService.parseEntryFrontmatterOnly(file);
                        if (entry) {
                            await this.indexService.parseEntryContent(file, entry);
                            const detectedFields = store.getState().detectedFields;
                            entry.qualityScore = this.indexService.computeQualityScore(entry, detectedFields);

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
            this.plugin.app.vault.on('delete', (file) => {
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
            this.plugin.app.vault.on('rename', (file, oldPath) => {
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
                            const entry = this.indexService.parseEntryFrontmatterOnly(file);
                            if (entry) {
                                await this.indexService.parseEntryContent(file, entry);
                                const detectedFields = store.getState().detectedFields;
                                entry.qualityScore = this.indexService.computeQualityScore(entry, detectedFields);
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

    /**
     * Debounced detectFields() — waits 5 seconds after last trigger.
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
     * Returns true if normal mode (handle individually),
     * false if bulk mode (skip individual processing).
     */
    private trackBulkEvent(): boolean {
        const now = Date.now();

        this.bulkEventTimestamps.push(now);
        this.bulkEventTimestamps = this.bulkEventTimestamps.filter(
            ts => now - ts < BULK_EVENT_WINDOW_MS
        );

        if (this.bulkEventTimestamps.length >= BULK_EVENT_THRESHOLD) {
            if (!this.inBulkMode) {
                this.inBulkMode = true;
                debugLog('Bulk event mode activated:', this.bulkEventTimestamps.length, 'events in window');
            }

            if (this.bulkSettleTimer) {
                clearTimeout(this.bulkSettleTimer);
            }
            this.bulkSettleTimer = setTimeout(() => {
                this.bulkSettleTimer = null;
                this.inBulkMode = false;
                this.bulkEventTimestamps = [];
                debugLog('Bulk settle complete — running full re-index');
                void this.indexService.initialize();
            }, BULK_SETTLE_MS);

            return false;
        }

        if (this.inBulkMode) {
            if (this.bulkSettleTimer) {
                clearTimeout(this.bulkSettleTimer);
            }
            this.bulkSettleTimer = setTimeout(() => {
                this.bulkSettleTimer = null;
                this.inBulkMode = false;
                this.bulkEventTimestamps = [];
                debugLog('Bulk settle complete — running full re-index');
                void this.indexService.initialize();
            }, BULK_SETTLE_MS);
            return false;
        }

        return true;
    }

    /** Clean up all timers */
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
