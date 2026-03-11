/**
 * Threads Service
 *
 * Stateless pure functions for tag analytics and section word count trends.
 * No caching, no state — call these from React components and memoize at the component level.
 *
 * PERFORMANCE:
 * - getTagFrequency: O(n × avgTags) — fast, no yielding needed
 * - getTagCoOccurrence: O(n × C(limit,2)) — capped at C(15,2) = 105 pairs × n
 * - getMetricAveragesByTag: O(n × avgTags)
 * - getTagTimeline: O(n) — simple filter
 * - getSectionWordCounts: O(n × sections) — uses pre-computed sectionWordCounts for cold tier
 * - getSectionInsights: O(sections × recentEntries)
 */

import type { JournalEntry, MetricDataPoint } from '../types';
import { getNumericValue } from './FrontmatterService';

/** Tag frequency result */
export interface TagFrequencyResult {
    tag: string;
    count: number;
    percentage: number;
}

/** Tag co-occurrence pair */
export interface TagCoOccurrenceResult {
    tagA: string;
    tagB: string;
    count: number;
}

/** Metric average per tag */
export interface MetricAverageByTag {
    tag: string;
    average: number;
    count: number;
}

/** Section insight */
export interface SectionInsight {
    section: string;
    insight: string;
    type: 'growth' | 'decline' | 'inactive';
}

/**
 * Compute tag frequency: how often each tag appears across all entries.
 * Source: frontmatter `tags` field (string[]).
 * Returns sorted by frequency (most common first).
 */
export function getTagFrequency(entries: JournalEntry[]): TagFrequencyResult[] {
    const tagCounts = new Map<string, number>();

    for (const entry of entries) {
        const tags = entry.frontmatter.tags;
        if (!Array.isArray(tags)) continue;

        for (const tag of tags) {
            if (typeof tag !== 'string' || tag.trim() === '') continue;
            const normalized = tag.trim().toLowerCase();
            tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
        }
    }

    const totalEntries = entries.length;
    const results: TagFrequencyResult[] = [];

    for (const [tag, count] of tagCounts) {
        results.push({
            tag,
            count,
            percentage: totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0,
        });
    }

    // Sort descending by count
    results.sort((a, b) => b.count - a.count);

    return results;
}

/**
 * Compute tag co-occurrence matrix: which tags appear together most often.
 * Returns pairs of tags with their co-occurrence count.
 * Filtered to pairs that co-occur at least 3 times.
 *
 * PERFORMANCE: First computes getTagFrequency() and takes the top `limit`
 * tags (default 15). Then computes co-occurrence only for those tags.
 * This caps the pair computation at C(15,2) = 105 pairs × N entries.
 */
export function getTagCoOccurrence(
    entries: JournalEntry[],
    limit = 15,
): TagCoOccurrenceResult[] {
    // Get top tags by frequency
    const topTags = getTagFrequency(entries)
        .slice(0, limit)
        .map(t => t.tag);

    const topTagSet = new Set(topTags);

    // Build co-occurrence counts
    const pairCounts = new Map<string, number>();

    for (const entry of entries) {
        const tags = entry.frontmatter.tags;
        if (!Array.isArray(tags)) continue;

        // Filter to only top tags present in this entry
        const entryTopTags = tags
            .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
            .map(t => t.trim().toLowerCase())
            .filter(t => topTagSet.has(t));

        // Deduplicate tags within single entry
        const uniqueTags = [...new Set(entryTopTags)];

        // Count all pairs
        for (let i = 0; i < uniqueTags.length; i++) {
            for (let j = i + 1; j < uniqueTags.length; j++) {
                // Canonical order: alphabetical to avoid (A,B) vs (B,A) dupes
                const [first, second] = uniqueTags[i] < uniqueTags[j]
                    ? [uniqueTags[i], uniqueTags[j]]
                    : [uniqueTags[j], uniqueTags[i]];

                const key = `${first}|||${second}`;
                pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
            }
        }
    }

    // Filter to pairs with >= 3 co-occurrences and build results
    const results: TagCoOccurrenceResult[] = [];

    for (const [key, count] of pairCounts) {
        if (count < 3) continue;
        const [tagA, tagB] = key.split('|||');
        results.push({ tagA, tagB, count });
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count);

    return results;
}

/**
 * Compute average metric values per tag.
 * E.g., average mood on days tagged "therapy" vs days tagged "work".
 * Only includes tags with >= 5 occurrences for meaningful averages.
 */
export function getMetricAveragesByTag(
    entries: JournalEntry[],
    metricField: string,
): MetricAverageByTag[] {
    const tagSums = new Map<string, { sum: number; count: number }>();

    for (const entry of entries) {
        const tags = entry.frontmatter.tags;
        if (!Array.isArray(tags)) continue;

        const value = getNumericValue(entry.frontmatter[metricField]);
        if (value === null) continue;

        for (const tag of tags) {
            if (typeof tag !== 'string' || tag.trim() === '') continue;
            const normalized = tag.trim().toLowerCase();
            const existing = tagSums.get(normalized) ?? { sum: 0, count: 0 };
            existing.sum += value;
            existing.count += 1;
            tagSums.set(normalized, existing);
        }
    }

    const results: MetricAverageByTag[] = [];

    for (const [tag, { sum, count }] of tagSums) {
        if (count < 5) continue;
        results.push({
            tag,
            average: Math.round((sum / count) * 100) / 100,
            count,
        });
    }

    // Sort by average descending
    results.sort((a, b) => b.average - a.average);

    return results;
}

/**
 * Get tag timeline: for a specific tag, return all entries containing it, sorted by date.
 */
export function getTagTimeline(
    entries: JournalEntry[],
    tag: string,
): JournalEntry[] {
    const normalizedTag = tag.trim().toLowerCase();

    return entries
        .filter(entry => {
            const tags = entry.frontmatter.tags;
            if (!Array.isArray(tags)) return false;
            return tags.some(
                t => typeof t === 'string' && t.trim().toLowerCase() === normalizedTag
            );
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Compute section word count trends.
 * For each detected section heading, returns a time series of word counts.
 *
 * Cold tier awareness: For entries beyond HOT_TIER_DAYS, reads from
 * `entry.sectionWordCounts` (pre-computed during Pass 2) instead of
 * calling `ensureSectionsLoaded()`. This avoids O(N) I/O for historical
 * word count trends.
 */
export function getSectionWordCounts(
    entries: JournalEntry[],
): { section: string; data: MetricDataPoint[] }[] {
    // Collect all section headings and their word count data points
    const sectionData = new Map<string, MetricDataPoint[]>();

    // Sort entries by date for chronological data
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const entry of sorted) {
        const dateMs = entry.date.getTime();

        // Use sectionWordCounts if available (works for both hot and cold tier)
        if (entry.sectionWordCounts) {
            for (const [section, wordCount] of Object.entries(entry.sectionWordCounts)) {
                if (!sectionData.has(section)) {
                    sectionData.set(section, []);
                }
                sectionData.get(section)!.push({ date: dateMs, value: wordCount });
            }
        } else if (entry.sections && Object.keys(entry.sections).length > 0) {
            // Fallback: compute word count from loaded sections
            for (const [section, content] of Object.entries(entry.sections)) {
                if (!sectionData.has(section)) {
                    sectionData.set(section, []);
                }
                const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;
                sectionData.get(section)!.push({ date: dateMs, value: wordCount });
            }
        }
    }

    const results: { section: string; data: MetricDataPoint[] }[] = [];

    for (const [section, data] of sectionData) {
        if (data.length >= 2) {
            results.push({ section, data });
        }
    }

    // Sort sections alphabetically for consistent display
    results.sort((a, b) => a.section.localeCompare(b.section));

    return results;
}

/**
 * Detect section usage insights.
 * E.g., "You've been writing more in Dreams lately" or "Scratchpad hasn't been used in 3 weeks".
 *
 * Compares the average word count in the last 14 days vs the prior 30 days.
 * Growth: >50% increase. Decline: >50% decrease. Inactive: no content in 21+ days.
 */
export function getSectionInsights(
    entries: JournalEntry[],
    referenceDate: Date,
): SectionInsight[] {
    const now = referenceDate.getTime();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const fortyFourDaysAgo = now - 44 * 24 * 60 * 60 * 1000; // 14 + 30 for the prior period
    const twentyOneDaysAgo = now - 21 * 24 * 60 * 60 * 1000;

    // Collect word counts per section for recent and prior periods
    const sectionRecent = new Map<string, number[]>();
    const sectionPrior = new Map<string, number[]>();
    const sectionLastSeen = new Map<string, number>();

    for (const entry of entries) {
        const dateMs = entry.date.getTime();

        // Get section word counts from either source
        const wordCounts = entry.sectionWordCounts ??
            (entry.sections
                ? Object.fromEntries(
                    Object.entries(entry.sections).map(([k, v]) => [
                        k,
                        v.trim().split(/\s+/).filter(w => w.length > 0).length,
                    ])
                )
                : {});

        for (const [section, wc] of Object.entries(wordCounts)) {
            if (wc === 0) continue;

            // Track last seen date
            const prevLastSeen = sectionLastSeen.get(section) ?? 0;
            if (dateMs > prevLastSeen) {
                sectionLastSeen.set(section, dateMs);
            }

            if (dateMs >= fourteenDaysAgo && dateMs <= now) {
                if (!sectionRecent.has(section)) sectionRecent.set(section, []);
                sectionRecent.get(section)!.push(wc);
            } else if (dateMs >= fortyFourDaysAgo && dateMs < fourteenDaysAgo) {
                if (!sectionPrior.has(section)) sectionPrior.set(section, []);
                sectionPrior.get(section)!.push(wc);
            }
        }
    }

    const insights: SectionInsight[] = [];

    // Collect all section names from both periods
    const allSections = new Set([
        ...sectionRecent.keys(),
        ...sectionPrior.keys(),
        ...sectionLastSeen.keys(),
    ]);

    for (const section of allSections) {
        const lastSeen = sectionLastSeen.get(section) ?? 0;

        // Check inactive first
        if (lastSeen < twentyOneDaysAgo && lastSeen > 0) {
            const weeksAgo = Math.floor((now - lastSeen) / (7 * 24 * 60 * 60 * 1000));
            insights.push({
                section,
                insight: `${section} hasn't been used in ${weeksAgo} week${weeksAgo !== 1 ? 's' : ''}`,
                type: 'inactive',
            });
            continue;
        }

        // Compare recent vs prior word counts
        const recentValues = sectionRecent.get(section) ?? [];
        const priorValues = sectionPrior.get(section) ?? [];

        if (recentValues.length === 0 || priorValues.length === 0) continue;

        const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
        const priorAvg = priorValues.reduce((a, b) => a + b, 0) / priorValues.length;

        if (priorAvg === 0) continue;

        const changePercent = ((recentAvg - priorAvg) / priorAvg) * 100;

        if (changePercent > 50) {
            insights.push({
                section,
                insight: `You've been writing more in ${section} lately (avg ${Math.round(recentAvg)} words/day up from ${Math.round(priorAvg)})`,
                type: 'growth',
            });
        } else if (changePercent < -50) {
            insights.push({
                section,
                insight: `${section} has less writing recently (avg ${Math.round(recentAvg)} words/day down from ${Math.round(priorAvg)})`,
                type: 'decline',
            });
        }
    }

    return insights;
}
