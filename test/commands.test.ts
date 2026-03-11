/**
 * Commands Tests
 *
 * Tests that command IDs do not contain the plugin manifest ID
 * (Obsidian auto-prefixes command IDs with the plugin ID).
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock obsidian module — needs Modal for SectionReaderModal import chain
vi.mock('obsidian', () => ({
    Platform: { isMobile: false },
    Modal: class MockModal {
        app: unknown;
        modalEl = { addClass: vi.fn() };
        contentEl = { empty: vi.fn(), addClass: vi.fn() };
        constructor(app: unknown) { this.app = app; }
        open(): void { /* noop */ }
        close(): void { /* noop */ }
    },
    Notice: vi.fn(),
    MarkdownRenderer: { render: vi.fn() },
    Component: class MockComponent {
        load(): void { /* noop */ }
        unload(): void { /* noop */ }
    },
}));

// Mock react-dom/client to avoid DOM dependency
vi.mock('react-dom/client', () => ({
    createRoot: () => ({
        render: vi.fn(),
        unmount: vi.fn(),
    }),
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
