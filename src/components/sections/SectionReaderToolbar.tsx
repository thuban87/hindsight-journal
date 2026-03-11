/**
 * Section Reader Toolbar
 *
 * Controls bar for the Section Reader:
 * - Section heading dropdown
 * - Date range preset buttons + custom date picker
 * - Search input
 * - Simple view toggle
 * - Result count with aria-live
 */

import React from 'react';
import type { DateRangePreset } from '../../hooks/useSectionReaderData';

interface SectionReaderToolbarProps {
    availableHeadings: string[];
    selectedHeading: string;
    onHeadingChange: (h: string) => void;
    dateRange: DateRangePreset;
    onDateRangeChange: (r: DateRangePreset) => void;
    customStartDate: string;
    onCustomStartDateChange: (d: string) => void;
    customEndDate: string;
    onCustomEndDateChange: (d: string) => void;
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    resultCount: number;
    isSearching: boolean;
    simpleView: boolean;
    onSimpleViewChange: (v: boolean) => void;
}

export function SectionReaderToolbar({
    availableHeadings,
    selectedHeading,
    onHeadingChange,
    dateRange,
    onDateRangeChange,
    customStartDate,
    onCustomStartDateChange,
    customEndDate,
    onCustomEndDateChange,
    searchQuery,
    onSearchQueryChange,
    resultCount,
    isSearching,
    simpleView,
    onSimpleViewChange,
}: SectionReaderToolbarProps): React.ReactElement {
    return (
        <div className="hindsight-section-reader-toolbar">
            <div className="hindsight-section-reader-toolbar-row">
                <select
                    className="hindsight-section-reader-select"
                    value={selectedHeading}
                    onChange={(e) => onHeadingChange(e.target.value)}
                    aria-label="Select section heading"
                >
                    {availableHeadings.map((h) => (
                        <option key={h} value={h}>{h}</option>
                    ))}
                </select>

                <div className="hindsight-section-reader-date-buttons" role="group" aria-label="Date range">
                    <button
                        className={`hindsight-section-reader-date-btn ${dateRange === 'last30' ? 'is-active' : ''}`}
                        onClick={() => onDateRangeChange('last30')}
                    >
                        30 days
                    </button>
                    <button
                        className={`hindsight-section-reader-date-btn ${dateRange === 'last90' ? 'is-active' : ''}`}
                        onClick={() => onDateRangeChange('last90')}
                    >
                        90 days
                    </button>
                    <button
                        className={`hindsight-section-reader-date-btn ${dateRange === 'all' ? 'is-active' : ''}`}
                        onClick={() => onDateRangeChange('all')}
                    >
                        All time
                    </button>
                    <button
                        className={`hindsight-section-reader-date-btn ${dateRange === 'custom' ? 'is-active' : ''}`}
                        onClick={() => onDateRangeChange('custom')}
                    >
                        Custom
                    </button>
                </div>

                <label className="hindsight-section-reader-toggle">
                    <input
                        type="checkbox"
                        checked={simpleView}
                        onChange={(e) => onSimpleViewChange(e.target.checked)}
                    />
                    <span>Simple view</span>
                </label>
            </div>

            {dateRange === 'custom' && (
                <div className="hindsight-section-reader-toolbar-row">
                    <label className="hindsight-section-reader-date-label">
                        From
                        <input
                            type="date"
                            className="hindsight-section-reader-date-input"
                            value={customStartDate}
                            onChange={(e) => onCustomStartDateChange(e.target.value)}
                            aria-label="Start date"
                        />
                    </label>
                    <label className="hindsight-section-reader-date-label">
                        To
                        <input
                            type="date"
                            className="hindsight-section-reader-date-input"
                            value={customEndDate}
                            onChange={(e) => onCustomEndDateChange(e.target.value)}
                            aria-label="End date"
                        />
                    </label>
                </div>
            )}

            <div className="hindsight-section-reader-toolbar-row">
                <input
                    type="text"
                    className="hindsight-section-reader-search"
                    placeholder="Search within section..."
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    maxLength={200}
                    aria-label="Search within section"
                />

                <span
                    className="hindsight-section-reader-count"
                    aria-live="polite"
                >
                    {isSearching
                        ? 'Searching...'
                        : `${resultCount} ${resultCount === 1 ? 'entry' : 'entries'}`}
                </span>
            </div>
        </div>
    );
}
