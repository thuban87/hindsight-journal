# Journal

The Journal tab group gives you three ways to browse your daily entries.

---

## Calendar

![Calendar view](../assets/images/Hindsight%20Calendar_DM.png)

The calendar displays your journal entries in a monthly grid. Each day cell shows:

- A **dot indicator** if an entry exists for that date
- An **image thumbnail** pulled from the first embedded image in the entry (when thumbnail generation is enabled in settings)
- A **metric heatmap** overlay when you select a frontmatter field from the dropdown (e.g., mood, energy, sleep). The cell background color maps to the field's value on a gradient scale

### Navigation
- Arrow buttons to move forward/back by month
- "Today" button to jump to the current month
- Metric selector dropdown in the top-right corner

### Interaction
- Click any day cell to open that day's journal entry in Obsidian
- The metric heatmap updates instantly when you switch fields

---

## Timeline

The timeline is a reverse-chronological scrollable list of entry cards. Each card shows:

- **Date and day of week**
- **Frontmatter badges** for key fields (mood, energy, etc.)
- **Entry excerpt** pulled from the first body section
- **Image thumbnails** from embedded images
- **Annotation badges** if the entry has annotations attached

The list uses virtual scrolling, so it handles hundreds of entries without slowing down. Click any card to open that entry.

---

## Index

A sortable, filterable table of every indexed journal entry. Columns include:

- Date
- Detected frontmatter fields (numeric and text)
- Word count
- Tags

Click column headers to sort. Click a row to open the entry. This view is useful when you want to quickly find a specific entry or compare values across many dates at once.
