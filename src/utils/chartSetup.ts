/**
 * Chart.js Setup — Tree-Shaken Registration
 *
 * Side-effect module that registers only the Chart.js components
 * actually used by the plugin. Import this once before creating
 * any Chart instances.
 *
 * IMPORTANT:
 * - Tooltip is intentionally NOT registered. The default tooltip
 *   plugin uses innerHTML internally, which triggers the Obsidian
 *   review bot's automatic security flag. All chart tooltips are
 *   rendered via React state + positioned <div> elements.
 * - Do NOT use `import Chart from 'chart.js/auto'` — that imports
 *   everything and defeats tree-shaking (~180KB → ~80KB).
 */

import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Legend,
    ScatterController,
    BarController,
    BarElement,
    Filler,
} from 'chart.js';

// Register only what we use — idempotent, safe to call multiple times
Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Legend,
    ScatterController,
    BarController,
    BarElement,
    Filler,
);

export { Chart };
