/**
 * Metrics Engine
 *
 * Statistical analysis engine - all pure functions, no Obsidian API dependency.
 * Computes correlations, conditional averages, and weekly comparisons
 * across journal frontmatter fields.
 */

import { Platform } from 'obsidian';
import type { JournalEntry, FrontmatterField, MetricDataPoint, CorrelationResult, ConditionalInsight } from '../types';
import { getTimeSeries } from './ChartDataService';
import { getWeekBounds } from '../utils/periodUtils';

/**
 * Compute Pearson correlation coefficient between two numeric field series.
 * Returns r value (-1 to 1). Only uses data points where both fields have values.
 * Returns null if fewer than 5 paired data points (insufficient for meaningful correlation).
 *
 * @param seriesA - Time series for field A
 * @param seriesB - Time series for field B
 * @returns Pearson r value, or null if insufficient data
 */
export function pearsonCorrelation(
    seriesA: MetricDataPoint[],
    seriesB: MetricDataPoint[]
): number | null {
    // Build paired data by matching timestamps
    const mapB = new Map<number, number>();
    for (const point of seriesB) {
        if (point.value !== null) {
            mapB.set(point.date, point.value);
        }
    }

    const paired: { a: number; b: number }[] = [];
    for (const point of seriesA) {
        if (point.value !== null) {
            const bVal = mapB.get(point.date);
            if (bVal !== undefined) {
                paired.push({ a: point.value, b: bVal });
            }
        }
    }

    if (paired.length < 5) return null;

    const n = paired.length;
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;

    for (const { a, b } of paired) {
        sumA += a;
        sumB += b;
        sumAB += a * b;
        sumA2 += a * a;
        sumB2 += b * b;
    }

    const denominator = Math.sqrt(
        (n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB)
    );

    // Zero variance — cannot compute correlation
    if (denominator === 0) return null;

    return (n * sumAB - sumA * sumB) / denominator;
}

/**
 * Compute conditional average: average of numericField when booleanField is true vs false.
 * Returns null if either group has fewer than 3 data points.
 *
 * @param entries - Journal entries to analyze
 * @param numericField - Numeric field key
 * @param booleanField - Boolean field key
 */
export function conditionalAverage(
    entries: JournalEntry[],
    numericField: string,
    booleanField: string
): ConditionalInsight | null {
    const trueValues: number[] = [];
    const falseValues: number[] = [];

    for (const entry of entries) {
        const numVal = entry.frontmatter[numericField];
        const boolVal = entry.frontmatter[booleanField];

        if (typeof numVal !== 'number' || numVal === null || numVal === undefined) continue;
        if (boolVal === undefined || boolVal === null) continue;

        if (boolVal === true) {
            trueValues.push(numVal);
        } else if (boolVal === false) {
            falseValues.push(numVal);
        }
    }

    if (trueValues.length < 3 || falseValues.length < 3) return null;

    const avgTrue = trueValues.reduce((sum, v) => sum + v, 0) / trueValues.length;
    const avgFalse = falseValues.reduce((sum, v) => sum + v, 0) / falseValues.length;

    return {
        numericField,
        booleanField,
        whenTrue: Math.round(avgTrue * 100) / 100,
        whenFalse: Math.round(avgFalse * 100) / 100,
        difference: Math.round((avgTrue - avgFalse) * 100) / 100,
        sampleSizeTrue: trueValues.length,
        sampleSizeFalse: falseValues.length,
    };
}

/**
 * Compute variance of a numeric series (excluding nulls).
 */
function computeVariance(series: MetricDataPoint[]): number {
    const values = series.filter(p => p.value !== null).map(p => p.value as number);
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

/**
 * Rank and select top N fields for correlation analysis.
 * Stable ranking: numeric > boolean, coverage desc, charted fields, variance desc, alpha.
 */
function selectTopFields(
    fields: FrontmatterField[],
    entries: JournalEntry[],
    selectedChartFields: string[],
    limit: number
): FrontmatterField[] {
    const numericFields = fields.filter(f => f.type === 'number');
    if (numericFields.length <= limit) return numericFields;

    // Pre-compute variance for ranking
    const varianceMap = new Map<string, number>();
    for (const field of numericFields) {
        const series = getTimeSeries(entries, field.key);
        varianceMap.set(field.key, computeVariance(series));
    }

    return numericFields
        .sort((a, b) => {
            // 1. Coverage descending
            const coverageDiff = b.coverage - a.coverage;
            if (coverageDiff !== 0) return coverageDiff;

            // 2. Charted fields first
            const aCharted = selectedChartFields.includes(a.key) ? 1 : 0;
            const bCharted = selectedChartFields.includes(b.key) ? 1 : 0;
            if (bCharted !== aCharted) return bCharted - aCharted;

            // 3. Variance descending
            const varDiff = (varianceMap.get(b.key) ?? 0) - (varianceMap.get(a.key) ?? 0);
            if (varDiff !== 0) return varDiff;

            // 4. Alphabetical tie-break
            return a.key.localeCompare(b.key);
        })
        .slice(0, limit);
}

/**
 * Find all significant correlations across all numeric field pairs.
 * Significance threshold: |r| >= 0.4 (moderate or stronger correlation).
 * Returns sorted by absolute r value (strongest first).
 *
 * Capped at 20 numeric fields on desktop, 10 on mobile.
 * Uses a plain for loop with signal check (not processWithYielding).
 *
 * @param entries - Journal entries
 * @param fields - Detected frontmatter fields
 * @param selectedChartFields - Fields the user has charted (for ranking)
 * @param signal - Optional cancellation signal
 */
export async function findCorrelations(
    entries: JournalEntry[],
    fields: FrontmatterField[],
    selectedChartFields: string[],
    signal?: { cancelled: boolean }
): Promise<{ results: CorrelationResult[]; totalFields: number; analyzedFields: number }> {
    const limit = Platform.isMobile ? 10 : 20;
    const numericFields = fields.filter(f => f.type === 'number');
    const topFields = selectTopFields(fields, entries, selectedChartFields, limit);

    // Pre-compute all time series ONCE
    const seriesMap = new Map<string, MetricDataPoint[]>();
    for (const field of topFields) {
        seriesMap.set(field.key, getTimeSeries(entries, field.key));
    }

    // Zero-variance pre-filter: exclude fields with variance < 0.0001
    const viableFields = topFields.filter(f => {
        const series = seriesMap.get(f.key);
        if (!series) return false;
        return computeVariance(series) >= 0.0001;
    });

    // Generate all pairs
    const results: CorrelationResult[] = [];

    for (let i = 0; i < viableFields.length; i++) {
        for (let j = i + 1; j < viableFields.length; j++) {
            if (signal?.cancelled) {
                return { results: [], totalFields: numericFields.length, analyzedFields: topFields.length };
            }

            const fieldA = viableFields[i].key;
            const fieldB = viableFields[j].key;
            const seriesA = seriesMap.get(fieldA);
            const seriesB = seriesMap.get(fieldB);

            if (!seriesA || !seriesB) continue;

            const r = pearsonCorrelation(seriesA, seriesB);
            if (r !== null && Math.abs(r) >= 0.4) {
                // Count paired data points
                const mapB = new Map<number, number>();
                for (const p of seriesB) {
                    if (p.value !== null) mapB.set(p.date, p.value);
                }
                let n = 0;
                for (const p of seriesA) {
                    if (p.value !== null && mapB.has(p.date)) n++;
                }

                results.push({ fieldA, fieldB, r: Math.round(r * 1000) / 1000, n });
            }
        }
    }

    // Sort by absolute r value (strongest first)
    results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    return {
        results,
        totalFields: numericFields.length,
        analyzedFields: topFields.length,
    };
}

/**
 * Find all significant conditional averages across all numeric+boolean pairs.
 * Significance threshold: |difference| >= 0.5 AND sampleSize >= 5 per group.
 *
 * Capped at top 10 boolean fields by coverage × top 20 numeric fields.
 *
 * @param entries - Journal entries
 * @param fields - Detected frontmatter fields
 */
export function findConditionalInsights(
    entries: JournalEntry[],
    fields: FrontmatterField[]
): ConditionalInsight[] {
    const numericFields = fields
        .filter(f => f.type === 'number')
        .sort((a, b) => b.coverage - a.coverage)
        .slice(0, 20);

    const booleanFields = fields
        .filter(f => f.type === 'boolean')
        .sort((a, b) => b.coverage - a.coverage)
        .slice(0, 10);

    const results: ConditionalInsight[] = [];

    for (const numField of numericFields) {
        for (const boolField of booleanFields) {
            const result = conditionalAverage(entries, numField.key, boolField.key);
            if (result && Math.abs(result.difference) >= 0.5 &&
                result.sampleSizeTrue >= 5 && result.sampleSizeFalse >= 5) {
                results.push(result);
            }
        }
    }

    // Sort by absolute difference (most significant first)
    results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    return results;
}

/**
 * Compute weekly comparison: this week's averages vs last week's for all numeric fields.
 * Returns fields with notable changes (>= 15% or >= 1 unit difference).
 *
 * @param entries - All journal entries
 * @param fields - Detected fields
 * @param referenceDate - Current date reference
 * @param weekStartDay - 0=Sunday, 1=Monday
 */
export function weeklyComparison(
    entries: JournalEntry[],
    fields: FrontmatterField[],
    referenceDate: Date,
    weekStartDay: 0 | 1 = 0
): { field: string; thisWeek: number; lastWeek: number; change: number; percentChange: number }[] {
    const thisWeekBounds = getWeekBounds(referenceDate, weekStartDay);
    const lastWeekRef = new Date(referenceDate);
    lastWeekRef.setDate(lastWeekRef.getDate() - 7);
    const lastWeekBounds = getWeekBounds(lastWeekRef, weekStartDay);

    const numericFields = fields.filter(f => f.type === 'number');
    const results: { field: string; thisWeek: number; lastWeek: number; change: number; percentChange: number }[] = [];

    for (const field of numericFields) {
        const thisWeekValues: number[] = [];
        const lastWeekValues: number[] = [];

        for (const entry of entries) {
            const val = entry.frontmatter[field.key];
            if (typeof val !== 'number') continue;

            const entryTime = entry.date.getTime();
            if (entryTime >= thisWeekBounds.start.getTime() && entryTime <= thisWeekBounds.end.getTime()) {
                thisWeekValues.push(val);
            } else if (entryTime >= lastWeekBounds.start.getTime() && entryTime <= lastWeekBounds.end.getTime()) {
                lastWeekValues.push(val);
            }
        }

        if (thisWeekValues.length === 0 || lastWeekValues.length === 0) continue;

        const thisAvg = thisWeekValues.reduce((s, v) => s + v, 0) / thisWeekValues.length;
        const lastAvg = lastWeekValues.reduce((s, v) => s + v, 0) / lastWeekValues.length;
        const change = thisAvg - lastAvg;
        const percentChange = lastAvg !== 0 ? (change / Math.abs(lastAvg)) * 100 : 0;

        // Only include notable changes
        if (Math.abs(percentChange) >= 15 || Math.abs(change) >= 1) {
            results.push({
                field: field.key,
                thisWeek: Math.round(thisAvg * 100) / 100,
                lastWeek: Math.round(lastAvg * 100) / 100,
                change: Math.round(change * 100) / 100,
                percentChange: Math.round(percentChange * 10) / 10,
            });
        }
    }

    // Sort by absolute percent change
    results.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    return results;
}
