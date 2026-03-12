/**
 * Vault Utilities
 *
 * Path validation and folder management helpers for safe vault operations.
 */

import { normalizePath, type Vault } from 'obsidian';

/**
 * Validate that a path is a safe, relative path within the vault.
 * Rejects absolute paths, drive letters, `..` traversal, and null bytes.
 *
 * @param path - The path to validate
 * @returns The normalized path if valid, or null if unsafe
 */
export function validateVaultRelativePath(path: string): string | null {
    if (!path || path.trim() === '') return null;

    const normalized = normalizePath(path);

    // Reject absolute paths (leading slash or backslash)
    if (normalized.startsWith('/') || normalized.startsWith('\\')) return null;

    // Reject drive letters (e.g., C:)
    if (/^[a-zA-Z]:/.test(normalized)) return null;

    // Reject path traversal (.. segments)
    if (normalized.split('/').some(seg => seg === '..')) return null;

    // Reject null byte injection
    if (normalized.includes('\0')) return null;

    return normalized;
}

/**
 * Ensure all parent folders in a path exist, creating them if needed.
 * Must be called before vault.create() for any user-configured path
 * (export folders, weekly review folder, etc.) since vault.create()
 * throws if parent directories don't exist.
 *
 * Uses getFolderByPath() (not getAbstractFileByPath()) for type safety.
 * Wraps createFolder() in try/catch to handle race conditions where
 * a sync service (Obsidian Sync, iCloud) creates the folder between
 * the existence check and the create call.
 *
 * @param vault - Obsidian Vault instance
 * @param folderPath - Vault-relative folder path
 * @throws If the path is invalid or folder creation fails
 */
export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const parts = normalized.split('/');
    let current = '';
    for (const part of parts) {
        current = current === '' ? part : `${current}/${part}`;
        if (!vault.getFolderByPath(current)) {
            try {
                await vault.createFolder(current);
            } catch {
                // Folder may have been created by sync — verify it exists now
                if (!vault.getFolderByPath(current)) {
                    throw new Error(`Failed to create folder: ${current}`);
                }
            }
        }
    }
}

/**
 * Sanitize a filename for safe file creation across all operating systems.
 * Strips illegal characters, trims whitespace, and enforces max length.
 *
 * @param name - Raw filename (without extension)
 * @returns Sanitized filename
 */
export function sanitizeFileName(name: string): string {
    // Strip characters illegal on any OS: / \ : * ? " < > |
    let sanitized = name.replace(/[/\\:*?"<>|]/g, '');
    // Trim whitespace
    sanitized = sanitized.trim();
    // Enforce max length of 200 characters
    if (sanitized.length > 200) {
        sanitized = sanitized.substring(0, 200);
    }
    // Fallback if completely empty
    if (sanitized === '') {
        sanitized = 'export';
    }
    return sanitized;
}
