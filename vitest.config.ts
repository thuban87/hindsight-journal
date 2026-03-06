import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            'obsidian': path.resolve(__dirname, 'test/mocks/obsidian.ts'),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.test.ts'],
        exclude: ['node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: [
                'node_modules/',
                'test/',
                '*.config.*',
                'esbuild.config.mjs',
                'deploy.mjs',
            ],
        },
        globals: true,
    },
});
