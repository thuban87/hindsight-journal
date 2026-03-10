/**
 * Markdown Excerpt
 *
 * Renders a markdown string using Obsidian's MarkdownRenderer.render().
 * This preserves bullet lists, bold, italics, headings, etc. in excerpts.
 * Uses a ref-based approach since MarkdownRenderer operates on DOM elements.
 * Safe: MarkdownRenderer handles HTML sanitization internally.
 *
 * Optionally highlights search terms in the rendered output by walking
 * DOM text nodes and wrapping matches in <mark> elements (no innerHTML).
 */

import React, { useRef, useEffect } from 'react';
import { MarkdownRenderer, Component } from 'obsidian';
import { useAppStore } from '../../store/appStore';

interface MarkdownExcerptProps {
    /** Raw markdown text to render */
    markdown: string;
    /** Source file path for link resolution */
    sourcePath?: string;
    /** Optional CSS class for the container */
    className?: string;
    /** Optional search query to highlight in rendered output */
    highlightQuery?: string;
}

/**
 * Lightweight Obsidian Component for MarkdownRenderer lifecycle.
 * Required by MarkdownRenderer.render() — manages child components.
 */
class ExcerptComponent extends Component {
    onload(): void { /* no-op */ }
    onunload(): void { /* no-op */ }
}

/**
 * Walk all text nodes under a DOM element and wrap occurrences of `query`
 * in <mark> elements. Case-insensitive. Safe: no innerHTML used.
 */
function highlightTextNodes(container: HTMLElement, query: string): void {
    if (!query || query.length === 0) return;
    const lowerQuery = query.toLowerCase();

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode()) !== null) {
        textNodes.push(node as Text);
    }

    for (const textNode of textNodes) {
        const text = textNode.textContent ?? '';
        const lowerText = text.toLowerCase();
        const idx = lowerText.indexOf(lowerQuery);
        if (idx === -1) continue;

        // Split into: before, match, after
        const parent = textNode.parentNode;
        if (!parent) continue;

        const before = text.substring(0, idx);
        const match = text.substring(idx, idx + query.length);
        const after = text.substring(idx + query.length);

        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));

        const mark = document.createElement('mark');
        mark.className = 'hindsight-highlight';
        mark.textContent = match;
        frag.appendChild(mark);

        if (after) frag.appendChild(document.createTextNode(after));

        parent.replaceChild(frag, textNode);
    }
}

export function MarkdownExcerpt({
    markdown,
    sourcePath = '',
    className = '',
    highlightQuery,
}: MarkdownExcerptProps): React.ReactElement | null {
    const containerRef = useRef<HTMLDivElement>(null);
    const componentRef = useRef<ExcerptComponent | null>(null);
    const app = useAppStore(s => s.app);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || !app || !markdown) return;

        // Clear previous render
        el.empty();

        // Create a lifecycle component for this render
        const comp = new ExcerptComponent();
        comp.load();
        componentRef.current = comp;

        // Render markdown into the DOM element, then highlight search terms
        void MarkdownRenderer.render(
            app,
            markdown,
            el,
            sourcePath,
            comp
        ).then(() => {
            if (highlightQuery && containerRef.current) {
                highlightTextNodes(containerRef.current, highlightQuery);
            }
        });

        return () => {
            comp.unload();
            componentRef.current = null;
        };
    }, [markdown, sourcePath, app, highlightQuery]);

    if (!markdown) return null;

    return (
        <div
            ref={containerRef}
            className={`hindsight-markdown-excerpt ${className}`}
        />
    );
}
