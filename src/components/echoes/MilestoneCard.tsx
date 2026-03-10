/**
 * Milestone Card
 *
 * Subtle milestone celebration card. No gamification — just a simple
 * acknowledgment of journaling consistency achievements.
 */

import React from 'react';
import type { Milestone } from '../../types';

interface MilestoneCardProps {
    milestone: Milestone;
}

export function MilestoneCard({ milestone }: MilestoneCardProps): React.ReactElement {
    return (
        <div className="hindsight-milestone">
            <span className="hindsight-milestone-icon">✨</span>
            <span className="hindsight-milestone-title">{milestone.title}</span>
        </div>
    );
}
