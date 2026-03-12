/**
 * Export Button
 *
 * Dropdown export functionality for CSV, JSON, and Markdown formats.
 * Writes files to the vault via vault.create() — does NOT use Blob URLs
 * (which break on mobile WebViews).
 *
 * Uses ensureFolderExists() for the target directory and
 * validateVaultRelativePath() on the configured export folder.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Notice, normalizePath } from 'obsidian';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { generateCSV, generateJSON, generateMarkdownReport } from '../../services/ExportService';
import { ensureFolderExists, validateVaultRelativePath, sanitizeFileName } from '../../utils/vaultUtils';
import type { JournalEntry, FrontmatterField, DateRange } from '../../types';

interface ExportButtonProps {
    entries: JournalEntry[];
    fields: FrontmatterField[];
    dateRange: DateRange;
}

export function ExportButton({ entries, fields, dateRange }: ExportButtonProps): React.ReactElement | null {
    const app = useAppStore(s => s.app);
    const exportFolder = useSettingsStore(s => s.settings.exportFolder);
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [isOpen]);

    const writeToVault = useCallback(async (content: string, extension: string) => {
        if (!app) return;

        // Validate export folder
        const folder = exportFolder || '';
        if (folder) {
            const validated = validateVaultRelativePath(folder);
            if (!validated) {
                new Notice('Invalid export folder path — must be a relative path within the vault.');
                return;
            }
        }

        const startStr = formatDate(dateRange.start);
        const endStr = formatDate(dateRange.end);
        const baseName = sanitizeFileName(`hindsight-export-${startStr}-to-${endStr}`);

        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
            const suffix = retries > 0 ? `-${randomHex()}` : '';
            const fileName = `${baseName}${suffix}.${extension}`;
            const filePath = folder
                ? normalizePath(`${folder}/${fileName}`)
                : normalizePath(fileName);

            try {
                // Ensure parent folder exists
                if (folder) {
                    await ensureFolderExists(app.vault, folder);
                }

                // Check if file already exists
                const existing = app.vault.getFileByPath(filePath);
                if (existing) {
                    retries++;
                    continue;
                }

                await app.vault.create(filePath, content);
                new Notice(`Exported to ${filePath}`);
                return;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                // Check for permission errors
                if (msg.includes('EPERM') || msg.includes('EACCES') || msg.includes('read-only')) {
                    new Notice('Export failed: vault appears to be read-only. Check file system permissions.');
                    return;
                }
                retries++;
                if (retries >= maxRetries) {
                    new Notice(`Export failed after ${maxRetries} attempts: ${msg}`);
                    console.error('[Hindsight] Export failed:', err);
                }
            }
        }
    }, [app, exportFolder, dateRange]);

    const handleExport = useCallback(async (format: 'csv' | 'json' | 'markdown') => {
        setIsExporting(true);
        setIsOpen(false);

        try {
            if (format === 'csv') {
                const csv = generateCSV(entries, fields);
                await writeToVault(csv, 'csv');
            } else if (format === 'json') {
                const json = generateJSON(entries, fields);
                await writeToVault(json, 'json');
            } else {
                const md = generateMarkdownReport(entries, fields, dateRange);
                await writeToVault(md, 'md');
            }
        } catch (err) {
            console.error('[Hindsight] Export error:', err);
            new Notice('Export failed. Check the console for details.');
        } finally {
            setIsExporting(false);
        }
    }, [entries, fields, dateRange, writeToVault]);

    if (!app) return null;

    return (
        <div className="hindsight-export-button" ref={dropdownRef}>
            <button
                className="hindsight-export-trigger"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isExporting || entries.length === 0}
            >
                {isExporting ? 'Exporting...' : 'Export'}
            </button>
            {isOpen && (
                <div className="hindsight-export-dropdown">
                    <button
                        className="hindsight-export-option"
                        onClick={() => void handleExport('csv')}
                    >
                        Export as CSV
                    </button>
                    <button
                        className="hindsight-export-option"
                        onClick={() => void handleExport('json')}
                    >
                        Export as JSON
                    </button>
                    <button
                        className="hindsight-export-option"
                        onClick={() => void handleExport('markdown')}
                    >
                        Export to markdown
                    </button>
                </div>
            )}
        </div>
    );
}

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function randomHex(): string {
    return Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0');
}
