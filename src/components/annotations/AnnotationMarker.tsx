/**
 * Annotation Marker
 *
 * Small badge/pill that displays annotation text on timeline cards
 * and chart elements. Renders as a simple visual marker with hover tooltip.
 */

import React, { useState, useRef, useCallback } from 'react';

interface AnnotationMarkerProps {
    annotations: string[];
    /** Compact mode shows just a count badge */
    compact?: boolean;
}

export function AnnotationMarker({ annotations, compact = false }: AnnotationMarkerProps): React.ReactElement | null {
    const [showTooltip, setShowTooltip] = useState(false);
    const markerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
    const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

    if (annotations.length === 0) return null;

    if (compact) {
        return (
            <div
                className="hindsight-annotation-marker-compact"
                ref={markerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <span className="hindsight-annotation-marker-badge">
                    📌 {annotations.length}
                </span>
                {showTooltip && (
                    <div className="hindsight-annotation-tooltip">
                        {annotations.map((ann, i) => (
                            <div key={i} className="hindsight-annotation-tooltip-item">{ann}</div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="hindsight-annotation-marker">
            {annotations.map((ann, i) => (
                <span key={i} className="hindsight-annotation-pill">{ann}</span>
            ))}
        </div>
    );
}
