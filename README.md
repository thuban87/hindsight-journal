# Hindsight Journal

**Visualize and reflect on your journal entries with calendars, charts, and retrospective insights.**

Hindsight turns your daily Obsidian journal into a rich data source. It reads your frontmatter fields, detects patterns, and gives you tools to explore your history across time. No cloud, no network requests, everything stays local in your vault.

![Calendar view with image thumbnails](assets/images/Hindsight%20Calendar_DM.png)

---

## Features at a Glance

### Journal

Browse your entries three ways: a **calendar** with metric heatmaps and image thumbnails, a **timeline** with scrollable entry cards, and a searchable **index** table.

[Read more about Journal features →](docs/Journal.md)

---

### Insights

Track your data over time with interactive **charts** (line graphs, rolling averages, trend lines, correlations). Check your **pulse** with stats cards, heatmaps, goal trackers, consistency scores, and personal bests. Review **digests** for period-based summaries of task completion and frontmatter field rates.

![Charts view showing mood and energy over 30 days](assets/images/Hindsight%20Charts_DM.png)

![Pulse view with heatmap and personal bests](assets/images/Hindsight%20Pulse_DM.png)

[Read more about Insights features →](docs/Insights.md)

---

### Explore

Search across your entire journal with **Lens** (full-text and frontmatter filters). See tag frequency charts and cross-tag exploration in **Threads**. Browse all embedded images in a **Gallery** grid with lightbox zoom.

![Gallery view with image thumbnails](assets/images/Hindsight%20Gallery_DM.png)

[Read more about Explore features →](docs/Explore.md)

---

### Sidebar

A compact panel in Obsidian's right sidebar with two tabs:

- **Today** shows your daily status, goal progress rings, sparklines, gap alerts, and a morning briefing. Quick-edit frontmatter or open today's note right from the panel.
- **Echoes** surfaces entries from this day in previous years, along with metric comparisons and coping strategy lookups.

![Sidebar with Today panel](assets/images/Hindsight%20Sidebar_DM.png) ![Echoes panel showing past entries](assets/images/Hindsight%20Echoes_DM.png)

[Read more about the Sidebar →](docs/Sidebar.md)

---

### Section Reader

A dedicated modal for reading a specific heading section across all your entries. Pick a section (like "Dreams" or "Top 3"), filter by date range, and search within it. Great for reviewing a recurring journal prompt over time.

![Section Reader showing entries for a heading](assets/images/Hindsight%20Section%20Reader_DM.png)

[Read more about the Section Reader and other commands →](docs/Commands.md)

---

### Guided Entry

A two-step wizard for creating or editing journal entries without switching away from what you're doing.

- **Step 1:** Fill in frontmatter fields with sliders, toggles, text inputs, and tag chips.
- **Step 2:** Write body sections using your note's heading structure, with prompts pre-filled from your template.

Also includes a **weekly review** modal with summary cards for the past week.

![Guided entry wizard, step 1](assets/images/Hindsight%20Guided%20Entry%201_DM.png) ![Guided entry wizard, step 2](assets/images/Hindsight%20Guided%20Entry%202_DM.png)

[Read more about Guided Entry and Weekly Review →](docs/Commands.md#guided-entry)

---

### Command Menu

Quick access to all Hindsight features from a single grid. Opens from the ribbon icon or the command palette.

![Command menu modal](assets/images/Hindsight%20Command%20Menu_DM.png)

---

## Installation (BRAT)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) if you don't have it.
2. Open BRAT settings and click **Add Beta plugin**.
3. Enter: `thuban87/hindsight-journal`
4. Enable the plugin in Settings > Community plugins.

## Getting Started

1. Go to **Settings > Hindsight Journal** and set your journal folder path.
2. Click the book icon in the ribbon (or use the command palette) to open the command menu.
3. Start exploring your journal data.

Hindsight automatically detects frontmatter fields from your journal entries and builds its visualizations from them. No special setup needed beyond pointing it at your journal folder.

## Privacy

This plugin makes **zero network requests**. All processing happens locally in your vault. Your data never leaves your machine.

## License

[MIT](LICENSE)
