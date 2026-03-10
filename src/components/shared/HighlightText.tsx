/**
 * Highlight Text
 *
 * Safe search term highlighting via String.split() — no regex, no innerHTML.
 * Case-insensitive matching preserving original casing in output.
 */

import React from 'react';

interface HighlightTextProps {
    text: string;
    query: string;
}

export function HighlightText({ text, query }: HighlightTextProps): React.ReactElement {
    // Empty query guard: prevents split('') from creating one element per character
    if (!query || query.length === 0) {
        return <>{text}</>;
    }

    // Case-insensitive split while preserving original casing
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: string[] = [];
    let lastIndex = 0;
    let idx = lowerText.indexOf(lowerQuery, lastIndex);

    while (idx !== -1) {
        parts.push(text.substring(lastIndex, idx));
        parts.push(text.substring(idx, idx + query.length));
        lastIndex = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, lastIndex);
    }
    parts.push(text.substring(lastIndex));

    // Fragment count cap: >200 fragments means too many matches to highlight
    if (parts.length > 200) {
        return (
            <>
                {text}
                <span className="hindsight-highlight-overflow">Too many matches to highlight</span>
            </>
        );
    }

    // No matches found
    if (parts.length <= 1) {
        return <>{text}</>;
    }

    // Interleave: even indices are plain text, odd indices are matched text
    return (
        <>
            {parts.map((part, i) => {
                if (i % 2 === 1) {
                    return <mark key={i} className="hindsight-highlight">{part}</mark>;
                }
                return <React.Fragment key={i}>{part}</React.Fragment>;
            })}
        </>
    );
}
