/** Describes a detected frontmatter field across all entries */
export interface FrontmatterField {
    /** Field key as it appears in frontmatter */
    key: string;
    /** Inferred type */
    type: 'number' | 'boolean' | 'string' | 'date' | 'string[]' | 'numeric-text';
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
