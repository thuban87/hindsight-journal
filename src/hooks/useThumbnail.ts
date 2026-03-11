/**
 * useThumbnail Hook
 *
 * React hook to get a thumbnail URL for an image path.
 * Returns { url: string | null, loading: boolean }.
 *
 * Does NOT manage blob URL lifecycle internally — the ThumbnailService
 * owns all Object URLs centrally (see activeObjectUrls map).
 * This hook simply requests a URL from the service and triggers a
 * re-render when it becomes available. No revokeObjectURL on unmount.
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useThumbnail(
    imagePath: string,
    sourceFilePath: string,
    mtime: number
): { url: string | null; loading: boolean } {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const plugin = useAppStore(s => s.plugin);
    const thumbnailService = plugin?.services.thumbnailService ?? null;

    useEffect(() => {
        if (!thumbnailService || !imagePath) {
            setLoading(false);
            return;
        }

        // Cancellation signal — set on unmount to skip stale results
        const signal = { cancelled: false };
        setLoading(true);

        const app = useAppStore.getState().app;
        if (!app) {
            setLoading(false);
            return;
        }

        void thumbnailService
            .getThumbnail(imagePath, sourceFilePath, app.vault, mtime, signal)
            .then((result: string | null) => {
                if (!signal.cancelled) {
                    setUrl(result);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!signal.cancelled) {
                    setUrl(null);
                    setLoading(false);
                }
            });

        return () => {
            signal.cancelled = true;
        };
    }, [thumbnailService, imagePath, sourceFilePath, mtime]);

    return { url, loading };
}
