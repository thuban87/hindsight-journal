/**
 * Command Menu Modal
 *
 * Obsidian Modal that mounts a React root for the Command Menu.
 * Follows the canonical modal pattern:
 * - isUnloading guard in onOpen
 * - ErrorBoundary with close-button fallback
 * - root.unmount() in onClose
 */

import { App, Modal } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { useAppStore } from '../store/appStore';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { CommandMenuApp } from '../components/CommandMenuApp';
import type { HindsightPluginInterface } from '../types/plugin';

export class CommandMenuModal extends Modal {
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
        contentEl.addClass('hindsight-command-menu-content');
        this.modalEl.addClass('hindsight-command-menu-modal');

        this.root = createRoot(contentEl);
        this.root.render(
            React.createElement(
                ErrorBoundary,
                { fallback: 'Command menu encountered an error.' },
                React.createElement(CommandMenuApp, {
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
