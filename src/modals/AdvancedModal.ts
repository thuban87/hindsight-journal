/**
 * Advanced Settings Modal
 *
 * Settings sub-modal for power-user settings:
 * priority section heading, hot tier days, debug mode,
 * thumbnail size, and max cached thumbnails.
 * Uses native Obsidian Setting API — no React needed.
 */

import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type HindsightPlugin from '../../main';

export class AdvancedModal extends Modal {
    private plugin: HindsightPlugin;

    constructor(app: App, plugin: HindsightPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hindsight-settings-modal');

        new Setting(contentEl)
            .setHeading()
            .setName('Advanced');

        // Priority section heading
        new Setting(contentEl)
            .setName('Priority section heading')
            .setDesc('Section heading in yesterday\'s entry to extract priorities for the morning briefing.')
            .addText(text => {
                text.setPlaceholder("e.g., Tomorrow's Top 3")
                    .setValue(this.plugin.settings.prioritySectionHeading);
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const val = text.inputEl.value.trim();
                        if (val && val !== this.plugin.settings.prioritySectionHeading) {
                            this.plugin.settings.prioritySectionHeading = val;
                            await this.plugin.saveSettings();
                        }
                    })();
                });
            });

        // Hot tier days
        new Setting(contentEl)
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
                            text.inputEl.value = String(this.plugin.settings.hotTierDays);
                        }
                    })();
                });
            });

        // Thumbnail size
        new Setting(contentEl)
            .setHeading()
            .setName('Thumbnails');

        new Setting(contentEl)
            .setName('Thumbnail size')
            .setDesc('Pixel dimensions for generated thumbnails (larger = sharper but more storage).')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('80', 'Small (80px)')
                    .addOption('120', 'Medium (120px)')
                    .addOption('160', 'Large (160px)')
                    .setValue(String(this.plugin.settings.thumbnailSize))
                    .onChange(async (value) => {
                        this.plugin.settings.thumbnailSize = parseInt(value, 10);
                        await this.plugin.saveSettings();
                    });
            });

        // Max cached thumbnails
        new Setting(contentEl)
            .setName('Maximum cached thumbnails')
            .setDesc('Maximum number of thumbnails to store in the browser cache (50–2000).')
            .addText(text => {
                text.setPlaceholder('500')
                    .setValue(String(this.plugin.settings.maxThumbnailCount));
                text.inputEl.type = 'number';
                text.inputEl.min = '50';
                text.inputEl.max = '2000';
                text.inputEl.addEventListener('blur', () => {
                    void (async () => {
                        const parsed = parseInt(text.inputEl.value, 10);
                        if (!isNaN(parsed) && parsed >= 50 && parsed <= 2000) {
                            if (parsed !== this.plugin.settings.maxThumbnailCount) {
                                this.plugin.settings.maxThumbnailCount = parsed;
                                await this.plugin.saveSettings();
                            }
                        } else {
                            text.inputEl.value = String(this.plugin.settings.maxThumbnailCount);
                        }
                    })();
                });
            });

        // Debug mode
        new Setting(contentEl)
            .setHeading()
            .setName('Developer');

        new Setting(contentEl)
            .setName('Debug mode')
            .setDesc('Enable verbose debug logging to the developer console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
