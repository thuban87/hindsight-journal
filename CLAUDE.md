# {Plugin Name} - Development Guidelines

Instructions for AI assistants working on this project.

**Version:** 0.1.0
**Last Updated:** 2026-03-05

---

## Project Context

**Developer:** Brad Wales (ADHD, visual learner, prefers vibe coding)
**Purpose:** {Brief description of what this plugin does}
**Tech Stack:** TypeScript, React 18, Obsidian API, esbuild
**Release:** Personal use (potential public release later)

**Environments:**
- **Dev:** `C:\Users\bwales\projects\obsidian-plugins\{plugin-name}`
- **Test:** `C:\Quest-Board-Test-Vault\.obsidian\plugins\{plugin-name}`
- **Staging:** `C:\Quest-Board-Staging-Vault\Staging Vault\.obsidian\plugins\{plugin-name}`
- **Production:** `G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\{plugin-name}`

---

## Git Workflow (CRITICAL)

**Brad handles ALL git commands.** AI assistants should:
- Read: `git status`, `git log`, `git diff`
- **NEVER run:** `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`
- Provide commit messages at session wrap-up for Brad to copy/paste

---

## Development Session Workflow

1. **Review & Discuss** - Clarify requirements, check roadmap/priority docs
2. **Do the Work** - Write code in dev environment only
3. **Test** - `npm run dev` (watches + builds), fix errors, rebuild until passing
4. **Deploy** - `npm run deploy:test` (copies to test vault)
5. **Wait for Confirmation** - Brad tests in test Obsidian vault
6. **Wrap Up** - Update session docs, provide commit message

---

## Core Principles

### ADHD-Optimized Development
- **Micro-steps:** Break complex tasks into atomic, completable steps
- **Explain why:** Briefly justify architectural choices
- **Celebrate wins:** Acknowledge when features work

### Architecture (Non-Negotiable)
- **Separation of Concerns:** Models/Types, Services, Components, Hooks, Utils
- **Single Responsibility:** Each class/function does ONE thing
- **No Monolithic Files:** Split if exceeding ~300 lines
- **JSDoc Public Methods:** Public methods get documentation

### File Structure Template

```
{plugin-name}/
├── main.ts                     # THIN entry point (~100 lines max)
├── manifest.json
├── styles.css
├── src/
│   ├── types.ts                # Interfaces, constants, pure utilities
│   ├── settings.ts             # Settings tab UI
│   ├── components/             # React UI components
│   ├── services/               # Business logic, file I/O
│   ├── hooks/                  # React hooks
│   ├── views/                  # Obsidian ItemView shells (React mounting)
│   ├── modals/                 # Obsidian modals
│   ├── context/ or store/      # React Context or Zustand state
│   ├── utils/                  # Pure functions
│   └── data/                   # Static data, templates
├── docs/                       # Development documentation
└── test/                       # Vitest unit tests
```

### Layer Responsibilities

| Layer | Should | Should NOT |
|-------|--------|------------|
| **main.ts** | Register commands, initialize services, handle lifecycle | Contain business logic |
| **Components** | Render UI, handle user interactions, call hooks/services | Read/write files, manage global state |
| **Hooks** | Encapsulate reusable React logic, compose services | Be too specific to one component |
| **Services** | Business logic, file I/O, state coordination | Render UI, manipulate DOM |
| **Utils** | Pure functions, data transformations | Manage state, make assumptions about context |

---

## Data Storage Patterns

| Data Type | Storage | Why |
|-----------|---------|-----|
| **Plugin settings** | `loadData()`/`saveData()` | Standard Obsidian pattern, syncs with plugin |
| **User-editable data** | Vault files (markdown/frontmatter) | Human-readable, user-owned, survives plugin removal |
| **Internal state** | `loadData()`/`saveData()` | Safe from user deletion |

---

## Security Essentials

1. **API Keys** - Store in Obsidian settings (not in vault files). Warn users that `data.json` stores keys in plaintext.
2. **Input Sanitization** - Use DOMPurify for any AI-generated or user-provided HTML content
3. **Safe JSON** - Guard against prototype pollution when parsing external JSON
4. **Path Validation** - Validate all file paths resolve within the vault
5. **No innerHTML** - Use DOM API, Obsidian helpers, or React JSX

---

## Common Pitfalls

### Don't:
- Put all code in main.ts
- Use synchronous file I/O
- Hardcode user-specific values
- Run git commands
- Skip testing before deployment
- Use `vault.modify()` for frontmatter — use `app.fileManager.processFrontMatter()`
- Use `moment()` for date parsing — use native `Date`
- Start writing tests before Brad has manually verified the feature

### Do:
- Keep files under 300 lines
- Use TypeScript strict mode
- JSDoc all public methods
- Test in dev before deploying
- Follow session workflow
- Prefix all CSS classes with plugin name
- Use React functional components + hooks
- Handle missing data gracefully (defaults, not crashes)
- Use `TFile`/`TFolder` guards before vault operations
- Use CSS variables for theming (no hardcoded colors)

---

## Key Documentation

- **Roadmap/Priority List** — {link to current priorities doc}
- **Session Log** — {link to active development log}
- **Architecture Decisions** — {link to ADR or architecture doc}

---

<!--
PROJECT-SPECIFIC SECTIONS BELOW
Add sections as the project grows. Examples from other projects:

## Current Feature Status
## CSS Modularization
## Custom Data Models
## Testing Values to Verify
-->
