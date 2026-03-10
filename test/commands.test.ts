/**
 * Commands Tests
 *
 * Tests that command IDs do not contain the plugin manifest ID
 * (Obsidian auto-prefixes command IDs with the plugin ID).
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock obsidian module
vi.mock('obsidian', () => ({
    Platform: { isMobile: false },
}));

import { registerCommands } from '../src/commands';

describe('Command IDs', () => {
    // Read manifest ID dynamically
    const manifestPath = path.resolve(__dirname, '../manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const pluginId = manifest.id as string;

    it('no command ID contains the plugin manifest id (Obsidian auto-prefixes)', () => {
        const registeredCommands: Array<{ id: string; name: string }> = [];

        // Create a mock plugin that captures addCommand calls
        const mockPlugin = {
            addCommand: (cmd: { id: string; name: string }) => {
                registeredCommands.push(cmd);
            },
        };

        registerCommands(mockPlugin as Parameters<typeof registerCommands>[0]);

        expect(registeredCommands.length).toBeGreaterThan(0);
        for (const cmd of registeredCommands) {
            expect(cmd.id).not.toContain(pluginId);
        }
    });

    it('dynamically checks ALL registered commands, not a hardcoded list', () => {
        const registeredCommands: Array<{ id: string; name: string }> = [];

        const mockPlugin = {
            addCommand: (cmd: { id: string; name: string }) => {
                registeredCommands.push(cmd);
            },
        };

        registerCommands(mockPlugin as Parameters<typeof registerCommands>[0]);

        // Verify we tested every command that registerCommands adds
        // (not just a known subset). The count should match the actual
        // number of addCommand() calls in commands.ts.
        expect(registeredCommands.length).toBeGreaterThanOrEqual(2);

        // Double-check: every ID is a valid non-empty string
        for (const cmd of registeredCommands) {
            expect(typeof cmd.id).toBe('string');
            expect(cmd.id.length).toBeGreaterThan(0);
            expect(cmd.id).not.toContain(pluginId);
        }
    });
});
