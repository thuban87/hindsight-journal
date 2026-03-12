/**
 * Wizard App
 *
 * Multi-page guided entry wizard for daily journal entries.
 * Page 1: Frontmatter fields (reuses FieldInput)
 * Page 2: Body sections (text areas per detected ## heading)
 *
 * Save strategy:
 * - Step 1: processFrontMatter() for changed fields only
 * - Step 2: vault.process() with getFrontMatterInfo() for changed sections only
 * - mtime guard between steps
 * - Double-submit guard via isSaving state
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Notice, Platform, getFrontMatterInfo } from 'obsidian';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';
import { FieldInput } from '../quickedit/FieldInput';
import { createDailyNote } from '../../services/NoteCreationService';
import { replaceSectionContent } from '../../utils/sectionUtils';
import { isSameDay } from '../../utils/dateUtils';

interface WizardAppProps {
    /** Callback to close the modal */
    onClose: () => void;
}

export function WizardApp({ onClose }: WizardAppProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const plugin = useAppStore(s => s.plugin);
    const entries = useJournalStore(s => s.entries);
    const detectedFields = useJournalStore(s => s.detectedFields);

    // Date selection & page state
    const today = useMemo(() => new Date(), []);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = today;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [currentPage, setCurrentPage] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Find entry for selected date
    const dateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
    const entry = useMemo(() => {
        for (const e of entries.values()) {
            if (isSameDay(e.date, dateObj)) return e;
        }
        return undefined;
    }, [entries, dateObj]);

    // Collect section headings from existing entries
    const sectionHeadings = useMemo(() => {
        const headings: string[] = [];
        for (const e of entries.values()) {
            if (e.sectionHeadings && e.sectionHeadings.length > 0) {
                for (const h of e.sectionHeadings) {
                    if (!headings.includes(h)) headings.push(h);
                }
                break;
            } else if (e.sections && Object.keys(e.sections).length > 0) {
                for (const h of Object.keys(e.sections)) {
                    if (!headings.includes(h)) headings.push(h);
                }
                break;
            }
        }
        return headings;
    }, [entries]);

    // Field values state (Page 1)
    const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
    const changedFields = useRef(new Set<string>());

    // Section values state (Page 2)
    const [sectionValues, setSectionValues] = useState<Record<string, string>>({});
    const changedSections = useRef(new Set<string>());

    // Snapshot mtime when entry loads
    const snapshotMtime = useRef(0);

    // Initialize values when entry changes
    useEffect(() => {
        if (entry) {
            // Initialize field values
            const values: Record<string, unknown> = {};
            for (const field of detectedFields) {
                values[field.key] = entry.frontmatter[field.key] ?? null;
            }
            setFieldValues(values);

            // Initialize section values
            const sections: Record<string, string> = {};
            if (entry.sections) {
                for (const heading of sectionHeadings) {
                    sections[heading] = entry.sections[heading] ?? '';
                }
            } else {
                for (const heading of sectionHeadings) {
                    sections[heading] = '';
                }
            }
            setSectionValues(sections);

            snapshotMtime.current = entry.mtime;
        } else {
            // No entry — empty values
            const values: Record<string, unknown> = {};
            for (const field of detectedFields) {
                values[field.key] = null;
            }
            setFieldValues(values);

            const sections: Record<string, string> = {};
            for (const heading of sectionHeadings) {
                sections[heading] = '';
            }
            setSectionValues(sections);

            snapshotMtime.current = 0;
        }

        // Reset changed tracking
        changedFields.current = new Set();
        changedSections.current = new Set();
    }, [entry?.filePath, detectedFields, sectionHeadings]);

    // Handle field change
    const handleFieldChange = useCallback((key: string, value: unknown) => {
        setFieldValues(prev => ({ ...prev, [key]: value }));
        changedFields.current.add(key);
    }, []);

    // Handle section change
    const handleSectionChange = useCallback((heading: string, content: string) => {
        setSectionValues(prev => ({ ...prev, [heading]: content }));
        changedSections.current.add(heading);
    }, []);

    // Save handler
    const handleSave = useCallback(async () => {
        if (!app || !plugin || isSaving) return;
        setIsSaving(true);

        try {
            let file = entry
                ? app.vault.getFileByPath(entry.filePath)
                : null;

            // Create entry if it doesn't exist
            if (!file) {
                const newFile = await createDailyNote(
                    app,
                    dateObj,
                    plugin.settings.journalFolder,
                    sectionHeadings
                );
                file = newFile;
                // All fields and sections are "changed" for a new note
                for (const field of detectedFields) {
                    changedFields.current.add(field.key);
                }
                for (const heading of sectionHeadings) {
                    changedSections.current.add(heading);
                }
            }

            if (!file) {
                new Notice('Failed to find or create entry file.');
                setIsSaving(false);
                return;
            }

            // Staleness check
            if (snapshotMtime.current > 0 && file.stat.mtime !== snapshotMtime.current) {
                const doOverwrite = confirm(
                    'This note was modified externally. Overwrite with wizard data?'
                );
                if (!doOverwrite) {
                    new Notice('Save cancelled. Close and reopen the wizard to reload.');
                    setIsSaving(false);
                    return;
                }
            }

            // Step 1: Update frontmatter (changed fields only)
            if (changedFields.current.size > 0) {
                const fieldsToWrite = changedFields.current;
                await app.fileManager.processFrontMatter(file, (fm) => {
                    for (const key of fieldsToWrite) {
                        fm[key] = fieldValues[key];
                    }
                });
            }

            // mtime check between steps
            const midMtime = file.stat.mtime;

            // Step 2: Update body sections (changed sections only)
            if (changedSections.current.size > 0) {
                // Brief check: did mtime change unexpectedly between steps?
                if (changedFields.current.size > 0 && file.stat.mtime !== midMtime) {
                    new Notice('File was modified during save — please try again.');
                    setIsSaving(false);
                    return;
                }

                await app.vault.process(file, (data) => {
                    const { contentStart } = getFrontMatterInfo(data);
                    const frontmatterBlock = data.substring(0, contentStart);
                    let bodyText = data.substring(contentStart);

                    for (const heading of changedSections.current) {
                        const newContent = sectionValues[heading] ?? '';
                        bodyText = replaceSectionContent(bodyText, heading, newContent);
                    }

                    return frontmatterBlock + bodyText;
                });
            }

            new Notice('Entry saved.');

            // Open the note
            await app.workspace.openLinkText(file.path, '');

            onClose();
        } catch (err) {
            console.error('[Hindsight] Wizard save failed:', err);
            new Notice('Failed to save entry. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [app, plugin, entry, dateObj, fieldValues, sectionValues, detectedFields,
        sectionHeadings, isSaving, onClose]);

    if (!app || !plugin) return null;

    const isMobile = Platform.isMobile;
    const totalPages = 2;

    return (
        <div className={`hindsight-wizard ${isMobile ? 'hindsight-mobile' : ''}`}>
            <div className="hindsight-wizard-header">
                <h3 className="hindsight-wizard-title">Guided entry</h3>
                <div className="hindsight-wizard-date">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setCurrentPage(0);
                        }}
                        className="hindsight-wizard-datepicker"
                    />
                </div>
                <span className="hindsight-wizard-progress">
                    Step {currentPage + 1} of {totalPages}
                </span>
            </div>

            <div className="hindsight-wizard-page">
                {currentPage === 0 && (
                    <div className="hindsight-wizard-fields">
                        <h4>Frontmatter fields</h4>
                        {detectedFields.length === 0 ? (
                            <p>No fields detected yet. Fields will appear here after indexing.</p>
                        ) : (
                            detectedFields.map(field => (
                                <FieldInput
                                    key={field.key}
                                    field={field}
                                    value={fieldValues[field.key]}
                                    onChange={(val) => handleFieldChange(field.key, val)}
                                />
                            ))
                        )}
                    </div>
                )}

                {currentPage === 1 && (
                    <div className="hindsight-wizard-sections">
                        <h4>Body sections</h4>
                        {sectionHeadings.length === 0 ? (
                            <p>No section headings detected in existing entries.</p>
                        ) : (
                            sectionHeadings.map(heading => (
                                <div key={heading} className="hindsight-wizard-section">
                                    <label className="hindsight-wizard-section-label">
                                        {heading}
                                    </label>
                                    <textarea
                                        className="hindsight-wizard-textarea"
                                        value={sectionValues[heading] ?? ''}
                                        onChange={(e) => handleSectionChange(heading, e.target.value)}
                                        placeholder={`Write about ${heading}...`}
                                    />
                                </div>
                            ))
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
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save & close'}
                    </button>
                )}
            </div>
        </div>
    );
}
