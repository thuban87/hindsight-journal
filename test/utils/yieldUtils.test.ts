/**
 * yieldUtils Tests
 *
 * Tests for processWithYielding — time-based yielding utility.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock obsidian Platform before importing yieldUtils
vi.mock('obsidian', () => ({
    Platform: { isMobile: false },
}));

// Import after mocking
import { processWithYielding } from '../../src/utils/yieldUtils';

describe('processWithYielding', () => {
    it('processes all items', async () => {
        const items = [1, 2, 3, 4, 5];
        const results: number[] = [];

        await processWithYielding(items, (item) => {
            results.push(item);
        });

        expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    it('handles empty array', async () => {
        const results: number[] = [];

        await processWithYielding([], (item: number) => {
            results.push(item);
        });

        expect(results).toEqual([]);
    });

    it('respects signal.cancelled and stops mid-stream', async () => {
        const items = [1, 2, 3, 4, 5];
        const results: number[] = [];
        const signal = { cancelled: false };

        await processWithYielding(
            items,
            (item) => {
                results.push(item);
                if (item === 3) {
                    signal.cancelled = true;
                }
            },
            { signal, budgetMs: 50 }
        );

        // Should have processed at most 3 items (cancellation checked at next iteration)
        expect(results.length).toBeLessThanOrEqual(3);
        expect(results).toContain(1);
        expect(results).toContain(2);
        expect(results).toContain(3);
        expect(results).not.toContain(5);
    });

    it('calls onProgress at yield points', async () => {
        const items = [1, 2, 3];
        const progressCalls: Array<{ processed: number; total: number }> = [];

        await processWithYielding(
            items,
            () => { /* no-op */ },
            {
                budgetMs: 50,
                onProgress: (processed, total) => {
                    progressCalls.push({ processed, total });
                },
            }
        );

        // Should have at least one progress call and a final 100% call
        expect(progressCalls.length).toBeGreaterThanOrEqual(1);
        const lastCall = progressCalls[progressCalls.length - 1];
        expect(lastCall.processed).toBe(3);
        expect(lastCall.total).toBe(3);
    });

    it('calls onError for failing items and continues processing', async () => {
        const items = [1, 2, 3, 4, 5];
        const results: number[] = [];
        const errors: Array<{ item: number; error: unknown }> = [];

        await processWithYielding(
            items,
            (item) => {
                if (item === 3) {
                    throw new Error('item 3 failed');
                }
                results.push(item);
            },
            {
                budgetMs: 50,
                onError: (item, error) => {
                    errors.push({ item, error });
                },
            }
        );

        // Should have processed all items except the failed one
        expect(results).toEqual([1, 2, 4, 5]);
        expect(errors).toHaveLength(1);
        expect(errors[0].item).toBe(3);
    });

    it('propagates errors when no onError handler provided', async () => {
        const items = [1, 2, 3];

        await expect(
            processWithYielding(items, (item) => {
                if (item === 2) throw new Error('boom');
            }, { budgetMs: 50 })
        ).rejects.toThrow('boom');
    });

    it('processes sync processors without await overhead', async () => {
        const items = [1, 2, 3, 4, 5];
        const results: number[] = [];

        await processWithYielding(
            items,
            (item) => {
                results.push(item * 2);
            },
            { sync: true, budgetMs: 50 }
        );

        expect(results).toEqual([2, 4, 6, 8, 10]);
    });
});
