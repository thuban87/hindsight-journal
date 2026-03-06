import { Plugin } from 'obsidian';
import { HindsightSettingTab } from './src/settings';
import { DEFAULT_SETTINGS, HindsightSettings } from './src/types';
import { HINDSIGHT_UPLOT_EVAL_VIEW_TYPE, CHARTJS_EVAL_VIEW_TYPE } from './src/constants';
import { UPlotEvalView } from './src/views/UPlotEvalView';
import { ChartJsEvalView } from './src/views/ChartJsEvalView';
import { JournalIndexService } from './src/services/JournalIndexService';
import { useSettingsStore } from './src/store/settingsStore';
import { useJournalStore } from './src/store/journalStore';

export default class HindsightPlugin extends Plugin {
    settings: HindsightSettings = DEFAULT_SETTINGS;
    journalIndex: JournalIndexService | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new HindsightSettingTab(this.app, this));

        // Sync settings to reactive store for React components
        useSettingsStore.getState().setSettings(this.settings);

        // === Journal Index Service ===
        this.journalIndex = new JournalIndexService(this.app, this);
        this.app.workspace.onLayoutReady(async () => {
            await this.journalIndex!.initialize();
            this.journalIndex!.registerFileWatchers();
        });

        // Temporary debug command (remove after Phase 1 verification)
        this.addCommand({
            id: 'debug-index',
            name: 'Debug: log journal index',
            callback: () => {
                const { entries, detectedFields } = useJournalStore.getState();
                console.debug(`Hindsight index: ${entries.size} entries`);
                console.debug('Detected fields:', detectedFields);
                if (entries.size > 0) {
                    const sample = entries.values().next().value;
                    console.debug('Sample entry:', sample);
                }
            },
        });

        // === Temporary: uPlot evaluation view ===
        this.registerView(
            HINDSIGHT_UPLOT_EVAL_VIEW_TYPE,
            (leaf) => new UPlotEvalView(leaf, this)
        );

        this.addCommand({
            id: 'open-uplot-eval',
            name: 'Open uPlot evaluation charts',
            callback: async () => {
                const existing = this.app.workspace.getLeavesOfType(HINDSIGHT_UPLOT_EVAL_VIEW_TYPE);
                if (existing.length > 0) {
                    this.app.workspace.revealLeaf(existing[0]);
                    return;
                }
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.setViewState({
                    type: HINDSIGHT_UPLOT_EVAL_VIEW_TYPE,
                    active: true,
                });
            },
        });

        // === Temporary: Chart.js evaluation view ===
        this.registerView(
            CHARTJS_EVAL_VIEW_TYPE,
            (leaf) => new ChartJsEvalView(leaf, this)
        );

        this.addCommand({
            id: 'open-chartjs-eval',
            name: 'Open Chart.js evaluation charts',
            callback: async () => {
                const existing = this.app.workspace.getLeavesOfType(CHARTJS_EVAL_VIEW_TYPE);
                if (existing.length > 0) {
                    this.app.workspace.revealLeaf(existing[0]);
                    return;
                }
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.setViewState({
                    type: CHARTJS_EVAL_VIEW_TYPE,
                    active: true,
                });
            },
        });

        console.debug('Hindsight Journal loaded');
    }

    onunload(): void {
        this.journalIndex?.destroy();
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Keep reactive store in sync
        useSettingsStore.getState().setSettings(this.settings);
    }
}
