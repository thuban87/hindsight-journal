/**
 * Lens Panel
 *
 * Full-text search and compound filtering for journal entries.
 * Searches in-memory section data by default, with an opt-in toggle
 * for full note content search via vault.cachedRead().
 *
 * Features:
 * - Text search with multi-term AND logic
 * - Stackable compound filters (field, date, tag, wordCount, quality, hasImages)
 * - Saved filters (persisted in settings)
 * - Sorting by date, quality, word count
 * - Random entry button
 * - Formatted markdown excerpts via MarkdownRenderer
 * - Cold section eviction after full-content search
 */

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'obsidian';
import type { JournalEntry, LensFilterRow as LensFilterRowType } from '../../types';
import { useJournalStore } from '../../store/journalStore';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { useLensStore } from '../../store/lensStore';
import { useAppStore } from '../../store/appStore';
import { LensFilterRow } from './LensFilterRow';
import { SavedFilters } from './SavedFilters';
import { MarkdownExcerpt } from '../shared/MarkdownExcerpt';
import { EmptyState } from '../shared/EmptyState';
import { debugLog } from '../../utils/debugLog';
import { applyLensFilters, sortEntries } from '../../utils/lensUtils';
import type { SortOption } from '../../utils/lensUtils';


export function LensPanel(): React.ReactElement {
    const { entries, detectedFields } = useJournalEntries();
    const app = useAppStore(s => s.app);

    const searchQuery = useLensStore(s => s.searchQuery);
    const activeFilters = useLensStore(s => s.activeFilters);
    const isSearching = useLensStore(s => s.isSearching);
    const fullContentSearch = useLensStore(s => s.fullContentSearch);
    const setSearchQuery = useLensStore(s => s.setSearchQuery);
    const addFilter = useLensStore(s => s.addFilter);
    const removeFilter = useLensStore(s => s.removeFilter);
    const updateFilter = useLensStore(s => s.updateFilter);
    const setResults = useLensStore(s => s.setResults);
    const setIsSearching = useLensStore(s => s.setIsSearching);
    const setFullContentSearch = useLensStore(s => s.setFullContentSearch);
    const nextGeneration = useLensStore(s => s.nextGeneration);

    const [sortBy, setSortBy] = useState<SortOption>('date-newest');

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fullContentContexts = useRef<Map<string, string>>(new Map());
    const coldLoadedPaths = useRef<Set<string>>(new Set());

    const allEntries = useMemo(
        () => Array.from(entries.values()).sort((a, b) => b.date.getTime() - a.date.getTime()),
        [entries]
    );

    // Collect all unique tags across entries
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        for (const entry of allEntries) {
            const entryTags = entry.frontmatter['tags'];
            if (Array.isArray(entryTags)) {
                for (const t of entryTags) {
                    if (typeof t === 'string') tags.add(t);
                }
            }
        }
        return Array.from(tags).sort();
    }, [allEntries]);

    // Results count for display
    const results = useLensStore(s => s.results);
    const resultCount = useLensStore(s => s.resultCount);

    // Debounced search
    const runSearch = useCallback((query: string, filters: LensFilterRowType[]) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            const { filtered, contexts } = applyLensFilters(
                allEntries,
                query,
                filters,
                fullContentSearch ? fullContentContexts.current : null
            );
            setResults(filtered, filtered.length);
            fullContentContexts.current = contexts;
        }, 250);
    }, [allEntries, fullContentSearch, setResults]);

    // Re-run search when query, filters, or entries change
    useEffect(() => {
        runSearch(searchQuery, activeFilters);
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, activeFilters, runSearch]);

    // Full-content search
    const handleFullContentSearch = useCallback(async () => {
        if (!app) return;
        const token = nextGeneration();
        setIsSearching(true);
        const coldLoaded = new Set<string>();

        try {
            const timeout = Platform.isMobile ? 5000 : 10000;
            const startTime = performance.now();
            const contexts = new Map<string, string>();

            for (const entry of allEntries) {
                if (performance.now() - startTime > timeout) {
                    debugLog('Lens full-content search timeout reached');
                    break;
                }

                // Stale-result guard
                if (useLensStore.getState().generationToken !== token) return;

                // Skip entries with sections already loaded
                if (Object.keys(entry.sections).length > 0) continue;

                const file = app.vault.getFileByPath(entry.filePath);
                if (!file) continue;

                try {
                    const content = await app.vault.cachedRead(file);
                    contexts.set(entry.filePath, content);
                    coldLoaded.add(entry.filePath);
                } catch {
                    // Skip files that can't be read
                }
            }

            // Stale-result guard before committing
            if (useLensStore.getState().generationToken !== token) return;

            fullContentContexts.current = contexts;
            coldLoadedPaths.current = coldLoaded;

            // Re-run the filter with full content
            const { filtered, contexts: updatedContexts } = applyLensFilters(
                allEntries,
                useLensStore.getState().searchQuery,
                useLensStore.getState().activeFilters,
                contexts
            );
            fullContentContexts.current = updatedContexts;
            setResults(filtered, filtered.length);
        } catch (err) {
            debugLog('Lens full-content search error:', err);
        } finally {
            setIsSearching(false);
        }
    }, [app, allEntries, nextGeneration, setIsSearching, setResults]);

    // Trigger full content search when toggle is turned on
    useEffect(() => {
        if (fullContentSearch && searchQuery.trim().length > 0) {
            void handleFullContentSearch();
        }
    }, [fullContentSearch, handleFullContentSearch, searchQuery]);

    // Random entry handler
    const handleRandomEntry = useCallback(() => {
        if (!app || results.length === 0) return;
        const randomIdx = Math.floor(Math.random() * results.length);
        const entry = results[randomIdx];
        void app.workspace.openLinkText(entry.filePath, '');
    }, [app, results]);

    // Handle entry click
    const handleEntryClick = useCallback((filePath: string) => {
        if (!app) return;
        void app.workspace.openLinkText(filePath, '');
    }, [app]);

    if (allEntries.length === 0) {
        return <EmptyState message="No journal entries indexed yet. Check your journal folder in settings." icon="🔍" />;
    }

    return (
        <div className="hindsight-lens-panel">
            {/* Search input */}
            <div className="hindsight-lens-search">
                <input
                    type="text"
                    className="hindsight-lens-search-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search journal entries..."
                    maxLength={200}
                    aria-label="Search query"
                />
                <label className="hindsight-lens-fullcontent-toggle">
                    <input
                        type="checkbox"
                        checked={fullContentSearch}
                        onChange={e => setFullContentSearch(e.target.checked)}
                    />
                    Search full note content
                </label>
            </div>

            {/* Filters */}
            <div className="hindsight-lens-filters">
                {activeFilters.map((filter, i) => (
                    <LensFilterRow
                        key={i}
                        filter={filter}
                        index={i}
                        fields={detectedFields}
                        tags={allTags}
                        onUpdate={updateFilter}
                        onRemove={removeFilter}
                    />
                ))}
                <button
                    className="hindsight-lens-add-filter"
                    onClick={() => addFilter({ type: 'field', fieldKey: detectedFields[0]?.key ?? '', operator: '>=', value: 0 })}
                    type="button"
                >
                    + Add filter
                </button>
            </div>

            {/* Saved filters */}
            <SavedFilters />

            {/* Results header */}
            <div className="hindsight-lens-results-header">
                <span className="hindsight-lens-result-count" aria-live="polite">
                    {isSearching ? 'Scanning history...' : `${resultCount} entries match`}
                </span>
                <div className="hindsight-lens-results-actions">
                    <select
                        className="hindsight-lens-sort-select"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as SortOption)}
                        aria-label="Sort results"
                    >
                        <option value="date-newest">Newest first</option>
                        <option value="date-oldest">Oldest first</option>
                        <option value="quality-high">Quality (high → low)</option>
                        <option value="quality-low">Quality (low → high)</option>
                        <option value="wordcount-high">Word count (high → low)</option>
                        <option value="wordcount-low">Word count (low → high)</option>
                    </select>
                    <button
                        className="hindsight-lens-random-btn"
                        onClick={handleRandomEntry}
                        disabled={results.length === 0}
                        type="button"
                    >
                        🎲 Random
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="hindsight-lens-results">
                {sortEntries(results, sortBy).slice(0, 50).map(entry => {
                    const context = fullContentContexts.current.get(entry.filePath);
                    // Use raw markdown for formatted rendering — limit to ~400 chars
                    const rawExcerpt = context
                        ? context.substring(0, 400)
                        : entry.firstSectionExcerpt
                            ? entry.firstSectionExcerpt.substring(0, 400)
                            : Object.values(entry.sections).join('\n').substring(0, 400);

                    return (
                        <div
                            key={entry.filePath}
                            className="hindsight-lens-result-card"
                            onClick={() => handleEntryClick(entry.filePath)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleEntryClick(entry.filePath); }}
                        >
                            <div className="hindsight-lens-result-header">
                                <span className="hindsight-lens-result-date">
                                    {entry.date.toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        weekday: 'short',
                                    })}
                                </span>
                                <span className="hindsight-lens-result-meta">
                                    {entry.wordCount}w · Q{entry.qualityScore}
                                </span>
                            </div>
                            {rawExcerpt && (
                                <MarkdownExcerpt
                                    markdown={rawExcerpt}
                                    sourcePath={entry.filePath}
                                    className="hindsight-lens-result-excerpt"
                                    highlightQuery={searchQuery}
                                />
                            )}
                        </div>
                    );
                })}
                {results.length > 50 && (
                    <div className="hindsight-lens-more-results">
                        Showing first 50 of {results.length} matches — refine your query for more results.
                    </div>
                )}
            </div>
        </div>
    );
}
