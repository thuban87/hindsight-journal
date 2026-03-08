import { PluginSettingTab, App, Setting } from 'obsidian';
import type HindsightPlugin from '../main';
import { FolderSuggest } from './ui/FolderSuggest';

export class HindsightSettingTab extends PluginSettingTab {
    plugin: HindsightPlugin;

    constructor(app: App, plugin: HindsightPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setHeading()
            .setName('Journal');

        // IMPORTANT: Text inputs use onBlur (not onChange) to avoid
        // hammering saveSettings() on every keystroke.
        // onChange would trigger disk I/O per character typed.
        new Setting(containerEl)
            .setName('Journal folder')
            .setDesc('Folder containing your daily notes (scanned recursively).')
            .addText(text => {
                text.setPlaceholder('e.g., Journal')
                    .setValue(this.plugin.settings.journalFolder);
                // Attach folder autocomplete
                new FolderSuggest(this.app, text.inputEl);
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const newFolder = text.inputEl.value.trim();
                        if (newFolder !== this.plugin.settings.journalFolder) {
                            this.plugin.settings.journalFolder = newFolder;
                            await this.plugin.saveSettings();
                            // Trigger re-index with the new folder
                            void this.plugin.journalIndex?.reconfigure(newFolder);
                        }
                    })();
                });
            });

        new Setting(containerEl)
            .setName('Weekly review folder')
            .setDesc('Folder containing weekly review notes (optional).')
            .addText(text => {
                text.setPlaceholder('e.g., Weekly Reviews')
                    .setValue(this.plugin.settings.weeklyReviewFolder);
                // Attach folder autocomplete
                new FolderSuggest(this.app, text.inputEl);
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const value = text.inputEl.value.trim();
                        if (value !== this.plugin.settings.weeklyReviewFolder) {
                            this.plugin.settings.weeklyReviewFolder = value;
                            await this.plugin.saveSettings();
                        }
                    })();
                });
            });

        new Setting(containerEl)
            .setHeading()
            .setName('Appearance');

        new Setting(containerEl)
            .setName('Open sidebar on startup')
            .setDesc('Automatically open the Hindsight Journal sidebar when the plugin loads.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSidebar)
                .onChange(async (value) => {
                    this.plugin.settings.enableSidebar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setHeading()
            .setName('Advanced');

        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable verbose debug logging to the developer console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }
}

