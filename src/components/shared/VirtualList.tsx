/**
 * Virtual List
 *
 * Lightweight virtual scroll component — no external dependency.
 * Only renders items within the visible window + buffer for smooth
 * scroll performance with 700+ journal entries.
 */

import React, { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';

interface VirtualListProps<T> {
    /** Items to render */
    items: T[];
    /** Render function for each item */
    renderItem: (item: T, index: number) => ReactNode;
    /** Estimated height of each item in pixels */
    estimatedItemHeight: number;
    /** Number of extra items to render above/below the visible window */
    overscan?: number;
}

/**
 * Renders only the visible items + overscan buffer within a scrollable container.
 * Uses spacer divs to maintain correct scroll position.
 */
export function VirtualList<T>({
    items,
    renderItem,
    estimatedItemHeight,
    overscan = 10,
}: VirtualListProps<T>): React.ReactElement {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            setScrollTop(containerRef.current.scrollTop);
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Measure initial container height
        setContainerHeight(container.clientHeight);

        // Observe resize changes
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });
        resizeObserver.observe(container);

        // Listen for scroll events
        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            resizeObserver.disconnect();
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    const totalHeight = items.length * estimatedItemHeight;
    const visibleCount = Math.ceil(containerHeight / estimatedItemHeight);

    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + 2 * overscan);

    const topSpacerHeight = startIndex * estimatedItemHeight;
    const bottomSpacerHeight = Math.max(0, totalHeight - endIndex * estimatedItemHeight);

    const visibleItems = items.slice(startIndex, endIndex);

    return (
        <div
            ref={containerRef}
            className="hindsight-virtual-list"
        >
            <div style={{ height: topSpacerHeight }} />
            {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
            <div style={{ height: bottomSpacerHeight }} />
        </div>
    );
}
