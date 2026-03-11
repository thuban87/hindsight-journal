/**
 * Virtual Variable List
 *
 * Variable-height virtual scroll component for the Section Reader.
 * Separate from VirtualList.tsx (fixed-height) — variable-height
 * virtualization is fundamentally different and modifying the existing
 * component risks regressions in Timeline and Index views.
 *
 * Key features:
 * - measuredHeights cache with estimatedItemHeight fallback
 * - Content-versioned keys via getKey prop
 * - Instance-scoped shared ResizeObserver via SharedObserverProvider
 * - Height cache batching via requestAnimationFrame
 * - Container-width ResizeObserver with 200ms debounce
 * - CSS-change: mark stale + remeasure visible (no full clear)
 * - Context change (heading/date range): full clear + scroll to top
 */

import React, {
    useRef,
    useState,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';
import { SharedObserverProvider, useSharedObserver } from '../../hooks/useSharedObserver';
import { useAppStore } from '../../store/appStore';

interface VirtualVariableListProps<T> {
    /** Items to render */
    items: T[];
    /** Render function for each item — isFastScrolling indicates rapid scrolling in progress */
    renderItem: (item: T, index: number, isFastScrolling: boolean) => ReactNode;
    /** Estimated height of each item in pixels (default for unmeasured items) */
    estimatedItemHeight: number;
    /** Number of extra items to render above/below the visible window */
    overscan?: number;
    /** Content-versioned key for each item (e.g., filePath::heading::mtime) */
    getKey: (index: number) => string;
    /** Incremented when context changes (heading/date range) to reset scroll + heights */
    contextVersion?: number;
}

/**
 * Wrapper row that observes its own height via the shared ResizeObserver.
 */
function MeasuredRow({
    index,
    itemKey,
    onHeightMeasured,
    children,
}: {
    index: number;
    itemKey: string;
    onHeightMeasured: (index: number, height: number) => void;
    children: ReactNode;
}): React.ReactElement {
    const rowRef = useRef<HTMLDivElement>(null);
    const observer = useSharedObserver();

    useEffect(() => {
        const el = rowRef.current;
        if (!el) return;

        observer.observe(el, (entry) => {
            const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
            onHeightMeasured(index, height);
        });

        return () => {
            observer.unobserve(el);
        };
    }, [index, itemKey, observer, onHeightMeasured]);

    return (
        <div ref={rowRef} data-vvl-index={index}>
            {children}
        </div>
    );
}

/**
 * Inner list that reads from the SharedObserverProvider context.
 */
function VirtualVariableListInner<T>({
    items,
    renderItem,
    estimatedItemHeight,
    overscan = 5,
    getKey,
    contextVersion = 0,
}: VirtualVariableListProps<T>): React.ReactElement {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    const measuredHeightsRef = useRef<Map<number, number>>(new Map());
    const staleRef = useRef(false);
    const pendingUpdatesRef = useRef<Map<number, number>>(new Map());
    const rafIdRef = useRef<number | null>(null);
    const [, forceUpdate] = useState(0);
    const prevContextVersion = useRef(contextVersion);
    const containerWidthRef = useRef(0);
    const widthDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const app = useAppStore(s => s.app);

    // Fast-scroll detection: track last N scroll timestamps
    const FAST_SCROLL_EVENT_COUNT = 3;
    const FAST_SCROLL_WINDOW_MS = 100;
    const FAST_SCROLL_SETTLE_MS = 150;
    const scrollTimestampsRef = useRef<number[]>([]);
    const [isFastScrolling, setIsFastScrolling] = useState(false);
    const fastScrollRef = useRef(false);
    const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Context change: clear heights + scroll to top
    useEffect(() => {
        if (contextVersion !== prevContextVersion.current) {
            prevContextVersion.current = contextVersion;
            measuredHeightsRef.current.clear();
            pendingUpdatesRef.current.clear();
            if (containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }
            setScrollTop(0);
            forceUpdate(v => v + 1);
        }
    }, [contextVersion]);

    // Batched height measurement callback
    const onHeightMeasured = useCallback((index: number, height: number) => {
        const current = measuredHeightsRef.current.get(index);
        if (current !== undefined && Math.abs(current - height) < 1) return;

        pendingUpdatesRef.current.set(index, height);

        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                const pending = pendingUpdatesRef.current;
                for (const [idx, h] of pending) {
                    measuredHeightsRef.current.set(idx, h);
                }
                pending.clear();
                rafIdRef.current = null;
                forceUpdate(v => v + 1);
            });
        }
    }, []);

    // Get height for an item (measured or estimated)
    const getItemHeight = useCallback((index: number): number => {
        return measuredHeightsRef.current.get(index) ?? estimatedItemHeight;
    }, [estimatedItemHeight]);

    // Scroll handler with fast-scroll detection
    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;
        setScrollTop(containerRef.current.scrollTop);

        // Track scroll timestamps for fast-scroll detection
        const now = performance.now();
        const timestamps = scrollTimestampsRef.current;
        timestamps.push(now);
        // Keep only the last N + 1 timestamps
        while (timestamps.length > FAST_SCROLL_EVENT_COUNT + 1) {
            timestamps.shift();
        }

        // Check if >FAST_SCROLL_EVENT_COUNT events fired within FAST_SCROLL_WINDOW_MS
        if (timestamps.length > FAST_SCROLL_EVENT_COUNT) {
            const oldest = timestamps[timestamps.length - FAST_SCROLL_EVENT_COUNT - 1];
            if (now - oldest < FAST_SCROLL_WINDOW_MS) {
                if (!fastScrollRef.current) {
                    fastScrollRef.current = true;
                    setIsFastScrolling(true);
                }
            }
        }

        // Reset settle timeout — fires when scrolling stops
        if (settleTimeoutRef.current) {
            clearTimeout(settleTimeoutRef.current);
        }
        settleTimeoutRef.current = setTimeout(() => {
            fastScrollRef.current = false;
            setIsFastScrolling(false);
            scrollTimestampsRef.current = [];
        }, FAST_SCROLL_SETTLE_MS);
    }, []);

    // Container resize observer + scroll listener
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        setContainerHeight(container.clientHeight);
        containerWidthRef.current = container.clientWidth;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const newHeight = entry.contentRect.height;
                const newWidth = entry.contentRect.width;

                setContainerHeight(newHeight);

                // Width change → debounce invalidation (A13)
                if (Math.abs(newWidth - containerWidthRef.current) > 1) {
                    containerWidthRef.current = newWidth;
                    if (widthDebounceRef.current) {
                        clearTimeout(widthDebounceRef.current);
                    }
                    widthDebounceRef.current = setTimeout(() => {
                        measuredHeightsRef.current.clear();
                        forceUpdate(v => v + 1);
                    }, 200);
                }
            }
        });
        resizeObserver.observe(container);

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            resizeObserver.disconnect();
            container.removeEventListener('scroll', handleScroll);
            if (widthDebounceRef.current) {
                clearTimeout(widthDebounceRef.current);
            }
            if (settleTimeoutRef.current) {
                clearTimeout(settleTimeoutRef.current);
            }
        };
    }, [handleScroll]);

    // CSS-change: mark stale + remeasure visible (no full clear)
    useEffect(() => {
        if (!app) return;

        const onCssChange = (): void => {
            staleRef.current = true;
            // Clear only measured heights for currently visible items
            // They will be re-measured by the ResizeObserver automatically
            // Items outside viewport keep old heights until they scroll into view
            forceUpdate(v => v + 1);
        };

        app.workspace.on('css-change', onCssChange);
        return () => {
            app.workspace.off('css-change', onCssChange);
        };
    }, [app]);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    // Compute visible range
    const { startIndex, endIndex, topSpacerHeight, totalHeight } = useMemo(() => {
        let cumHeight = 0;
        let start = 0;
        let foundStart = false;

        // Find start index
        for (let i = 0; i < items.length; i++) {
            const h = getItemHeight(i);
            if (!foundStart && cumHeight + h > scrollTop) {
                start = i;
                foundStart = true;
                break;
            }
            cumHeight += h;
        }

        if (!foundStart) {
            start = Math.max(0, items.length - 1);
            cumHeight = 0;
            for (let i = 0; i < start; i++) {
                cumHeight += getItemHeight(i);
            }
        }

        const topSpacer = cumHeight;

        // Find end index
        let visibleHeight = 0;
        let end = start;
        for (let i = start; i < items.length; i++) {
            end = i + 1;
            visibleHeight += getItemHeight(i);
            if (visibleHeight >= containerHeight) break;
        }

        // Apply overscan
        const oStart = Math.max(0, start - overscan);
        const oEnd = Math.min(items.length, end + overscan);

        // Recalculate top spacer for overscan start
        let adjustedTopSpacer = 0;
        for (let i = 0; i < oStart; i++) {
            adjustedTopSpacer += getItemHeight(i);
        }

        // Total height
        let total = 0;
        for (let i = 0; i < items.length; i++) {
            total += getItemHeight(i);
        }

        return {
            startIndex: oStart,
            endIndex: oEnd,
            topSpacerHeight: adjustedTopSpacer,
            totalHeight: total,
        };
    }, [items.length, scrollTop, containerHeight, getItemHeight, overscan]);

    const bottomSpacerHeight = useMemo(() => {
        let bottomItems = 0;
        for (let i = endIndex; i < items.length; i++) {
            bottomItems += getItemHeight(i);
        }
        return bottomItems;
    }, [endIndex, items.length, getItemHeight]);

    const visibleItems = items.slice(startIndex, endIndex);

    return (
        <div
            ref={containerRef}
            className="hindsight-virtual-variable-list"
        >
            <div style={{ height: topSpacerHeight }} />
            {visibleItems.map((item, i) => {
                const globalIndex = startIndex + i;
                const key = getKey(globalIndex);
                return (
                    <MeasuredRow
                        key={key}
                        index={globalIndex}
                        itemKey={key}
                        onHeightMeasured={onHeightMeasured}
                    >
                        {renderItem(item, globalIndex, isFastScrolling)}
                    </MeasuredRow>
                );
            })}
            <div style={{ height: bottomSpacerHeight }} />
        </div>
    );
}

/**
 * Variable-height virtual list with shared ResizeObserver.
 * Wraps the inner list in a SharedObserverProvider.
 */
export function VirtualVariableList<T>(props: VirtualVariableListProps<T>): React.ReactElement {
    return (
        <SharedObserverProvider>
            <VirtualVariableListInner {...props} />
        </SharedObserverProvider>
    );
}
