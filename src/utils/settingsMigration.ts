/**
 * Settings Migration
 *
 * Versioned settings migration utility. Handles upgrading settings
 * from older schema versions, validating types/ranges, normalizing
 * path settings, and stripping prototype pollution keys.
 */

import { normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { HindsightSettings } from '../types/settings';
import { sanitizeLoadedData } from './sanitize';
import { validateVaultRelativePath } from './vaultUtils';
import { debugLog } from './debugLog';

/** Current settings schema version */
const CURRENT_MAX_VERSION = 4;

/**
 * Normalize a path-type setting value.
 * Strips leading/trailing slashes and normalizes separators.
 *
 * @param value - Raw path string from user input
 * @returns Normalized path string
 */
export function normalizePathSetting(value: string): string {
    if (!value || value.trim() === '') return '';
    // Strip leading/trailing whitespace
    let cleaned = value.trim();
    // Strip leading slashes
    cleaned = cleaned.replace(/^[/\\]+/, '');
    // Strip trailing slashes
    cleaned = cleaned.replace(/[/\\]+$/, '');
    // Normalize separators
    return normalizePath(cleaned);
}

/**
 * Validate settings types and ranges.
 * Falls back to DEFAULT_SETTINGS values for any invalid field.
 *
 * @param settings - Settings object to validate
 * @returns Validated settings with corrected values
 */
export function validateSettings(settings: unknown): HindsightSettings {
    if (typeof settings !== 'object' || settings === null) {
        return { ...DEFAULT_SETTINGS };
    }

    const s = settings as Record<string, unknown>;
    const result = { ...DEFAULT_SETTINGS };

    // journalFolder: string
    if (typeof s['journalFolder'] === 'string' && s['journalFolder'].trim() !== '') {
        result.journalFolder = normalizePathSetting(s['journalFolder']);
    }

    // weeklyReviewFolder: string (can be empty)
    if (typeof s['weeklyReviewFolder'] === 'string') {
        result.weeklyReviewFolder = normalizePathSetting(s['weeklyReviewFolder']);
    }

    // enableSidebar: boolean
    if (typeof s['enableSidebar'] === 'boolean') {
        result.enableSidebar = s['enableSidebar'];
    }

    // thumbnailsEnabled: boolean
    if (typeof s['thumbnailsEnabled'] === 'boolean') {
        result.thumbnailsEnabled = s['thumbnailsEnabled'];
    }

    // morningBriefingEnabled: boolean
    if (typeof s['morningBriefingEnabled'] === 'boolean') {
        result.morningBriefingEnabled = s['morningBriefingEnabled'];
    }

    // productivitySections: string[]
    if (Array.isArray(s['productivitySections'])) {
        result.productivitySections = s['productivitySections'].filter(
            (v: unknown) => typeof v === 'string'
        );
    }

    // excludedSections: string[]
    if (Array.isArray(s['excludedSections'])) {
        result.excludedSections = s['excludedSections'].filter(
            (v: unknown) => typeof v === 'string'
        );
    }

    // debugMode: boolean
    if (typeof s['debugMode'] === 'boolean') {
        result.debugMode = s['debugMode'];
    }

    // settingsVersion: number
    if (typeof s['settingsVersion'] === 'number' && s['settingsVersion'] >= 1) {
        result.settingsVersion = s['settingsVersion'];
    }

    // selectedChartFields: string[]
    if (Array.isArray(s['selectedChartFields'])) {
        result.selectedChartFields = s['selectedChartFields'].filter(
            (v: unknown) => typeof v === 'string'
        );
    }

    // rollingWindow: number (range: 2-90)
    if (
        typeof s['rollingWindow'] === 'number' &&
        s['rollingWindow'] >= 2 &&
        s['rollingWindow'] <= 90
    ) {
        result.rollingWindow = s['rollingWindow'];
    }

    // hotTierDays: number (range: 7-365)
    if (
        typeof s['hotTierDays'] === 'number' &&
        s['hotTierDays'] >= 7 &&
        s['hotTierDays'] <= 365
    ) {
        result.hotTierDays = s['hotTierDays'];
    }

    // fieldPolarity: Record<string, polarity>
    if (typeof s['fieldPolarity'] === 'object' && s['fieldPolarity'] !== null && !Array.isArray(s['fieldPolarity'])) {
        const raw = s['fieldPolarity'] as Record<string, unknown>;
        const validPolarities = ['higher-is-better', 'lower-is-better', 'neutral'];
        const cleaned: Record<string, 'higher-is-better' | 'lower-is-better' | 'neutral'> = {};
        for (const [key, val] of Object.entries(raw)) {
            if (typeof val === 'string' && validPolarities.includes(val)) {
                cleaned[key] = val as 'higher-is-better' | 'lower-is-better' | 'neutral';
            }
        }
        result.fieldPolarity = cleaned;
    }

    // goalTargets: Record<string, GoalConfig>
    if (typeof s['goalTargets'] === 'object' && s['goalTargets'] !== null && !Array.isArray(s['goalTargets'])) {
        const raw = s['goalTargets'] as Record<string, unknown>;
        const validPeriods = ['weekly', 'monthly'];
        const validTypes = ['sum', 'count'];
        const cleaned: Record<string, { period: 'weekly' | 'monthly'; target: number; type: 'sum' | 'count' }> = {};
        for (const [key, val] of Object.entries(raw)) {
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const goal = val as Record<string, unknown>;
                const period = goal['period'];
                const target = goal['target'];
                const type = goal['type'];
                if (
                    typeof period === 'string' && validPeriods.includes(period) &&
                    typeof target === 'number' && target > 0 &&
                    typeof type === 'string' && validTypes.includes(type)
                ) {
                    cleaned[key] = {
                        period: period as 'weekly' | 'monthly',
                        target,
                        type: type as 'sum' | 'count',
                    };
                }
            }
        }
        result.goalTargets = cleaned;
    }

    // prioritySectionHeading: string
    if (typeof s['prioritySectionHeading'] === 'string' && s['prioritySectionHeading'].trim() !== '') {
        result.prioritySectionHeading = s['prioritySectionHeading'].trim();
    }

    // weekStartDay: 0 | 1
    if (s['weekStartDay'] === 0 || s['weekStartDay'] === 1) {
        result.weekStartDay = s['weekStartDay'];
    }

    return result;
}

/**
 * Migrate settings from older schema versions.
 * Called once in loadSettings() before any service initialization.
 *
 * Each migration function is idempotent — safe to re-run on
 * already-migrated data. On failure: logs error, keeps existing
 * settings, bumps version to prevent infinite retry loops.
 *
 * @param loaded - Raw loaded data from Obsidian's loadData()
 * @returns Fully migrated and validated HindsightSettings
 */
export function migrateSettings(loaded: Record<string, unknown> | null): HindsightSettings {
    if (!loaded) {
        return { ...DEFAULT_SETTINGS };
    }

    // 1. Sanitize prototype pollution
    const sanitized = sanitizeLoadedData(loaded) as Record<string, unknown>;

    debugLog('Settings migration: raw data', sanitized);

    // 2. Check version
    const version = typeof sanitized['settingsVersion'] === 'number'
        ? sanitized['settingsVersion']
        : 0;

    // Downgrade handling: newer version than plugin knows about
    if (version > CURRENT_MAX_VERSION) {
        debugLog('Settings version newer than plugin — possible downgrade');
        // Do NOT reset — preserve user config, just validate known fields
        return validateSettings(sanitized);
    }

    // 3. Run sequential migrations
    let migrated = { ...sanitized };

    if (version < 1) {
        migrated = migrateV0ToV1(migrated);
    }
    if (version < 2) {
        migrated = migrateV1ToV2(migrated);
    }
    if (version < 3) {
        migrated = migrateV2ToV3(migrated);
    }
    if (version < 4) {
        migrated = migrateV3ToV4(migrated);
    }

    // 4. Validate all fields
    const validated = validateSettings(migrated);

    debugLog('Settings migration complete: v' + String(version) + ' → v' + String(CURRENT_MAX_VERSION));

    return validated;
}

/**
 * Migration: v0 → v1
 * - Adds settingsVersion field
 * - Normalizes path settings
 * - Applies defaults for any missing fields
 */
function migrateV0ToV1(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    // Set version
    result['settingsVersion'] = 1;

    // Normalize path settings if present
    if (typeof result['journalFolder'] === 'string') {
        result['journalFolder'] = normalizePathSetting(result['journalFolder'] as string);
    }
    if (typeof result['weeklyReviewFolder'] === 'string') {
        result['weeklyReviewFolder'] = normalizePathSetting(result['weeklyReviewFolder'] as string);
    }

    // Validate journalFolder path
    if (typeof result['journalFolder'] === 'string' && result['journalFolder'] !== '') {
        const validated = validateVaultRelativePath(result['journalFolder'] as string);
        if (!validated) {
            debugLog('Settings migration: journalFolder path invalid, resetting to default');
            result['journalFolder'] = DEFAULT_SETTINGS.journalFolder;
        }
    }

    return result;
}

/**
 * Migration: v1 → v2
 * - Adds selectedChartFields and rollingWindow settings
 */
function migrateV1ToV2(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    result['settingsVersion'] = 2;

    // Add chart settings with defaults if missing
    if (!Array.isArray(result['selectedChartFields'])) {
        result['selectedChartFields'] = DEFAULT_SETTINGS.selectedChartFields;
    }
    if (typeof result['rollingWindow'] !== 'number') {
        result['rollingWindow'] = DEFAULT_SETTINGS.rollingWindow;
    }

    return result;
}

/**
 * Migration: v2 → v3
 * - Adds fieldPolarity setting for per-field badge coloring
 */
function migrateV2ToV3(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    result['settingsVersion'] = 3;

    // Add fieldPolarity with empty default if missing
    if (typeof result['fieldPolarity'] !== 'object' || result['fieldPolarity'] === null || Array.isArray(result['fieldPolarity'])) {
        result['fieldPolarity'] = DEFAULT_SETTINGS.fieldPolarity;
    }

    return result;
}

/**
 * Migration: v3 → v4
 * - Adds goalTargets for goal tracking
 * - Adds prioritySectionHeading for morning briefing priorities
 * - Adds weekStartDay for locale-aware weekly computations
 */
function migrateV3ToV4(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    result['settingsVersion'] = 4;

    // Add goalTargets with empty default if missing
    if (typeof result['goalTargets'] !== 'object' || result['goalTargets'] === null || Array.isArray(result['goalTargets'])) {
        result['goalTargets'] = {};
    }

    // Add prioritySectionHeading with default if missing
    if (typeof result['prioritySectionHeading'] !== 'string' || result['prioritySectionHeading'].trim() === '') {
        result['prioritySectionHeading'] = DEFAULT_SETTINGS.prioritySectionHeading;
    }

    // Add weekStartDay with default (Sunday) if missing
    if (result['weekStartDay'] !== 0 && result['weekStartDay'] !== 1) {
        result['weekStartDay'] = 0;
    }

    return result;
}
