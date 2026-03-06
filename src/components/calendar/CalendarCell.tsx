/**
 * Calendar Cell
 *
 * Individual day cell in the calendar grid.
 * Color-coded by metric value, with hover tooltip, mobile tap handler,
 * and right-click context menu via Obsidian's Menu class.
 */

import React, { useCallback } from 'react';
import { Menu, Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { JournalEntry } from '../../types';
import { mapValueToColor, mapBooleanToColor } from '../../utils/statsUtils';
import { useUIStore } from '../../store/uiStore';

interface CalendarCellProps {
    date: Date;
    entry: JournalEntry | undefined;
    selectedMetric: string | null;
    metricRange: { min: number; max: number } | null;
    isToday: boolean;
    onClick: () => void;
    app: App;
}

/**
 * Format a date for tooltip display.
 */
function formatTooltipDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Get the metric value from an entry's frontmatter.
 */
function getMetricValue(entry: JournalEntry, metricKey: string): number | boolean | null {
    const raw = entry.frontmatter[metricKey];
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'boolean') return raw;
    const num = Number(raw);
    return isNaN(num) ? null : num;
}

export function CalendarCell({
    date,
    entry,
    selectedMetric,
    metricRange,
    isToday,
    onClick,
    app,
}: CalendarCellProps): React.ReactElement {
    const setActiveMainTab = useUIStore(state => state.setActiveMainTab);

    // Compute background color
    let bgColor: string | undefined;
    let tooltipMetricText = '';

    if (entry && selectedMetric) {
        const value = getMetricValue(entry, selectedMetric);
        if (typeof value === 'boolean') {
            bgColor = mapBooleanToColor(value);
            tooltipMetricText = `${selectedMetric}: ${value ? 'yes' : 'no'}`;
        } else if (typeof value === 'number' && metricRange) {
            bgColor = mapValueToColor(value, metricRange.min, metricRange.max);
            tooltipMetricText = `${selectedMetric}: ${value}`;
        } else {
            // Null/missing value
            bgColor = mapValueToColor(null, 0, 1);
            tooltipMetricText = `${selectedMetric}: —`;
        }
    }

    const tooltipText = entry
        ? `${formatTooltipDate(date)}${tooltipMetricText ? '\n' + tooltipMetricText : ''}`
        : formatTooltipDate(date);

    // Build CSS classes
    const classes = ['hindsight-calendar-cell'];
    if (entry) classes.push('has-entry');
    if (isToday) classes.push('is-today');
    if (!entry) classes.push('hindsight-calendar-cell-no-entry');

    // Mobile tap handler — show notice with tooltip info
    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (entry && tooltipMetricText) {
                e.preventDefault();
                new Notice(tooltipText, 2000);
            }
        },
        [entry, tooltipText, tooltipMetricText]
    );

    // Right-click context menu via Obsidian's Menu class
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            if (!entry) return;
            e.preventDefault();

            const menu = new Menu();

            menu.addItem(item => {
                item.setTitle('Open note')
                    .setIcon('file-text')
                    .onClick(() => {
                        void app.workspace.openLinkText(entry.filePath, '', false);
                    });
            });

            menu.addItem(item => {
                item.setTitle('View in timeline')
                    .setIcon('list')
                    .onClick(() => {
                        setActiveMainTab('timeline');
                    });
            });

            menu.showAtMouseEvent(e.nativeEvent);
        },
        [entry, app, setActiveMainTab]
    );

    const cellStyle: React.CSSProperties = bgColor
        ? { backgroundColor: bgColor }
        : {};

    return (
        <div
            className={classes.join(' ')}
            style={cellStyle}
            onClick={entry ? onClick : undefined}
            onContextMenu={handleContextMenu}
            onTouchEnd={handleTouchEnd}
            title={tooltipText}
            role="gridcell"
            aria-label={tooltipText}
        >
            <span className="hindsight-calendar-day-number">{date.getDate()}</span>
            {/* Dot indicator: entry exists but no metric selected */}
            {entry && !selectedMetric && (
                <span className="hindsight-calendar-indicator" />
            )}
            {/* Placeholder for Phase 9 image thumbnails */}
            <div className="hindsight-calendar-thumbnail" />
        </div>
    );
}
