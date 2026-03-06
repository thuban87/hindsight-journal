/**
 * uPlot Evaluation View
 * 
 * Temporary ItemView for evaluating uPlot inside Obsidian.
 * Renders 5 chart types matching Brad's journal frontmatter fields.
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

/** Generate fake mood data (1-10 scale, realistic variation) */
function generateMoodData(count: number): (number | null)[] {
    const data: (number | null)[] = [];
    let base = 5;
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.08) {
            data.push(null);
        } else {
            // Wider swing so data fills the chart vertically
            base += (Math.random() - 0.5) * 3;
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
            base += (Math.random() - 0.5) * 2;
            base = Math.max(3, Math.min(10, base));
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
        if (mood === null) return Math.random() < 0.5 ? null : Math.round((Math.random() * 6 + 2) * 10) / 10;
        const energy = mood + (Math.random() - 0.5) * 4;
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

/** Format a unix timestamp (seconds) into a readable date string */
function formatDate(ts: number): string {
    const d = new Date(ts * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Custom tooltip plugin for uPlot.
 * Shows a floating tooltip with date + series values on hover.
 */
function tooltipPlugin(colors: ReturnType<typeof getThemeColors>) {
    let tooltipEl: HTMLDivElement | null = null;

    function init(u: uPlot) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'hindsight-uplot-tooltip';
        tooltipEl.style.display = 'none';
        u.over.appendChild(tooltipEl);
    }

    function setCursor(u: uPlot) {
        if (!tooltipEl) return;
        const idx = u.cursor.idx;
        if (idx == null || idx < 0) {
            tooltipEl.style.display = 'none';
            return;
        }

        const xVal = u.data[0][idx];
        let html = `<div class="hindsight-tooltip-date">${formatDate(xVal)}</div>`;

        let hasValue = false;
        for (let i = 1; i < u.series.length; i++) {
            const s = u.series[i];
            if (!s.show) continue;
            const val = u.data[i][idx];
            if (val == null) continue;
            hasValue = true;
            const color = typeof s.stroke === 'function' ? colors.accent : (s.stroke as string);
            html += `<div class="hindsight-tooltip-row">
                <span class="hindsight-tooltip-dot" style="background:${color}"></span>
                <span class="hindsight-tooltip-label">${s.label ?? ''}</span>
                <span class="hindsight-tooltip-value">${val}</span>
            </div>`;
        }

        if (!hasValue) {
            tooltipEl.style.display = 'none';
            return;
        }

        tooltipEl.innerHTML = html;
        tooltipEl.style.display = 'block';

        const { left, top } = u.cursor;
        if (left == null || top == null) return;

        const tooltipWidth = tooltipEl.offsetWidth;
        const plotWidth = u.over.clientWidth;

        let xPos = left + 12;
        if (xPos + tooltipWidth > plotWidth - 10) {
            xPos = left - tooltipWidth - 12;
        }

        tooltipEl.style.left = `${Math.max(0, xPos)}px`;
        tooltipEl.style.top = `${Math.max(0, top - 10)}px`;
    }

    return {
        hooks: {
            init,
            setCursor,
        },
    };
}

/**
 * Auto-range with a small amount of padding above and below the data.
 * uPlot calls this to determine the y-axis bounds.
 */
function paddedRange(_u: uPlot, dataMin: number, dataMax: number): [number, number] {
    const span = dataMax - dataMin || 1;
    const pad = span * 0.1;
    return [
        Math.floor((dataMin - pad) * 10) / 10,
        Math.ceil((dataMax + pad) * 10) / 10,
    ];
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
        this.addHeading(container, 'Mood over time (line chart)', 'Primary use case — numeric 1-10 scale with gaps for missing days. Hover over points to see values.');
        this.charts.push(this.createLineChart(container, dates, moodData, {
            label: 'Mood',
            color: colors.accent,
            width: chartWidth,
            height: 280,
            colors,
        }));

        // ===== 2. Sleep Duration Area Chart =====
        this.addHeading(container, 'Sleep duration (area chart)', 'Filled area chart — hover to see hours. Shows how uPlot handles fill/stroke and null gaps.');
        this.charts.push(this.createAreaChart(container, dates, sleepData, {
            label: 'Sleep (hrs)',
            color: colors.success,
            width: chartWidth,
            height: 250,
            colors,
        }));

        // ===== 3. Boolean Habits Dot Chart =====
        this.addHeading(container, 'Boolean habits (dot chart)', 'Morning meds, evening meds, workout — shown as colored dots. Tests points-only rendering.');
        this.charts.push(this.createBooleanChart(container, dates, [
            { data: morningMeds, label: 'Morning meds', color: colors.success },
            { data: eveningMeds, label: 'Evening meds', color: colors.warning },
            { data: workout, label: 'Workout', color: colors.accent },
        ], {
            width: chartWidth,
            height: 180,
            colors,
        }));

        // ===== 4. Multi-Metric Overlay =====
        this.addHeading(container, 'Multi-metric overlay (mood + energy)', 'Two series on the same axes — hover to compare values side by side.');
        this.charts.push(this.createMultiLineChart(container, dates, [
            { data: moodData, label: 'Mood', color: colors.accent },
            { data: energyData, label: 'Energy', color: colors.warning },
        ], {
            width: chartWidth,
            height: 280,
            colors,
        }));

        // ===== 5. Sparklines =====
        this.addHeading(container, 'Sparklines (sidebar preview)', 'Tiny inline charts for the sidebar widget — tests minimal rendering.');
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

    /** Add a heading + description directly to the container (no wrapper div) */
    private addHeading(container: HTMLElement, title: string, description: string): void {
        container.createEl('h2', { text: title, cls: 'hindsight-chart-heading' });
        container.createEl('p', { text: description, cls: 'hindsight-chart-desc' });
    }

    private getCommonAxes(colors: ReturnType<typeof getThemeColors>): uPlot.Axis[] {
        return [
            {
                stroke: colors.textMuted,
                grid: { stroke: colors.border, width: 1 },
                ticks: { stroke: colors.border, width: 1 },
                font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                gap: 5,
            },
            {
                stroke: colors.textMuted,
                grid: { stroke: colors.border, width: 1 },
                ticks: { stroke: colors.border, width: 1 },
                font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                size: 45,
                gap: 5,
            },
        ];
    }

    private createLineChart(
        el: HTMLElement,
        dates: number[],
        values: (number | null)[],
        opts: { label: string; color: string; width: number; height: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: {
                show: true,
                drag: { x: true, y: false },
                points: { size: 8, fill: opts.color, stroke: opts.colors.bg, width: 2 },
            },
            legend: { show: false },
            plugins: [tooltipPlugin(opts.colors)],
            scales: {
                y: { range: paddedRange },
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
        opts: { label: string; color: string; width: number; height: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: {
                show: true,
                drag: { x: true, y: false },
                points: { size: 8, fill: opts.color, stroke: opts.colors.bg, width: 2 },
            },
            legend: { show: false },
            plugins: [tooltipPlugin(opts.colors)],
            scales: {
                y: { range: paddedRange },
            },
            axes: this.getCommonAxes(opts.colors),
            series: [
                {},
                {
                    label: opts.label,
                    stroke: opts.color,
                    width: 2,
                    fill: opts.color + '30',
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
        const spreadData = series.map((s, idx) =>
            s.data.map(v => {
                if (v === null) return null;
                return v === 1 ? (series.length - idx) : null;
            })
        );

        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: { show: true },
            legend: { show: false },
            plugins: [tooltipPlugin(opts.colors)],
            scales: {
                y: { range: [0, series.length + 1] },
            },
            axes: [
                {
                    stroke: opts.colors.textMuted,
                    grid: { stroke: opts.colors.border, width: 1 },
                    ticks: { stroke: opts.colors.border, width: 1 },
                    font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                    gap: 5,
                },
                {
                    stroke: opts.colors.textMuted,
                    grid: { show: false },
                    ticks: { show: false },
                    font: '11px -apple-system, BlinkMacSystemFont, sans-serif',
                    size: 110,
                    gap: 5,
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
                    paths: () => null,
                })),
            ],
        };

        return new uPlot(uplotOpts, [dates, ...spreadData as number[][]], el);
    }

    private createMultiLineChart(
        el: HTMLElement,
        dates: number[],
        series: { data: (number | null)[]; label: string; color: string }[],
        opts: { width: number; height: number; colors: ReturnType<typeof getThemeColors> },
    ): uPlot {
        const uplotOpts: uPlot.Options = {
            width: opts.width,
            height: opts.height,
            cursor: {
                show: true,
                drag: { x: true, y: false },
                points: { size: 8, stroke: opts.colors.bg, width: 2 },
            },
            legend: { show: false },
            plugins: [tooltipPlugin(opts.colors)],
            scales: {
                y: { range: paddedRange },
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
                y: { range: paddedRange },
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

    /** Minimal uPlot CSS — themed to Obsidian */
    private getUPlotCSS(): string {
        return `
            .uplot {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .u-legend {
                display: none !important;
            }
            .u-cursor-pt {
                border-radius: 50%;
            }
            .hindsight-uplot-tooltip {
                position: absolute;
                z-index: 100;
                background: var(--background-primary, #1e1e1e);
                border: 1px solid var(--background-modifier-border, #363636);
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 12px;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                min-width: 120px;
            }
            .hindsight-tooltip-date {
                color: var(--text-muted, #999);
                font-size: 11px;
                margin-bottom: 4px;
                font-weight: 500;
            }
            .hindsight-tooltip-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 2px 0;
            }
            .hindsight-tooltip-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .hindsight-tooltip-label {
                color: var(--text-muted, #999);
                flex: 1;
            }
            .hindsight-tooltip-value {
                color: var(--text-normal, #dcddde);
                font-weight: 600;
                font-variant-numeric: tabular-nums;
            }
        `;
    }
}
