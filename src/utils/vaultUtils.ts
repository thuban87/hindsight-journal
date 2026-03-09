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
 * Ensure a folder exists in the vault, creating parent directories as needed.
 * Validates the path internally (defense-in-depth per A9).
 *
 * @param vault - Obsidian Vault instance
 * @param folderPath - Vault-relative folder path
 * @throws If the path is invalid (path traversal, absolute path, etc.)
 */
export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
    const validated = validateVaultRelativePath(folderPath);
    if (!validated) {
        throw new Error(`Invalid folder path: ${folderPath}`);
    }

    // Check if folder already exists
    const existing = vault.getFolderByPath(validated);
    if (existing) return;

    // Create folder (and parents) recursively
    await vault.createFolder(validated);
}
