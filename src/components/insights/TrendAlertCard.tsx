/**
 * Trend Alert Card
 *
 * Renders a single TrendAlert with color-coded left border.
 */

import React from 'react';
import type { TrendAlert } from '../../types';
import { useAppStore } from '../../store/appStore';
import { Notice } from 'obsidian';

interface TrendAlertCardProps {
    alert: TrendAlert;
    onDismiss: (id: string) => void;
}

export function TrendAlertCard({ alert, onDismiss }: TrendAlertCardProps): React.ReactElement {
    const app = useAppStore(s => s.app);

    const severityClass = `hindsight-trend-alert-${alert.severity}`;

    const handleViewEntry = (): void => {
        if (!app || !alert.relatedEntryPath) return;
        const file = app.vault.getFileByPath(alert.relatedEntryPath);
        if (!file) {
            new Notice('Entry file no longer exists.');
            return;
        }
        void app.workspace.openLinkText(alert.relatedEntryPath, '');
    };

    return (
        <div className={`hindsight-trend-alert ${severityClass}`}>
            <div className="hindsight-trend-alert-content">
                <div className="hindsight-trend-alert-title">{alert.title}</div>
                <div className="hindsight-trend-alert-body">{alert.body}</div>
                {alert.relatedEntryPath && (
                    <button
                        className="hindsight-trend-alert-link"
                        onClick={handleViewEntry}
                    >
                        View entry
                    </button>
                )}
            </div>
            <button
                className="hindsight-trend-alert-dismiss"
                onClick={() => onDismiss(alert.id)}
                aria-label="Dismiss alert"
            >
                ×
            </button>
        </div>
    );
}
