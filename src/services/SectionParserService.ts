/**
 * Section Parser Service
 *
 * Pure functions — no Obsidian API dependency, fully testable.
 * Parses markdown content into structured sections for journal entries.
 */

/**
 * Parse markdown content into sections keyed by heading text.
 * Processes ## (h2) headings as top-level sections.
 * ### (h3) headings are included in their parent ## section's content.
 * Headings inside code blocks (``` ... ```) are ignored.
 */
export function parseSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');

    let currentHeading: string | null = null;
    let currentContent: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
        // Track code block boundaries
        if (line.trimStart().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        // Only process headings outside code blocks
        if (!inCodeBlock && line.match(/^## (?!#)/)) {
            // Save previous section if any
            if (currentHeading !== null) {
                sections[currentHeading] = currentContent.join('\n').trim();
            }

            // Start new section — strip the ## prefix
            currentHeading = line.replace(/^## /, '').trim();
            currentContent = [];
        } else if (currentHeading !== null) {
            currentContent.push(line);
        }
    }

    // Save the last section
    if (currentHeading !== null) {
        sections[currentHeading] = currentContent.join('\n').trim();
    }

    return sections;
}

/**
 * Extract a single section by heading name.
 * Returns null if the heading doesn't exist.
 */
export function extractSection(content: string, heading: string): string | null {
    const sections = parseSections(content);
    return sections[heading] ?? null;
}

/**
 * Extract all image embed paths from markdown content.
 * Supports:
 *   - ![[image.png]]                     (wikilink embed)
 *   - ![[image.jpg|500]]                 (wikilink with size)
 *   - ![alt](path/image.jpg)            (standard markdown embed)
 *   - [![alt](path/image.jpg)](link)    (linked image — image inside a link)
 * URL-encoded paths (e.g. %20 for spaces) are decoded before returning.
 * Returns vault-relative paths.
 */
export function extractImagePaths(content: string): string[] {
    const paths: string[] = [];
    const imgExtPattern = '(?:\\.png|\\.jpg|\\.jpeg|\\.gif|\\.bmp|\\.svg|\\.webp|\\.avif)';

    // Wikilink embeds: ![[image.png]], ![[folder/image.png]], ![[image.jpg|500]]
    // The optional (?:\|[^\]]*)? handles Obsidian's size/display parameter syntax
    const wikiRegex = new RegExp('!\\[\\[([^\\]|]+?' + imgExtPattern + ')(?:\\|[^\\]]*)?\\]\\]', 'gi');
    let match: RegExpExecArray | null;
    while ((match = wikiRegex.exec(content)) !== null) {
        paths.push(match[1]);
    }

    // Standard markdown embeds: ![alt](path.png)
    // Also catches linked images [![alt](path.jpg)](url) — the inner ![alt](path) part
    const mdRegex = new RegExp('!\\[[^\\]]*\\]\\(([^)]+?' + imgExtPattern + ')\\)', 'gi');
    while ((match = mdRegex.exec(content)) !== null) {
        // URL-decode paths — plugins like obsidian-google-photos encode spaces as %20
        try {
            paths.push(decodeURIComponent(match[1]));
        } catch {
            // If decoding fails (malformed URI), use the raw path
            paths.push(match[1]);
        }
    }

    return paths;
}

/**
 * Count words in text content (strips markdown syntax first).
 */
export function countWords(text: string): number {
    const cleaned = stripMarkdown(text);
    if (cleaned.length === 0) return 0;
    // Split on whitespace and filter empty strings
    return cleaned.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Strip markdown syntax AND HTML tags to produce clean plain text.
 * Removes: [[links]], [text](urls), **bold**, *italic*, # headings,
 * - [ ] checkboxes, > blockquotes, ``` code blocks ```,
 * and all HTML tags (<script>, <img>, <div>, etc.).
 * HTML stripping is defense-in-depth — Obsidian notes can contain raw HTML,
 * and while React JSX escapes by default, stripping here ensures
 * excerpts are always safe plain text regardless of rendering context.
 */
export function stripMarkdown(text: string): string {
    let result = text;

    // Remove code blocks (``` ... ```)
    result = result.replace(/```[\s\S]*?```/g, '');

    // Remove inline code (`...`)
    result = result.replace(/`[^`]*`/g, '');

    // Remove HTML tags
    result = result.replace(/<[^>]+>/g, '');

    // Remove image embeds ![[...]] and ![alt](url)
    result = result.replace(/!\[\[[^\]]*\]\]/g, '');
    result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

    // Remove wikilinks [[link|display]] → display, [[link]] → link
    result = result.replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2');

    // Remove markdown links [text](url) → text
    result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Remove headings (# ... ######)
    result = result.replace(/^#{1,6}\s+/gm, '');

    // Remove bold/italic markers
    result = result.replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1');
    result = result.replace(/_{1,3}([^_]*)_{1,3}/g, '$1');

    // Remove strikethrough
    result = result.replace(/~~([^~]*)~~/g, '$1');

    // Remove blockquotes
    result = result.replace(/^>\s?/gm, '');

    // Remove checkbox markers
    result = result.replace(/- \[[ xX]\]\s?/g, '');

    // Remove unordered list markers
    result = result.replace(/^[\s]*[-*+]\s+/gm, '');

    // Remove horizontal rules
    result = result.replace(/^---+$/gm, '');

    // Collapse multiple newlines and trim
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    return result;
}
