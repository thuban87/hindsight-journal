import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        files: ['src/**/*.ts', 'src/**/*.tsx', 'main.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            'no-console': ['error', { allow: ['warn', 'error'] }],
        },
    },
];
