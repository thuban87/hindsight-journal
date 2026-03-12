/**
 * Weekly Review App
 *
 * Weekly review wizard with pre-populated data.
 * Page 1: Week summary (read-only) — averages, completion rates, highlights
 * Page 2: Reflections (editable) — text areas with optional custom sections
 *
 * "Generate & save" creates a weekly review note via NoteCreationService.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Notice, Platform } from 'obsidian';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { WeeklySummaryCards } from './WeeklySummaryCards';
import { createWeeklyReview } from '../../services/NoteCreationService';
import { getWeekBounds } from '../../utils/periodUtils';
import { isInRange } from '../../utils/dateUtils';

interface WeeklyReviewAppProps {
    /** Callback to close the modal */
    onClose: () => void;
}

/** Maximum custom sections allowed */
const MAX_CUSTOM_SECTIONS = 10;
/** Maximum section label length */
const MAX_SECTION_LABEL_LENGTH = 100;

/**
 * Sanitize section label: remove leading markdown-active characters
 * and collapse multiple spaces.
 */
function sanitizeSectionLabel(label: string): string {
    return label
        .replace(/^[#\-*>\[\]]+\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function WeeklyReviewApp({ onClose }: WeeklyReviewAppProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const plugin = useAppStore(s => s.plugin);
    const entries = useJournalStore(s => s.entries);
    const detectedFields = useJournalStore(s => s.detectedFields);
    const settings = useSettingsStore(s => s.settings);

    const [currentPage, setCurrentPage] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Reflections text areas
    const [reflections, setReflections] = useState({
        wentWell: '',
        improve: '',
        nextWeekGoals: '',
    });

    // Custom sections
    const customSectionsFromSettings = settings.weeklyReviewCustomSections ?? [];
    const [customSections, setCustomSections] = useState<{ label: string; content: string }[]>(
        customSectionsFromSettings.map((label: string) => ({ label, content: '' }))
    );
    const [newSectionLabel, setNewSectionLabel] = useState('');
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);

    // Current week entries
    const weekStartDay = settings.weekStartDay ?? 0;
    const today = useMemo(() => new Date(), []);
    const weekBounds = useMemo(() => getWeekBounds(today, weekStartDay), [today, weekStartDay]);

    const weekEntries = useMemo(() => {
        const result = [];
        for (const e of entries.values()) {
            if (isInRange(e.date, { start: weekBounds.start, end: weekBounds.end })) {
                result.push(e);
            }
        }
        // Sort by date ascending
        result.sort((a, b) => a.date.getTime() - b.date.getTime());
        return result;
    }, [entries, weekBounds]);

    // Add custom section
    const handleAddSection = useCallback(() => {
        const sanitized = sanitizeSectionLabel(newSectionLabel);
        if (!sanitized) return;
        if (sanitized.length > MAX_SECTION_LABEL_LENGTH) {
            new Notice(`Section label must be under ${MAX_SECTION_LABEL_LENGTH} characters.`);
            return;
        }
        if (customSections.length >= MAX_CUSTOM_SECTIONS) {
            new Notice(`Maximum ${MAX_CUSTOM_SECTIONS} custom sections allowed.`);
            return;
        }
        // Dedup check
        const isDuplicate = customSections.some(
            s => s.label.toLowerCase().trim() === sanitized.toLowerCase()
        ) || ['What went well this week?', 'What could be improved?', 'Goals for next week']
            .some(s => s.toLowerCase() === sanitized.toLowerCase());

        if (isDuplicate) {
            new Notice('A section with this name already exists.');
            return;
        }

        setCustomSections(prev => [...prev, { label: sanitized, content: '' }]);
        setNewSectionLabel('');
    }, [newSectionLabel, customSections]);

    // Remove custom section
    const handleRemoveSection = useCallback((index: number) => {
        setCustomSections(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Generate and save
    const handleGenerate = useCallback(async () => {
        if (!app || !plugin || isSaving) return;
        setIsSaving(true);

        try {
            // Build markdown content
            const lines: string[] = [];

            // Week summary header
            lines.push(`# Weekly Review: ${formatDateRange(weekBounds.start, weekBounds.end)}`);
            lines.push('');

            // Stats section
            lines.push('## Summary');
            lines.push('');
            if (weekEntries.length === 0) {
                lines.push('No entries for this week.');
            } else {
                lines.push(`- **Entries:** ${weekEntries.length}`);

                // Numeric averages
                const numericFields = detectedFields.filter(f =>
                    f.type === 'number' || f.type === 'numeric-text'
                );
                for (const field of numericFields) {
                    const values: number[] = [];
                    for (const entry of weekEntries) {
                        const raw = entry.frontmatter[field.key];
                        const num = raw !== null && raw !== undefined ? Number(raw) : NaN;
                        if (!isNaN(num)) values.push(num);
                    }
                    if (values.length > 0) {
                        const avg = values.reduce((s, v) => s + v, 0) / values.length;
                        lines.push(`- **${field.key}:** ${avg.toFixed(1)} avg`);
                    }
                }

                // Boolean completion rates
                const boolFields = detectedFields.filter(f => f.type === 'boolean');
                for (const field of boolFields) {
                    let trueCount = 0;
                    let total = 0;
                    for (const entry of weekEntries) {
                        const val = entry.frontmatter[field.key];
                        if (val !== null && val !== undefined) {
                            total++;
                            if (val === true || val === 'true') trueCount++;
                        }
                    }
                    if (total > 0) {
                        const rate = Math.round((trueCount / total) * 100);
                        lines.push(`- **${field.key}:** ${rate}% (${trueCount}/${total})`);
                    }
                }

                // Word count
                const totalWords = weekEntries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0);
                if (totalWords > 0) {
                    lines.push(`- **Words written:** ${totalWords.toLocaleString()}`);
                }
            }
            lines.push('');

            // Reflections
            lines.push('## What went well this week?');
            lines.push('');
            lines.push(reflections.wentWell || '*No response.*');
            lines.push('');

            lines.push('## What could be improved?');
            lines.push('');
            lines.push(reflections.improve || '*No response.*');
            lines.push('');

            lines.push('## Goals for next week');
            lines.push('');
            lines.push(reflections.nextWeekGoals || '*No response.*');
            lines.push('');

            // Custom sections
            for (const section of customSections) {
                lines.push(`## ${section.label}`);
                lines.push('');
                lines.push(section.content || '*No response.*');
                lines.push('');
            }

            const content = lines.join('\n');

            // Save custom sections as template if checked
            if (saveAsTemplate && plugin) {
                const labels = customSections.map(s => s.label);
                plugin.settings.weeklyReviewCustomSections = labels;
                void plugin.saveSettings();
            }

            // Create the review note
            const file = await createWeeklyReview(
                app,
                content,
                plugin.settings.weeklyReviewFolder,
                { start: weekBounds.start, end: weekBounds.end }
            );

            new Notice('Weekly review saved.');
            await app.workspace.openLinkText(file.path, '');
            onClose();
        } catch (err) {
            console.error('[Hindsight] Weekly review save failed:', err);
            new Notice('Failed to save weekly review.');
        } finally {
            setIsSaving(false);
        }
    }, [app, plugin, weekEntries, weekBounds, detectedFields, reflections,
        customSections, saveAsTemplate, isSaving, onClose]);

    if (!app || !plugin) return null;

    const isMobile = Platform.isMobile;
    const totalPages = 2;

    return (
        <div className={`hindsight-weekly-review ${isMobile ? 'hindsight-mobile' : ''}`}>
            <div className="hindsight-wizard-header">
                <h3 className="hindsight-wizard-title">Weekly review</h3>
                <span className="hindsight-wizard-progress">
                    Step {currentPage + 1} of {totalPages}
                </span>
            </div>

            <div className="hindsight-wizard-page">
                {currentPage === 0 && (
                    <div className="hindsight-weekly-review-summary">
                        <h4>
                            Week of {formatDateRange(weekBounds.start, weekBounds.end)}
                        </h4>
                        <WeeklySummaryCards
                            entries={weekEntries}
                            fields={detectedFields}
                        />
                    </div>
                )}

                {currentPage === 1 && (
                    <div className="hindsight-weekly-review-reflections">
                        <h4>Reflections</h4>

                        <div className="hindsight-wizard-section">
                            <label className="hindsight-wizard-section-label">
                                What went well this week?
                            </label>
                            <textarea
                                className="hindsight-wizard-textarea"
                                value={reflections.wentWell}
                                onChange={(e) => setReflections(prev => ({
                                    ...prev, wentWell: e.target.value
                                }))}
                                placeholder="Reflect on the positives..."
                            />
                        </div>

                        <div className="hindsight-wizard-section">
                            <label className="hindsight-wizard-section-label">
                                What could be improved?
                            </label>
                            <textarea
                                className="hindsight-wizard-textarea"
                                value={reflections.improve}
                                onChange={(e) => setReflections(prev => ({
                                    ...prev, improve: e.target.value
                                }))}
                                placeholder="Areas for growth..."
                            />
                        </div>

                        <div className="hindsight-wizard-section">
                            <label className="hindsight-wizard-section-label">
                                Goals for next week
                            </label>
                            <textarea
                                className="hindsight-wizard-textarea"
                                value={reflections.nextWeekGoals}
                                onChange={(e) => setReflections(prev => ({
                                    ...prev, nextWeekGoals: e.target.value
                                }))}
                                placeholder="What do you want to accomplish?"
                            />
                        </div>

                        {/* Custom sections */}
                        {customSections.map((section, i) => (
                            <div key={section.label} className="hindsight-wizard-section">
                                <div className="hindsight-wizard-section-header">
                                    <label className="hindsight-wizard-section-label">
                                        {section.label}
                                    </label>
                                    <button
                                        className="hindsight-wizard-section-remove"
                                        onClick={() => handleRemoveSection(i)}
                                        aria-label={`Remove ${section.label}`}
                                    >
                                        ×
                                    </button>
                                </div>
                                <textarea
                                    className="hindsight-wizard-textarea"
                                    value={section.content}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCustomSections(prev =>
                                            prev.map((s, idx) =>
                                                idx === i ? { ...s, content: val } : s
                                            )
                                        );
                                    }}
                                    placeholder={`Write about ${section.label}...`}
                                />
                            </div>
                        ))}

                        {/* Add custom section */}
                        {customSections.length < MAX_CUSTOM_SECTIONS && (
                            <div className="hindsight-wizard-add-section">
                                <input
                                    type="text"
                                    className="hindsight-wizard-add-section-input"
                                    value={newSectionLabel}
                                    onChange={(e) => setNewSectionLabel(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddSection();
                                        }
                                    }}
                                    placeholder="Add custom section..."
                                    maxLength={MAX_SECTION_LABEL_LENGTH}
                                />
                                <button
                                    className="hindsight-wizard-btn"
                                    onClick={handleAddSection}
                                    disabled={!newSectionLabel.trim()}
                                >
                                    + Add section
                                </button>
                            </div>
                        )}

                        {/* Save as template checkbox */}
                        {customSections.length > 0 && (
                            <label className="hindsight-wizard-template-check">
                                <input
                                    type="checkbox"
                                    checked={saveAsTemplate}
                                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                />
                                Save custom sections as template for future reviews
                            </label>
                        )}
                    </div>
                )}
            </div>

            <div className="hindsight-wizard-nav">
                <button
                    className="hindsight-wizard-btn"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                >
                    Back
                </button>
                {currentPage < totalPages - 1 ? (
                    <button
                        className="hindsight-wizard-btn hindsight-wizard-btn-primary"
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    >
                        Next
                    </button>
                ) : (
                    <button
                        className="hindsight-wizard-btn hindsight-wizard-btn-primary"
                        onClick={() => void handleGenerate()}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Generate & save'}
                    </button>
                )}
            </div>
        </div>
    );
}

/** Format date range as "Mon DD – Mon DD, YYYY" */
function formatDateRange(start: Date, end: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}
