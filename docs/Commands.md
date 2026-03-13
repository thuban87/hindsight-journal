# Commands

Hindsight adds several commands accessible from the command palette (`Ctrl/Cmd + P`) or from the command menu modal.

![Command menu](../assets/images/Hindsight%20Command%20Menu_DM.png)

---

## Command Menu

Click the book icon in the ribbon to open a grid of all available Hindsight commands. Each card shows the command name, a brief description, and an icon. Click any card to run that command. You can also trigger this from the command palette with "Hindsight: Open command menu."

---

## Section Reader

![Section Reader](../assets/images/Hindsight%20Section%20Reader_DM.png)

A dedicated modal for reading one specific heading section across multiple entries. This is useful when your journal uses a consistent heading structure (like "Dreams," "Top 3," "What Actually Happened") and you want to read through just that section over time.

### How to use it
1. Open the Section Reader from the command menu or command palette
2. Select a heading from the dropdown (it auto-detects headings from your entries)
3. Browse entries chronologically, each showing the content under that heading
4. Use the date range buttons (30 days, 90 days, All time, Custom) to narrow the scope
5. Type in the search box to filter within the selected section's content
6. Toggle "Simple view" for a cleaner reading experience

### What it shows
Each entry card displays the date, the rendered content under that heading, and links to related notes. It supports full markdown rendering, so formatting, callouts, and embedded content all display correctly.

---

## Guided Entry

![Guided entry, step 1](../assets/images/Hindsight%20Guided%20Entry%201_DM.png)

A two-step wizard for creating new journal entries or editing existing ones.

### Step 1: Frontmatter fields

The first step shows all detected frontmatter fields with appropriate input controls:

- **Numeric fields**: slider with a text input for exact values
- **Boolean fields**: toggle switches
- **Text fields**: text inputs
- **Tags**: chip-style tag editor with an "Add tag" input
- **Date/time**: auto-populated from the entry date

A date picker at the top lets you choose which day to create or edit. If an entry already exists for that date, the wizard loads its current values.

### Step 2: Body sections

![Guided entry, step 2](../assets/images/Hindsight%20Guided%20Entry%202_DM.png)

The second step shows text areas for each heading section in your note template. If your template has prompts or placeholder text under headings, those appear in the text areas as starting points. Write freely in each section, then click **Save & close** to create or update the entry.

### Editing existing entries
Open the guided entry from the command menu while you have a journal entry open, and it will load that entry's data for editing. You can adjust frontmatter values and body content without manually navigating frontmatter YAML.

---

## Weekly Review

A reflection modal that summarizes your past week. It shows summary cards with key metrics, trends, and highlights from the last 7 days. Write review notes directly in the modal, and save them as a standalone weekly review note in your configured review folder.

Open it from the command menu or the command palette with "Hindsight: Open weekly review."
