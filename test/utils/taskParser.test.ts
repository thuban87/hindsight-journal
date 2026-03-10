import { describe, it, expect } from 'vitest';
import { parseTaskCompletion, computeProductivityScore } from '../../src/utils/taskParser';

describe('parseTaskCompletion', () => {
    it('counts completed and total checkboxes', () => {
        const sections: Record<string, string> = {
            Tasks: '- [x] Done task\n- [ ] Pending task\n- [x] Another done\n',
        };
        const result = parseTaskCompletion(sections, [], []);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ section: 'Tasks', completed: 2, total: 3 });
    });

    it('respects whitelist (only specified sections counted)', () => {
        const sections: Record<string, string> = {
            Tasks: '- [x] Done\n- [ ] Pending\n',
            Meds: '- [x] Morning pill\n- [ ] Evening pill\n',
            Notes: '- [ ] Some note\n',
        };
        const result = parseTaskCompletion(sections, ['Tasks'], []);
        expect(result).toHaveLength(1);
        expect(result[0].section).toBe('Tasks');
    });

    it('respects blacklist (excluded sections skipped)', () => {
        const sections: Record<string, string> = {
            Tasks: '- [x] Done\n- [ ] Pending\n',
            Meds: '- [x] Morning pill\n- [ ] Evening pill\n',
        };
        const result = parseTaskCompletion(sections, [], ['Meds']);
        expect(result).toHaveLength(1);
        expect(result[0].section).toBe('Tasks');
    });

    it('handles sections with no checkboxes (excluded from results)', () => {
        const sections: Record<string, string> = {
            Thoughts: 'Just some prose content.\nNo checkboxes here.',
            Tasks: '- [x] One task\n',
        };
        const result = parseTaskCompletion(sections, [], []);
        // Only Tasks should appear — Thoughts has no checkboxes
        expect(result).toHaveLength(1);
        expect(result[0].section).toBe('Tasks');
    });

    it('empty sections → empty results', () => {
        const result = parseTaskCompletion({}, [], []);
        expect(result).toEqual([]);
    });
});

describe('computeProductivityScore', () => {
    it('returns correct percentage', () => {
        const tasks = [
            { completed: 3, total: 5 },
            { completed: 2, total: 5 },
        ];
        // 5 completed out of 10 total = 50%
        expect(computeProductivityScore(tasks)).toBe(50);
    });

    it('returns null when no checkboxes exist', () => {
        expect(computeProductivityScore([])).toBeNull();
    });
});
