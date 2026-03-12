/**
 * Period Selector
 *
 * Date period picker for the Digest panel with preset buttons
 * (this/last week, this/last month) and custom date range.
 * Each preset uses aria-pressed for accessibility.
 */

import React, { useState, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { getWeekBounds, getMonthBounds } from '../../utils/periodUtils';
import type { DateRange } from '../../types';

type PresetId = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

interface PeriodSelectorProps {
    onPeriodChange: (range: DateRange) => void;
}

export function PeriodSelector({ onPeriodChange }: PeriodSelectorProps): React.ReactElement {
    const weekStartDay = useSettingsStore(s => s.settings.weekStartDay);
    const [activePreset, setActivePreset] = useState<PresetId>('this-week');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const handlePreset = useCallback((preset: PresetId) => {
        setActivePreset(preset);
        const now = new Date();

        if (preset === 'this-week') {
            const bounds = getWeekBounds(now, weekStartDay);
            onPeriodChange(bounds);
        } else if (preset === 'last-week') {
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            const bounds = getWeekBounds(lastWeek, weekStartDay);
            onPeriodChange(bounds);
        } else if (preset === 'this-month') {
            const bounds = getMonthBounds(now);
            onPeriodChange(bounds);
        } else if (preset === 'last-month') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const bounds = getMonthBounds(lastMonth);
            onPeriodChange(bounds);
        }
    }, [weekStartDay, onPeriodChange]);

    const handleCustomApply = useCallback(() => {
        if (customStart && customEnd) {
            const start = new Date(customStart + 'T00:00:00');
            const end = new Date(customEnd + 'T00:00:00');
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
                setActivePreset('custom');
                onPeriodChange({ start, end });
            }
        }
    }, [customStart, customEnd, onPeriodChange]);

    const presets: { id: PresetId; label: string }[] = [
        { id: 'this-week', label: 'This week' },
        { id: 'last-week', label: 'Last week' },
        { id: 'this-month', label: 'This month' },
        { id: 'last-month', label: 'Last month' },
    ];

    return (
        <div className="hindsight-period-selector">
            <div className="hindsight-period-presets">
                {presets.map(p => (
                    <button
                        key={p.id}
                        className={`hindsight-period-btn ${activePreset === p.id ? 'is-active' : ''}`}
                        aria-pressed={activePreset === p.id}
                        onClick={() => handlePreset(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <div className="hindsight-period-custom">
                <input
                    type="date"
                    className="hindsight-period-date-input"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    aria-label="Custom start date"
                />
                <span className="hindsight-period-to">to</span>
                <input
                    type="date"
                    className="hindsight-period-date-input"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    aria-label="Custom end date"
                />
                <button
                    className="hindsight-period-btn"
                    onClick={handleCustomApply}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}
