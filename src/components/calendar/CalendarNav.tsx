/**
 * Calendar Navigation
 *
 * Month navigation bar with prev/next arrows, month/year display,
 * "Today" button, metric selector dropdown, and arrow key support.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { FrontmatterField } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { MetricSelector } from '../shared/MetricSelector';

interface CalendarNavProps {
    detectedFields: FrontmatterField[];
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarNav({ detectedFields }: CalendarNavProps): React.ReactElement {
    const calendarMonth = useUIStore(state => state.calendarMonth);
    const calendarYear = useUIStore(state => state.calendarYear);
    const setCalendarMonth = useUIStore(state => state.setCalendarMonth);
    const selectedMetric = useUIStore(state => state.selectedMetric);
    const setSelectedMetric = useUIStore(state => state.setSelectedMetric);

    const navRef = useRef<HTMLDivElement>(null);

    const goToPrevMonth = useCallback((): void => {
        if (calendarMonth === 0) {
            setCalendarMonth(11, calendarYear - 1);
        } else {
            setCalendarMonth(calendarMonth - 1, calendarYear);
        }
    }, [calendarMonth, calendarYear, setCalendarMonth]);

    const goToNextMonth = useCallback((): void => {
        if (calendarMonth === 11) {
            setCalendarMonth(0, calendarYear + 1);
        } else {
            setCalendarMonth(calendarMonth + 1, calendarYear);
        }
    }, [calendarMonth, calendarYear, setCalendarMonth]);

    const goToToday = useCallback((): void => {
        const now = new Date();
        setCalendarMonth(now.getMonth(), now.getFullYear());
    }, [setCalendarMonth]);

    // Arrow key navigation scoped to the calendar container
    useEffect(() => {
        const container = navRef.current?.closest('.hindsight-calendar-container');
        if (!container) return;

        const handleKeyDown = (e: Event): void => {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'ArrowLeft') {
                keyEvent.preventDefault();
                goToPrevMonth();
            } else if (keyEvent.key === 'ArrowRight') {
                keyEvent.preventDefault();
                goToNextMonth();
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [goToPrevMonth, goToNextMonth]);

    return (
        <div className="hindsight-calendar-nav" ref={navRef}>
            <div className="hindsight-calendar-nav-controls">
                <button
                    className="hindsight-calendar-nav-btn"
                    onClick={goToPrevMonth}
                    aria-label="Previous month"
                >
                    ←
                </button>
                <button
                    className="hindsight-calendar-nav-title"
                    onClick={goToToday}
                    aria-label="Jump to today"
                >
                    {MONTH_NAMES[calendarMonth]} {calendarYear}
                </button>
                <button
                    className="hindsight-calendar-nav-btn"
                    onClick={goToNextMonth}
                    aria-label="Next month"
                >
                    →
                </button>
                <button
                    className="hindsight-calendar-nav-today"
                    onClick={goToToday}
                    aria-label="Go to today"
                >
                    Today
                </button>
            </div>
            <div className="hindsight-calendar-nav-metric">
                <MetricSelector
                    fields={detectedFields}
                    selected={selectedMetric}
                    onChange={setSelectedMetric}
                />
            </div>
        </div>
    );
}
