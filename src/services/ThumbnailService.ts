/**
 * Thumbnail Service
 *
 * Manages WebP thumbnail generation and IndexedDB caching.
 * Uses OffscreenCanvas where available, falls back to <canvas>.
 *
 * Cache key: `${vaultId}|${normalizedPath}:${mtime}` — mtime ensures
 * regeneration when source image changes. vaultId is a UUID generated
 * once on first plugin install (stored in data.json as thumbnailVaultId).
 *
 * PERFORMANCE CONSTRAINTS:
 * - <canvas> fallback runs on the main thread. Mitigations:
 *   1. Concurrency limit of 3 simultaneous generations
 *   2. setTimeout(0) between each generation to yield to main thread
 *   3. Cap source image dimensions: if >2000px, use createImageBitmap resize
 * - Thumbnails are lazy-loaded via useThumbnail() hook when items render
 */

import { normalizePath } from 'obsidian';
import type { App, Vault, TFile } from 'obsidian';
import type { HindsightSettings } from '../types/settings';
import { debugLog } from '../utils/debugLog';

/** Allowed image extensions for thumbnail generation (case-insensitive) */
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp']);

/** IndexedDB database name */
const DB_NAME = 'hindsight-thumbnails';
/** IndexedDB store name */
const STORE_NAME = 'thumbnails';
/** Schema version */
const DB_VERSION = 1;

/** Cache state machine states */
type CacheState = 'healthy' | 'evicting' | 'disabled';

export class ThumbnailService {
    private db: IDBDatabase | null = null;
    private dbReady: Promise<void>;
    private dbReadyResolve!: () => void;

    /** In-flight deduplication: prevents duplicate generation for the same key */
    private inFlightByKey: Map<string, Promise<string | null>> = new Map();
    private activeGenerations = 0;
    private readonly MAX_CONCURRENT = 3;

    /**
     * Centralized blob URL management. Maps cache keys to active Object URLs.
     * React components request URLs from the service; the service handles
     * creating and returning the same URL for identical requests.
     * All URLs are revoked centrally in destroy(), not in individual components.
     */
    private activeObjectUrls: Map<string, string> = new Map();
    /** Track when each blob URL was last requested, for 5-min eviction */
    private urlLastAccessed: Map<string, number> = new Map();
    private urlEvictionTimer: ReturnType<typeof setInterval> | null = null;

    /** In-flight transaction counter for safe DB close */
    private activeTxCount = 0;

    /** Cache state machine */
    private cacheState: CacheState = 'healthy';

    /** Feature detection results (set during initialize()) */
    private supportsOffscreenCanvas = false;
    private supportsWebPEncode = false;
    private supportsImageBitmapResize = false;

    /** Effective max count (halved on iOS PNG fallback) */
    private effectiveMaxCount: number;

    /** Estimated quota in bytes */
    private estimatedQuotaBytes = 40_000_000; // 40MB fallback

    /** Last eviction timestamp (rate-limit to once per 30s) */
    private lastEvictionTime = 0;

    /** Vault identifier for cache key namespacing */
    private vaultId: string;

    private app: App;
    private settings: HindsightSettings;

    constructor(app: App, settings: HindsightSettings, vaultId: string) {
        this.app = app;
        this.settings = settings;
        this.vaultId = vaultId;
        this.effectiveMaxCount = settings.maxThumbnailCount;

        this.dbReady = new Promise<void>((resolve) => {
            this.dbReadyResolve = resolve;
        });
    }

    /**
     * Open or create the IndexedDB database.
     * Runs feature detection for OffscreenCanvas, WebP encoding, and
     * createImageBitmap resize options.
     */
    async initialize(): Promise<void> {
        // Feature detection: OffscreenCanvas
        this.supportsOffscreenCanvas = await this.detectOffscreenCanvas();
        debugLog('ThumbnailService: OffscreenCanvas supported:', this.supportsOffscreenCanvas);

        // Feature detection: WebP encoding
        this.supportsWebPEncode = await this.detectWebPEncode();
        debugLog('ThumbnailService: WebP encode supported:', this.supportsWebPEncode);

        // Feature detection: createImageBitmap with resize
        this.supportsImageBitmapResize = await this.detectImageBitmapResize();
        debugLog('ThumbnailService: ImageBitmap resize supported:', this.supportsImageBitmapResize);

        // Halve max count if WebP encoding is not supported (PNG fallback = larger files)
        if (!this.supportsWebPEncode) {
            this.effectiveMaxCount = Math.floor(this.settings.maxThumbnailCount / 2);
            debugLog('ThumbnailService: PNG fallback — halved max count to', this.effectiveMaxCount);
        }

        // Estimate quota
        try {
            if (navigator.storage && typeof navigator.storage.estimate === 'function') {
                const estimate = await navigator.storage.estimate();
                if (estimate.quota && estimate.quota > 0) {
                    this.estimatedQuotaBytes = estimate.quota;
                }
            }
        } catch {
            // Fallback to 40MB
        }

        // Open IndexedDB
        try {
            await this.openDatabase();
        } catch (err) {
            // Corruption recovery: delete and re-create
            console.warn('[Hindsight] Thumbnail DB corrupted, resetting:', err);
            try {
                await this.deleteDatabase();
                await this.openDatabase();
            } catch (retryErr) {
                console.warn('[Hindsight] IndexedDB unavailable, thumbnails disabled:', retryErr);
                this.cacheState = 'disabled';
                this.dbReadyResolve();
                return;
            }
        }

        // Start blob URL eviction timer (every 60s, revoke URLs unused for 5 min)
        this.urlEvictionTimer = setInterval(() => {
            this.evictUnusedUrls();
        }, 60_000);

        this.dbReadyResolve();
    }

    /**
     * Get a thumbnail for an image path. Returns a blob URL or null.
     * Deduplicates concurrent requests for the same image.
     */
    async getThumbnail(
        imagePath: string,
        sourceFilePath: string,
        vault: Vault,
        mtime: number,
        signal?: { cancelled: boolean }
    ): Promise<string | null> {
        if (!this.settings.thumbnailsEnabled) return null;
        if (signal?.cancelled) return null;

        // Resolve the image file via metadataCache (security gate)
        const resolved = this.app.metadataCache.getFirstLinkpathDest(imagePath, sourceFilePath);
        if (!resolved) return null;

        // Extension allowlist check
        const ext = resolved.extension.toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) return null;

        const cacheKey = this.buildCacheKey(resolved.path, mtime);

        // Check if we already have a blob URL for this key
        const existing = this.activeObjectUrls.get(cacheKey);
        if (existing) {
            this.urlLastAccessed.set(cacheKey, Date.now());
            return existing;
        }

        // Check for in-flight deduplication
        const inflight = this.inFlightByKey.get(cacheKey);
        if (inflight) return inflight;

        // Create the request promise
        const promise = this.fetchOrGenerate(cacheKey, resolved, vault, mtime, signal);
        this.inFlightByKey.set(cacheKey, promise);

        try {
            return await promise;
        } finally {
            this.inFlightByKey.delete(cacheKey);
        }
    }

    /**
     * Clear the entire thumbnail cache.
     */
    async clearCache(): Promise<void> {
        await this.dbReady;
        if (!this.db) return;

        // Revoke all blob URLs first
        for (const url of this.activeObjectUrls.values()) {
            URL.revokeObjectURL(url);
        }
        this.activeObjectUrls.clear();
        this.urlLastAccessed.clear();

        return new Promise<void>((resolve, reject) => {
            if (!this.db) { resolve(); return; }
            this.activeTxCount++;
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => {
                this.activeTxCount--;
                this.cacheState = 'healthy';
                debugLog('ThumbnailService: cache cleared');
                resolve();
            };
            tx.onerror = () => {
                this.activeTxCount--;
                reject(tx.error);
            };
        });
    }

    /**
     * Get cache statistics: entry count, estimated size.
     */
    async getCacheStats(): Promise<{ count: number; estimatedSizeMB: number }> {
        await this.dbReady;
        if (!this.db) return { count: 0, estimatedSizeMB: 0 };

        return new Promise((resolve) => {
            if (!this.db) { resolve({ count: 0, estimatedSizeMB: 0 }); return; }
            this.activeTxCount++;
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const countReq = store.count();
            let totalSize = 0;

            const cursorReq = store.openCursor();
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor) {
                    const record = cursor.value as { estimatedSizeBytes?: number };
                    totalSize += record.estimatedSizeBytes ?? 0;
                    cursor.continue();
                }
            };

            tx.oncomplete = () => {
                this.activeTxCount--;
                resolve({
                    count: countReq.result,
                    estimatedSizeMB: Math.round((totalSize / 1_000_000) * 100) / 100,
                });
            };
            tx.onerror = () => {
                this.activeTxCount--;
                resolve({ count: 0, estimatedSizeMB: 0 });
            };
        });
    }

    /**
     * Clean up ALL active Object URLs, clear maps, and close DB.
     * Called from plugin.onunload().
     */
    async destroy(): Promise<void> {
        // Stop URL eviction timer
        if (this.urlEvictionTimer !== null) {
            clearInterval(this.urlEvictionTimer);
            this.urlEvictionTimer = null;
        }

        // Revoke all blob URLs
        for (const url of this.activeObjectUrls.values()) {
            URL.revokeObjectURL(url);
        }
        this.activeObjectUrls.clear();
        this.urlLastAccessed.clear();
        this.inFlightByKey.clear();

        // Wait for pending transactions (max 2s)
        if (this.activeTxCount > 0) {
            await Promise.race([
                new Promise<void>((resolve) => {
                    const check = setInterval(() => {
                        if (this.activeTxCount <= 0) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                }),
                new Promise<void>((resolve) => setTimeout(resolve, 2000)),
            ]);
        }

        // Close DB
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // ─── Private Methods ─────────────────────────────────────────

    private buildCacheKey(filePath: string, mtime: number): string {
        const normalized = normalizePath(filePath).replace(/\//g, '|');
        return `${this.vaultId}|${normalized}:${mtime}`;
    }

    private async fetchOrGenerate(
        cacheKey: string,
        file: TFile,
        vault: Vault,
        mtime: number,
        signal?: { cancelled: boolean }
    ): Promise<string | null> {
        // Try cache first
        const cached = await this.getCachedBlob(cacheKey);
        if (cached) {
            const url = URL.createObjectURL(cached);
            this.activeObjectUrls.set(cacheKey, url);
            this.urlLastAccessed.set(cacheKey, Date.now());
            // Update lastAccessed in IndexedDB (fire-and-forget)
            void this.updateLastAccessed(cacheKey);
            return url;
        }

        if (signal?.cancelled) return null;

        // Wait for concurrency slot
        await this.waitForSlot();
        if (signal?.cancelled) {
            return null;
        }

        this.activeGenerations++;
        try {
            const blob = await this.generateThumbnail(file, vault);
            if (!blob || signal?.cancelled) return null;

            // Cache the result
            if (this.cacheState !== 'disabled') {
                await this.cacheThumbnail(cacheKey, blob, mtime);
            }

            const url = URL.createObjectURL(blob);
            this.activeObjectUrls.set(cacheKey, url);
            this.urlLastAccessed.set(cacheKey, Date.now());
            return url;
        } catch (err) {
            console.error('[Hindsight] Thumbnail generation failed:', err);
            return null;
        } finally {
            this.activeGenerations--;
        }
    }

    private async waitForSlot(): Promise<void> {
        while (this.activeGenerations >= this.MAX_CONCURRENT) {
            await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
    }

    /**
     * Generate a WebP thumbnail from a vault image file.
     * SECURITY: Only processes files resolved via getFirstLinkpathDest.
     */
    private async generateThumbnail(file: TFile, vault: Vault): Promise<Blob | null> {
        try {
            const buffer = await vault.readBinary(file);
            const blob = new Blob([buffer], { type: `image/${file.extension.toLowerCase()}` });

            // Create ImageBitmap (with resize if supported and image is large)
            let bitmap: ImageBitmap;
            try {
                if (this.supportsImageBitmapResize) {
                    // Use resize options for efficiency
                    bitmap = await createImageBitmap(blob, {
                        resizeWidth: this.settings.thumbnailSize,
                        resizeHeight: this.settings.thumbnailSize,
                        resizeQuality: 'medium',
                    });
                } else {
                    bitmap = await createImageBitmap(blob);
                }
            } catch {
                debugLog('ThumbnailService: createImageBitmap failed for', file.path);
                return null;
            }

            // Calculate scaled dimensions maintaining aspect ratio
            const targetSize = this.settings.thumbnailSize;
            let drawWidth: number;
            let drawHeight: number;
            if (this.supportsImageBitmapResize) {
                // Already resized via createImageBitmap
                drawWidth = bitmap.width;
                drawHeight = bitmap.height;
            } else {
                const ratio = Math.min(
                    targetSize / bitmap.width,
                    targetSize / bitmap.height
                );
                drawWidth = Math.round(bitmap.width * ratio);
                drawHeight = Math.round(bitmap.height * ratio);
            }

            // Draw to canvas
            let resultBlob: Blob | null = null;
            if (this.supportsOffscreenCanvas) {
                const canvas = new OffscreenCanvas(drawWidth, drawHeight);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    bitmap.close();
                    return null;
                }
                ctx.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
                bitmap.close();

                const format = this.supportsWebPEncode ? 'image/webp' : 'image/png';
                resultBlob = await canvas.convertToBlob({ type: format, quality: 0.7 });
            } else {
                // <canvas> fallback (main thread)
                const canvas = document.createElement('canvas');
                canvas.width = drawWidth;
                canvas.height = drawHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    bitmap.close();
                    return null;
                }
                ctx.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
                bitmap.close();

                resultBlob = await new Promise<Blob | null>((resolve) => {
                    const format = this.supportsWebPEncode ? 'image/webp' : 'image/png';
                    canvas.toBlob(
                        (b) => resolve(b),
                        format,
                        0.7
                    );
                });

                // Yield to main thread after canvas work
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
            }

            return resultBlob;
        } catch (err) {
            console.error('[Hindsight] Thumbnail generation error:', err);
            return null;
        }
    }

    /**
     * Store a thumbnail in IndexedDB with LRU metadata.
     * On QuotaExceededError, calls handleQuotaExceeded().
     */
    private async cacheThumbnail(key: string, blob: Blob, mtime: number): Promise<void> {
        await this.dbReady;
        if (!this.db || this.cacheState === 'disabled') return;

        // Check proactive eviction threshold (80% of estimated quota)
        const stats = await this.getCacheStats();
        const totalBytes = stats.estimatedSizeMB * 1_000_000;
        const threshold = this.estimatedQuotaBytes * 0.8;
        if (totalBytes > threshold || stats.count >= this.effectiveMaxCount) {
            await this.evictLRU();
        }

        try {
            await this.writeToStore(key, blob, mtime);
        } catch (err) {
            if (this.isQuotaError(err)) {
                await this.handleQuotaExceeded(key, blob, mtime);
            }
        }
    }

    private async writeToStore(key: string, blob: Blob, mtime: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) { resolve(); return; }
            this.activeTxCount++;
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({
                key,
                blob,
                mtime,
                lastAccessed: Date.now(),
                estimatedSizeBytes: blob.size,
            });
            tx.oncomplete = () => {
                this.activeTxCount--;
                resolve();
            };
            tx.onerror = () => {
                this.activeTxCount--;
                reject(tx.error);
            };
        });
    }

    /**
     * Handle quota exceeded: aggressive auto-eviction + retry.
     */
    private async handleQuotaExceeded(key: string, blob: Blob, mtime: number): Promise<void> {
        this.cacheState = 'evicting';

        // 1st attempt: evict oldest 25%
        const count = (await this.getCacheStats()).count;
        const evictCount = Math.max(Math.ceil(count * 0.25), 1);
        await this.evictLRU(evictCount);

        try {
            await this.writeToStore(key, blob, mtime);
            this.cacheState = 'healthy';
            return;
        } catch (err) {
            if (!this.isQuotaError(err)) throw err;
        }

        // 2nd attempt: evict another 25%
        const newCount = (await this.getCacheStats()).count;
        const evictCount2 = Math.max(Math.ceil(newCount * 0.25), 1);
        await this.evictLRU(evictCount2);

        try {
            await this.writeToStore(key, blob, mtime);
            this.cacheState = 'healthy';
        } catch (err) {
            if (this.isQuotaError(err)) {
                this.cacheState = 'disabled';
                console.warn('[Hindsight] Thumbnail cache disabled — quota exhausted after eviction retries');
            }
        }
    }

    /**
     * Evict least-recently-accessed thumbnails.
     * Rate-limited to once per 30 seconds to prevent thrashing.
     */
    private async evictLRU(count?: number): Promise<void> {
        const now = Date.now();
        if (now - this.lastEvictionTime < 30_000 && !count) return;
        this.lastEvictionTime = now;

        await this.dbReady;
        if (!this.db) return;

        const stats = await this.getCacheStats();
        const evictCount = count ?? Math.max(stats.count - this.effectiveMaxCount, 0);
        if (evictCount <= 0) return;

        return new Promise<void>((resolve) => {
            if (!this.db) { resolve(); return; }
            this.activeTxCount++;
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('lastAccessed');
            const cursorReq = index.openCursor(); // ascending = oldest first
            let deleted = 0;

            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor && deleted < evictCount) {
                    const record = cursor.value as { key: string };
                    // Revoke blob URL if active
                    const url = this.activeObjectUrls.get(record.key);
                    if (url) {
                        URL.revokeObjectURL(url);
                        this.activeObjectUrls.delete(record.key);
                        this.urlLastAccessed.delete(record.key);
                    }
                    cursor.delete();
                    deleted++;
                    cursor.continue();
                }
            };

            tx.oncomplete = () => {
                this.activeTxCount--;
                debugLog('ThumbnailService: evicted', deleted, 'entries');
                resolve();
            };
            tx.onerror = () => {
                this.activeTxCount--;
                resolve();
            };
        });
    }

    private async getCachedBlob(key: string): Promise<Blob | null> {
        await this.dbReady;
        if (!this.db) return null;

        return new Promise<Blob | null>((resolve) => {
            if (!this.db) { resolve(null); return; }
            this.activeTxCount++;
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => {
                this.activeTxCount--;
                const result = req.result as { blob: Blob } | undefined;
                resolve(result?.blob ?? null);
            };
            req.onerror = () => {
                this.activeTxCount--;
                resolve(null);
            };
        });
    }

    private async updateLastAccessed(key: string): Promise<void> {
        if (!this.db) return;
        try {
            this.activeTxCount++;
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => {
                const record = req.result;
                if (record) {
                    record.lastAccessed = Date.now();
                    store.put(record);
                }
            };
            tx.oncomplete = () => { this.activeTxCount--; };
            tx.onerror = () => { this.activeTxCount--; };
        } catch {
            this.activeTxCount--;
        }
    }

    /** Revoke blob URLs that haven't been accessed for 5 minutes */
    private evictUnusedUrls(): void {
        const cutoff = Date.now() - 5 * 60 * 1000;
        for (const [key, lastAccess] of this.urlLastAccessed.entries()) {
            if (lastAccess < cutoff) {
                const url = this.activeObjectUrls.get(key);
                if (url) {
                    URL.revokeObjectURL(url);
                    this.activeObjectUrls.delete(key);
                }
                this.urlLastAccessed.delete(key);
            }
        }
    }

    // ─── Database Helpers ────────────────────────────────────────

    private openDatabase(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB not available'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private deleteDatabase(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ─── Feature Detection ───────────────────────────────────────

    private async detectOffscreenCanvas(): Promise<boolean> {
        try {
            if (typeof OffscreenCanvas === 'undefined') return false;
            const canvas = new OffscreenCanvas(1, 1);
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;
            ctx.fillRect(0, 0, 1, 1);
            return true;
        } catch {
            return false;
        }
    }

    private async detectWebPEncode(): Promise<boolean> {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            return await new Promise<boolean>((resolve) => {
                canvas.toBlob(
                    (blob) => resolve(blob?.type === 'image/webp'),
                    'image/webp',
                    0.8
                );
            });
        } catch {
            return false;
        }
    }

    private async detectImageBitmapResize(): Promise<boolean> {
        try {
            if (typeof createImageBitmap === 'undefined') return false;
            const canvas = document.createElement('canvas');
            canvas.width = 2;
            canvas.height = 2;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;
            ctx.fillStyle = '#f00';
            ctx.fillRect(0, 0, 2, 2);
            const testBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/png');
            });
            if (!testBlob) return false;
            const bitmap = await createImageBitmap(testBlob, {
                resizeWidth: 1,
                resizeHeight: 1,
            });
            bitmap.close();
            return true;
        } catch {
            return false;
        }
    }

    // ─── Utilities ───────────────────────────────────────────────

    private isQuotaError(err: unknown): boolean {
        if (err instanceof DOMException) {
            return err.name === 'QuotaExceededError';
        }
        return false;
    }

    /** Get current cache state (for UI status display) */
    getCacheState(): CacheState {
        return this.cacheState;
    }
}
