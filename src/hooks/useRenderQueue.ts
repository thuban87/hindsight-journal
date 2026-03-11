/**
 * Render Queue Hook
 *
 * Manages a concurrent render cap for MarkdownRenderer in the Section Reader.
 * MAX_ACTIVE_RENDERERS: 2 on mobile, 4 on desktop (Platform.isMobile).
 *
 * Flow:
 * 1. Entry mounts → acquires a render slot via useRenderSlot
 * 2. Slot granted → canRender = true → MarkdownRenderer starts
 * 3. MarkdownRenderer completes → entry calls onRenderComplete()
 * 4. Slot released → next queued entry dequeues
 * 5. Entry keeps showing rendered content (hasRendered stays true)
 *
 * Uses a module-level queue + listener pattern (not React Context) to avoid
 * re-rendering all items when queue state changes.
 *
 * During fast scrolling, no entries dequeue — prevents wasted renders.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'obsidian';

const MAX_ACTIVE_RENDERERS = Platform.isMobile ? 2 : 4;

type Listener = () => void;

/** Module-level render queue state */
let activeCount = 0;
const waitingQueue: { key: string; resolve: () => void }[] = [];
const listeners = new Set<Listener>();
let fastScrollActive = false;

function notifyListeners(): void {
    for (const listener of listeners) {
        listener();
    }
}

function tryDequeue(): void {
    if (fastScrollActive) return;
    while (activeCount < MAX_ACTIVE_RENDERERS && waitingQueue.length > 0) {
        const next = waitingQueue.shift();
        if (next) {
            activeCount++;
            next.resolve();
        }
    }
}

function acquireSlot(key: string): Promise<void> | null {
    // Remove any existing entry for this key (re-mount case)
    const existingIdx = waitingQueue.findIndex(w => w.key === key);
    if (existingIdx >= 0) {
        waitingQueue.splice(existingIdx, 1);
    }

    if (!fastScrollActive && activeCount < MAX_ACTIVE_RENDERERS) {
        activeCount++;
        return null; // slot acquired immediately
    }

    // Queue the request
    return new Promise<void>((resolve) => {
        waitingQueue.push({ key, resolve });
    });
}

function releaseSlot(): void {
    activeCount = Math.max(0, activeCount - 1);
    tryDequeue();
}

function removeFromQueue(key: string): void {
    const idx = waitingQueue.findIndex(w => w.key === key);
    if (idx >= 0) {
        waitingQueue.splice(idx, 1);
    }
}

/**
 * Update fast-scroll state. When scrolling settles, dequeue pending entries.
 */
export function setRenderQueueFastScroll(isFastScrolling: boolean): void {
    const wasActive = fastScrollActive;
    fastScrollActive = isFastScrolling;
    if (wasActive && !isFastScrolling) {
        // Scrolling settled — dequeue pending entries
        tryDequeue();
        notifyListeners();
    }
}

/**
 * Reset the render queue (for unmount / cleanup).
 */
export function resetRenderQueue(): void {
    activeCount = 0;
    waitingQueue.length = 0;
    fastScrollActive = false;
}

/**
 * Hook to acquire a render slot for MarkdownRenderer.
 *
 * Returns:
 * - canRender: true when rendering should start (slot acquired or already rendered)
 * - onRenderComplete: call this when MarkdownRenderer finishes to release the slot
 *
 * Once rendering completes and onRenderComplete is called, canRender stays true
 * for the lifetime of the component (hasRendered flag). The slot is freed for
 * the next queued entry.
 */
export function useRenderSlot(
    key: string, enabled: boolean
): { canRender: boolean; onRenderComplete: () => void } {
    const [canRender, setCanRender] = useState(false);
    const hasSlotRef = useRef(false);
    const hasRenderedRef = useRef(false);
    const keyRef = useRef(key);
    keyRef.current = key;

    useEffect(() => {
        if (!enabled) {
            // If we already rendered, keep canRender true
            if (hasRenderedRef.current) {
                setCanRender(true);
                return;
            }
            // Release slot if we had one but hadn't rendered yet
            if (hasSlotRef.current) {
                hasSlotRef.current = false;
                setCanRender(false);
                releaseSlot();
            }
            return;
        }

        // Already rendered — no need for a slot
        if (hasRenderedRef.current) {
            setCanRender(true);
            return;
        }

        let cancelled = false;

        const result = acquireSlot(key);
        if (result === null) {
            // Immediate acquisition
            hasSlotRef.current = true;
            setCanRender(true);
        } else {
            // Queued — wait for slot
            void result.then(() => {
                if (!cancelled) {
                    hasSlotRef.current = true;
                    setCanRender(true);
                }
            });
        }

        // Listen for queue state changes (fast-scroll settle)
        const listener = (): void => {
            if (!hasSlotRef.current && !hasRenderedRef.current && !cancelled) {
                const retry = acquireSlot(keyRef.current);
                if (retry === null) {
                    hasSlotRef.current = true;
                    setCanRender(true);
                }
            }
        };
        listeners.add(listener);

        return () => {
            cancelled = true;
            listeners.delete(listener);
            removeFromQueue(key);
            // Release the slot if we still hold one (entry unmounted before rendering completed)
            if (hasSlotRef.current) {
                hasSlotRef.current = false;
                releaseSlot();
            }
        };
    }, [key, enabled]);

    const onRenderComplete = useCallback(() => {
        hasRenderedRef.current = true;
        // Release the slot for the next queued entry
        if (hasSlotRef.current) {
            hasSlotRef.current = false;
            releaseSlot();
        }
    }, []);

    return { canRender, onRenderComplete };
}
