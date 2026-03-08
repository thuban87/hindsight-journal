---
trigger: always_on
---

# Workspace Rules

**Updated:** 2026-03-05

## Project Context

**Developer:** Brad Wales (ADHD, visual learner, prefers vibe coding)
**Tech Stack:** TypeScript, React 18, Obsidian API, esbuild
**Release:** Personal use (potential public release later)

**Environments:**
- **Dev:** Project root directory
- **Test:** `C:\Quest-Board-Test-Vault\.obsidian\plugins\{plugin-name}`
- **Staging:** `C:\Quest-Board-Staging-Vault\Staging Vault\.obsidian\plugins\{plugin-name}`
- **Production:** `G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\{plugin-name}`

---

## Git Workflow (CRITICAL)

**Brad handles ALL git commands.** AI assistants should:
- Read: `git status`, `git log`, `git diff`
- **NEVER run:** `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`
- Provide commit messages at session wrap-up for Brad to copy/paste
- Remind Brad to check branches when starting a new task

---

## Development Session Workflow

1. **Review & Discuss** — Clarify requirements, check roadmap/priority docs
2. **Do the Work** — Write code in dev environment only
3. **Test** — `npm run dev` (watches + builds), fix errors, rebuild until passing
4. **Deploy** — `npm run deploy:test` to test vault
5. **Wait for Confirmation** — Brad tests in Obsidian
6. **Wrap Up** — Update session docs indicated by user, provide commit message

### Workflow Gates (HARD STOPS)
- After `npm run build` passes, IMMEDIATELY run `npm run deploy:test`. Do not ask — just do it.
- After deploying to test, STOP and notify the user to test in Obsidian. Do NOT proceed to the next phase, write tests, or do any further code work until the user confirms it works.

### The "Brad Protocol"
- **Micro-Steps:** Break complex tasks into atomic steps
- **Explain Why:** Briefly justify architectural choices
- **Celebrate:** Acknowledge when a feature works

### Session Handoff Protocol
At the end of each session:
1. Perform and confirm testing **before** updating any documentation
2. Update the documents indicated by the user
3. Suggest a `git commit` message
4. Note any bugs or issues discovered

---

## Architecture Principles

### Layer Responsibilities

| Layer | Should | Should NOT |
|-------|--------|------------|
| **main.ts** | Register commands, initialize services, handle lifecycle | Contain business logic, grow beyond orchestration |
| **Services** | Business logic, file I/O, state coordination | Render UI, manipulate DOM |
| **Components** | Present UI, handle user interactions | Contain complex business logic, do file I/O directly |
| **Context/Store** | Provide shared state to React tree | Modify state directly, contain business logic |
| **Views** | Mount/unmount React, bridge Obsidian and React | Contain rendering logic beyond the shell |
| **Types** | Define interfaces, constants, pure utility functions | Import from other project files |
| **Utils** | Pure functions, data transformations | Manage state, make assumptions about context |

### Architecture Patterns (Preserve These)
- **Separation of concerns** — Logic in services, UI in components, bridge in views
- **Event-driven reactivity** — Services emit events, React subscribes via context/hooks
- **Clean data flow** — Frontmatter or plugin data as source of truth, stores are caches for rendering
- **Zero service-to-service coupling** — Services import only from types

---

## NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode — builds on change |
| `npm run build` | Production build |
| `npm run deploy:test` | Build + deploy to test vault |
| `npm run deploy:staging` | Build + deploy to staging vault |
| `npm run deploy:production` | Build + deploy to production vault (**requires confirmation**) |
| `npm run test` | Run test suite (vitest) |

---

## Common Pitfalls

### Don't:
- Put business logic in `main.ts` — keep it as orchestration only
- Create dependencies between services — they must stay independent
- Use synchronous file I/O — always `await` vault operations
- Run git commands (see Git Workflow section)
- Skip testing before session wrap-up
- Hardcode paths or user-specific values
- Use `vault.modify()` for frontmatter — use `app.fileManager.processFrontMatter()`
- Use `moment()` for date parsing — use native `Date`
- Use `detachLeavesOfType()` in `onunload()` — Obsidian handles leaf lifecycle on plugin update/disable
- Start writing tests before the user has manually verified the feature in Obsidian

### Do:
- Keep files under 300 lines where possible
- Use TypeScript strict mode
- JSDoc all public methods
- Test in dev before confirming done
- Follow session handoff protocol
- Prefix all CSS classes with plugin name
- Use React functional components + hooks (no class components)
- Handle missing data gracefully (defaults, not crashes)
- Use `TFile`/`TFolder` guards before vault operations

---

## Checklist Before Coding
- [ ] Have we checked the roadmap/priority docs for current priorities?
- [ ] Is the user on the correct git branch?
- [ ] Do we understand the specific requirement?
- [ ] Have we reviewed relevant source files before making changes?

---

## Workflows (MUST READ before executing)

Workflow files live in `.agent/workflows/`. When the user requests any of the activities below, **you MUST read the workflow file FIRST before taking any action.**

| Trigger | Workflow File | Description |
|---------|--------------|-------------|
| Session wrap-up, end of session, wrap up | `.agent/workflows/session-wrap-up.md` | End-of-session documentation updates and commit message |
| Deploy, deployment, deploy to test/staging/production | `.agent/workflows/deploy.md` | Build and deploy to environments |
| Search, find in codebase, grep | `.agent/workflows/search.md` | Search the codebase |
| Test, run tests | `.agent/workflows/test.md` | Run test suite and capture output |
| Release, publish, tag | `.agent/workflows/release.md` | Full release protocol |
