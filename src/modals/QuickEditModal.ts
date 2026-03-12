/**
 * Quick Edit Modal
 *
 * Obsidian Modal for frontmatter quick-editing.
 * Triggered from the sidebar Today tab.
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
import { QuickEditApp } from '../components/quickedit/QuickEditApp';
import type { HindsightPluginInterface } from '../types/plugin';

export class QuickEditModal extends Modal {
    private root: Root | null = null;
    private plugin: HindsightPluginInterface;
    private initialDate: Date;

    constructor(app: App, plugin: HindsightPluginInterface, initialDate?: Date) {
        super(app);
        this.plugin = plugin;
        this.initialDate = initialDate ?? new Date();
    }

    onOpen(): void {
        // Guard: don't create React roots during shutdown
        if (useAppStore.getState().isUnloading) return;

        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hindsight-quick-edit-modal');
        this.modalEl.addClass('hindsight-fullscreen-modal');

        this.root = createRoot(contentEl);
        this.root.render(
            React.createElement(
                ErrorBoundary,
                { fallback: 'Quick edit encountered an error.' },
                React.createElement(QuickEditApp, {
                    initialDate: this.initialDate,
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
