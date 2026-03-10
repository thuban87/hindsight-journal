/**
 * Widget Container
 *
 * Renders sidebar widgets in a user-configurable order with
 * arrow-button reordering, visibility toggles, and overflow menus.
 * Arrow buttons used on ALL platforms (no drag-and-drop to avoid
 * interfering with Obsidian's workspace drag handlers).
 */

import React, { useCallback, useState, useMemo } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';
import type { HindsightPluginInterface } from '../../types';

interface WidgetDefinition {
    id: string;
    label: string;
    component: React.ReactNode;
}

interface WidgetContainerProps {
    widgets: WidgetDefinition[];
}

/**
 * Debounce timer ref for saving settings after reorder/visibility changes.
 * In-memory state updates immediately for visual feedback.
 */
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(plugin: HindsightPluginInterface): void {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        void plugin.saveSettings();
        saveDebounceTimer = null;
    }, 500);
}

export function WidgetContainer({ widgets }: WidgetContainerProps): React.ReactElement {
    const plugin = useAppStore(s => s.plugin);
    const widgetSettings = useSettingsStore(s => s.settings.widgets);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Build ordered visible widget list from settings
    const orderedWidgets = useMemo(() => {
        const widgetMap = new Map(widgets.map(w => [w.id, w]));
        const result: WidgetDefinition[] = [];

        for (const setting of widgetSettings) {
            if (setting.visible && widgetMap.has(setting.id)) {
                result.push(widgetMap.get(setting.id)!);
            }
        }

        return result;
    }, [widgets, widgetSettings]);

    const updateWidgets = useCallback(
        (newWidgets: { id: string; visible: boolean }[]) => {
            if (!plugin) return;
            plugin.settings.widgets = newWidgets;
            useSettingsStore.getState().setSettings({ ...plugin.settings });
            debouncedSave(plugin);
        },
        [plugin]
    );

    const moveWidget = useCallback(
        (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
            const current = [...widgetSettings];
            const idx = current.findIndex(w => w.id === id);
            if (idx === -1) return;

            const item = current[idx];
            current.splice(idx, 1);

            switch (direction) {
                case 'up':
                    current.splice(Math.max(0, idx - 1), 0, item);
                    break;
                case 'down':
                    current.splice(Math.min(current.length, idx + 1), 0, item);
                    break;
                case 'top':
                    current.unshift(item);
                    break;
                case 'bottom':
                    current.push(item);
                    break;
            }

            updateWidgets(current);
            setOpenMenuId(null);
        },
        [widgetSettings, updateWidgets]
    );

    const toggleVisibility = useCallback(
        (id: string) => {
            const current = widgetSettings.map(w =>
                w.id === id ? { ...w, visible: !w.visible } : { ...w }
            );
            updateWidgets(current);
        },
        [widgetSettings, updateWidgets]
    );

    if (orderedWidgets.length === 0) {
        return (
            <div className="hindsight-widget-container">
                <p className="hindsight-widget-empty">
                    All widgets are hidden. Enable them in settings.
                </p>
            </div>
        );
    }

    return (
        <div className="hindsight-widget-container">
            {orderedWidgets.map((widget, index) => (
                <div key={widget.id} className="hindsight-widget">
                    <div className="hindsight-widget-header">
                        <span className="hindsight-widget-label">{widget.label}</span>
                        <div className="hindsight-widget-controls">
                            <button
                                className="hindsight-widget-arrow hindsight-touch-target"
                                onClick={() => moveWidget(widget.id, 'up')}
                                disabled={index === 0}
                                aria-label={`Move ${widget.label} up`}
                                title="Move up"
                            >
                                ↑
                            </button>
                            <button
                                className="hindsight-widget-arrow hindsight-touch-target"
                                onClick={() => moveWidget(widget.id, 'down')}
                                disabled={index === orderedWidgets.length - 1}
                                aria-label={`Move ${widget.label} down`}
                                title="Move down"
                            >
                                ↓
                            </button>
                            <button
                                className="hindsight-widget-toggle hindsight-touch-target"
                                onClick={() => toggleVisibility(widget.id)}
                                aria-label={`Hide ${widget.label}`}
                                title="Hide widget"
                            >
                                👁
                            </button>
                            <div className="hindsight-widget-menu-wrapper">
                                <button
                                    className="hindsight-widget-menu-btn hindsight-touch-target"
                                    onClick={() => setOpenMenuId(openMenuId === widget.id ? null : widget.id)}
                                    aria-label={`More options for ${widget.label}`}
                                    title="More options"
                                >
                                    ⋮
                                </button>
                                {openMenuId === widget.id && (
                                    <div className="hindsight-widget-menu-dropdown">
                                        <button
                                            className="hindsight-widget-menu-item"
                                            onClick={() => moveWidget(widget.id, 'top')}
                                        >
                                            Move to top
                                        </button>
                                        <button
                                            className="hindsight-widget-menu-item"
                                            onClick={() => moveWidget(widget.id, 'bottom')}
                                        >
                                            Move to bottom
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="hindsight-widget-content">
                        {widget.component}
                    </div>
                </div>
            ))}
        </div>
    );
}
