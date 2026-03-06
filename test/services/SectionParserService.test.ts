import { describe, it, expect } from 'vitest';
import {
    parseSections,
    extractSection,
    extractImagePaths,
    countWords,
    stripMarkdown,
} from '../../src/services/SectionParserService';

const DAILY_NOTE = `---
date: "2026-03-05"
mood: 7
---

# Daily Note

## Morning Routine
Woke up at 6:30am. Made coffee.
Did some stretching.

### Exercise
30 minutes of yoga.

## 💤 Dreams
Had a vivid dream about flying.

## Work
Worked on the plugin project.
Fixed several bugs.

## Evening
Read a book before bed.
`;

describe('parseSections', () => {
    it('parses well-formed daily note with all headings', () => {
        const sections = parseSections(DAILY_NOTE);
        expect(sections['Morning Routine']).toBeDefined();
        expect(sections['💤 Dreams']).toBeDefined();
        expect(sections['Work']).toBeDefined();
        expect(sections['Evening']).toBeDefined();
    });

    it('includes content under each heading', () => {
        const sections = parseSections(DAILY_NOTE);
        expect(sections['Morning Routine']).toContain('Woke up at 6:30am');
        expect(sections['Work']).toContain('Fixed several bugs');
    });

    it('includes ### headings in parent ## section content', () => {
        const sections = parseSections(DAILY_NOTE);
        expect(sections['Morning Routine']).toContain('### Exercise');
        expect(sections['Morning Routine']).toContain('30 minutes of yoga');
    });

    it('handles missing sections gracefully', () => {
        const content = '## Only Section\nSome content here.';
        const sections = parseSections(content);
        expect(Object.keys(sections)).toHaveLength(1);
        expect(sections['Only Section']).toBe('Some content here.');
    });

    it('handles empty sections (heading with no content below)', () => {
        const content = '## Empty Section\n## Next Section\nHas content.';
        const sections = parseSections(content);
        expect(sections['Empty Section']).toBe('');
        expect(sections['Next Section']).toBe('Has content.');
    });

    it('ignores headings inside code blocks', () => {
        const content = '## Real Section\nContent here.\n```\n## Fake Heading\n```\n## Another Real\nMore content.';
        const sections = parseSections(content);
        expect(sections['Real Section']).toContain('## Fake Heading');
        expect(sections['Fake Heading']).toBeUndefined();
        expect(sections['Another Real']).toBe('More content.');
    });

    it('does not capture # h1 headings as sections', () => {
        const content = '# Title\n## Section\nContent.';
        const sections = parseSections(content);
        expect(sections['Title']).toBeUndefined();
        expect(sections['Section']).toBe('Content.');
    });

    it('returns empty object for content with no ## headings', () => {
        const content = 'Just some text without any headings.';
        const sections = parseSections(content);
        expect(Object.keys(sections)).toHaveLength(0);
    });
});

describe('extractSection', () => {
    it('returns content for existing heading', () => {
        const result = extractSection(DAILY_NOTE, 'Work');
        expect(result).toContain('Worked on the plugin project');
    });

    it('returns null for missing heading', () => {
        const result = extractSection(DAILY_NOTE, 'Nonexistent');
        expect(result).toBeNull();
    });

    it('works with emoji headings', () => {
        const result = extractSection(DAILY_NOTE, '💤 Dreams');
        expect(result).toContain('vivid dream about flying');
    });
});

describe('extractImagePaths', () => {
    it('extracts wikilink image embeds', () => {
        const content = 'Some text\n![[photo.png]]\nMore text';
        const paths = extractImagePaths(content);
        expect(paths).toContain('photo.png');
    });

    it('extracts standard markdown image embeds', () => {
        const content = 'Some text\n![alt text](path/to/image.png)\nMore text';
        const paths = extractImagePaths(content);
        expect(paths).toContain('path/to/image.png');
    });

    it('extracts mixed syntax in same document', () => {
        const content = '![[wiki.jpg]]\n![alt](standard.png)';
        const paths = extractImagePaths(content);
        expect(paths).toHaveLength(2);
        expect(paths).toContain('wiki.jpg');
        expect(paths).toContain('standard.png');
    });

    it('returns empty array when no images', () => {
        const content = 'Just text, no images here.';
        const paths = extractImagePaths(content);
        expect(paths).toHaveLength(0);
    });

    it('handles images in subdirectories', () => {
        const content = '![[attachments/2026/photo.png]]';
        const paths = extractImagePaths(content);
        expect(paths).toContain('attachments/2026/photo.png');
    });

    it('handles multiple image formats', () => {
        const content = '![[a.jpg]]\n![[b.gif]]\n![[c.webp]]\n![[d.svg]]';
        const paths = extractImagePaths(content);
        expect(paths).toHaveLength(4);
    });
});

describe('countWords', () => {
    it('counts words in normal text', () => {
        expect(countWords('hello world foo bar')).toBe(4);
    });

    it('counts words in text with markdown syntax', () => {
        expect(countWords('**bold** and *italic* text')).toBe(4);
    });

    it('returns 0 for empty string', () => {
        expect(countWords('')).toBe(0);
    });

    it('returns 0 for only whitespace', () => {
        expect(countWords('   \n\n  ')).toBe(0);
    });
});

describe('stripMarkdown', () => {
    it('strips bold markers', () => {
        expect(stripMarkdown('**bold**')).toBe('bold');
    });

    it('strips italic markers', () => {
        expect(stripMarkdown('*italic*')).toBe('italic');
    });

    it('strips wikilinks keeping text', () => {
        expect(stripMarkdown('[[Some Page]]')).toBe('Some Page');
    });

    it('strips wikilinks with display text', () => {
        expect(stripMarkdown('[[Some Page|display]]')).toBe('display');
    });

    it('strips markdown links keeping text', () => {
        expect(stripMarkdown('[link text](https://example.com)')).toBe('link text');
    });

    it('strips heading markers', () => {
        expect(stripMarkdown('## Heading')).toBe('Heading');
    });

    it('strips HTML tags', () => {
        expect(stripMarkdown('<div>content</div>')).toBe('content');
    });

    it('strips code blocks', () => {
        const input = 'before\n```js\nconst x = 1;\n```\nafter';
        const result = stripMarkdown(input);
        expect(result).not.toContain('const x');
        expect(result).toContain('before');
        expect(result).toContain('after');
    });
});
