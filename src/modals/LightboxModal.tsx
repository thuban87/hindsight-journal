/**
 * Lightbox Modal
 *
 * Obsidian Modal that shows a full-size image from a journal entry.
 * Uses vault.readBinary() to load the image, creates a blob URL,
 * and displays in a centered modal with Escape/click-outside-to-close.
 * React root wrapped in ErrorBoundary per plan-wide rules.
 */

import { Modal } from 'obsidian';
import type { App, TFile } from 'obsidian';
import React, { useState, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { useAppStore } from '../store/appStore';

export class LightboxModal extends Modal {
    private root: Root | null = null;
    private imagePath: string;
    private resolvedFile: TFile;

    constructor(app: App, imagePath: string, resolvedFile: TFile) {
        super(app);
        this.imagePath = imagePath;
        this.resolvedFile = resolvedFile;
    }

    onOpen(): void {
        // Guard: don't create React roots during shutdown
        if (useAppStore.getState().isUnloading) return;

        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hindsight-lightbox-modal');

        this.root = createRoot(contentEl);
        this.root.render(
            <ErrorBoundary fallback="Could not display image">
                <LightboxContent
                    resolvedFile={this.resolvedFile}
                    imagePath={this.imagePath}
                    onClose={() => this.close()}
                />
            </ErrorBoundary>
        );
    }

    onClose(): void {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        this.contentEl.empty();
    }
}

/** Error fallback with close button */
function LightboxError({ onClose }: { onClose: () => void }): React.ReactElement {
    return (
        <div className="hindsight-lightbox-error">
            <span>Could not display image</span>
            <button onClick={onClose} className="mod-cta">Close</button>
        </div>
    );
}

/** Main lightbox content — loads and displays the full-size image */
function LightboxContent({
    resolvedFile,
    imagePath,
    onClose,
}: {
    resolvedFile: TFile;
    imagePath: string;
    onClose: () => void;
}): React.ReactElement {
    const app = useAppStore(s => s.app);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!app) return;

        void (async () => {
            try {
                const buffer = await app.vault.readBinary(resolvedFile);
                const blob = new Blob([buffer]);
                const url = URL.createObjectURL(blob);
                urlRef.current = url;
                setImageUrl(url);
                setLoading(false);
            } catch {
                setError(true);
                setLoading(false);
            }
        })();

        return () => {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, [app, resolvedFile]);

    if (error) {
        return (
            <div className="hindsight-lightbox-error">
                <span>Could not load image: {imagePath}</span>
                <button onClick={onClose} className="mod-cta">Close</button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="hindsight-lightbox-loading">
                <div className="hindsight-lightbox-spinner" />
                <span>Loading image...</span>
            </div>
        );
    }

    return (
        <div className="hindsight-lightbox-container">
            {imageUrl && (
                <img
                    className="hindsight-lightbox-img"
                    src={imageUrl}
                    alt={imagePath}
                />
            )}
        </div>
    );
}
