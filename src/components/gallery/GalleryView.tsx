/**
 * Gallery View
 *
 * Grid of image thumbnails from all journal entries.
 * Uses VirtualList adapted for row-based grid virtualization.
 * Each row contains N thumbnails based on container width.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useJournalStore } from '../../store/journalStore';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Thumbnail } from '../shared/Thumbnail';
import { EmptyState } from '../shared/EmptyState';
import { VirtualList } from '../shared/VirtualList';
import type { JournalEntry } from '../../types';

/** A single image item for the gallery grid */
interface GalleryItem {
    imagePath: string;
    sourceFilePath: string;
    mtime: number;
    date: Date;
    entryFilePath: string;
}

export function GalleryView(): React.ReactElement {
    const entries = useJournalStore(s => s.entries);
    const app = useAppStore(s => s.app);
    const thumbnailsEnabled = useSettingsStore(s => s.settings.thumbnailsEnabled);
    const thumbnailSize = useSettingsStore(s => s.settings.thumbnailSize);
    const containerRef = useRef<HTMLDivElement>(null);
    const [itemsPerRow, setItemsPerRow] = useState(4);

    // Collect all images from all entries, newest first
    const allImages = useMemo<GalleryItem[]>(() => {
        const items: GalleryItem[] = [];
        const sortedEntries = Array.from(entries.values())
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        for (const entry of sortedEntries) {
            for (const imgPath of entry.imagePaths) {
                items.push({
                    imagePath: imgPath,
                    sourceFilePath: entry.filePath,
                    mtime: entry.mtime,
                    date: entry.date,
                    entryFilePath: entry.filePath,
                });
            }
        }
        return items;
    }, [entries]);

    // Calculate items per row based on container width
    useEffect(() => {
        if (!containerRef.current) return;

        const calculateColumns = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth;
            const gap = 8;
            const cellSize = thumbnailSize + gap;
            const cols = Math.max(1, Math.floor(width / cellSize));
            setItemsPerRow(cols);
        };

        calculateColumns();

        const observer = new ResizeObserver(() => {
            calculateColumns();
        });
        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, [thumbnailSize]);

    // Split items into rows
    const rows = useMemo(() => {
        const result: GalleryItem[][] = [];
        for (let i = 0; i < allImages.length; i += itemsPerRow) {
            result.push(allImages.slice(i, i + itemsPerRow));
        }
        return result;
    }, [allImages, itemsPerRow]);

    const handleImageClick = useCallback(
        (item: GalleryItem) => {
            if (!app) return;
            void app.workspace.openLinkText(item.entryFilePath, '');
        },
        [app]
    );

    if (!thumbnailsEnabled) {
        return (
            <EmptyState
                message="Enable thumbnails in settings to view the gallery"
            />
        );
    }

    if (allImages.length === 0) {
        return (
            <EmptyState
                message="No images found in journal entries"
            />
        );
    }

    const rowHeight = thumbnailSize + 28; // thumbnail + date label + gap

    return (
        <div className="hindsight-gallery-container" ref={containerRef}>
            <div className="hindsight-gallery-header">
                <span className="hindsight-gallery-count" aria-live="polite">
                    {allImages.length} image{allImages.length !== 1 ? 's' : ''}
                </span>
            </div>
            <VirtualList<GalleryItem[]>
                items={rows}
                estimatedItemHeight={rowHeight}
                renderItem={(row, index) => (
                    <GalleryRow
                        key={index}
                        items={row}
                        thumbnailSize={thumbnailSize}
                        onImageClick={handleImageClick}
                    />
                )}
            />
        </div>
    );
}

/** Renders a single row of gallery thumbnails */
function GalleryRow({
    items,
    thumbnailSize,
    onImageClick,
}: {
    items: GalleryItem[];
    thumbnailSize: number;
    onImageClick: (item: GalleryItem) => void;
}): React.ReactElement {
    return (
        <div className="hindsight-gallery-row">
            {items.map((item, i) => (
                <div key={`${item.sourceFilePath}-${item.imagePath}-${i}`} className="hindsight-gallery-item">
                    <Thumbnail
                        imagePath={item.imagePath}
                        sourceFilePath={item.sourceFilePath}
                        mtime={item.mtime}
                        size={thumbnailSize}
                        onClick={() => onImageClick(item)}
                    />
                    <span className="hindsight-gallery-date">
                        {item.date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                </div>
            ))}
        </div>
    );
}
