/**
 * TrendAlertEngine Tests
 *
 * Tests for trend alert heuristics:
 * detectConsecutiveChange, detectAnomaly, detectFieldGap, patternRecall,
 * generateAlerts, and getPolarityColor.
 */

import { describe, it, expect } from 'vitest';
import {
    detectConsecutiveChange,
    detectAnomaly,
    detectFieldGap,
    patternRecall,
    generateAlerts,
} from '../../src/services/TrendAlertEngine';
import { getPolarityColor } from '../../src/utils/statsUtils';
import type { JournalEntry, FrontmatterField } from '../../src/types';

/** Helper to create a minimal JournalEntry */
function makeEntry(dateStr: string, frontmatter: Record<string, unknown> = {}): JournalEntry {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        filePath: `Journal/${dateStr}.md`,
        date: d,
        dayOfWeek: 'Monday',
        frontmatter,
        sections: {},
        wordCount: 0,
        imagePaths: [],
        mtime: d.getTime(),
        fullyIndexed: true,
        qualityScore: 100,
    };
}

describe('detectConsecutiveChange', () => {
    it('generates alert for 3-day decrease', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 8 }),
            makeEntry('2026-03-02', { mood: 7 }),
            makeEntry('2026-03-03', { mood: 6 }),
            makeEntry('2026-03-04', { mood: 5 }),
        ];
        const alert = detectConsecutiveChange(entries, 'mood', 'neutral');
        expect(alert).not.toBeNull();
        expect(alert!.title).toContain('decreased');
        expect(alert!.title).toContain('3');
    });

    it('returns no alert for only 2-day decrease (below threshold)', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 8 }),
            makeEntry('2026-03-02', { mood: 7 }),
            makeEntry('2026-03-03', { mood: 6 }),
        ];
        const alert = detectConsecutiveChange(entries, 'mood', 'neutral');
        expect(alert).toBeNull();
    });

    it('returns warning severity for higher-is-better + decrease', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 8 }),
            makeEntry('2026-03-02', { mood: 7 }),
            makeEntry('2026-03-03', { mood: 6 }),
            makeEntry('2026-03-04', { mood: 5 }),
        ];
        const alert = detectConsecutiveChange(entries, 'mood', 'higher-is-better');
        expect(alert).not.toBeNull();
        expect(alert!.severity).toBe('warning');
    });

    it('returns positive severity for lower-is-better + decrease', () => {
        const entries = [
            makeEntry('2026-03-01', { anxiety: 8 }),
            makeEntry('2026-03-02', { anxiety: 7 }),
            makeEntry('2026-03-03', { anxiety: 6 }),
            makeEntry('2026-03-04', { anxiety: 5 }),
        ];
        const alert = detectConsecutiveChange(entries, 'anxiety', 'lower-is-better');
        expect(alert).not.toBeNull();
        expect(alert!.severity).toBe('positive');
    });

    it('returns info severity for neutral polarity', () => {
        const entries = [
            makeEntry('2026-03-01', { mood: 8 }),
            makeEntry('2026-03-02', { mood: 7 }),
            makeEntry('2026-03-03', { mood: 6 }),
            makeEntry('2026-03-04', { mood: 5 }),
        ];
        const alert = detectConsecutiveChange(entries, 'mood', 'neutral');
        expect(alert).not.toBeNull();
        expect(alert!.severity).toBe('info');
    });
});

describe('detectAnomaly', () => {
    it('generates alert when value is 2+ std devs below mean', () => {
        const entries: JournalEntry[] = [];
        // 10 days of consistent mood ~7 with slight variance (use explicit Date constructor)
        for (let i = 1; i <= 10; i++) {
            entries.push(makeEntry(
                `2026-01-${String(i).padStart(2, '0')}`,
                { mood: i % 2 === 0 ? 7.5 : 6.5 }
            ));
        }
        // Today (Jan 15): anomalously low — 2 is far below mean of 7 with stdDev ≈ 0
        const todayDate = new Date(2026, 0, 15);
        const todayEntry = makeEntry('2026-01-15', { mood: 2 });
        entries.push(todayEntry);

        const alert = detectAnomaly(entries, 'mood', todayDate);
        expect(alert).not.toBeNull();
        expect(alert!.title).toContain('unusually');
        expect(alert!.severity).toBe('info');
    });

    it('returns no alert for normal value', () => {
        const entries: JournalEntry[] = [];
        for (let i = 1; i <= 10; i++) {
            entries.push(makeEntry(
                `2026-01-${String(i).padStart(2, '0')}`,
                { mood: 7 }
            ));
        }
        // Today: within normal range
        const todayDate = new Date(2026, 0, 15);
        entries.push(makeEntry('2026-01-15', { mood: 7 }));

        const alert = detectAnomaly(entries, 'mood', todayDate);
        expect(alert).toBeNull();
    });
});

describe('detectFieldGap', () => {
    it('generates alert for 5+ days missing in high-coverage field', () => {
        const entries = [
            makeEntry('2026-02-20', { mood: 7 }),
            // 10+ days gap — no mood entries until reference date
        ];
        const referenceDate = new Date('2026-03-05');
        const alert = detectFieldGap(entries, 'mood', 0.8, referenceDate);
        expect(alert).not.toBeNull();
        expect(alert!.title).toContain("haven't logged");
    });

    it('returns no alert for low-coverage field (<50%)', () => {
        const entries = [
            makeEntry('2026-02-20', { mood: 7 }),
        ];
        const referenceDate = new Date('2026-03-05');
        const alert = detectFieldGap(entries, 'mood', 0.3, referenceDate);
        expect(alert).toBeNull();
    });
});

describe('patternRecall', () => {
    it('finds previous matching pattern and reports recovery', () => {
        const entries: JournalEntry[] = [];
        // Historical data: a past decrease streak followed by recovery
        // Days 1-5: decrease (10, 8, 6, 4, 2)
        for (let i = 0; i < 5; i++) {
            entries.push(makeEntry(
                `2025-06-${String(i + 1).padStart(2, '0')}`,
                { mood: 10 - i * 2 }
            ));
        }
        // Days 6-10: recovery (5, 6, 7, 8, 9)
        for (let i = 0; i < 5; i++) {
            entries.push(makeEntry(
                `2025-06-${String(i + 6).padStart(2, '0')}`,
                { mood: 5 + i }
            ));
        }
        // Filler to ensure enough entries
        for (let i = 11; i <= 20; i++) {
            entries.push(makeEntry(
                `2025-06-${String(i).padStart(2, '0')}`,
                { mood: 7 }
            ));
        }

        // Current period: a 3-day decrease streak
        entries.push(makeEntry('2026-03-01', { mood: 9 }));
        entries.push(makeEntry('2026-03-02', { mood: 7 }));
        entries.push(makeEntry('2026-03-03', { mood: 5 }));
        entries.push(makeEntry('2026-03-04', { mood: 3 }));

        const alert = patternRecall(entries, 'mood', 3, new Date('2026-03-04'));
        expect(alert).not.toBeNull();
        expect(alert!.title).toContain('Similar');
        expect(alert!.body).toContain('averaged');
    });

    it('returns null when no matching pattern exists', () => {
        const entries: JournalEntry[] = [];
        // Only flat data — no decrease patterns
        for (let i = 1; i <= 20; i++) {
            entries.push(makeEntry(
                `2026-02-${String(i).padStart(2, '0')}`,
                { mood: 7 }
            ));
        }

        const alert = patternRecall(entries, 'mood', 3, new Date('2026-03-01'));
        expect(alert).toBeNull();
    });
});

describe('generateAlerts', () => {
    it('combines all heuristics and caps at MAX_ALERTS', () => {
        const entries: JournalEntry[] = [];
        // Create enough data for multiple alerts across multiple fields
        for (let i = 1; i <= 30; i++) {
            entries.push(makeEntry(
                `2026-02-${String(i).padStart(2, '0')}`,
                { mood: 7, energy: 6, sleep: 7 }
            ));
        }
        // Today with low values
        entries.push(makeEntry('2026-03-01', { mood: 2, energy: 1, sleep: 2 }));

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 31, total: 31, range: { min: 1, max: 10 } },
            { key: 'energy', type: 'number', coverage: 31, total: 31, range: { min: 1, max: 10 } },
            { key: 'sleep', type: 'number', coverage: 31, total: 31, range: { min: 1, max: 10 } },
        ];

        const alerts = generateAlerts(entries, fields, {}, new Date('2026-03-01'));
        // Should return at most MAX_ALERTS (5)
        expect(alerts.length).toBeLessThanOrEqual(5);
    });

    it('sorts alerts by severity (warnings first)', () => {
        const entries: JournalEntry[] = [];
        // Create a 3-day decrease for mood (will be warning with higher-is-better)
        entries.push(makeEntry('2026-03-01', { mood: 8, anxiety: 5 }));
        entries.push(makeEntry('2026-03-02', { mood: 7, anxiety: 6 }));
        entries.push(makeEntry('2026-03-03', { mood: 6, anxiety: 7 }));
        entries.push(makeEntry('2026-03-04', { mood: 5, anxiety: 8 }));

        const fields: FrontmatterField[] = [
            { key: 'mood', type: 'number', coverage: 4, total: 4, range: { min: 1, max: 10 } },
            { key: 'anxiety', type: 'number', coverage: 4, total: 4, range: { min: 1, max: 10 } },
        ];

        const polarity = {
            mood: 'higher-is-better' as const,
            anxiety: 'lower-is-better' as const,
        };

        const alerts = generateAlerts(entries, fields, polarity, new Date('2026-03-04'));
        if (alerts.length >= 2) {
            // Warning should come before info and positive
            const severityOrder = { warning: 0, info: 1, positive: 2 };
            for (let i = 1; i < alerts.length; i++) {
                expect(severityOrder[alerts[i].severity])
                    .toBeGreaterThanOrEqual(severityOrder[alerts[i - 1].severity]);
            }
        }
    });
});

describe('getPolarityColor', () => {
    it('returns green for higher-is-better + high value', () => {
        const color = getPolarityColor(10, 1, 10, 'higher-is-better');
        expect(color).toContain('hsl(120'); // hue 120 = green
    });

    it('returns red for lower-is-better + high value', () => {
        const color = getPolarityColor(10, 1, 10, 'lower-is-better');
        expect(color).toContain('hsl(0'); // hue 0 = red
    });

    it('returns blue for neutral polarity regardless of value', () => {
        const colorHigh = getPolarityColor(10, 1, 10, 'neutral');
        const colorLow = getPolarityColor(1, 1, 10, 'neutral');
        expect(colorHigh).toContain('hsl(210'); // consistent blue
        expect(colorLow).toContain('hsl(210');
    });
});
