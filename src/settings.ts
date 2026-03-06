import { PluginSettingTab, App, Setting } from 'obsidian';
import type HindsightPlugin from '../main';

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
                text.inputEl.addEventListener('blur', async () => {
                    const newFolder = text.inputEl.value.trim();
                    if (newFolder !== this.plugin.settings.journalFolder) {
                        this.plugin.settings.journalFolder = newFolder;
                        await this.plugin.saveSettings();
                        // Trigger re-index with the new folder (Phase 1)
                        // this.plugin.journalIndex?.reconfigure(newFolder);
                    }
                });
            });

        new Setting(containerEl)
            .setName('Weekly review folder')
            .setDesc('Folder containing weekly review notes (optional).')
            .addText(text => {
                text.setPlaceholder('e.g., Weekly Reviews')
                    .setValue(this.plugin.settings.weeklyReviewFolder);
                text.inputEl.addEventListener('blur', async () => {
                    const value = text.inputEl.value.trim();
                    if (value !== this.plugin.settings.weeklyReviewFolder) {
                        this.plugin.settings.weeklyReviewFolder = value;
                        await this.plugin.saveSettings();
                    }
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
    }
}
