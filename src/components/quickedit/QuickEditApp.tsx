/**
 * Quick Edit App
 *
 * React root for the quick-edit modal. Dynamically discovers frontmatter
 * fields and renders FieldInput for each, with a single debounced save
 * queue that batches all changes into one processFrontMatter() call.
 *
 * Features:
 * - Date picker to switch between entries
 * - Stale-save guard (mtime check before each write)
 * - "Saving..." / "Saved ✓" indicator
 * - "No entry yet" with "Create entry" button
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Notice } from 'obsidian';
import { useAppStore } from '../../store/appStore';
import { useJournalStore } from '../../store/journalStore';
import { FieldInput } from './FieldInput';
import { createDailyNote } from '../../services/NoteCreationService';
import { Platform } from 'obsidian';
import { isSameDay } from '../../utils/dateUtils';

interface QuickEditAppProps {
    /** Initial date to edit (defaults to today) */
    initialDate: Date;
}

type SaveState = 'idle' | 'saving' | 'saved';

export function QuickEditApp({ initialDate }: QuickEditAppProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const plugin = useAppStore(s => s.plugin);
    const { detectedFields } = useJournalStore(s => ({
        detectedFields: s.detectedFields,
    }));
    const entries = useJournalStore(s => s.entries);

    // Date selection state
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = initialDate;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    // Find entry for selected date by iterating entries
    const dateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
    const entry = useMemo(() => {
        for (const e of entries.values()) {
            if (isSameDay(e.date, dateObj)) return e;
        }
        return undefined;
    }, [entries, dateObj]);

    // Local field values
    const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
    const [saveState, setSaveState] = useState<SaveState>('idle');

    // Refs for debouncing
    const pendingChanges = useRef<Record<string, unknown>>({});
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMtimeRef = useRef<number>(0);

    // Initialize field values when entry changes
    useEffect(() => {
        if (entry) {
            const values: Record<string, unknown> = {};
            for (const field of detectedFields) {
                values[field.key] = entry.frontmatter[field.key] ?? null;
            }
            setFieldValues(values);
            lastMtimeRef.current = entry.mtime;
        } else {
            setFieldValues({});
        }
        // Reset pending changes on entry switch
        pendingChanges.current = {};
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        setSaveState('idle');
    }, [entry?.filePath, detectedFields]);

    // Debounced save function
    const flushSave = useCallback(async () => {
        if (!app || !entry) return;
        const changes = { ...pendingChanges.current };
        if (Object.keys(changes).length === 0) return;

        const file = app.vault.getFileByPath(entry.filePath);
        if (!file) return;

        // Stale-save guard: check if file was modified externally
        const currentMtime = file.stat.mtime;
        if (currentMtime !== lastMtimeRef.current && lastMtimeRef.current > 0) {
            new Notice('Entry was modified externally. Reloading...');
            // Refresh values from the latest frontmatter
            const meta = app.metadataCache.getFileCache(file);
            if (meta?.frontmatter) {
                const values: Record<string, unknown> = {};
                for (const field of detectedFields) {
                    values[field.key] = meta.frontmatter[field.key] ?? null;
                }
                setFieldValues(values);
            }
            pendingChanges.current = {};
            setSaveState('idle');
            lastMtimeRef.current = currentMtime;
            return;
        }

        setSaveState('saving');
        try {
            await app.fileManager.processFrontMatter(file, (fm) => {
                for (const [key, val] of Object.entries(changes)) {
                    fm[key] = val;
                }
            });
            pendingChanges.current = {};
            lastMtimeRef.current = file.stat.mtime;
            setSaveState('saved');
            // Fade out the "Saved" indicator after 2 seconds
            setTimeout(() => setSaveState('idle'), 2000);
        } catch (err) {
            console.error('[Hindsight] Quick-edit save failed:', err);
            new Notice('Failed to save changes. Please try again.');
            setSaveState('idle');
        }
    }, [app, entry, detectedFields]);

    // Handle field value changes
    const handleFieldChange = useCallback((key: string, value: unknown) => {
        setFieldValues(prev => ({ ...prev, [key]: value }));
        pendingChanges.current[key] = value;

        // Reset debounce timer
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        setSaveState('saving');
        saveTimerRef.current = setTimeout(() => {
            void flushSave();
        }, 1000);
    }, [flushSave]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    // Handle create entry
    const handleCreateEntry = useCallback(async () => {
        if (!app || !plugin) return;
        try {
            const sectionHeadings = detectedFields.length > 0
                ? [] // Will be populated from existing entries
                : [];
            // Collect detected section headings from existing entries
            const allEntries = Array.from(entries.values());
            const headings: string[] = [];
            for (const e of allEntries) {
                if (e.sectionHeadings && e.sectionHeadings.length > 0) {
                    for (const h of e.sectionHeadings) {
                        if (!headings.includes(h)) headings.push(h);
                    }
                    break; // Use headings from first entry with them
                } else if (e.sections && Object.keys(e.sections).length > 0) {
                    for (const h of Object.keys(e.sections)) {
                        if (!headings.includes(h)) headings.push(h);
                    }
                    break;
                }
            }

            const file = await createDailyNote(
                app,
                dateObj,
                plugin.settings.journalFolder,
                headings.length > 0 ? headings : sectionHeadings
            );
            // Open the newly created note
            await app.workspace.openLinkText(file.path, '');
            new Notice('Daily note created.');
        } catch (err) {
            console.error('[Hindsight] Failed to create daily note:', err);
            new Notice('Failed to create daily note.');
        }
    }, [app, plugin, dateObj, detectedFields, entries]);

    if (!app || !plugin) return null;

    const isMobile = Platform.isMobile;

    return (
        <div className={`hindsight-quick-edit ${isMobile ? 'hindsight-mobile' : ''}`}>
            <div className="hindsight-quick-edit-header">
                <h3 className="hindsight-quick-edit-title">Quick edit</h3>
                <div className="hindsight-quick-edit-date">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="hindsight-quick-edit-datepicker"
                    />
                </div>
                {saveState !== 'idle' && (
                    <span className={`hindsight-saved-indicator ${saveState === 'saved' ? 'is-saved' : ''}`}>
                        {saveState === 'saving' ? 'Saving...' : 'Saved ✓'}
                    </span>
                )}
            </div>

            {!entry ? (
                <div className="hindsight-quick-edit-empty">
                    <p>No entry for this date.</p>
                    <button
                        className="hindsight-quick-edit-create-btn"
                        onClick={() => void handleCreateEntry()}
                    >
                        Create entry
                    </button>
                </div>
            ) : (
                <div className="hindsight-quick-edit-fields">
                    {detectedFields.length === 0 ? (
                        <p className="hindsight-quick-edit-no-fields">
                            No fields detected. Add frontmatter to your journal entries to see fields here.
                        </p>
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
        </div>
    );
}
