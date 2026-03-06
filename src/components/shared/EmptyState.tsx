/**
 * Empty State
 *
 * Reusable centered message for empty views.
 * Used across all panels when there's no data to display.
 */

import React from 'react';

interface EmptyStateProps {
    message: string;
    icon?: string;
}

export function EmptyState({ message, icon }: EmptyStateProps): React.ReactElement {
    return (
        <div className="hindsight-empty-state">
            {icon && <span className="hindsight-empty-state-icon">{icon}</span>}
            <p>{message}</p>
        </div>
    );
}
