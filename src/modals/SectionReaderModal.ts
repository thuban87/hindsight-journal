/**
 * Section Reader Modal
 *
 * Obsidian Modal that mounts a React root for the Section Reader.
 * Follows the canonical modal pattern from plan-wide rules:
 * - isUnloading guard in onOpen
 * - ErrorBoundary with close-button fallback
 * - root.unmount() in onClose
 */

import { App, Modal } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { useAppStore } from '../store/appStore';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { SectionReader } from '../components/sections/SectionReader';
import type { HindsightPluginInterface } from '../types/plugin';

export class SectionReaderModal extends Modal {
    private root: Root | null = null;
    private plugin: HindsightPluginInterface;

    constructor(app: App, plugin: HindsightPluginInterface) {
        super(app);
        this.plugin = plugin;
    }

    onOpen(): void {
        // Guard: don't create React roots during shutdown
        if (useAppStore.getState().isUnloading) return;

        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hindsight-section-reader-modal');
        this.modalEl.addClass('hindsight-fullscreen-modal');

        this.root = createRoot(contentEl);
        this.root.render(
            React.createElement(
                ErrorBoundary,
                { fallback: 'Section reader encountered an error.' },
                React.createElement(SectionReader)
            )
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
