import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import type HindsightPlugin from '../main';
import { FolderSuggest } from './ui/FolderSuggest';
import { normalizePathSetting } from './utils/settingsMigration';
import { validateVaultRelativePath } from './utils/vaultUtils';
import { useJournalStore } from './store/journalStore';

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
                        const raw = text.inputEl.value.trim();
                        const normalized = normalizePathSetting(raw);
                        if (normalized !== this.plugin.settings.journalFolder) {
                            // Validate path before saving
                            if (normalized !== '' && !validateVaultRelativePath(normalized)) {
                                new Notice('Invalid folder path — must be a relative path within the vault.');
                                text.inputEl.value = this.plugin.settings.journalFolder;
                                return;
                            }
                            this.plugin.settings.journalFolder = normalized;
                            await this.plugin.saveSettings();
                            // Trigger re-index with the new folder
                            void this.plugin.journalIndex?.reconfigure(normalized);
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
                        const raw = text.inputEl.value.trim();
                        const normalized = normalizePathSetting(raw);
                        if (normalized !== this.plugin.settings.weeklyReviewFolder) {
                            // Validate if non-empty
                            if (normalized !== '' && !validateVaultRelativePath(normalized)) {
                                new Notice('Invalid folder path — must be a relative path within the vault.');
                                text.inputEl.value = this.plugin.settings.weeklyReviewFolder;
                                return;
                            }
                            this.plugin.settings.weeklyReviewFolder = normalized;
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

        // Field configuration section
        const detectedFields = useJournalStore.getState().detectedFields;
        const numericFields = detectedFields.filter(f => f.type === 'number');

        if (numericFields.length > 0) {
            new Setting(containerEl)
                .setHeading()
                .setName('Field configuration');

            for (const field of numericFields) {
                new Setting(containerEl)
                    .setName(field.key)
                    .setDesc(`Set polarity for ${field.key} (affects badge colors and trend alert tone).`)
                    .addDropdown(dropdown => {
                        dropdown
                            .addOption('neutral', 'Neutral')
                            .addOption('higher-is-better', 'Higher is better')
                            .addOption('lower-is-better', 'Lower is better')
                            .setValue(this.plugin.settings.fieldPolarity[field.key] ?? 'neutral')
                            .onChange(async (value) => {
                                const polarity = value as 'higher-is-better' | 'lower-is-better' | 'neutral';
                                if (polarity === 'neutral') {
                                    // Remove from settings (neutral is default)
                                    const updated = { ...this.plugin.settings.fieldPolarity };
                                    delete updated[field.key];
                                    this.plugin.settings.fieldPolarity = updated;
                                } else {
                                    this.plugin.settings.fieldPolarity = {
                                        ...this.plugin.settings.fieldPolarity,
                                        [field.key]: polarity,
                                    };
                                }
                                await this.plugin.saveSettings();
                            });
                    });
            }
        }

        new Setting(containerEl)
            .setHeading()
            .setName('Advanced');

        new Setting(containerEl)
            .setName('Hot tier days')
            .setDesc('Entries older than this many days use lightweight storage (headings + excerpt only). Lower values reduce memory usage.')
            .addText(text => {
                text.setPlaceholder('90')
                    .setValue(String(this.plugin.settings.hotTierDays));
                text.inputEl.type = 'number';
                text.inputEl.min = '7';
                text.inputEl.max = '365';
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const parsed = parseInt(text.inputEl.value, 10);
                        if (!isNaN(parsed) && parsed >= 7 && parsed <= 365) {
                            if (parsed !== this.plugin.settings.hotTierDays) {
                                this.plugin.settings.hotTierDays = parsed;
                                await this.plugin.saveSettings();
                            }
                        } else {
                            // Reset to current value on invalid input
                            text.inputEl.value = String(this.plugin.settings.hotTierDays);
                        }
                    })();
                });
            });

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

