import { Plugin } from 'obsidian';
import { HindsightSettingTab } from './src/settings';
import { DEFAULT_SETTINGS, HindsightSettings } from './src/types';
import { HINDSIGHT_UPLOT_EVAL_VIEW_TYPE, CHARTJS_EVAL_VIEW_TYPE } from './src/constants';
import { UPlotEvalView } from './src/views/UPlotEvalView';
import { ChartJsEvalView } from './src/views/ChartJsEvalView';

export default class HindsightPlugin extends Plugin {
    settings: HindsightSettings = DEFAULT_SETTINGS;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new HindsightSettingTab(this.app, this));

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

        // Services and views will be registered here in later phases
        console.debug('Hindsight Journal loaded');
    }

    onunload(): void {
        // Cleanup will be added as services/views are registered
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
