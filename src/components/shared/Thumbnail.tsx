/**
 * Thumbnail Component
 *
 * Reusable thumbnail display component.
 * Uses useThumbnail() hook for lazy loading.
 * Shows loading skeleton while generating, placeholder icon on failure.
 */

import React from 'react';
import { useThumbnail } from '../../hooks/useThumbnail';

interface ThumbnailProps {
    imagePath: string;
    sourceFilePath: string;
    mtime: number;
    size?: number;
    onClick?: () => void;
}

export function Thumbnail({
    imagePath,
    sourceFilePath,
    mtime,
    size = 120,
    onClick,
}: ThumbnailProps): React.ReactElement {
    const { url, loading } = useThumbnail(imagePath, sourceFilePath, mtime);

    if (loading) {
        return (
            <div
                className="hindsight-thumbnail hindsight-thumbnail-skeleton"
                role="img"
                aria-label="Loading thumbnail"
            />
        );
    }

    if (!url) {
        return (
            <div
                className="hindsight-thumbnail hindsight-thumbnail-placeholder"
                role="img"
                aria-label="Image placeholder"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                </svg>
            </div>
        );
    }

    return (
        <img
            className="hindsight-thumbnail"
            src={url}
            alt="Journal entry image"
            width={size}
            height={size}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
        />
    );
}
