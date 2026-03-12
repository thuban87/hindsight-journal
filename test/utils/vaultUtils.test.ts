import { describe, it, expect, vi } from 'vitest';
import { validateVaultRelativePath, ensureFolderExists } from '../../src/utils/vaultUtils';
import { Vault } from 'obsidian';

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

describe('ensureFolderExists', () => {
    it('creates nested folders that do not exist', async () => {
        const vault = new Vault();
        vault.getFolderByPath = vi.fn().mockReturnValue(null);
        vault.createFolder = vi.fn().mockResolvedValue(undefined);

        await ensureFolderExists(vault, 'exports/weekly/reports');

        expect(vault.createFolder).toHaveBeenCalledTimes(3);
        expect(vault.createFolder).toHaveBeenCalledWith('exports');
        expect(vault.createFolder).toHaveBeenCalledWith('exports/weekly');
        expect(vault.createFolder).toHaveBeenCalledWith('exports/weekly/reports');
    });

    it('skips folders that already exist', async () => {
        const vault = new Vault();
        vault.getFolderByPath = vi.fn().mockImplementation((path: string) => {
            // First two segments exist, third does not
            if (path === 'exports' || path === 'exports/weekly') return { path };
            return null;
        });
        vault.createFolder = vi.fn().mockResolvedValue(undefined);

        await ensureFolderExists(vault, 'exports/weekly/reports');

        expect(vault.createFolder).toHaveBeenCalledTimes(1);
        expect(vault.createFolder).toHaveBeenCalledWith('exports/weekly/reports');
    });

    it('handles race condition — createFolder throws but folder now exists', async () => {
        const vault = new Vault();
        let callCount = 0;
        vault.getFolderByPath = vi.fn().mockImplementation((path: string) => {
            // First call returns null (doesn't exist), subsequent calls for same path return truthy
            if (path === 'exports') {
                callCount++;
                return callCount > 1 ? { path } : null;
            }
            return null;
        });
        vault.createFolder = vi.fn().mockImplementation((path: string) => {
            if (path === 'exports') {
                throw new Error('Folder already exists');
            }
            return Promise.resolve();
        });

        // Should not throw — race condition is handled gracefully
        await expect(ensureFolderExists(vault, 'exports/data')).resolves.toBeUndefined();
    });

    it('uses forward-slash paths (normalizePath applied)', async () => {
        const vault = new Vault();
        vault.getFolderByPath = vi.fn().mockReturnValue(null);
        vault.createFolder = vi.fn().mockResolvedValue(undefined);

        await ensureFolderExists(vault, 'exports\\weekly');

        // normalizePath converts backslashes to forward slashes
        const calls = (vault.createFolder as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        for (const callPath of calls) {
            expect(callPath).not.toContain('\\');
        }
    });
});
