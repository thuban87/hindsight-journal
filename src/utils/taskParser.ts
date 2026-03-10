/**
 * Task Parser
 *
 * Parse markdown content for checkboxes within specified sections.
 * Used to compute tasksCompleted and tasksTotal during Pass 2 indexing,
 * and for the TaskVolatility dashboard component.
 *
 * Whitelist semantics: When productivitySections is empty ([]),
 * treat it as "all sections" (no whitelist filter).
 * excludedSections is always applied as a blacklist on top.
 */

/** Checkbox match pattern: matches both `- [ ]` and `- [x]` (case-insensitive) */
const CHECKBOX_REGEX = /^[ \t]*- \[([ xX])\]/gm;

/**
 * Parse markdown content for checkboxes within specified sections.
 * Returns { completed, total } for each section.
 * Respects productivitySections whitelist and excludedSections blacklist.
 *
 * @param sections - Parsed sections by heading name
 * @param productivitySections - Sections whose checkboxes count (empty = all)
 * @param excludedSections - Sections to exclude from counting
 * @returns Per-section task completion data
 */
export function parseTaskCompletion(
    sections: Record<string, string>,
    productivitySections: string[],
    excludedSections: string[]
): { section: string; completed: number; total: number }[] {
    const results: { section: string; completed: number; total: number }[] = [];
    const excludeSet = new Set(excludedSections.map(s => s.toLowerCase()));
    const whitelistSet = productivitySections.length > 0
        ? new Set(productivitySections.map(s => s.toLowerCase()))
        : null;

    for (const [heading, content] of Object.entries(sections)) {
        const headingLower = heading.toLowerCase();

        // Apply blacklist
        if (excludeSet.has(headingLower)) continue;

        // Apply whitelist (null = no whitelist = include all)
        if (whitelistSet && !whitelistSet.has(headingLower)) continue;

        let completed = 0;
        let total = 0;

        // Reset regex lastIndex for each section
        CHECKBOX_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = CHECKBOX_REGEX.exec(content)) !== null) {
            total++;
            if (match[1].toLowerCase() === 'x') {
                completed++;
            }
        }

        if (total > 0) {
            results.push({ section: heading, completed, total });
        }
    }

    return results;
}

/**
 * Compute overall productivity score from task completion data.
 * Returns 0-100 percentage, or null if no checkboxes found.
 *
 * @param tasks - Per-section task completion data
 * @returns Productivity score (0-100) or null
 */
export function computeProductivityScore(
    tasks: { completed: number; total: number }[]
): number | null {
    const totalCompleted = tasks.reduce((sum, t) => sum + t.completed, 0);
    const totalAll = tasks.reduce((sum, t) => sum + t.total, 0);

    if (totalAll === 0) return null;

    return Math.round((totalCompleted / totalAll) * 100);
}
