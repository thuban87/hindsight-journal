/**
 * Weekly Review Modal
 *
 * Obsidian Modal for weekly review wizard.
 * Triggered via command: 'Hindsight: Open weekly review'
 * Follows the canonical modal pattern (SectionReaderModal):
 * - isUnloading guard in onOpen
 * - ErrorBoundary with close-button fallback
 * - root.unmount() in onClose
 */

import { App, Modal } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { useAppStore } from '../store/appStore';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { WeeklyReviewApp } from '../components/wizard/WeeklyReviewApp';
import type { HindsightPluginInterface } from '../types/plugin';

export class WeeklyReviewModal extends Modal {
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
        contentEl.addClass('hindsight-weekly-review-modal');
        this.modalEl.addClass('hindsight-fullscreen-modal');

        this.root = createRoot(contentEl);
        this.root.render(
            React.createElement(
                ErrorBoundary,
                { fallback: 'Weekly review encountered an error.' },
                React.createElement(WeeklyReviewApp, {
                    onClose: () => this.close(),
                })
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
