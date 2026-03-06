/**
 * uPlot Evaluation View
 * 
 * Temporary ItemView for evaluating uPlot inside Obsidian.
 * Renders 5 chart types matching Brad's journal frontmatter fields:
 * 1. Mood over time (line chart with points)
 * 2. Sleep duration (area/fill chart)
 * 3. Boolean habits — meds taken, workout (dot chart)
 * 4. Multi-metric overlay — mood + energy
 * 5. Sparklines — tiny inline charts for sidebar
 * 
 * Uses fake data matching the Implementation Plan frontmatter fields.
 * This entire file will be removed after the charting library decision.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import uPlot from 'uplot';
import type HindsightPlugin from '../../main';
import { HINDSIGHT_UPLOT_EVAL_VIEW_TYPE } from '../constants';

/** Generate an array of unix timestamps, one per day, going back N days from today */
function generateDates(count: number): number[] {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const dates: number[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.getTime() / 1000); // uPlot uses seconds
    }
    return dates;
}

/** Generate fake mood data (1-10 scale, with some nulls for missing days) */
function generateMoodData(count: number): (number | null)[] {
    const data: (number | null)[] = [];
    let base = 6;
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.08) {
            data.push(null); // ~8% missing days
        } else {
            base += (Math.random() - 0.48) * 1.5;
            base = Math.max(1, Math.min(10, base));
            data.push(Math.round(base * 10) / 10);
        }
    }
    return data;
}

/** Generate fake sleep data (4-10 hours range) */
function generateSleepData(count: number): (number | null)[] {
    const data: (number | null)[] = [];
    let base = 7;
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.05) {
            data.push(null);
        } else {
            base += (Math.random() - 0.5) * 1.2;
            base = Math.max(4, Math.min(10, base));
            data.push(Math.round(base * 10) / 10);
        }
    }
    return data;
}

/** Generate fake boolean data (0 or 1, with some nulls) */
function generateBooleanData(count: number, probability: number): (number | null)[] {
    const data: (number | null)[] = [];
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.03) {
            data.push(null);
        } else {
            data.push(Math.random() < probability ? 1 : 0);
        }
    }
    return data;
}

/** Generate fake energy data (1-10, correlated with mood) */
function generateEnergyData(moodData: (number | null)[]): (number | null)[] {
    return moodData.map(mood => {
        if (mood === null) return Math.random() < 0.5 ? null : Math.round((Math.random() * 4 + 4) * 10) / 10;
        // Correlated with mood but with some noise
        const energy = mood + (Math.random() - 0.5) * 3;
        return Math.round(Math.max(1, Math.min(10, energy)) * 10) / 10;
    });
}

/** Get Obsidian CSS variable value */
function getCssVar(name: string): string {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/** Build a color palette from Obsidian CSS variables */
function getThemeColors() {
    return {
        text: getCssVar('--text-normal') || '#dcddde',
        textMuted: getCssVar('--text-muted') || '#999',
        bg: getCssVar('--background-primary') || '#1e1e1e',
        bgSecondary: getCssVar('--background-secondary') || '#262626',
        border: getCssVar('--background-modifier-border') || '#363636',
        accent: getCssVar('--interactive-accent') || '#7c5bf0',
        success: getCssVar('--text-success') || '#59a869',
        warning: getCssVar('--text-warning') || '#e5c07b',
        error: getCssVar('--text-error') || '#e06c75',
    };
}

export class UPlotEvalView extends ItemView {
    plugin: HindsightPlugin;
    private charts: uPlot[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: HindsightPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return HINDSIGHT_UPLOT_EVAL_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'uPlot evaluation';
    }

    getIcon(): string {
        return 'bar-chart-3';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('hindsight-container', 'hindsight-uplot-eval');

        // Inject uPlot CSS
        const styleEl = document.createElement('style');
        styleEl.textContent = this.getUPlotCSS();
        container.appendChild(styleEl);

        const DAYS = 90;
        const dates = generateDates(DAYS);
        const moodData = generateMoodData(DAYS);
        const sleepData = generateSleepData(DAYS);
        const morningMeds = generateBooleanData(DAYS, 0.85);
        const eveningMeds = generateBooleanData(DAYS, 0.75);
        const workout = generateBooleanData(DAYS, 0.45);
        const energyData = generateEnergyData(moodData);

        const colors = getThemeColors();
        const chartWidth = container.clientWidth - 32;

        // ===== 1. Mood Line Chart =====
        this.createSection(container, 'Mood over time (line chart)', 'Primary use case — numeric 1-10 scale with gaps for missing days. Tests line rendering, null handling, and tooltips.');
        const moodEl = this.createChartWrapper(container);
        this.charts.push(this.createLineChart(moodEl, dates, moodData, {
            label: 'Mood',
            color: colors.accent,
            width: chartWidth,
            height: 220,
            yMin: 1,
            yMax: 10,
            colors,
        }));

        // ===== 2. Sleep Duration Area Chart =====
        this.createSection(container, 'Sleep duration (area chart)', 'Filled area chart — shows how uPlot handles fill/stroke and null gaps.');
        const sleepEl = this.createChartWrapper(container);
        this.charts.push(this.createAreaChart(sleepEl, dates, sleepData, {
            label: 'Sleep (hrs)',
            color: colors.success,
            width: chartWidth,
            height: 200,
            yMin: 0,
            yMax: 12,
            colors,
        }));

        // ===== 3. Boolean Habits Dot Chart =====
        this.createSection(container, 'Boolean habits (dot chart)', 'Morning meds, evening meds, workout — shown as colored dots. Tests points-only rendering.');
        const boolEl = this.createChartWrapper(container);
        this.charts.push(this.createBooleanChart(boolEl, dates, [
            { data: morningMeds, label: 'Morning meds', color: colors.success },
            { data: eveningMeds, label: 'Evening meds', color: colors.warning },
            { data: workout, label: 'Workout', color: colors.accent },
        ], {
            width: chartWidth,
            height: 160,
            colors,
        }));

        // ===== 4. Multi-Metric Overlay =====
        this.createSection(container, 'Multi-metric overlay (mood + energy)', 'Two series on the same axes — tests multi-series rendering and legend.');
        const multiEl = this.createChartWrapper(container);
        this.charts.push(this.createMultiLineChart(multiEl, dates, [
            { data: moodData, label: 'Mood', color: colors.accent },
            { data: energyData, label: 'Energy', color: colors.warning },
        ], {
            width: chartWidth,
            height: 220,
            yMin: 1,
            yMax: 10,
            colors,
        }));

        // ===== 5. Sparklines =====
        this.createSection(container, 'Sparklines (sidebar preview)', 'Tiny inline charts for the sidebar widget — tests minimal rendering.');
        const sparkContainer = container.createDiv('hindsight-sparkline-container');
        this.createSparklineRow(sparkContainer, dates, moodData, 'Mood', moodData.filter(v => v !== null).pop()?.toString() ?? '—', colors.accent, colors);
        this.createSparklineRow(sparkContainer, dates, sleepData, 'Sleep', (sleepData.filter(v => v !== null).pop()?.toFixed(1) ?? '—') + 'h', colors.success, colors);
        this.createSparklineRow(sparkContainer, dates, energyData, 'Energy', energyData.filter(v => v !== null).pop()?.toString() ?? '—', colors.warning, colors);
    }

    async onClose(): Promise<void> {
        for (const chart of this.charts) {
            chart.destroy();
        }
        this.charts = [];
    }

    private createSection(container: HTMLElement, title: string, description: string): void {
        const section = container.createDiv('hindsight-uplot-section');
        section.createEl('h2', { text: title });
        section.createEl('p', { text: description });
    }

    private createChartWrapper(container: HTMLElement): HTMLElement {
        return container.createDiv('hindsight-chart-wrapper');
    }

    private getCommonAxes(colors: ReturnType<typeof getThemeColors>): uPlot.Axis[] {
        return [
            {
                stroke: colors.textMuted,
                grid: { stroke: colors.border, width: 1 },
                ticks: { stroke: colors.border, width: 1 },
                font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
            },
            {
                stroke: colors.textMuted,
                grid: { stroke: colors.border, width: 1 },
                ticks: { stroke: colors.border, width: 1 },
                font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                size: 50,
            },
        ];
    }

    private createLineChart(
        el: HTMLElement,
        dates: number[],
        values: (number | null)[],
        opts: { label: string; color: string; width: number; height: number; yMin: number; yMax: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: { show: true, drag: { x: true, y: false } },
            scales: {
                y: { range: [opts.yMin, opts.yMax] },
            },
            axes: this.getCommonAxes(opts.colors),
            series: [
                {},
                {
                    label: opts.label,
                    stroke: opts.color,
                    width: 2,
                    points: { size: 4, fill: opts.color },
                    spanGaps: false,
                },
            ],
        };

        return new uPlot(uplotOpts, [dates, values as number[]], el);
    }

    private createAreaChart(
        el: HTMLElement,
        dates: number[],
        values: (number | null)[],
        opts: { label: string; color: string; width: number; height: number; yMin: number; yMax: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: { show: true, drag: { x: true, y: false } },
            scales: {
                y: { range: [opts.yMin, opts.yMax] },
            },
            axes: this.getCommonAxes(opts.colors),
            series: [
                {},
                {
                    label: opts.label,
                    stroke: opts.color,
                    width: 2,
                    fill: opts.color + '30', // 30 = ~19% opacity hex
                    points: { size: 3, fill: opts.color },
                    spanGaps: false,
                },
            ],
        };

        return new uPlot(uplotOpts, [dates, values as number[]], el);
    }

    private createBooleanChart(
        el: HTMLElement,
        dates: number[],
        series: { data: (number | null)[]; label: string; color: string }[],
        opts: { width: number; height: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        // Spread boolean series vertically: series 0 at y=3, series 1 at y=2, series 2 at y=1
        const spreadData = series.map((s, idx) =>
            s.data.map(v => {
                if (v === null) return null;
                return v === 1 ? (series.length - idx) : null; // Only show dots for "true"
            })
        );

        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: { show: true },
            scales: {
                y: { range: [0, series.length + 1] },
            },
            axes: [
                {
                    stroke: opts.colors.textMuted,
                    grid: { stroke: opts.colors.border, width: 1 },
                    ticks: { stroke: opts.colors.border, width: 1 },
                    font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                },
                {
                    stroke: opts.colors.textMuted,
                    grid: { show: false },
                    ticks: { show: false },
                    font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                    size: 50,
                    values: (_u: uPlot, vals: number[]) =>
                        vals.map(v => {
                            const idx = series.length - v;
                            return idx >= 0 && idx < series.length ? series[idx].label : '';
                        }),
                },
            ],
            series: [
                {},
                ...series.map((s, _idx) => ({
                    label: s.label,
                    stroke: s.color,
                    width: 0,
                    points: { size: 8, fill: s.color, space: 0 },
                    paths: () => null, // No lines, just points
                })),
            ],
        };

        return new uPlot(uplotOpts, [dates, ...spreadData as number[][]], el);
    }

    private createMultiLineChart(
        el: HTMLElement,
        dates: number[],
        series: { data: (number | null)[]; label: string; color: string }[],
        opts: { width: number; height: number; yMin: number; yMax: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: { show: true, drag: { x: true, y: false } },
            scales: {
                y: { range: [opts.yMin, opts.yMax] },
            },
            axes: this.getCommonAxes(opts.colors),
            series: [
                {},
                ...series.map(s => ({
                    label: s.label,
                    stroke: s.color,
                    width: 2,
                    points: { size: 3, fill: s.color },
                    spanGaps: false,
                })),
            ],
        };

        return new uPlot(uplotOpts, [dates, ...series.map(s => s.data) as number[][]], el);
    }

    private createSparklineRow(
        container: HTMLElement,
        dates: number[],
        values: (number | null)[],
        label: string,
        currentValue: string,
        color: string,
        colors: ReturnType<typeof getThemeColors>,
    ): void {
        // Only use last 30 days for sparklines
        const last30Dates = dates.slice(-30);
        const last30Values = values.slice(-30);

        const row = container.createDiv('hindsight-sparkline-row');
        row.createDiv({ cls: 'hindsight-sparkline-label', text: label });

        const chartEl = row.createDiv('hindsight-sparkline-chart');

        const uplotOpts: uPlot.Options = {
            width: 200,
            height: 32,
            cursor: { show: false },
            legend: { show: false },
            axes: [
                { show: false },
                { show: false },
            ],
            scales: {
                x: { time: false },
            },
            series: [
                {},
                {
                    stroke: color,
                    width: 1.5,
                    fill: color + '20',
                    points: { show: false },
                    spanGaps: true,
                },
            ],
        };

        this.charts.push(new uPlot(uplotOpts, [last30Dates, last30Values as number[]], chartEl));

        row.createDiv({ cls: 'hindsight-sparkline-value', text: currentValue });
    }

    /** Minimal uPlot CSS — uses Obsidian variables for theme compatibility */
    private getUPlotCSS(): string {
        return `
            .uplot {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .u-legend {
                font-size: 12px;
                padding: 4px 8px;
            }
            .u-legend .u-series {
                padding: 2px 8px;
            }
            .u-legend .u-marker {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            .u-cursor-pt {
                border-radius: 50%;
            }
        `;
    }
}
