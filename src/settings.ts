import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import type HindsightPlugin from '../main';
import { FolderSuggest } from './ui/FolderSuggest';
import { normalizePathSetting } from './utils/settingsMigration';
import { validateVaultRelativePath } from './utils/vaultUtils';
import { useJournalStore } from './store/journalStore';
import { FieldConfigModal } from './modals/FieldConfigModal';
import { GoalsModal } from './modals/GoalsModal';
import { AnnotationsModal } from './modals/AnnotationsModal';
import { AdvancedModal } from './modals/AdvancedModal';

export class HindsightSettingTab extends PluginSettingTab {
    plugin: HindsightPlugin;

    constructor(app: App, plugin: HindsightPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ── Journal ──────────────────────────────────────────────

        new Setting(containerEl)
            .setHeading()
            .setName('Journal');

        // IMPORTANT: Text inputs use onBlur (not onChange) to avoid
        // hammering saveSettings() on every keystroke.
        new Setting(containerEl)
            .setName('Journal folder')
            .setDesc('Folder containing your daily notes (scanned recursively).')
            .addText(text => {
                text.setPlaceholder('e.g., Journal')
                    .setValue(this.plugin.settings.journalFolder);
                new FolderSuggest(this.app, text.inputEl);
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const raw = text.inputEl.value.trim();
                        const normalized = normalizePathSetting(raw);
                        if (normalized !== this.plugin.settings.journalFolder) {
                            if (normalized !== '' && !validateVaultRelativePath(normalized)) {
                                new Notice('Invalid folder path — must be a relative path within the vault.');
                                text.inputEl.value = this.plugin.settings.journalFolder;
                                return;
                            }
                            this.plugin.settings.journalFolder = normalized;
                            await this.plugin.saveSettings();
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
                new FolderSuggest(this.app, text.inputEl);
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const raw = text.inputEl.value.trim();
                        const normalized = normalizePathSetting(raw);
                        if (normalized !== this.plugin.settings.weeklyReviewFolder) {
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
            .setName('Export folder')
            .setDesc('Folder for exported reports (leave empty for vault root).')
            .addText(text => {
                text.setPlaceholder('e.g., Exports')
                    .setValue(this.plugin.settings.exportFolder);
                new FolderSuggest(this.app, text.inputEl);
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const raw = text.inputEl.value.trim();
                        const normalized = normalizePathSetting(raw);
                        if (normalized !== this.plugin.settings.exportFolder) {
                            if (normalized !== '' && !validateVaultRelativePath(normalized)) {
                                new Notice('Invalid folder path — must be a relative path within the vault.');
                                text.inputEl.value = this.plugin.settings.exportFolder;
                                return;
                            }
                            this.plugin.settings.exportFolder = normalized;
                            await this.plugin.saveSettings();
                        }
                    })();
                });
            });

        // ── Appearance ───────────────────────────────────────────

        new Setting(containerEl)
            .setHeading()
            .setName('Appearance');

        new Setting(containerEl)
            .setName('Week start day')
            .setDesc('Controls all weekly aggregations (goal progress, weekly review, consistency scores).')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('0', 'Sunday')
                    .addOption('1', 'Monday')
                    .setValue(String(this.plugin.settings.weekStartDay))
                    .onChange(async (value) => {
                        this.plugin.settings.weekStartDay = (value === '1' ? 1 : 0);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Morning briefing')
            .setDesc('Show the morning briefing section in the sidebar Today tab.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.morningBriefingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.morningBriefingEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Color theme')
            .setDesc('Color palette for the calendar heatmap and metric cells.')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('default', 'Default (red-green)')
                    .addOption('monochrome', 'Monochrome')
                    .addOption('warm', 'Warm')
                    .addOption('cool', 'Cool')
                    .addOption('colorblind', 'Color-blind safe')
                    .setValue(this.plugin.settings.calendarColorTheme)
                    .onChange(async (value) => {
                        this.plugin.settings.calendarColorTheme = value as typeof this.plugin.settings.calendarColorTheme;
                        await this.plugin.saveSettings();
                    });
            });

        // ── Productivity ─────────────────────────────────────────

        const allEntries = Array.from(useJournalStore.getState().entries.values());
        const sectionHeadings = new Set<string>();
        for (const entry of allEntries) {
            if (entry.sections) {
                for (const heading of Object.keys(entry.sections)) {
                    sectionHeadings.add(heading);
                }
            }
            if (entry.sectionHeadings) {
                for (const heading of entry.sectionHeadings) {
                    sectionHeadings.add(heading);
                }
            }
        }
        const sortedHeadings = Array.from(sectionHeadings).sort();

        if (sortedHeadings.length > 0) {
            new Setting(containerEl)
                .setHeading()
                .setName('Productivity');

            new Setting(containerEl)
                .setName('Productivity sections')
                .setDesc('Only count checkboxes in these sections. Leave empty to count all sections.')
                .addText(text => {
                    text.setPlaceholder('e.g., Tasks, Goals')
                        .setValue(this.plugin.settings.productivitySections.join(', '));
                    text.inputEl.addEventListener('blur', () => {
                        void (async () => {
                            const raw = text.inputEl.value;
                            const sections = raw.split(',').map(s => s.trim()).filter(s => s !== '');
                            this.plugin.settings.productivitySections = sections;
                            await this.plugin.saveSettings();
                        })();
                    });
                });

            new Setting(containerEl)
                .setName('Excluded sections')
                .setDesc('Never count checkboxes in these sections (overrides the whitelist above).')
                .addText(text => {
                    text.setPlaceholder('e.g., Meds, Shopping')
                        .setValue(this.plugin.settings.excludedSections.join(', '));
                    text.inputEl.addEventListener('blur', () => {
                        void (async () => {
                            const raw = text.inputEl.value;
                            const sections = raw.split(',').map(s => s.trim()).filter(s => s !== '');
                            this.plugin.settings.excludedSections = sections;
                            await this.plugin.saveSettings();
                        })();
                    });
                });
        }

        // ── Thumbnails ───────────────────────────────────────────

        new Setting(containerEl)
            .setHeading()
            .setName('Thumbnails');

        new Setting(containerEl)
            .setName('Enable thumbnails')
            .setDesc('Generate and cache image thumbnails for calendar cells, timeline cards, and gallery view.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.thumbnailsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.thumbnailsEnabled = value;
                    await this.plugin.saveSettings();
                    new Notice(value
                        ? 'Thumbnails enabled — reload the plugin to start generating thumbnails.'
                        : 'Thumbnails disabled — reload the plugin to complete teardown.');
                }));

        new Setting(containerEl)
            .setName('Clear thumbnail cache')
            .setDesc('Delete all cached thumbnails to free storage space.')
            .addButton(btn => {
                btn.setButtonText('Clear cache')
                    .onClick(() => {
                        void (async () => {
                            const service = this.plugin.services.thumbnailService;
                            if (service) {
                                const stats = await service.getCacheStats();
                                await service.clearCache();
                                new Notice(`Cleared ${stats.count} cached thumbnails (${stats.estimatedSizeMB} MB freed).`);
                            } else {
                                new Notice('Thumbnail service is not active. Enable thumbnails and reload first.');
                            }
                        })();
                    });
            });

        // ── Sub-modal buttons ────────────────────────────────────

        new Setting(containerEl)
            .setHeading()
            .setName('Configure');

        new Setting(containerEl)
            .setName('Field configuration')
            .setDesc('Set polarity for numeric fields (affects badge colors and trend alerts).')
            .addButton(btn => {
                btn.setButtonText('Configure fields →')
                    .onClick(() => {
                        new FieldConfigModal(this.app, this.plugin).open();
                    });
            });

        new Setting(containerEl)
            .setName('Goals')
            .setDesc('Set targets for numeric and boolean fields (weekly or monthly).')
            .addButton(btn => {
                btn.setButtonText('Configure goals →')
                    .onClick(() => {
                        new GoalsModal(this.app, this.plugin).open();
                    });
            });

        new Setting(containerEl)
            .setName('Annotations')
            .setDesc('Annotation storage mode and quick-add presets.')
            .addButton(btn => {
                btn.setButtonText('Configure annotations →')
                    .onClick(() => {
                        new AnnotationsModal(this.app, this.plugin).open();
                    });
            });

        new Setting(containerEl)
            .setName('Advanced')
            .setDesc('Priority headings, memory tuning, thumbnail sizing, and debug mode.')
            .addButton(btn => {
                btn.setButtonText('Configure advanced →')
                    .onClick(() => {
                        new AdvancedModal(this.app, this.plugin).open();
                    });
            });
    }
}
