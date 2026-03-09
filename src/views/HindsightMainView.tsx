/**
 * Hindsight Main View
 *
 * Obsidian ItemView that hosts a React root for the full-page view.
 * Same pattern as HindsightSidebarView: create root in onOpen, unmount in onClose.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { HINDSIGHT_MAIN_VIEW_TYPE } from '../constants';
import { MainApp } from '../components/MainApp';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

export class HindsightMainView extends ItemView {
    private root: Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return HINDSIGHT_MAIN_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Hindsight';
    }

    getIcon(): string {
        return 'book-open';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('hindsight-main-container');
        this.root = createRoot(container as HTMLElement);
        this.root.render(
            <ErrorBoundary fallback="Hindsight encountered an error.">
                <MainApp />
            </ErrorBoundary>
        );
    }

    async onClose(): Promise<void> {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }
}
