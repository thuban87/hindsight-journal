import { getDefaultWeekStart } from '../utils/periodUtils';

/** Goal target configuration for a single field */
export interface GoalConfig {
    period: 'weekly' | 'monthly';
    target: number;
    /** 'sum' for cumulative (studying_hours), 'count' for occurrences (workout) */
    type: 'sum' | 'count';
}

/** Plugin settings */
export interface HindsightSettings {
    /** Path to the journal folder (scanned recursively) */
    journalFolder: string;
    /** Path to weekly review folder (optional) */
    weeklyReviewFolder: string;
    /** Whether to auto-open the sidebar on plugin load */
    enableSidebar: boolean;
    /** Whether to generate and cache image thumbnails */
    thumbnailsEnabled: boolean;
    /** Whether to show the morning briefing panel in the sidebar */
    morningBriefingEnabled: boolean;
    /** Sections whose checkboxes count toward productivity score (whitelist) */
    productivitySections: string[];
    /** Sections whose checkboxes are excluded from productivity score (blacklist) */
    excludedSections: string[];
    /** Enable verbose debug logging to the developer console */
    debugMode: boolean;
    /** Settings schema version for migration (DO NOT edit manually) */
    settingsVersion: number;
    /** Entries older than this many days use cold-tier storage (headings + excerpt only) */
    hotTierDays: number;
    /** Which frontmatter fields are selected for charting (persisted preference) */
    selectedChartFields: string[];
    /** Rolling average window size in days (persisted preference) */
    rollingWindow: number;
    /** Per-field polarity setting: determines badge coloring and trend alert tone */
    fieldPolarity: Record<string, 'higher-is-better' | 'lower-is-better' | 'neutral'>;
    /** Goal targets: field key -> { period, target, type } */
    goalTargets: Record<string, GoalConfig>;
    /** Section heading to extract priorities from yesterday's entry */
    prioritySectionHeading: string;
    /** Day the week starts on: 0 = Sunday, 1 = Monday */
    weekStartDay: 0 | 1;
}

export const DEFAULT_SETTINGS: HindsightSettings = {
    journalFolder: 'Journal',
    weeklyReviewFolder: '',
    enableSidebar: true,
    thumbnailsEnabled: false,
    morningBriefingEnabled: false,
    productivitySections: [],
    excludedSections: ['Meds'],
    debugMode: false,
    settingsVersion: 2,
    hotTierDays: 90,
    selectedChartFields: [],
    rollingWindow: 7,
    fieldPolarity: {},
    goalTargets: {},
    prioritySectionHeading: "Tomorrow's Top 3",
    weekStartDay: getDefaultWeekStart(),
};
