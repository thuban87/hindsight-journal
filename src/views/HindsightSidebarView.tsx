/**
 * Hindsight Sidebar View
 *
 * Obsidian ItemView that hosts a React root for the sidebar.
 * Follows the Quest Board pattern: create root in onOpen, unmount in onClose.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { HINDSIGHT_SIDEBAR_VIEW_TYPE } from '../constants';
import { SidebarApp } from '../components/SidebarApp';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

export class HindsightSidebarView extends ItemView {
    private root: Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return HINDSIGHT_SIDEBAR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Hindsight';
    }

    getIcon(): string {
        return 'history';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('hindsight-sidebar-container');
        this.root = createRoot(container as HTMLElement);
        this.root.render(
            <ErrorBoundary fallback="Hindsight sidebar encountered an error.">
                <SidebarApp />
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
