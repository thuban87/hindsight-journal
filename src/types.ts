/** Plugin settings */
export interface HindsightSettings {
    /** Path to the journal folder (scanned recursively) */
    journalFolder: string;
    /** Filename date format for parsing */
    dateFormat: string;
    /** Path to weekly review folder (optional) */
    weeklyReviewFolder: string;
    /** Whether to auto-open the sidebar on plugin load */
    enableSidebar: boolean;
    /** Whether to generate and cache image thumbnails */
    thumbnailsEnabled: boolean;
}

export const DEFAULT_SETTINGS: HindsightSettings = {
    journalFolder: 'Journal',
    dateFormat: 'YYYY-MM-DD, dddd',
    weeklyReviewFolder: '',
    enableSidebar: true,
    thumbnailsEnabled: false,
};

/** A single parsed journal entry */
export interface JournalEntry {
    /** Vault-relative file path */
    filePath: string;
    /** Parsed date from filename */
    date: Date;
    /** Day of week from filename (e.g., "Thursday") */
    dayOfWeek: string;
    /** All frontmatter key-value pairs (dynamic) */
    frontmatter: Record<string, unknown>;
    /** Parsed sections by heading name */
    sections: Record<string, string>;
    /** Full raw content (for word count, search) */
    rawContent: string;
    /** Word count of rawContent */
    wordCount: number;
    /** Vault-relative paths to embedded images */
    imagePaths: string[];
    /** File modification timestamp (ms) */
    mtime: number;
}

/** Describes a detected frontmatter field across all entries */
export interface FrontmatterField {
    /** Field key as it appears in frontmatter */
    key: string;
    /** Inferred type */
    type: 'number' | 'boolean' | 'string' | 'date' | 'string[]';
    /** How many entries have a non-empty value for this field */
    coverage: number;
    /** Total entries scanned */
    total: number;
    /** Min/max for numeric fields */
    range?: { min: number; max: number };
}

/** A single data point for charting */
export interface MetricDataPoint {
    /** Unix timestamp in milliseconds */
    date: number;
    /** Value, or null if missing */
    value: number | null;
}

/** A time range for queries */
export interface DateRange {
    start: Date;
    end: Date;
}

/** Parsed section from a journal entry */
export interface ParsedSection {
    /** Heading text (without the ## prefix) */
    heading: string;
    /** Heading level (1-6) */
    level: number;
    /** Raw markdown content under the heading */
    content: string;
}
