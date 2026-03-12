/**
 * Goals Modal
 *
 * Settings sub-modal for configuring per-field goals.
 * Supports add/edit/remove goals with field, period, type, and target.
 * Uses native Obsidian Setting API — no React needed.
 */

import { Modal, Setting, Notice } from 'obsidian';
import type { App } from 'obsidian';
import type HindsightPlugin from '../../main';
import { useJournalStore } from '../store/journalStore';
import type { GoalConfig } from '../types';

export class GoalsModal extends Modal {
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
            .setName('Goals');

        const detectedFields = useJournalStore.getState().detectedFields;
        const goalFields = detectedFields.filter(
            f => f.type === 'number' || f.type === 'numeric-text' || f.type === 'boolean'
        );

        if (goalFields.length === 0) {
            contentEl.createEl('p', {
                text: 'No numeric or boolean fields detected yet. Open some journal entries first.',
                cls: 'hindsight-settings-modal-empty',
            });
            return;
        }

        const goals = this.plugin.settings.goalTargets;

        // Render existing goals
        for (const [fieldKey, goal] of Object.entries(goals)) {
            this.renderGoalRow(contentEl, fieldKey, goal, goalFields);
        }

        // Add goal button
        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('Add goal')
                    .onClick(() => {
                        const usedKeys = new Set(Object.keys(goals));
                        const available = goalFields.find(f => !usedKeys.has(f.key));
                        if (!available) {
                            new Notice('All detected fields already have goals configured.');
                            return;
                        }

                        const newGoal: GoalConfig = {
                            period: 'weekly',
                            target: 1,
                            type: available.type === 'boolean' ? 'count' : 'sum',
                        };
                        this.plugin.settings.goalTargets = {
                            ...this.plugin.settings.goalTargets,
                            [available.key]: newGoal,
                        };
                        void this.plugin.saveSettings().then(() => {
                            this.renderContent();
                        });
                    });
            });
    }

    private renderGoalRow(
        container: HTMLElement,
        fieldKey: string,
        goal: GoalConfig,
        availableFields: { key: string; type: string }[]
    ): void {
        const row = container.createDiv('hindsight-goal-setting-row');

        // Field dropdown
        const fieldSelect = row.createEl('select');
        for (const f of availableFields) {
            const opt = fieldSelect.createEl('option', { text: f.key, value: f.key });
            if (f.key === fieldKey) opt.selected = true;
        }

        // Period dropdown
        const periodSelect = row.createEl('select');
        for (const p of ['weekly', 'monthly'] as const) {
            const opt = periodSelect.createEl('option', { text: p, value: p });
            if (p === goal.period) opt.selected = true;
        }

        // Type dropdown
        const typeSelect = row.createEl('select');
        for (const t of ['sum', 'count'] as const) {
            const opt = typeSelect.createEl('option', { text: t, value: t });
            if (t === goal.type) opt.selected = true;
        }

        // Target input
        const targetInput = row.createEl('input', { type: 'number' });
        targetInput.value = String(goal.target);
        targetInput.min = '0.1';
        targetInput.step = '0.1';

        // Remove button
        const removeBtn = row.createEl('button', {
            text: '✕',
            cls: 'hindsight-goal-remove-btn',
        });

        // Event handlers
        const saveGoal = () => {
            void (async () => {
                const newFieldKey = fieldSelect.value;
                const targetVal = parseFloat(targetInput.value);
                if (isNaN(targetVal) || targetVal <= 0) {
                    new Notice('Goal target must be a positive number.');
                    targetInput.value = String(goal.target);
                    return;
                }

                const updated = { ...this.plugin.settings.goalTargets };
                if (newFieldKey !== fieldKey) {
                    delete updated[fieldKey];
                }
                updated[newFieldKey] = {
                    period: periodSelect.value as 'weekly' | 'monthly',
                    target: targetVal,
                    type: typeSelect.value as 'sum' | 'count',
                };
                this.plugin.settings.goalTargets = updated;
                await this.plugin.saveSettings();
                this.renderContent();
            })();
        };

        fieldSelect.addEventListener('change', saveGoal);
        periodSelect.addEventListener('change', saveGoal);
        typeSelect.addEventListener('change', saveGoal);
        targetInput.addEventListener('blur', saveGoal);

        removeBtn.addEventListener('click', () => {
            void (async () => {
                const updated = { ...this.plugin.settings.goalTargets };
                delete updated[fieldKey];
                this.plugin.settings.goalTargets = updated;
                await this.plugin.saveSettings();
                this.renderContent();
            })();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
