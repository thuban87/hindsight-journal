/**
 * A single parsed journal entry.
 *
 * ARCHITECTURE NOTE: rawContent is NOT stored here to avoid holding
 * the full text of every journal entry in memory. With 700+ entries,
 * that would be 3-4MB of heap. Instead:
 * - Frontmatter is extracted via metadataCache (zero I/O)
 * - Sections, word count, and image paths are computed during
 *   background indexing (Phase 1 pass 2) and cached here
 * - Full text is lazy-loaded via vault.cachedRead() on demand
 *   (e.g., for full-text search in the Lens feature)
 */
export interface JournalEntry {
    /** Vault-relative file path */
    filePath: string;
    /** Parsed date — sourced from frontmatter `date` field (authoritative), filename as fallback */
    date: Date;
    /** Day of week (e.g., "Thursday") */
    dayOfWeek: string;
    /** All frontmatter key-value pairs (dynamic) */
    frontmatter: Record<string, unknown>;
    /** Parsed sections by heading name (populated during background pass 2) */
    sections: Record<string, string>;
    /** Word count (computed during pass 2, 0 until then) */
    wordCount: number;
    /** Vault-relative paths to embedded images (populated during pass 2) */
    imagePaths: string[];
    /** File modification timestamp (ms) */
    mtime: number;
    /** Whether pass 2 (full content parsing) has completed for this entry */
    fullyIndexed: boolean;
    /** Entry quality score (0-100): percentage of detected fields that are filled */
    qualityScore: number;
    /**
     * Heading names only — populated for cold-tier entries (older than hotTierDays).
     * Hot-tier entries have full `sections` and this is undefined.
     */
    sectionHeadings?: string[];
    /**
     * First 200 chars of the first non-empty section.
     * Always populated for ALL entries (hot and cold) to avoid lazy-load I/O
     * for the most common UI path (echo cards, timeline cards).
     */
    firstSectionExcerpt?: string;
    /**
     * Per-section word counts — computed during Pass 2, retained for cold tier.
     * Needed because getSectionWordCounts() would otherwise return zero for cold entries.
     */
    sectionWordCounts?: Record<string, number>;
    /** Number of completed checkboxes (- [x]) in configured productivity sections */
    tasksCompleted: number;
    /** Total number of checkboxes (- [ ] + - [x]) in configured productivity sections */
    tasksTotal: number;
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
