/**
 * Saved Filters
 *
 * Save/load/delete Lens filter configurations.
 * Stored in HindsightSettings (data.json) for cross-reload persistence.
 * Maximum 25 saved filters, filter name max 80 characters.
 */

import React, { useState } from 'react';
import type { FilterConfig } from '../../types';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLensStore } from '../../store/lensStore';
import { Notice } from 'obsidian';

interface SavedFilter {
    name: string;
    config: FilterConfig;
}

export function SavedFilters(): React.ReactElement {
    const plugin = useAppStore(s => s.plugin);
    const savedFilters = useSettingsStore(s => s.settings.savedFilters) as SavedFilter[];
    const selectedFilterId = useLensStore(s => s.selectedFilterId);
    const searchQuery = useLensStore(s => s.searchQuery);
    const activeFilters = useLensStore(s => s.activeFilters);
    const setSearchQuery = useLensStore(s => s.setSearchQuery);
    const setActiveFilters = useLensStore(s => s.setActiveFilters);
    const setSelectedFilterId = useLensStore(s => s.setSelectedFilterId);

    const [filterName, setFilterName] = useState('');

    /** Sync the plugin settings object back into settingsStore for reactivity */
    const syncSettings = () => {
        if (!plugin) return;
        useSettingsStore.getState().setSettings({ ...plugin.settings });
    };

    const handleSave = () => {
        if (!plugin) return;
        const name = filterName.trim().substring(0, 80);
        if (!name) {
            new Notice('Please enter a filter name.');
            return;
        }

        const config: FilterConfig = {
            searchQuery,
            filters: activeFilters,
        };

        const existing = savedFilters ?? [];
        const existingIdx = existing.findIndex((f: SavedFilter) => f.name === name);

        let updated: SavedFilter[];
        if (existingIdx >= 0) {
            updated = [...existing];
            updated[existingIdx] = { name, config };
        } else if (existing.length >= 25) {
            new Notice('Maximum saved filters reached. Delete an existing filter or overwrite one.');
            return;
        } else {
            updated = [...existing, { name, config }];
        }

        plugin.settings.savedFilters = updated;
        void plugin.saveSettings();
        syncSettings();
        setSelectedFilterId(name);
        setFilterName('');
        new Notice(`Filter "${name}" saved.`);
    };

    const handleLoad = (name: string) => {
        const filter = (savedFilters ?? []).find((f: SavedFilter) => f.name === name);
        if (!filter) return;

        setSearchQuery(filter.config.searchQuery);
        setActiveFilters(filter.config.filters);
        setSelectedFilterId(name);
    };

    const handleDelete = (name: string) => {
        if (!plugin) return;
        const updated = (savedFilters ?? []).filter((f: SavedFilter) => f.name !== name);
        plugin.settings.savedFilters = updated;
        void plugin.saveSettings();
        syncSettings();
        if (selectedFilterId === name) {
            setSelectedFilterId(null);
        }
        new Notice(`Filter "${name}" deleted.`);
    };

    const filterCount = (savedFilters ?? []).length;

    return (
        <div className="hindsight-lens-saved-filters">
            <div className="hindsight-lens-saved-filters-save">
                <input
                    type="text"
                    className="hindsight-lens-saved-filters-input"
                    value={filterName}
                    onChange={e => setFilterName(e.target.value.substring(0, 80))}
                    placeholder="Filter name..."
                    maxLength={80}
                    aria-label="Saved filter name"
                />
                <button
                    className="hindsight-lens-saved-filters-btn"
                    onClick={handleSave}
                    type="button"
                >
                    Save
                </button>
            </div>

            {filterCount > 0 && (
                <div className="hindsight-lens-saved-filters-list">
                    {filterCount > 20 && (
                        <span className="hindsight-lens-saved-filters-count">
                            {filterCount}/25 saved filters
                        </span>
                    )}
                    {(savedFilters ?? []).map((f: SavedFilter) => (
                        <div
                            key={f.name}
                            className={`hindsight-lens-saved-filter-item ${selectedFilterId === f.name ? 'is-active' : ''}`}
                        >
                            <button
                                className="hindsight-lens-saved-filter-load"
                                onClick={() => handleLoad(f.name)}
                                type="button"
                            >
                                {f.name}
                            </button>
                            <button
                                className="hindsight-lens-saved-filter-delete"
                                onClick={() => handleDelete(f.name)}
                                type="button"
                                aria-label={`Delete filter ${f.name}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
