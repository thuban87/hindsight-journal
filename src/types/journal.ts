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
