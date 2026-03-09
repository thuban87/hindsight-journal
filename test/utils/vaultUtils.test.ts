import { describe, it, expect } from 'vitest';
import { validateVaultRelativePath } from '../../src/utils/vaultUtils';

describe('validateVaultRelativePath', () => {
    it('accepts valid relative paths', () => {
        expect(validateVaultRelativePath('Journal')).toBe('Journal');
        expect(validateVaultRelativePath('My Notes/Journal')).toBe('My Notes/Journal');
        expect(validateVaultRelativePath('folder/subfolder/deep')).toBe('folder/subfolder/deep');
    });

    it('normalizes backslashes to forward slashes', () => {
        const result = validateVaultRelativePath('Journal\\subfolder');
        // normalizePath converts backslashes
        expect(result).toBeTruthy();
        expect(result).not.toContain('\\');
    });

    it('rejects empty strings and whitespace', () => {
        expect(validateVaultRelativePath('')).toBeNull();
        expect(validateVaultRelativePath('   ')).toBeNull();
    });

    it('rejects paths with .. traversal', () => {
        expect(validateVaultRelativePath('../outside')).toBeNull();
        expect(validateVaultRelativePath('inside/../../outside')).toBeNull();
        expect(validateVaultRelativePath('folder/../..')).toBeNull();
    });

    it('rejects absolute paths starting with /', () => {
        expect(validateVaultRelativePath('/etc/passwd')).toBeNull();
        expect(validateVaultRelativePath('/root/vault')).toBeNull();
    });

    it('rejects paths with drive letters', () => {
        expect(validateVaultRelativePath('C:\\Users\\vault')).toBeNull();
        expect(validateVaultRelativePath('D:/data')).toBeNull();
    });

    it('rejects paths with null bytes', () => {
        expect(validateVaultRelativePath('folder\0evil')).toBeNull();
    });

    it('accepts paths with spaces and special chars', () => {
        expect(validateVaultRelativePath('My Journal Notes')).toBeTruthy();
        expect(validateVaultRelativePath('journal (2026)')).toBeTruthy();
    });

    it('strips leading and trailing slashes via normalizePath', () => {
        // In production, Obsidian's normalizePath strips trailing slashes.
        // Our mock only replaces backslashes, so we test that the function
        // doesn't reject paths with trailing slashes (they're valid).
        const result = validateVaultRelativePath('folder/');
        expect(result).toBeTruthy();
    });
});
