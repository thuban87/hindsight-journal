import { describe, it, expect } from 'vitest';
import {
    getTagFrequency,
    getTagCoOccurrence,
    getMetricAveragesByTag,
    getTagTimeline,
    getSectionWordCounts,
    getSectionInsights,
} from '../../src/services/ThreadsService';
import type { JournalEntry } from '../../src/types';

/** Helper to create a minimal JournalEntry for testing */
function makeEntry(
    overrides: Partial<JournalEntry> & { filePath: string; date: Date }
): JournalEntry {
    return {
        dayOfWeek: 'Monday',
        frontmatter: {},
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: Date.now(),
        fullyIndexed: true,
        qualityScore: 100,
        tasksCompleted: 0,
        tasksTotal: 0,
        ...overrides,
    };
}

// ---- getTagFrequency ----

describe('getTagFrequency', () => {
    it('correct counts, sorted by frequency', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: { tags: ['work', 'focus'] } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 0, 2), frontmatter: { tags: ['work', 'therapy'] } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 0, 3), frontmatter: { tags: ['work'] } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 0, 4), frontmatter: { tags: ['therapy'] } }),
        ];

        const result = getTagFrequency(entries);

        expect(result[0].tag).toBe('work');
        expect(result[0].count).toBe(3);
        expect(result[1].tag).toBe('therapy');
        expect(result[1].count).toBe(2);
        expect(result[2].tag).toBe('focus');
        expect(result[2].count).toBe(1);
    });

    it('handles entries with no tags', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: {} }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 0, 2), frontmatter: { tags: null } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 0, 3), frontmatter: { tags: 'not-an-array' } }),
        ];

        const result = getTagFrequency(entries);

        expect(result).toEqual([]);
    });

    it('percentage calculation correct', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: { tags: ['work'] } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 0, 2), frontmatter: { tags: ['work'] } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 0, 3), frontmatter: { tags: ['rest'] } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 0, 4), frontmatter: {} }),
        ];

        const result = getTagFrequency(entries);

        // work: 2/4 = 50%, rest: 1/4 = 25%
        expect(result.find(r => r.tag === 'work')!.percentage).toBe(50);
        expect(result.find(r => r.tag === 'rest')!.percentage).toBe(25);
    });
});

// ---- getTagCoOccurrence ----

describe('getTagCoOccurrence', () => {
    it('finds co-occurring tag pairs', () => {
        // Create entries where 'work' + 'focus' appear together 4 times
        const entries = Array.from({ length: 4 }, (_, i) =>
            makeEntry({
                filePath: `e${i}.md`,
                date: new Date(2026, 0, i + 1),
                frontmatter: { tags: ['work', 'focus'] },
            })
        );

        const result = getTagCoOccurrence(entries);

        expect(result.length).toBeGreaterThanOrEqual(1);
        const pair = result.find(
            r => (r.tagA === 'focus' && r.tagB === 'work') || (r.tagA === 'work' && r.tagB === 'focus')
        );
        expect(pair).toBeDefined();
        expect(pair!.count).toBe(4);
    });

    it('filters pairs below threshold (< 3)', () => {
        // 'work' + 'rare' co-occur only 2 times — should be excluded
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: { tags: ['work', 'rare'] } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 0, 2), frontmatter: { tags: ['work', 'rare'] } }),
        ];

        const result = getTagCoOccurrence(entries);

        expect(result).toEqual([]);
    });

    it('no duplicate pairs (A,B same as B,A)', () => {
        const entries = Array.from({ length: 5 }, (_, i) =>
            makeEntry({
                filePath: `e${i}.md`,
                date: new Date(2026, 0, i + 1),
                frontmatter: { tags: ['alpha', 'beta'] },
            })
        );

        const result = getTagCoOccurrence(entries);

        // Should only have one pair, not both (alpha,beta) and (beta,alpha)
        const pairs = result.filter(
            r => (r.tagA === 'alpha' && r.tagB === 'beta') || (r.tagA === 'beta' && r.tagB === 'alpha')
        );
        expect(pairs).toHaveLength(1);
    });
});

// ---- getMetricAveragesByTag ----

describe('getMetricAveragesByTag', () => {
    it('correct average per tag', () => {
        // 'therapy' tag with mood values: 7, 8, 6, 9, 5 → avg = 7.0
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: { tags: ['therapy'], mood: 7 } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 0, 2), frontmatter: { tags: ['therapy'], mood: 8 } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 0, 3), frontmatter: { tags: ['therapy'], mood: 6 } }),
            makeEntry({ filePath: 'd.md', date: new Date(2026, 0, 4), frontmatter: { tags: ['therapy'], mood: 9 } }),
            makeEntry({ filePath: 'e.md', date: new Date(2026, 0, 5), frontmatter: { tags: ['therapy'], mood: 5 } }),
        ];

        const result = getMetricAveragesByTag(entries, 'mood');

        expect(result).toHaveLength(1);
        expect(result[0].tag).toBe('therapy');
        expect(result[0].average).toBe(7);
        expect(result[0].count).toBe(5);
    });

    it('excludes tags with < 5 occurrences', () => {
        // 'rare' tag only appears 3 times — should be excluded
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: { tags: ['rare'], mood: 7 } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 0, 2), frontmatter: { tags: ['rare'], mood: 8 } }),
            makeEntry({ filePath: 'c.md', date: new Date(2026, 0, 3), frontmatter: { tags: ['rare'], mood: 6 } }),
        ];

        const result = getMetricAveragesByTag(entries, 'mood');

        expect(result).toEqual([]);
    });
});

// ---- getTagTimeline ----

describe('getTagTimeline', () => {
    it('returns entries with specific tag, sorted by date', () => {
        const entries = [
            makeEntry({ filePath: 'c.md', date: new Date(2026, 2, 1), frontmatter: { tags: ['therapy'] } }),
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: { tags: ['therapy'] } }),
            makeEntry({ filePath: 'x.md', date: new Date(2026, 1, 1), frontmatter: { tags: ['work'] } }),
            makeEntry({ filePath: 'b.md', date: new Date(2026, 1, 15), frontmatter: { tags: ['therapy', 'work'] } }),
        ];

        const result = getTagTimeline(entries, 'therapy');

        expect(result).toHaveLength(3);
        // Ascending date order
        expect(result[0].filePath).toBe('a.md');
        expect(result[1].filePath).toBe('b.md');
        expect(result[2].filePath).toBe('c.md');
        // 'work'-only entry excluded
        expect(result.map(e => e.filePath)).not.toContain('x.md');
    });
});

// ---- getSectionWordCounts ----

describe('getSectionWordCounts', () => {
    it('correct word count time series per section', () => {
        const entries = [
            makeEntry({
                filePath: 'a.md',
                date: new Date(2026, 0, 1),
                sectionWordCounts: { Dreams: 45, 'What Happened': 120 },
            }),
            makeEntry({
                filePath: 'b.md',
                date: new Date(2026, 0, 2),
                sectionWordCounts: { Dreams: 30, 'What Happened': 200 },
            }),
        ];

        const result = getSectionWordCounts(entries);

        const dreams = result.find(r => r.section === 'Dreams');
        expect(dreams).toBeDefined();
        expect(dreams!.data).toHaveLength(2);
        expect(dreams!.data[0].value).toBe(45);
        expect(dreams!.data[1].value).toBe(30);

        const happened = result.find(r => r.section === 'What Happened');
        expect(happened).toBeDefined();
        expect(happened!.data[0].value).toBe(120);
        expect(happened!.data[1].value).toBe(200);
    });

    it('handles entries with missing sections', () => {
        const entries = [
            makeEntry({ filePath: 'a.md', date: new Date(2026, 0, 1), frontmatter: {} }),
            makeEntry({
                filePath: 'b.md',
                date: new Date(2026, 0, 2),
                sectionWordCounts: { Dreams: 50 },
            }),
        ];

        // Dreams only has 1 data point — excluded (needs >= 2)
        const result = getSectionWordCounts(entries);

        expect(result).toEqual([]);
    });

    it('falls back to counting words in sections when sectionWordCounts missing', () => {
        const entries = [
            makeEntry({
                filePath: 'a.md',
                date: new Date(2026, 0, 1),
                sections: { Dreams: 'I dreamed about flying over mountains' },
            }),
            makeEntry({
                filePath: 'b.md',
                date: new Date(2026, 0, 2),
                sections: { Dreams: 'No dreams last night' },
            }),
        ];

        const result = getSectionWordCounts(entries);

        const dreams = result.find(r => r.section === 'Dreams');
        expect(dreams).toBeDefined();
        expect(dreams!.data[0].value).toBe(6); // "I dreamed about flying over mountains"
        expect(dreams!.data[1].value).toBe(4); // "No dreams last night"
    });
});

// ---- getSectionInsights ----

describe('getSectionInsights', () => {
    const refDate = new Date(2026, 2, 10); // March 10, 2026
    const day = 24 * 60 * 60 * 1000;

    it('detects growth (increasing word count trend)', () => {
        const entries: JournalEntry[] = [];

        // Prior period (15-44 days ago): low word counts
        for (let i = 15; i <= 44; i++) {
            entries.push(makeEntry({
                filePath: `prior-${i}.md`,
                date: new Date(refDate.getTime() - i * day),
                sectionWordCounts: { Dreams: 20 },
            }));
        }
        // Recent period (0-14 days ago): high word counts (>50% increase)
        for (let i = 0; i <= 13; i++) {
            entries.push(makeEntry({
                filePath: `recent-${i}.md`,
                date: new Date(refDate.getTime() - i * day),
                sectionWordCounts: { Dreams: 60 },
            }));
        }

        const result = getSectionInsights(entries, refDate);

        const growth = result.find(r => r.section === 'Dreams' && r.type === 'growth');
        expect(growth).toBeDefined();
        expect(growth!.insight).toContain('writing more');
    });

    it('detects decline (decreasing word count trend)', () => {
        const entries: JournalEntry[] = [];

        // Prior period: high word counts
        for (let i = 15; i <= 44; i++) {
            entries.push(makeEntry({
                filePath: `prior-${i}.md`,
                date: new Date(refDate.getTime() - i * day),
                sectionWordCounts: { Gratitude: 100 },
            }));
        }
        // Recent period: low word counts (>50% decrease)
        for (let i = 0; i <= 13; i++) {
            entries.push(makeEntry({
                filePath: `recent-${i}.md`,
                date: new Date(refDate.getTime() - i * day),
                sectionWordCounts: { Gratitude: 30 },
            }));
        }

        const result = getSectionInsights(entries, refDate);

        const decline = result.find(r => r.section === 'Gratitude' && r.type === 'decline');
        expect(decline).toBeDefined();
        expect(decline!.insight).toContain('less writing');
    });

    it('detects inactive (no content in 3+ weeks)', () => {
        // Section last seen 28 days ago
        const entries = [
            makeEntry({
                filePath: 'old.md',
                date: new Date(refDate.getTime() - 28 * day),
                sectionWordCounts: { Scratchpad: 50 },
            }),
        ];

        const result = getSectionInsights(entries, refDate);

        const inactive = result.find(r => r.section === 'Scratchpad' && r.type === 'inactive');
        expect(inactive).toBeDefined();
        expect(inactive!.insight).toContain('hasn\'t been used');
        expect(inactive!.insight).toContain('4 week'); // 28 days = 4 weeks
    });
});
