---
description: Full release protocol from code changes through tagged GitHub release
---

# Release Protocol

This workflow covers the full release cycle: build, test, deploy for manual verification, merge, version bump, and tagged release. Steps marked with agent emoji are handled by the agent. Steps marked with user emoji require Brad.

## Pre-Release: Build & Verify

// turbo
1. Agent: Run production build:
   ```
   npm run build
   ```

// turbo
2. Agent: Run full test suite:
   ```
   npx vitest run 2>&1 | Select-Object -Last 5
   ```
   - If tests fail, fix and re-run before continuing.

// turbo
3. Agent: Deploy to test vault:
   ```
   npm run deploy:test
   ```

4. Brad: **HARD STOP** — Notify Brad to test in Obsidian. Wait for confirmation before continuing.

## Version Bump

5. Brad: Ask Brad: **"What version number for this release?"** (current version is in `manifest.json`). Also ask:
   - **Release title** (short, descriptive)
   - **Changelog entries** — what's new, changed, or fixed in this version

6. Agent: Update version in all three files (use the version Brad provides):
   - `manifest.json` → `"version": "X.Y.Z"`
   - `package.json` → `"version": "X.Y.Z"`
   - `versions.json` → add/update entry `"X.Y.Z": "CURRENT_MIN_APP_VERSION"` (keep the existing minAppVersion from manifest.json)

// turbo
7. Agent: Rebuild with updated version:
   ```
   npm run build
   ```

## Prepare Release Notes

8. Agent: Create a temporary file `.release-notes.md` in the project root containing the formatted release body. Format:

   ```markdown
   ## What's New

   - Feature 1 description

   ## Changes

   - Change 1

   ## Fixes

   - Fix 1

   ---

   Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):
   1. Open BRAT settings
   2. Click "Add Beta plugin"
   3. Enter: `{github-username}/{repo-name}`
   ```

   Populate sections based on Brad's changelog entries. Omit empty sections.

## Git & Release

9. Brad: **HARD STOP** — Show Brad:
   - The version number in all 3 files
   - The release title
   - The full release notes content

   Ask Brad to review, then provide these git commands for Brad to run:

   ```bash
   # If on a feature branch, merge to main first:
   git add .
   git commit -m "chore: bump version to X.Y.Z"
   git push origin <branch-name>
   # Then do PR or direct merge to main

   # If already on main:
   git add .
   git commit -m "chore: bump version to X.Y.Z"
   git push origin main

   # Tag and push to trigger release workflow:
   git tag X.Y.Z
   git push origin --tags
   ```

10. Brad runs the git commands.

## Post-Release Verification

11. Brad: Verify on GitHub:
    - Release appears with correct title and notes
    - Assets attached: `main.js`, `manifest.json`, `styles.css`

12. Brad: Verify via BRAT:
    - Check for updates in BRAT
    - Confirm the new version installs correctly

// turbo
13. Agent: Clean up the temporary release notes file:
    ```
    Remove-Item .release-notes.md -ErrorAction SilentlyContinue
    ```

## Notes

- **Tag format**: Must be bare semver `X.Y.Z` (no `v` prefix). BRAT and the release workflow both require this.
- **versions.json**: Maps plugin versions to minimum Obsidian versions. Only add a new entry if `minAppVersion` changes; otherwise update the existing version key.
- **Brad handles all git commands.** The agent never runs git add, commit, push, merge, rebase, or tag.
