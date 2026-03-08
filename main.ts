import { Plugin } from 'obsidian';
import { HindsightSettingTab } from './src/settings';
import { DEFAULT_SETTINGS } from './src/types';
import type { HindsightSettings, HindsightPluginInterface, ServiceRegistry } from './src/types';
import { HINDSIGHT_SIDEBAR_VIEW_TYPE, HINDSIGHT_MAIN_VIEW_TYPE } from './src/constants';
import { HindsightSidebarView } from './src/views/HindsightSidebarView';
import { HindsightMainView } from './src/views/HindsightMainView';
import { JournalIndexService } from './src/services/JournalIndexService';
import { useSettingsStore } from './src/store/settingsStore';
import { useAppStore } from './src/store/appStore';
import { useJournalStore } from './src/store/journalStore';
import { useUIStore } from './src/store/uiStore';
import { registerCommands } from './src/commands';
import { debugLog } from './src/utils/debugLog';

export default class HindsightPlugin extends Plugin implements HindsightPluginInterface {
    settings: HindsightSettings = DEFAULT_SETTINGS;
    journalIndex: JournalIndexService | null = null;

    /** Cross-store subscriptions — unsubscribed FIRST in onunload() */
    private storeSubscriptions: (() => void)[] = [];
    /** General cleanup callbacks — cleaned up SECOND in onunload() */
    private cleanupRegistry: (() => void)[] = [];

    /** Service registry for the plugin interface */
    get services(): ServiceRegistry {
        return {
            journalIndex: this.journalIndex,
        };
    }

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new HindsightSettingTab(this.app, this));

        // Sync settings to reactive store for React components
        useSettingsStore.getState().setSettings(this.settings);

        // Initialize appStore — components access app/plugin from here
        const appState = useAppStore.getState();
        appState.reset(); // Clear any stale state from previous enable cycle
        appState.setApp(this.app, this);

        // === Journal Index Service ===
        this.journalIndex = new JournalIndexService(this.app, this);
        this.app.workspace.onLayoutReady(async () => {
            await this.journalIndex?.initialize();
            this.journalIndex?.registerFileWatchers();
        });

        // === Sidebar View ===
        this.registerView(
            HINDSIGHT_SIDEBAR_VIEW_TYPE,
            (leaf) => new HindsightSidebarView(leaf)
        );

        // Auto-open sidebar if enabled
        if (this.settings.enableSidebar) {
            this.app.workspace.onLayoutReady(() => {
                void this.activateSidebarView();
            });
        }

        // === Main Full-Page View ===
        this.registerView(
            HINDSIGHT_MAIN_VIEW_TYPE,
            (leaf) => new HindsightMainView(leaf)
        );

        // Ribbon icon for quick access
        this.addRibbonIcon('book-open', 'Open Hindsight', () => {
            void this.activateMainView();
        });

        // === Commands ===
        registerCommands(this);

        debugLog('Plugin loaded');
    }

    onunload(): void {
        // 0. Signal teardown to React components and async hooks
        useAppStore.getState().setIsUnloading(true);

        // 1. Unsubscribe all cross-store subscriptions FIRST
        this.storeSubscriptions.forEach(unsub => unsub());
        this.storeSubscriptions = [];

        // 2. Destroy services
        this.journalIndex?.destroy();

        // 3. Run general cleanup (timers, observers, listeners)
        this.cleanupRegistry.forEach(fn => fn());
        this.cleanupRegistry = [];

        // 4. Reset all stores — appStore LAST
        useJournalStore.getState().reset();
        useUIStore.getState().reset();
        useSettingsStore.getState().reset();
        useAppStore.getState().reset(); // LAST — components may reference app during teardown
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Keep reactive store in sync
        useSettingsStore.getState().setSettings(this.settings);
    }

    /**
     * Activate the sidebar view in the right panel.
     * If already open on the right side, reveal it.
     * If on the wrong side (e.g. cached from a previous session), detach and recreate.
     */
    async activateSidebarView(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(HINDSIGHT_SIDEBAR_VIEW_TYPE);

        if (leaves.length > 0) {
            // Check if the existing leaf is in the right sidebar
            const rightRoot = this.app.workspace.rightSplit;
            const isOnRight = rightRoot && leaves[0].getRoot() === rightRoot;
            if (isOnRight) {
                void this.app.workspace.revealLeaf(leaves[0]);
                return;
            }
            // Wrong side — detach so we can recreate on the right
            leaves[0].detach();
        }

        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: HINDSIGHT_SIDEBAR_VIEW_TYPE });
            void this.app.workspace.revealLeaf(leaf);
        }
    }

    /**
     * Activate the main full-page view.
     * If already open, reveal it. Otherwise create a new tab.
     */
    async activateMainView(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(HINDSIGHT_MAIN_VIEW_TYPE);
        if (leaves.length === 0) {
            const leaf = this.app.workspace.getLeaf('tab');
            if (leaf) {
                await leaf.setViewState({ type: HINDSIGHT_MAIN_VIEW_TYPE });
            }
        } else {
            void this.app.workspace.revealLeaf(leaves[0]);
        }
    }
}
