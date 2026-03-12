/**
 * Section Utilities
 *
 * Shared section boundary detection and content replacement for
 * journal body editing. Uses the same code-block-aware heading
 * detection logic as SectionParserService.parseSections().
 *
 * Used by the Entry Wizard to surgically replace individual
 * ## sections in note bodies.
 */

/**
 * A section boundary within markdown text.
 */
export interface SectionBoundary {
    /** Heading text (without the ## prefix) */
    heading: string;
    /** Heading depth: 2 for ##, 3 for ###, etc. */
    level: number;
    /** Character index where this heading line starts */
    startIndex: number;
    /** Character index where section content ends (start of next same/higher-level heading, or EOF) */
    endIndex: number;
    /** Occurrence index for duplicate headings (0 = first, 1 = second, etc.) */
    occurrenceIndex: number;
}

/**
 * Find all section boundaries in markdown text.
 *
 * Code-block-aware: headings inside ``` ... ``` fences are ignored.
 * Tracks heading level so that a ## section includes all its ### and ####
 * subsections (section ends at next heading at same or higher level).
 *
 * @param text - Full markdown text (body only, no frontmatter)
 * @returns Array of section boundaries in document order
 */
export function findSectionBoundaries(text: string): SectionBoundary[] {
    const lines = text.split('\n');
    const boundaries: SectionBoundary[] = [];
    const occurrenceCounts = new Map<string, number>();

    let inCodeBlock = false;
    let charIndex = 0;

    // First pass: find all heading positions
    interface HeadingInfo {
        heading: string;
        level: number;
        lineStartIndex: number;
        lineEndIndex: number;
    }
    const headings: HeadingInfo[] = [];

    for (const line of lines) {
        const trimmedStart = line.trimStart();

        // Track code block boundaries
        if (trimmedStart.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        // Detect headings outside code blocks
        if (!inCodeBlock) {
            const headingMatch = line.match(/^(#{2,6})\s+(.+)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const heading = headingMatch[2].trim();
                headings.push({
                    heading,
                    level,
                    lineStartIndex: charIndex,
                    lineEndIndex: charIndex + line.length,
                });
            }
        }

        // +1 for the \n character (or end of string)
        charIndex += line.length + 1;
    }

    // Second pass: compute end indices based on next same/higher-level heading
    for (let i = 0; i < headings.length; i++) {
        const current = headings[i];

        // Find end: next heading at same or higher (lower number) level
        let endIndex = text.length;
        for (let j = i + 1; j < headings.length; j++) {
            if (headings[j].level <= current.level) {
                endIndex = headings[j].lineStartIndex;
                break;
            }
        }

        // Track occurrence index for duplicate headings
        const key = current.heading;
        const occIdx = occurrenceCounts.get(key) ?? 0;
        occurrenceCounts.set(key, occIdx + 1);

        boundaries.push({
            heading: current.heading,
            level: current.level,
            startIndex: current.lineStartIndex,
            endIndex,
            occurrenceIndex: occIdx,
        });
    }

    return boundaries;
}

/**
 * Replace the content of a specific ## section within note body text.
 *
 * Finds the section by heading text, replaces just that section's content
 * (between the heading line and the next same/higher-level heading or EOF),
 * and preserves everything before and after.
 *
 * Normalizes all line endings to LF on output. Obsidian internally uses LF;
 * CRLF files in Obsidian are the exception and typically come from external editors.
 *
 * @param fullText - Full body text (after frontmatter)
 * @param heading - The heading text to find (without ## prefix)
 * @param newContent - New content to place under the heading
 * @param occurrenceIndex - Which occurrence to replace (0 = first, default)
 * @returns Modified text, or original text if heading not found
 */
export function replaceSectionContent(
    fullText: string,
    heading: string,
    newContent: string,
    occurrenceIndex: number = 0,
): string {
    // Normalize CRLF to LF
    const normalized = fullText.replace(/\r\n/g, '\n');

    const boundaries = findSectionBoundaries(normalized);

    // Find the matching section
    const match = boundaries.find(
        b => b.heading === heading && b.occurrenceIndex === occurrenceIndex
    );

    if (!match) {
        return fullText; // Return original unchanged if heading not found
    }

    // The heading line itself: from startIndex to the end of the heading line
    // We need to find where the heading line ends (the \n after it)
    const headingLineEnd = normalized.indexOf('\n', match.startIndex);
    const contentStart = headingLineEnd === -1
        ? normalized.length
        : headingLineEnd + 1;

    // Build the replacement
    const before = normalized.substring(0, contentStart);
    const after = normalized.substring(match.endIndex);

    // Ensure content has proper spacing
    const trimmedContent = newContent.replace(/\r\n/g, '\n').trim();
    const contentBlock = trimmedContent.length > 0
        ? '\n' + trimmedContent + '\n\n'
        : '\n\n';

    return before + contentBlock + after;
}
