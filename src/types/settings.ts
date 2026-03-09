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
};
