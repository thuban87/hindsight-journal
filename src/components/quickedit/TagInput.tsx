/**
 * Tag Input
 *
 * Tag editing component for string[] frontmatter fields.
 * Text input to add new tags (Enter to add), existing tags
 * shown as removable pills.
 */

import React, { useState } from 'react';

interface TagInputProps {
    /** Current list of tags */
    tags: string[];
    /** Called when the tag list changes */
    onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps): React.ReactElement {
    const [inputValue, setInputValue] = useState('');

    const handleAdd = (): void => {
        const trimmed = inputValue.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
            setInputValue('');
        }
    };

    const handleRemove = (tag: string): void => {
        onChange(tags.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="hindsight-tag-input">
            <div className="hindsight-tag-pills">
                {tags.map((tag) => (
                    <span key={tag} className="hindsight-tag-pill">
                        {tag}
                        <button
                            className="hindsight-tag-pill-remove"
                            onClick={() => handleRemove(tag)}
                            aria-label={`Remove ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                className="hindsight-tag-input-field"
                placeholder="Add tag..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAdd}
            />
        </div>
    );
}
