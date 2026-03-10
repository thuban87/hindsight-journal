import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import type HindsightPlugin from '../main';
import { FolderSuggest } from './ui/FolderSuggest';
import { normalizePathSetting } from './utils/settingsMigration';
import { validateVaultRelativePath } from './utils/vaultUtils';
import { useJournalStore } from './store/journalStore';
import type { GoalConfig } from './types';

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

        // Field configuration section
        const detectedFields = useJournalStore.getState().detectedFields;
        const numericFields = detectedFields.filter(f => f.type === 'number' || f.type === 'numeric-text');

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

        // Goals section
        this.renderGoalsSection(containerEl, detectedFields);

        new Setting(containerEl)
            .setHeading()
            .setName('Advanced');

        new Setting(containerEl)
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

    /**
     * Render the Goals configuration section.
     * Shows existing goals with edit/remove, and an "Add goal" button.
     */
    private renderGoalsSection(
        containerEl: HTMLElement,
        detectedFields: { key: string; type: string; coverage: number }[]
    ): void {
        const goalFields = detectedFields.filter(f => f.type === 'number' || f.type === 'numeric-text' || f.type === 'boolean');
        if (goalFields.length === 0) return;

        new Setting(containerEl)
            .setHeading()
            .setName('Goals');

        const goalsContainer = containerEl.createDiv('hindsight-goals-container');
        const goals = this.plugin.settings.goalTargets;

        // Render existing goals
        for (const [fieldKey, goal] of Object.entries(goals)) {
            this.renderGoalRow(goalsContainer, fieldKey, goal, goalFields);
        }

        // Add goal button
        new Setting(goalsContainer)
            .addButton(btn => {
                btn.setButtonText('Add goal')
                    .onClick(() => {
                        // Pick the first field not already configured
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
                            this.display(); // Re-render settings
                        });
                    });
            });
    }

    /**
     * Render a single goal configuration row.
     */
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
                // If field changed, remove old key
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
                this.display(); // Re-render
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
                this.display(); // Re-render
            })();
        });
    }
}
