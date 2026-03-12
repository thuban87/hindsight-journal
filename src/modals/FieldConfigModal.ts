/**
 * Field Configuration Modal
 *
 * Settings sub-modal for configuring per-field polarity
 * (higher-is-better / lower-is-better / neutral).
 * Uses native Obsidian Setting API — no React needed.
 */

import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type HindsightPlugin from '../../main';
import { useJournalStore } from '../store/journalStore';

export class FieldConfigModal extends Modal {
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
            .setName('Field configuration');

        const detectedFields = useJournalStore.getState().detectedFields;
        const numericFields = detectedFields.filter(
            f => f.type === 'number' || f.type === 'numeric-text'
        );

        if (numericFields.length === 0) {
            contentEl.createEl('p', {
                text: 'No numeric fields detected yet. Open some journal entries first.',
                cls: 'hindsight-settings-modal-empty',
            });
            return;
        }

        contentEl.createEl('p', {
            text: 'Set polarity for each numeric field. This affects badge colors, trend alert tone, and heatmap coloring.',
            cls: 'setting-item-description',
        });

        for (const field of numericFields) {
            new Setting(contentEl)
                .setName(field.key)
                .addDropdown(dropdown => {
                    dropdown
                        .addOption('neutral', 'Neutral')
                        .addOption('higher-is-better', 'Higher is better')
                        .addOption('lower-is-better', 'Lower is better')
                        .setValue(this.plugin.settings.fieldPolarity[field.key] ?? 'neutral')
                        .onChange(async (value) => {
                            const polarity = value as 'higher-is-better' | 'lower-is-better' | 'neutral';
                            if (polarity === 'neutral') {
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

    onClose(): void {
        this.contentEl.empty();
    }
}
