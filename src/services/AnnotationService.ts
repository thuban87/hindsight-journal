/**
 * Annotation Service
 *
 * Manages user-defined context markers (annotations) on journal entries.
 * Supports dual storage modes:
 * - 'plugin': stored in plugin data.json, keyed by file path
 * - 'frontmatter': stored as `annotations: string[]` in note YAML
 *
 * Default: 'plugin' (safer, doesn't modify user notes).
 */

import { type App, Notice, normalizePath } from 'obsidian';
import type { HindsightPluginInterface } from '../types/plugin';
import { processWithYielding } from '../utils/yieldUtils';
import { debugLog } from '../utils/debugLog';

/** Maximum annotation length in characters */
const MAX_ANNOTATION_LENGTH = 500;
/** Maximum annotations per entry */
const MAX_ANNOTATIONS_PER_ENTRY = 20;

export class AnnotationService {
    /** Per-file write locks for frontmatter mode */
    private writeLocks = new Map<string, Promise<void>>();

    constructor(
        private app: App,
        private plugin: HindsightPluginInterface,
        private storageMode: 'plugin' | 'frontmatter'
    ) { }

    /**
     * Serialize frontmatter writes per file path to prevent data loss
     * from concurrent processFrontMatter() calls.
     */
    private async withWriteLock(filePath: string, fn: () => Promise<void>): Promise<void> {
        const existing = this.writeLocks.get(filePath) ?? Promise.resolve();
        const next = existing.then(fn, fn); // run even if previous failed
        this.writeLocks.set(filePath, next);
        await next;
        // Clean up to prevent unbounded Map growth
        if (this.writeLocks.get(filePath) === next) this.writeLocks.delete(filePath);
    }

    /**
     * Get annotations for an entry.
     * Reads from the active storage mode.
     */
    async getAnnotations(filePath: string): Promise<string[]> {
        try {
            if (this.storageMode === 'plugin') {
                return this.getPluginAnnotations(filePath);
            }
            return await this.getFrontmatterAnnotations(filePath);
        } catch (err) {
            console.error('[Hindsight] Failed to get annotations:', err);
            return [];
        }
    }

    /**
     * Add an annotation to an entry.
     * Validates length, count, trims, replaces newlines, deduplicates.
     */
    async addAnnotation(filePath: string, annotation: string): Promise<void> {
        // Validation
        let text = annotation.trim();
        if (text === '') {
            new Notice('Annotation cannot be empty.');
            return;
        }

        // Replace newlines with spaces
        text = text.replace(/[\n\r]/g, ' ');

        if (text.length > MAX_ANNOTATION_LENGTH) {
            new Notice(`Annotation exceeds ${MAX_ANNOTATION_LENGTH} character limit.`);
            return;
        }

        try {
            const existing = await this.getAnnotations(filePath);

            // Deduplication — idempotent add
            if (existing.includes(text)) {
                debugLog('Annotation already exists, skipping:', text);
                return;
            }

            if (existing.length >= MAX_ANNOTATIONS_PER_ENTRY) {
                new Notice(`Maximum ${MAX_ANNOTATIONS_PER_ENTRY} annotations per entry reached.`);
                return;
            }

            if (this.storageMode === 'plugin') {
                await this.addPluginAnnotation(filePath, text);
            } else {
                await this.addFrontmatterAnnotation(filePath, text);
            }
        } catch (err) {
            console.error('[Hindsight] Failed to add annotation:', err);
            new Notice('Failed to add annotation. Check the console for details.');
        }
    }

    /**
     * Remove an annotation from an entry.
     */
    async removeAnnotation(filePath: string, annotation: string): Promise<void> {
        try {
            if (this.storageMode === 'plugin') {
                await this.removePluginAnnotation(filePath, annotation);
            } else {
                await this.removeFrontmatterAnnotation(filePath, annotation);
            }
        } catch (err) {
            console.error('[Hindsight] Failed to remove annotation:', err);
            new Notice('Failed to remove annotation.');
        }
    }

    /**
     * Get all entries that have annotations.
     * Returns { filePath, annotations }[]
     */
    async getAllAnnotated(): Promise<{ filePath: string; annotations: string[] }[]> {
        try {
            if (this.storageMode === 'plugin') {
                return this.getAllPluginAnnotated();
            }
            return await this.getAllFrontmatterAnnotated();
        } catch (err) {
            console.error('[Hindsight] Failed to get all annotated:', err);
            return [];
        }
    }

    /**
     * Migrate annotations between storage modes.
     * Copy → verify checksum → delete source.
     * Uses processWithYielding for smooth UI.
     */
    async migrateStorage(
        from: 'plugin' | 'frontmatter',
        to: 'plugin' | 'frontmatter'
    ): Promise<{ migrated: number; skipped: string[]; errors: string[] }> {
        const errors: string[] = [];
        const skipped: string[] = [];
        let migrated = 0;

        // Get all annotations from source
        const sourceAnnotations = from === 'plugin'
            ? this.getAllPluginAnnotated()
            : await this.getAllFrontmatterAnnotated();

        const sourceList = Array.isArray(sourceAnnotations)
            ? sourceAnnotations
            : await sourceAnnotations;

        if (sourceList.length === 0) {
            new Notice('No annotations to migrate.');
            return { migrated: 0, skipped: [], errors: [] };
        }

        // Copy to destination
        let lastProgressNotice: Notice | null = null;
        await processWithYielding(sourceList, async (item) => {
            try {
                for (const annotation of item.annotations) {
                    if (to === 'plugin') {
                        await this.addPluginAnnotation(item.filePath, annotation);
                    } else {
                        await this.addFrontmatterAnnotation(item.filePath, annotation);
                    }
                }
                migrated += item.annotations.length;
            } catch (err) {
                skipped.push(item.filePath);
                errors.push(`${item.filePath}: ${String(err)}`);
                debugLog('Migration error for', item.filePath, err);
            }
        }, {
            budgetMs: 10,
            onProgress: (processed, total) => {
                // Each new Notice replaces the visual slot; old ones auto-dismiss via short duration
                lastProgressNotice = new Notice(`Migrating annotations... ${processed}/${total}`, 3000);
            },
            onError: (item, err) => {
                skipped.push(item.filePath);
                errors.push(`${item.filePath}: ${String(err)}`);
            },
        });

        // Unused variable — lastProgressNotice auto-dismisses
        void lastProgressNotice;

        // Verify: compute expected vs actual count
        const expectedCount = sourceList.reduce((acc, i) => acc + i.annotations.length, 0);
        const skippedCount = skipped.length > 0
            ? sourceList
                .filter(i => skipped.includes(i.filePath))
                .reduce((acc, i) => acc + i.annotations.length, 0)
            : 0;

        if (migrated === expectedCount - skippedCount) {
            // Success — delete from source
            if (from === 'plugin') {
                this.clearPluginAnnotations();
            } else {
                // Clear frontmatter annotations for migrated files
                for (const item of sourceList) {
                    if (!skipped.includes(item.filePath)) {
                        try {
                            await this.clearFrontmatterAnnotations(item.filePath);
                        } catch (err) {
                            debugLog('Failed to clear source annotations for', item.filePath, err);
                        }
                    }
                }
            }

            if (skipped.length > 0) {
                new Notice(`Migrated ${migrated} annotations. ${skipped.length} files could not be updated — source data preserved for those files.`);
            } else {
                new Notice(`Successfully migrated ${migrated} annotations.`);
            }
        } else {
            new Notice('Migration completed with warnings — source data preserved. Check console for details.');
            console.error('[Hindsight] Migration count mismatch:', { expected: expectedCount, migrated, skippedCount });
        }

        return { migrated, skipped, errors };
    }

    /**
     * Remove orphaned annotation keys (file paths that no longer exist).
     */
    async cleanupOrphanedAnnotations(): Promise<number> {
        if (this.storageMode !== 'plugin') return 0;

        const annotations = this.getPluginAnnotationData();
        const keys = Object.keys(annotations);
        let cleaned = 0;

        for (const key of keys) {
            const file = this.app.vault.getFileByPath(normalizePath(key));
            if (!file) {
                delete annotations[key];
                cleaned++;
                debugLog('Cleaned orphaned annotation key:', key);
            }
        }

        if (cleaned > 0) {
            await this.plugin.saveSettings();
            debugLog(`Cleaned ${cleaned} orphaned annotation keys`);
        }

        return cleaned;
    }

    /**
     * Update annotation keys when a file is renamed/moved.
     * Validates both paths are within the journal folder.
     */
    async onEntryRenamed(oldPath: string, newPath: string): Promise<void> {
        const journalFolder = this.plugin.settings.journalFolder;
        if (!oldPath.startsWith(journalFolder) || !newPath.startsWith(journalFolder)) {
            debugLog('Rename outside journal folder, skipping annotation update:', { oldPath, newPath });
            return;
        }

        try {
            if (this.storageMode === 'plugin') {
                const annotations = this.getPluginAnnotationData();
                if (annotations[oldPath]) {
                    annotations[newPath] = annotations[oldPath];
                    delete annotations[oldPath];
                    await this.plugin.saveSettings();
                    debugLog('Updated annotation key on rename:', { oldPath, newPath });
                }
            }
            // Frontmatter mode: annotations travel with the file automatically
        } catch (err) {
            console.error('[Hindsight] Failed to update annotations on rename:', err);
        }
    }

    // ===== Plugin storage helpers =====

    private getPluginAnnotationData(): Record<string, string[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (this.plugin as any).settings as Record<string, unknown>;
        if (!data._annotations || typeof data._annotations !== 'object') {
            data._annotations = {};
        }
        return data._annotations as Record<string, string[]>;
    }

    private getPluginAnnotations(filePath: string): string[] {
        const annotations = this.getPluginAnnotationData();
        return annotations[filePath] ?? [];
    }

    private async addPluginAnnotation(filePath: string, annotation: string): Promise<void> {
        const annotations = this.getPluginAnnotationData();
        if (!annotations[filePath]) {
            annotations[filePath] = [];
        }
        // Dedup check
        if (!annotations[filePath].includes(annotation)) {
            annotations[filePath].push(annotation);
            await this.plugin.saveSettings();
        }
    }

    private async removePluginAnnotation(filePath: string, annotation: string): Promise<void> {
        const annotations = this.getPluginAnnotationData();
        if (annotations[filePath]) {
            annotations[filePath] = annotations[filePath].filter(a => a !== annotation);
            if (annotations[filePath].length === 0) {
                delete annotations[filePath];
            }
            await this.plugin.saveSettings();
        }
    }

    private getAllPluginAnnotated(): { filePath: string; annotations: string[] }[] {
        const annotations = this.getPluginAnnotationData();
        return Object.entries(annotations)
            .filter(([, v]) => Array.isArray(v) && v.length > 0)
            .map(([filePath, anns]) => ({ filePath, annotations: anns }));
    }

    private clearPluginAnnotations(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.plugin as any).settings._annotations = {};
    }

    // ===== Frontmatter storage helpers =====

    private async getFrontmatterAnnotations(filePath: string): Promise<string[]> {
        const file = this.app.vault.getFileByPath(normalizePath(filePath));
        if (!file) return [];

        return new Promise<string[]>((resolve) => {
            void this.app.fileManager.processFrontMatter(file, (fm) => {
                if (!fm.annotations || !Array.isArray(fm.annotations)) {
                    resolve([]);
                    return;
                }
                resolve([...fm.annotations]);
            });
        });
    }

    private async addFrontmatterAnnotation(filePath: string, annotation: string): Promise<void> {
        await this.withWriteLock(filePath, async () => {
            const file = this.app.vault.getFileByPath(normalizePath(filePath));
            if (!file) throw new Error(`File not found: ${filePath}`);

            await this.app.fileManager.processFrontMatter(file, (fm) => {
                // Defensive: reset corrupted non-array field
                if (fm.annotations && !Array.isArray(fm.annotations)) {
                    debugLog('Corrupted annotations field (not array), resetting:', filePath);
                    fm.annotations = [];
                }
                if (!fm.annotations) {
                    fm.annotations = [];
                }
                // Dedup check
                if (!fm.annotations.includes(annotation)) {
                    fm.annotations.push(annotation);
                }
            });
        });
    }

    private async removeFrontmatterAnnotation(filePath: string, annotation: string): Promise<void> {
        await this.withWriteLock(filePath, async () => {
            const file = this.app.vault.getFileByPath(normalizePath(filePath));
            if (!file) throw new Error(`File not found: ${filePath}`);

            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (Array.isArray(fm.annotations)) {
                    fm.annotations = fm.annotations.filter((a: string) => a !== annotation);
                    if (fm.annotations.length === 0) {
                        delete fm.annotations;
                    }
                }
            });
        });
    }

    private async getAllFrontmatterAnnotated(): Promise<{ filePath: string; annotations: string[] }[]> {
        const results: { filePath: string; annotations: string[] }[] = [];
        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            try {
                const annotations = await this.getFrontmatterAnnotations(file.path);
                if (annotations.length > 0) {
                    results.push({ filePath: file.path, annotations });
                }
            } catch {
                // Skip inaccessible files
            }
        }

        return results;
    }

    private async clearFrontmatterAnnotations(filePath: string): Promise<void> {
        await this.withWriteLock(filePath, async () => {
            const file = this.app.vault.getFileByPath(normalizePath(filePath));
            if (!file) return;

            await this.app.fileManager.processFrontMatter(file, (fm) => {
                delete fm.annotations;
            });
        });
    }
}
