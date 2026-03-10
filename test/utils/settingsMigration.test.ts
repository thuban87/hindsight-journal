import { describe, it, expect } from 'vitest';
import {
    migrateSettings,
    validateSettings,
    normalizePathSetting,
} from '../../src/utils/settingsMigration';
import { DEFAULT_SETTINGS } from '../../src/types/settings';

describe('normalizePathSetting', () => {
    it('returns empty string for empty/whitespace input', () => {
        expect(normalizePathSetting('')).toBe('');
        expect(normalizePathSetting('   ')).toBe('');
    });

    it('strips leading slashes', () => {
        const result = normalizePathSetting('/Journal');
        expect(result).not.toMatch(/^\//);
    });

    it('strips trailing slashes', () => {
        const result = normalizePathSetting('Journal/');
        expect(result).toBe('Journal');
    });

    it('preserves valid paths', () => {
        expect(normalizePathSetting('Journal')).toBe('Journal');
        expect(normalizePathSetting('My Notes/Journal')).toBe('My Notes/Journal');
    });
});

describe('validateSettings', () => {
    it('returns defaults for null/undefined input', () => {
        expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
        expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });

    it('returns defaults for non-object input', () => {
        expect(validateSettings('string')).toEqual(DEFAULT_SETTINGS);
        expect(validateSettings(42)).toEqual(DEFAULT_SETTINGS);
    });

    it('preserves valid settings', () => {
        const valid = {
            journalFolder: 'MyJournal',
            enableSidebar: false,
            debugMode: true,
            settingsVersion: 1,
            hotTierDays: 60,
        };
        const result = validateSettings(valid);
        expect(result.journalFolder).toBe('MyJournal');
        expect(result.enableSidebar).toBe(false);
        expect(result.debugMode).toBe(true);
        expect(result.settingsVersion).toBe(1);
        expect(result.hotTierDays).toBe(60);
    });

    it('falls back to defaults for invalid types', () => {
        const invalid = {
            journalFolder: 123,       // should be string
            enableSidebar: 'yes',     // should be boolean
            hotTierDays: 'banana',    // should be number
        };
        const result = validateSettings(invalid);
        expect(result.journalFolder).toBe(DEFAULT_SETTINGS.journalFolder);
        expect(result.enableSidebar).toBe(DEFAULT_SETTINGS.enableSidebar);
        expect(result.hotTierDays).toBe(DEFAULT_SETTINGS.hotTierDays);
    });

    it('falls back to defaults for out-of-range values', () => {
        const outOfRange = {
            hotTierDays: 3,    // minimum is 7
            settingsVersion: -1,
        };
        const result = validateSettings(outOfRange);
        expect(result.hotTierDays).toBe(DEFAULT_SETTINGS.hotTierDays);
        expect(result.settingsVersion).toBe(DEFAULT_SETTINGS.settingsVersion);
    });

    it('accepts hotTierDays at boundaries', () => {
        expect(validateSettings({ hotTierDays: 7 }).hotTierDays).toBe(7);
        expect(validateSettings({ hotTierDays: 365 }).hotTierDays).toBe(365);
    });

    it('filters non-string items from string arrays', () => {
        const mixed = {
            productivitySections: ['Tasks', 42, true, 'Goals'],
        };
        const result = validateSettings(mixed);
        expect(result.productivitySections).toEqual(['Tasks', 'Goals']);
    });
});

describe('migrateSettings', () => {
    it('returns defaults for null input', () => {
        const result = migrateSettings(null);
        expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('migrates v0 (no version field) to v1', () => {
        const v0 = {
            journalFolder: 'Journal',
            enableSidebar: true,
            debugMode: false,
            // No settingsVersion field
        };
        const result = migrateSettings(v0);
        expect(result.settingsVersion).toBe(6);
        expect(result.journalFolder).toBe('Journal');
        // Should also have chart settings from v2 migration
        expect(result.selectedChartFields).toEqual([]);
        expect(result.rollingWindow).toBe(7);
        // Should have Phase 6b settings from v4 migration
        expect(result.goalTargets).toEqual({});
        expect(result.prioritySectionHeading).toBe("Tomorrow's Top 3");
        expect(result.weekStartDay === 0 || result.weekStartDay === 1).toBe(true);
        // Should have Phase 6c settings from v5 migration
        expect(Array.isArray(result.widgets)).toBe(true);
        expect(result.widgets.length).toBe(7);
        expect(result.calendarColorTheme).toBe('default');
        // Should have Phase 7 settings from v6 migration
        expect(result.savedFilters).toEqual([]);
    });

    it('preserves existing valid settings during migration', () => {
        const v0 = {
            journalFolder: 'MyCustomFolder',
            enableSidebar: false,
            debugMode: true,
            excludedSections: ['Meds', 'Workout'],
        };
        const result = migrateSettings(v0);
        expect(result.journalFolder).toBe('MyCustomFolder');
        expect(result.enableSidebar).toBe(false);
        expect(result.debugMode).toBe(true);
        expect(result.excludedSections).toEqual(['Meds', 'Workout']);
    });

    it('normalizes path settings during v0→v1 migration', () => {
        const v0 = {
            journalFolder: 'Journal/',
            weeklyReviewFolder: '/Reviews/',
        };
        const result = migrateSettings(v0);
        expect(result.journalFolder).toBe('Journal');
        // weeklyReviewFolder with leading slash gets normalized
        expect(result.weeklyReviewFolder).not.toMatch(/^\//);
    });

    it('resets invalid journalFolder paths during migration', () => {
        const v0 = {
            journalFolder: '../../etc/passwd',
        };
        const result = migrateSettings(v0);
        expect(result.journalFolder).toBe(DEFAULT_SETTINGS.journalFolder);
    });

    it('handles downgrade gracefully (newer version than plugin)', () => {
        const future = {
            settingsVersion: 999,
            journalFolder: 'FutureJournal',
            enableSidebar: false,
            unknownFutureSetting: 'value',
        };
        const result = migrateSettings(future);
        // Should preserve known fields, not reset to defaults
        expect(result.journalFolder).toBe('FutureJournal');
        expect(result.enableSidebar).toBe(false);
    });

    it('strips prototype pollution keys', () => {
        const poisoned = JSON.parse(
            '{"journalFolder":"Journal","__proto__":{"admin":true},"settingsVersion":0}'
        );
        const result = migrateSettings(poisoned);
        expect(result.journalFolder).toBe('Journal');
        // sanity check — the result should not have __proto__ pollution
        expect((result as unknown as Record<string, unknown>)['admin']).toBeUndefined();
    });

    it('adds defaults for missing new fields', () => {
        const minimal = {
            journalFolder: 'Journal',
        };
        const result = migrateSettings(minimal);
        expect(result.hotTierDays).toBe(DEFAULT_SETTINGS.hotTierDays);
        expect(result.settingsVersion).toBe(6);
        expect(result.selectedChartFields).toEqual([]);
        expect(result.rollingWindow).toBe(7);
        expect(result.thumbnailsEnabled).toBe(DEFAULT_SETTINGS.thumbnailsEnabled);
        expect(result.goalTargets).toEqual({});
        expect(result.prioritySectionHeading).toBe(DEFAULT_SETTINGS.prioritySectionHeading);
        // Phase 6c fields
        expect(Array.isArray(result.widgets)).toBe(true);
        expect(result.calendarColorTheme).toBe('default');
        // Phase 7 fields
        expect(result.savedFilters).toEqual([]);
    });
});
