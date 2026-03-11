import { getDefaultWeekStart } from '../utils/periodUtils';

/** Goal target configuration for a single field */
export interface GoalConfig {
    period: 'weekly' | 'monthly';
    target: number;
    /** 'sum' for cumulative (studying_hours), 'count' for occurrences (workout) */
    type: 'sum' | 'count';
}

/** A single filter row within a saved Lens filter (discriminated union) */
export type LensFilterRow =
    | { type: 'field'; fieldKey: string; operator: '>=' | '<=' | '=' | '!='; value: string | number }
    | { type: 'dateRange'; startDate: string; endDate: string }
    | { type: 'tag'; tag: string }
    | { type: 'wordCount'; min?: number; max?: number }
    | { type: 'qualityScore'; min?: number; max?: number }
    | { type: 'hasImages'; enabled: boolean };

/** Complete filter configuration for a saved Lens filter */
export interface FilterConfig {
    searchQuery: string;
    filters: LensFilterRow[];
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
    /** Maximum number of thumbnails to cache in IndexedDB */
    maxThumbnailCount: number;
    /** Thumbnail size in pixels (width, height scales proportionally) */
    thumbnailSize: number;
    /** Unique vault identifier for thumbnail cache key namespacing */
    thumbnailVaultId: string;
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
    /** Ordered list of widgets with visibility state for the sidebar Today tab */
    widgets: { id: string; visible: boolean }[];
    /** Calendar color palette theme */
    calendarColorTheme: 'default' | 'monochrome' | 'warm' | 'cool' | 'colorblind';
    /** Saved filter configurations for Lens (persists across reloads) */
    savedFilters: { name: string; config: FilterConfig }[];
}

export const DEFAULT_SETTINGS: HindsightSettings = {
    journalFolder: 'Journal',
    weeklyReviewFolder: '',
    enableSidebar: true,
    thumbnailsEnabled: false,
    maxThumbnailCount: 500,
    thumbnailSize: 120,
    thumbnailVaultId: '',
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
    widgets: [
        { id: 'entry-status', visible: true },
        { id: 'goal-rings', visible: true },
        { id: 'sparklines', visible: true },
        { id: 'gap-alerts', visible: true },
        { id: 'morning-briefing', visible: true },
        { id: 'streak', visible: true },
        { id: 'consistency', visible: true },
    ],
    calendarColorTheme: 'default',
    savedFilters: [],
};
