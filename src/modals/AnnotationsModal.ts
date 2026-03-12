/**
 * Annotations Modal
 *
 * Settings sub-modal for annotation storage mode and presets.
 * Uses native Obsidian Setting API — no React needed.
 */

import { Modal, Setting, Notice } from 'obsidian';
import type { App } from 'obsidian';
import type HindsightPlugin from '../../main';

export class AnnotationsModal extends Modal {
    private plugin: HindsightPlugin;

    constructor(app: App, plugin: HindsightPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen(): void {
        this.renderContent();
    }

    private renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hindsight-settings-modal');

        new Setting(contentEl)
            .setHeading()
            .setName('Annotations');

        // Storage mode
        new Setting(contentEl)
            .setName('Storage mode')
            .setDesc('Plugin: stored in plugin data (safer, won\'t modify notes). Frontmatter: stored in note YAML (searchable, survives vault migration).')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('plugin', 'Plugin data')
                    .addOption('frontmatter', 'Frontmatter')
                    .setValue(this.plugin.settings.annotationStorage)
                    .onChange(async (value) => {
                        const newMode = value as 'plugin' | 'frontmatter';
                        if (newMode !== this.plugin.settings.annotationStorage) {
                            const oldMode = this.plugin.settings.annotationStorage;
                            this.plugin.settings.annotationStorage = newMode;
                            await this.plugin.saveSettings();

                            // Trigger migration if there are existing annotations
                            const service = this.plugin.services.annotationService;
                            if (service) {
                                const existing = await service.getAllAnnotated();
                                if (existing.length > 0) {
                                    new Notice(`Migrating ${existing.length} annotated entries from ${oldMode} to ${newMode}...`);
                                    void service.migrateStorage(oldMode, newMode);
                                }
                            }
                        }
                    });
            });

        // Annotation presets
        new Setting(contentEl)
            .setHeading()
            .setName('Presets');

        contentEl.createEl('p', {
            text: 'Suggested annotations shown when adding markers to entries.',
            cls: 'setting-item-description',
        });

        for (const [idx, preset] of this.plugin.settings.annotationPresets.entries()) {
            new Setting(contentEl)
                .setName(`  ${preset}`)
                .addButton(btn => {
                    btn.setButtonText('✕')
                        .onClick(async () => {
                            const updated = [...this.plugin.settings.annotationPresets];
                            updated.splice(idx, 1);
                            this.plugin.settings.annotationPresets = updated;
                            await this.plugin.saveSettings();
                            this.renderContent();
                        });
                });
        }

        new Setting(contentEl)
            .addText(text => {
                text.setPlaceholder('Add a preset...');
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        const val = text.inputEl.value.trim();
                        if (val) {
                            this.plugin.settings.annotationPresets = [
                                ...this.plugin.settings.annotationPresets,
                                val,
                            ];
                            void this.plugin.saveSettings().then(() => {
                                this.renderContent();
                            });
                        }
                    }
                });
            });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
