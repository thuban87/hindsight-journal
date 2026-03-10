/**
 * Progress Ring
 *
 * SVG progress ring for goal tracking. Shows a circular arc
 * that fills based on progress (0-1+), with center text.
 */

import React, { useRef, useEffect } from 'react';

interface ProgressRingProps {
    /** Progress value (0-1 for rendering, can exceed 1 for display) */
    progress: number;
    /** Ring diameter in pixels */
    size?: number;
    /** Ring stroke width in pixels */
    strokeWidth?: number;
    /** Label below the ring (e.g., field name) */
    label?: string;
    /** Sub-label below the label (e.g., period) */
    sublabel?: string;
}

export function ProgressRing({
    progress,
    size = 48,
    strokeWidth = 4,
    label,
    sublabel,
}: ProgressRingProps): React.ReactElement {
    const trackRef = useRef<SVGCircleElement>(null);
    const fillRef = useRef<SVGCircleElement>(null);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Clamp progress to 0-1 for rendering, but display actual value
    const renderProgress = Math.max(0, Math.min(1, progress));
    const offset = circumference - (renderProgress * circumference);
    const displayPercent = Math.round(progress * 100);
    const isComplete = progress >= 1;

    // Apply CSS variables via refs (no inline styles per plan-wide rules)
    useEffect(() => {
        if (fillRef.current) {
            fillRef.current.style.setProperty('--hindsight-ring-offset', String(offset));
            fillRef.current.style.setProperty('--hindsight-ring-circumference', String(circumference));
        }
    }, [offset, circumference]);

    const ariaLabel = label
        ? `${label}: ${displayPercent}% progress`
        : `${displayPercent}% progress`;

    return (
        <div className="hindsight-progress-ring">
            <svg
                width={size}
                height={size}
                role="img"
                aria-label={ariaLabel}
            >
                {/* Track circle */}
                <circle
                    ref={trackRef}
                    className="hindsight-progress-ring-track"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Fill circle */}
                <circle
                    ref={fillRef}
                    className={`hindsight-progress-ring-fill${isComplete ? ' hindsight-progress-ring-complete' : ''}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                {/* Center text */}
                <text
                    className="hindsight-progress-ring-text"
                    x={size / 2}
                    y={size / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                >
                    {displayPercent}%
                </text>
            </svg>
            {label && <span className="hindsight-progress-ring-label">{label}</span>}
            {sublabel && <span className="hindsight-progress-ring-sublabel">{sublabel}</span>}
        </div>
    );
}
