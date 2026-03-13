# Insights

The Insights tab group is where your journal data becomes actionable. Three sub-tabs give you different lenses on your tracked metrics.

---

## Charts

![Charts view](../assets/images/Hindsight%20Charts_DM.png)

Interactive line charts for any combination of your frontmatter fields.

### Controls
- **Field selectors** to toggle which metrics are plotted
- **Range presets**: 30 days, 90 days, 1 year, All time
- **Custom date range** with start/end date pickers
- **Rolling average** toggle to smooth out noise and see trends
- **Trend line** toggle to show the overall direction
- **Annotation markers** appear as dots on the chart when you've annotated a date

### Correlations

Below the chart, Hindsight automatically calculates **Pearson correlations** between your tracked fields. These cards tell you which metrics tend to move together (or in opposite directions) and how strong the relationship is. For example, "mood and energy are strongly correlated (r = 0.72, based on 45 entries)."

It also surfaces **field-split insights** like "Your average energy on light_therapy days is 5.2 vs 4.8" to help you spot the effect of boolean habits on your numeric metrics.

---

## Pulse

![Pulse view](../assets/images/Hindsight%20Pulse_DM.png)

A dashboard of stats and visualizations for your journaling habits.

### Overview cards
At the top, you get quick stats: total entries, current writing streak, key metric averages, and entries this week.

### Heatmap
A GitHub-style contribution heatmap for any numeric field. Select a field from the dropdown and navigate by year. Color intensity maps to the value range for that field.

### Goal tracker
If you've configured goals in settings, circular progress rings show your weekly completion rate for each tracked field.

### Consistency scores
Shows how consistently you're logging specific fields, broken down by week.

### Personal bests
Highlights your record-breaking numbers: highest values, longest streaks, most consistent months, and best trend periods.

### Quality dashboard
Scatter plots showing how two metrics relate visually, useful for spotting clusters and outliers.

---

## Digest

Period-based summaries that tie your metrics to specific time ranges.

### Period selector
Choose a predefined period (this week, last week, this month) or set a custom range. All three sections below update to match.

### Task completion
If your entries include task lists (checkboxes), this section shows completion rates and task volatility for the selected period.

### Field completion
Shows what percentage of entries in the selected period have values for each frontmatter field. Useful for seeing which fields you tend to skip.
