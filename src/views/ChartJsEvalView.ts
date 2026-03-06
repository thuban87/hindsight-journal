/**
 * Chart.js Evaluation View
 * 
 * Temporary ItemView for evaluating Chart.js inside Obsidian.
 * Same 5 chart types as the uPlot eval for direct comparison:
 * 1. Mood over time (line chart with points)
 * 2. Sleep duration (area/fill chart)
 * 3. Boolean habits (dot chart)
 * 4. Multi-metric overlay (mood + energy)
 * 5. Sparklines (tiny inline charts)
 * 
 * This entire file will be removed after the charting library decision.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Chart, registerables } from 'chart.js';
import type HindsightPlugin from '../../main';
import { CHARTJS_EVAL_VIEW_TYPE } from '../constants';

// Register all Chart.js components
Chart.register(...registerables);

/** Generate date labels for the last N days */
function generateDateLabels(count: number): string[] {
    const labels: string[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        labels.push(`${months[d.getMonth()]} ${d.getDate()}`);
    }
    return labels;
}

/** Generate fake mood data (1-10, realistic variation) */
function generateMoodData(count: number): (number | null)[] {
    const data: (number | null)[] = [];
    let base = 5;
    for (let i = 0; i < count; i++) {
        if (Math.random() < 0.08) {
            data.push(null);
        } else {
            base += (Math.random() - 0.5) * 3;
            base = Math.max(1, Math.min(10, base));
            data.push(Math.round(base * 10) / 10);
        }
    }
    return data;
}

/** Generate fake sleep data (3-10 hours) */
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

/** Generate fake boolean data (0 or 1) */
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

/** Hex color + opacity to rgba */
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Common Chart.js defaults themed to Obsidian */
function getChartDefaults(colors: ReturnType<typeof getThemeColors>) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: colors.bg,
                titleColor: colors.textMuted,
                bodyColor: colors.text,
                borderColor: colors.border,
                borderWidth: 1,
                cornerRadius: 6,
                padding: 10,
                titleFont: { size: 11, weight: 'bold' as const },
                bodyFont: { size: 12 },
                usePointStyle: true,
                boxPadding: 4,
            },
        },
        scales: {
            x: {
                ticks: { color: colors.textMuted, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
                grid: { color: colors.border, lineWidth: 0.5 },
                border: { color: colors.border },
            },
            y: {
                ticks: { color: colors.textMuted, font: { size: 10 } },
                grid: { color: colors.border, lineWidth: 0.5 },
                border: { color: colors.border },
            },
        },
    };
}

export class ChartJsEvalView extends ItemView {
    plugin: HindsightPlugin;
    private charts: Chart[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: HindsightPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return CHARTJS_EVAL_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Chart.js evaluation';
    }

    getIcon(): string {
        return 'line-chart';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('hindsight-container', 'hindsight-chartjs-eval');

        const DAYS = 90;
        const labels = generateDateLabels(DAYS);
        const moodData = generateMoodData(DAYS);
        const sleepData = generateSleepData(DAYS);
        const morningMeds = generateBooleanData(DAYS, 0.85);
        const eveningMeds = generateBooleanData(DAYS, 0.75);
        const workout = generateBooleanData(DAYS, 0.45);
        const energyData = generateEnergyData(moodData);

        const colors = getThemeColors();

        // ===== 1. Mood Line Chart =====
        this.addSection(container, 'Mood over time (line chart)', 'Numeric 1-10 scale with gaps for missing days. Hover for tooltips.');
        this.charts.push(this.createLineChart(container, labels, moodData, {
            label: 'Mood',
            color: colors.accent,
            height: 280,
            colors,
        }));

        // ===== 2. Sleep Duration Area Chart =====
        this.addSection(container, 'Sleep duration (area chart)', 'Filled area chart with gradient fill and smooth curves.');
        this.charts.push(this.createAreaChart(container, labels, sleepData, {
            label: 'Sleep (hrs)',
            color: colors.success,
            height: 250,
            colors,
        }));

        // ===== 3. Boolean Habits =====
        this.addSection(container, 'Boolean habits (stacked bar)', 'Morning meds, evening meds, workout — shown as colored bars per day.');
        this.charts.push(this.createBooleanChart(container, labels, [
            { data: morningMeds, label: 'Morning meds', color: colors.success },
            { data: eveningMeds, label: 'Evening meds', color: colors.warning },
            { data: workout, label: 'Workout', color: colors.accent },
        ], { height: 200, colors }));

        // ===== 4. Multi-Metric Overlay =====
        this.addSection(container, 'Multi-metric overlay (mood + energy)', 'Two series on the same axes — hover to compare values side by side.');
        this.charts.push(this.createMultiLineChart(container, labels, [
            { data: moodData, label: 'Mood', color: colors.accent },
            { data: energyData, label: 'Energy', color: colors.warning },
        ], { height: 280, colors }));

        // ===== 5. Sparklines =====
        this.addSection(container, 'Sparklines (sidebar preview)', 'Tiny inline charts for the sidebar widget.');
        const sparkContainer = container.createDiv('hindsight-sparkline-container');
        const last30Labels = labels.slice(-30);
        this.createSparkline(sparkContainer, last30Labels, moodData.slice(-30), 'Mood', moodData.filter(v => v !== null).pop()?.toString() ?? '—', colors.accent, colors);
        this.createSparkline(sparkContainer, last30Labels, sleepData.slice(-30), 'Sleep', (sleepData.filter(v => v !== null).pop()?.toFixed(1) ?? '—') + 'h', colors.success, colors);
        this.createSparkline(sparkContainer, last30Labels, energyData.slice(-30), 'Energy', energyData.filter(v => v !== null).pop()?.toString() ?? '—', colors.warning, colors);
    }

    async onClose(): Promise<void> {
        for (const chart of this.charts) {
            chart.destroy();
        }
        this.charts = [];
    }

    private addSection(container: HTMLElement, title: string, description: string): void {
        container.createEl('h2', { text: title, cls: 'hindsight-chart-heading' });
        container.createEl('p', { text: description, cls: 'hindsight-chart-desc' });
    }

    private createCanvas(container: HTMLElement, height: number): HTMLCanvasElement {
        const wrapper = container.createDiv('hindsight-chartjs-wrapper');
        wrapper.style.height = `${height}px`;
        wrapper.style.position = 'relative';
        return wrapper.createEl('canvas');
    }

    // ===== Chart Builders =====

    private createLineChart(
        container: HTMLElement,
        labels: string[],
        data: (number | null)[],
        opts: { label: string; color: string; height: number; colors: ReturnType<typeof getThemeColors> },
    ): Chart {
        const canvas = this.createCanvas(container, opts.height);
        const defaults = getChartDefaults(opts.colors);

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: opts.label,
                    data,
                    borderColor: opts.color,
                    backgroundColor: opts.color,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: opts.color,
                    pointHoverBackgroundColor: opts.color,
                    pointBorderColor: opts.colors.bgSecondary,
                    pointHoverBorderColor: opts.colors.bg,
                    pointBorderWidth: 1,
                    pointHoverBorderWidth: 2,
                    tension: 0.3,
                    spanGaps: false,
                }],
            },
            options: {
                ...defaults,
                scales: {
                    ...defaults.scales,
                    y: { ...defaults.scales.y, beginAtZero: false },
                },
            },
        });
    }

    private createAreaChart(
        container: HTMLElement,
        labels: string[],
        data: (number | null)[],
        opts: { label: string; color: string; height: number; colors: ReturnType<typeof getThemeColors> },
    ): Chart {
        const canvas = this.createCanvas(container, opts.height);
        const defaults = getChartDefaults(opts.colors);

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: opts.label,
                    data,
                    borderColor: opts.color,
                    backgroundColor: hexToRgba(opts.color, 0.15),
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: opts.color,
                    pointHoverBackgroundColor: opts.color,
                    pointBorderColor: 'transparent',
                    pointHoverBorderColor: opts.colors.bg,
                    pointHoverBorderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    spanGaps: false,
                }],
            },
            options: {
                ...defaults,
                scales: {
                    ...defaults.scales,
                    y: { ...defaults.scales.y, beginAtZero: true },
                },
            },
        });
    }

    private createBooleanChart(
        container: HTMLElement,
        labels: string[],
        series: { data: (number | null)[]; label: string; color: string }[],
        opts: { height: number; colors: ReturnType<typeof getThemeColors> },
    ): Chart {
        const canvas = this.createCanvas(container, opts.height);
        const defaults = getChartDefaults(opts.colors);

        return new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: series.map(s => ({
                    label: s.label,
                    data: s.data,
                    backgroundColor: hexToRgba(s.color, 0.7),
                    borderColor: s.color,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.8,
                })),
            },
            options: {
                ...defaults,
                plugins: {
                    ...defaults.plugins,
                    legend: {
                        display: true,
                        position: 'top' as const,
                        labels: {
                            color: opts.colors.textMuted,
                            boxWidth: 12,
                            boxHeight: 12,
                            borderRadius: 3,
                            useBorderRadius: true,
                            padding: 16,
                            font: { size: 11 },
                        },
                    },
                },
                scales: {
                    ...defaults.scales,
                    x: { ...defaults.scales.x, stacked: true },
                    y: {
                        ...defaults.scales.y,
                        stacked: true,
                        max: 3.5,
                        ticks: { ...defaults.scales.y.ticks, stepSize: 1 },
                    },
                },
            },
        });
    }

    private createMultiLineChart(
        container: HTMLElement,
        labels: string[],
        series: { data: (number | null)[]; label: string; color: string }[],
        opts: { height: number; colors: ReturnType<typeof getThemeColors> },
    ): Chart {
        const canvas = this.createCanvas(container, opts.height);
        const defaults = getChartDefaults(opts.colors);

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: series.map(s => ({
                    label: s.label,
                    data: s.data,
                    borderColor: s.color,
                    backgroundColor: s.color,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: s.color,
                    pointHoverBackgroundColor: s.color,
                    pointBorderColor: 'transparent',
                    pointHoverBorderColor: opts.colors.bg,
                    pointHoverBorderWidth: 2,
                    tension: 0.3,
                    spanGaps: false,
                })),
            },
            options: {
                ...defaults,
                plugins: {
                    ...defaults.plugins,
                    legend: {
                        display: true,
                        position: 'top' as const,
                        labels: {
                            color: opts.colors.textMuted,
                            boxWidth: 12,
                            boxHeight: 12,
                            borderRadius: 6,
                            useBorderRadius: true,
                            padding: 16,
                            font: { size: 11 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                        },
                    },
                },
                scales: {
                    ...defaults.scales,
                    y: { ...defaults.scales.y, beginAtZero: false },
                },
            },
        });
    }

    private createSparkline(
        container: HTMLElement,
        labels: string[],
        data: (number | null)[],
        label: string,
        currentValue: string,
        color: string,
        colors: ReturnType<typeof getThemeColors>,
    ): void {
        const row = container.createDiv('hindsight-sparkline-row');
        row.createDiv({ cls: 'hindsight-sparkline-label', text: label });

        const chartWrapper = row.createDiv('hindsight-sparkline-chart');
        chartWrapper.style.width = '200px';
        chartWrapper.style.height = '32px';
        chartWrapper.style.position = 'relative';
        const canvas = chartWrapper.createEl('canvas');

        this.charts.push(new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: color,
                    backgroundColor: hexToRgba(color, 0.1),
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false },
                },
            },
        }));

        row.createDiv({ cls: 'hindsight-sparkline-value', text: currentValue });
    }
}
