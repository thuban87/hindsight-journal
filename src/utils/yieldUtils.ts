/**
 * Yield Utilities
 *
 * Time-based main-thread yielding for background processing.
 * Ensures smooth 60fps UI regardless of hardware by yielding
 * control back to the browser when the time budget is exhausted.
 */

import { debugLog } from './debugLog';

/** Options for processWithYielding */
interface YieldOptions<T> {
    /** Time budget per tick in ms. Default: 16 (desktop) or 8 (mobile). */
    budgetMs?: number;
    /** Hint that the processor is synchronous — avoids await overhead in tight loops. */
    sync?: boolean;
    /** Cancellation signal — checked at each iteration. */
    signal?: { cancelled: boolean };
    /** Error handler — skip failing items and continue. If absent, errors propagate. */
    onError?: (item: T, error: unknown) => void;
    /** Progress callback — called at yield points with (processed, total). */
    onProgress?: (processed: number, total: number) => void;
}

/**
 * Process an array of items with time-based yielding to the main thread.
 *
 * Instead of fixed batch sizes (which are hardware-dependent), this uses
 * a time budget. The default 16ms budget leaves ~1ms per frame for rendering
 * on desktop; mobile gets 8ms for smoother scrolling.
 *
 * @param items - Array of items to process
 * @param processor - Function to call for each item
 * @param options - Configuration for budgeting, cancellation, error handling
 */
export async function processWithYielding<T>(
    items: T[],
    processor: (item: T) => void | Promise<void>,
    options?: YieldOptions<T>
): Promise<void> {
    // Detect mobile via Platform if available, fall back to desktop budget
    let defaultBudget = 16;
    try {
        // Dynamic import avoidance: Platform is a static export from obsidian
        // In test environments it may not exist
        const { Platform } = await import('obsidian');
        if (Platform?.isMobile) {
            defaultBudget = 8;
        }
    } catch {
        // Not in Obsidian environment (tests) — use desktop default
    }

    const {
        budgetMs = defaultBudget,
        sync = false,
        signal,
        onError,
        onProgress,
    } = options ?? {};

    let i = 0;

    while (i < items.length) {
        if (signal?.cancelled) return;

        const startTime = performance.now();

        while (i < items.length && performance.now() - startTime < budgetMs) {
            if (signal?.cancelled) return;

            try {
                if (sync) {
                    const result = processor(items[i]);
                    // Runtime guard: detect sync:true with async processor
                    if (result && typeof (result as { then?: unknown }).then === 'function') {
                        debugLog(
                            'processWithYielding: sync=true but processor returned a Promise.',
                            'Use sync=false or fix the processor.'
                        );
                    }
                } else {
                    await processor(items[i]);
                }
            } catch (err) {
                if (onError) {
                    onError(items[i], err);
                } else {
                    throw err; // backward compatible — propagate if no handler
                }
            }
            i++;
        }

        onProgress?.(i, items.length);

        if (i < items.length) {
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
    }

    // Final 100% progress callback
    onProgress?.(items.length, items.length);
}
