/**
 * Insights Types
 *
 * Type definitions for insight-related features:
 * trend alerts, correlations, conditional insights,
 * metric comparisons, and milestones.
 */

/** Alert severity levels */
export type AlertSeverity = 'info' | 'warning' | 'positive';

/** A generated trend alert */
export interface TrendAlert {
    /**
     * Stable ID for session-level dismissal tracking.
     * Format: `${alertType}-${fieldKey}-${triggerDate_ISO}`
     * e.g. 'consecutive-decrease-mood-2026-03-07'
     */
    id: string;
    severity: AlertSeverity;
    title: string;
    body: string;
    /** The field(s) this alert relates to */
    relatedFields: string[];
    /** Entry date that triggered the alert, if applicable */
    triggerDate?: Date;
    /** Entry to link to for context, if applicable */
    relatedEntryPath?: string;
}

/** A computed correlation between two numeric fields */
export interface CorrelationResult {
    fieldA: string;
    fieldB: string;
    /** Pearson r value (-1 to 1) */
    r: number;
    /** Number of paired data points used */
    n: number;
}

/** A conditional average insight (boolean × numeric) */
export interface ConditionalInsight {
    numericField: string;
    booleanField: string;
    whenTrue: number;
    whenFalse: number;
    difference: number;
    sampleSizeTrue: number;
    sampleSizeFalse: number;
}

/** A personal best record for a specific field and period */
export interface PersonalBest {
    type: 'best-week' | 'most-consistent-month' | 'best-trend';
    field: string;
    title: string;
    value: number;
    period: string;
}

/** A field-by-field comparison between today's entry and an echo entry */
export interface MetricComparison {
    /** Frontmatter field key */
    field: string;
    /** Today's value */
    today: number;
    /** Echo entry's value */
    then: number;
    /** Direction based on polarity setting */
    direction: 'improved' | 'declined' | 'unchanged';
    /** Numeric change (today - then) */
    change: number;
}

/** A journaling milestone worth celebrating */
export interface Milestone {
    /** Type of milestone detected */
    type: 'entry-count' | 'anniversary' | 'streak';
    /** Human-readable milestone description */
    title: string;
    /** Numeric value associated (entry count, years, streak days) */
    value: number;
}
