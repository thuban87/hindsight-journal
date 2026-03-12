/**
 * Section Utils Tests
 *
 * Tests for findSectionBoundaries() and replaceSectionContent().
 * Pure function tests — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { findSectionBoundaries, replaceSectionContent } from '../../src/utils/sectionUtils';

// ===== findSectionBoundaries =====

describe('findSectionBoundaries', () => {
    it('detects ## headings with correct boundaries', () => {
        const text = '## Heading One\nContent here\n\n## Heading Two\nMore content\n';
        const boundaries = findSectionBoundaries(text);

        expect(boundaries).toHaveLength(2);
        expect(boundaries[0].heading).toBe('Heading One');
        expect(boundaries[0].level).toBe(2);
        expect(boundaries[1].heading).toBe('Heading Two');
        expect(boundaries[1].level).toBe(2);
    });

    it('ignores headings inside code blocks', () => {
        const text = '## Real Heading\nContent\n\n```\n## Fake Heading\n```\n\n## Another Real\nMore\n';
        const boundaries = findSectionBoundaries(text);

        expect(boundaries).toHaveLength(2);
        expect(boundaries[0].heading).toBe('Real Heading');
        expect(boundaries[1].heading).toBe('Another Real');
    });

    it('tracks occurrence index for duplicate headings', () => {
        const text = '## Notes\nFirst\n\n## Notes\nSecond\n';
        const boundaries = findSectionBoundaries(text);

        expect(boundaries).toHaveLength(2);
        expect(boundaries[0].occurrenceIndex).toBe(0);
        expect(boundaries[1].occurrenceIndex).toBe(1);
    });
});

// ===== replaceSectionContent =====

describe('replaceSectionContent', () => {
    it('replaces content of existing section', () => {
        const text = '## Mood\nOld mood content\n\n## Notes\nOld notes\n';
        const result = replaceSectionContent(text, 'Mood', 'New mood content');

        expect(result).toContain('## Mood');
        expect(result).toContain('New mood content');
        expect(result).not.toContain('Old mood content');
    });

    it('preserves content before and after the section', () => {
        const text = '## Before\nBefore content\n\n## Target\nReplace me\n\n## After\nAfter content\n';
        const result = replaceSectionContent(text, 'Target', 'Replaced!');

        expect(result).toContain('## Before');
        expect(result).toContain('Before content');
        expect(result).toContain('Replaced!');
        expect(result).toContain('## After');
        expect(result).toContain('After content');
        expect(result).not.toContain('Replace me');
    });

    it('handles heading with emoji', () => {
        const text = '## 🗒️ What Happened\nSomething happened\n\n## Next\nNext content\n';
        const result = replaceSectionContent(text, '🗒️ What Happened', 'New stuff');

        expect(result).toContain('New stuff');
        expect(result).not.toContain('Something happened');
    });

    it('returns original text if heading not found', () => {
        const text = '## Existing\nContent here\n';
        const result = replaceSectionContent(text, 'NonExistent', 'Will not appear');

        expect(result).toBe(text);
    });

    it('handles empty section (heading immediately followed by another heading)', () => {
        const text = '## Empty\n## Next\nReal content\n';
        const result = replaceSectionContent(text, 'Empty', 'Now has content');

        expect(result).toContain('## Empty');
        expect(result).toContain('Now has content');
        expect(result).toContain('## Next');
        expect(result).toContain('Real content');
    });

    it('ignores headings inside code blocks', () => {
        // The code block contains ## Fake which should NOT be treated as a section boundary.
        // So ## Real's content extends all the way to ## After (past the code block).
        const text = '## Real\nOriginal\n\n```\n## Fake\nCode block heading\n```\n\nMore real content\n\n## After\nAfter content\n';
        const result = replaceSectionContent(text, 'Real', 'Replaced');

        expect(result).toContain('Replaced');
        expect(result).toContain('## After');
        expect(result).toContain('After content');
        // The code block was part of ## Real's content, so it's replaced
        expect(result).not.toContain('Original');
    });

    it('handles section at end of file (no next heading)', () => {
        const text = '## Only Section\nThis is the only section content\n';
        const result = replaceSectionContent(text, 'Only Section', 'Brand new content');

        expect(result).toContain('## Only Section');
        expect(result).toContain('Brand new content');
        expect(result).not.toContain('This is the only section content');
    });

    it('handles CRLF line endings correctly', () => {
        const text = '## Section\r\nOld content\r\n\r\n## Next\r\nMore\r\n';
        const result = replaceSectionContent(text, 'Section', 'New content');

        // Output should be LF-normalized
        expect(result).not.toContain('\r\n');
        expect(result).toContain('## Section');
        expect(result).toContain('New content');
        expect(result).toContain('## Next');
    });

    it('handles section with only whitespace content', () => {
        const text = '## Blank\n   \n  \n## Next\nContent\n';
        const result = replaceSectionContent(text, 'Blank', 'Now has real content');

        expect(result).toContain('Now has real content');
        expect(result).toContain('## Next');
        expect(result).toContain('Content');
    });

    it('handles nested headings (### inside ## section)', () => {
        const text = '## Parent\nParent content\n\n### Child\nChild content\n\n## Sibling\nSibling content\n';
        const result = replaceSectionContent(text, 'Parent', 'Replaced parent\n\n### Still a child\nNew child');

        expect(result).toContain('Replaced parent');
        expect(result).toContain('### Still a child');
        expect(result).toContain('## Sibling');
        expect(result).toContain('Sibling content');
        // The original ### Child should be gone (it was inside the replaced section)
        expect(result).not.toContain('Child content');
    });
});
