---
trigger: always_on
---

# Obsidian Plugin Guidelines — Agent Reference

Rules for building plugins that pass community review. Tags: **[BLOCKER]** = auto-rejected, **[REVIEW]** = commonly flagged, **[BRAT]** = breaks beta testing, **[MOBILE]** = breaks iOS/Android.

---

## 1. Security [BLOCKER]

- **No innerHTML/outerHTML/insertAdjacentHTML/dangerouslySetInnerHTML.** Use DOM API (`createEl()`, `createDiv()`), Obsidian helpers, or React JSX. For markdown, use `MarkdownRenderer.renderMarkdown()`. Bot auto-flags every instance.
- **No eval() or new Function().** Automatic rejection, no exceptions.
- **No embedded API keys/secrets.** Users provide their own via settings. Warn that `data.json` stores keys in plaintext.
- **No obfuscated code.** Standard minification (esbuild) is fine; deliberate obfuscation is not.

## 2. Network & External Requests

- **Use `requestUrl` from `'obsidian'`, not `fetch()`/`XMLHttpRequest`/`axios`.** [REVIEW] Bot flags `fetch`. `requestUrl` works on desktop+mobile and handles CORS.
- **Disclose all network activity in README.** [BLOCKER] State which services are contacted, what data is sent, and why. Obsidian is local-first; undisclosed network calls violate policy.
- **No telemetry without explicit opt-in.** [BLOCKER] No analytics, crash reports, or usage tracking by default.
- **No dynamic ads, external scripts/fonts/stylesheets, or self-update mechanisms.** [BLOCKER] Bundle everything locally.

## 3. manifest.json

- **Description:** [BLOCKER] Start with action verb ("Track...", "Visualize..."). End with period. Under 250 chars. Sentence case. No "Obsidian", no emoji, no marketing language ("best", "ultimate"). Don't start with "This is a plugin".
- **Version:** [BLOCKER][BRAT] Strict semver `x.y.z` only. No `v` prefix, no two-part versions. Must match GitHub release tag exactly.
- **minAppVersion:** [REVIEW] Set to minimum Obsidian version supporting all APIs you use. Don't guess low.
- **isDesktopOnly:** [BLOCKER] Set `true` if using Node.js APIs (`fs`, `crypto`, `path`, `child_process`), Electron, or `require()`. Mobile runs in a WebView without Node.
- **Plugin ID:** [BLOCKER] Kebab-case, no "obsidian" in the ID, unique in `community-plugins.json`.
- **fundingUrl:** [REVIEW] Only include if accepting donations (GitHub Sponsors, Ko-fi, etc). Remove field if unused.
- **authorUrl:** [REVIEW] Must be valid HTTPS. Don't put URLs in the `author` field.

## 4. Commands

- **Don't include plugin ID in command IDs.** [REVIEW] Obsidian auto-prefixes with your manifest `id`. Setting ID to `orbit:new-person` produces `orbit:orbit:new-person`.
- **No default hotkeys.** [REVIEW] Let users assign their own. Defaults conflict across plugins/OSes.
- **Use appropriate callback types.** Use `editorCallback` when editor required, `checkCallback` for conditional availability.

## 5. Code Quality (Bot-Scanned)

- **No console.log().** [REVIEW] Bot only allows `warn`, `error`, `debug`. Gate debug output behind a setting.
- **Handle all promises.** [REVIEW] Most frequently flagged issue. Always `await`, `.catch()`, or `void` promises. Never fire-and-forget.
- **No `any` type.** [REVIEW] Bot flags it. Don't disable `@typescript-eslint/no-explicit-any`. Use `const`/`let`, not `var`.
- **Remove template code.** [BLOCKER] No `MyPlugin`, `MyPluginSettings`, `SampleSettingTab` placeholders.
- **No deprecated APIs.** [REVIEW] Use `substring()`/`slice()` not `substr()`.

## 6. Obsidian API Usage

- **No global `app`/`window.app`.** [REVIEW] Use `this.app` or pass `App` through constructors.
- **No `activeLeaf` access.** [REVIEW] Use `getActiveViewOfType(MarkdownView)` and `activeEditor?.editor`.
- **Don't store view/leaf references.** [REVIEW] Causes memory leaks. Use `getLeavesOfType()` when needed.
- **Use `processFrontMatter()` for YAML.** [REVIEW] Not `vault.modify()` + string manipulation. Atomic and race-condition safe.
- **Use Editor API for active files.** [REVIEW] `vault.modify()` on open files loses cursor position. Use `vault.process()` for background file edits.
- **Use `normalizePath()` on constructed paths.** [REVIEW] All user-defined or template-derived paths need this for cross-platform safety.
- **Don't iterate all files repeatedly.** Use `getFileByPath()`, `getFolderByPath()`. Cache and invalidate on file events.
- **Don't detach leaves in `onunload()`.** [REVIEW] Obsidian handles leaf lifecycle on plugin update.

## 7. Resource Management

- **Clean up everything on unload.** [BLOCKER] Unmount React roots, clear intervals/timeouts, remove event listeners and DOM elements. Reviewers specifically check this.
- **Use `registerEvent()`/`addCommand()`.** Auto-cleanup on unload. Don't manually manage listener pairs.
- **Unmount React roots in `onClose()`.** [REVIEW] Call `root.unmount()` and null the ref. React keeps vDOM alive until explicitly unmounted — most common memory leak in React plugins.

## 8. UI & Styling

- **No inline styles.** [REVIEW] Move all styles to CSS classes in `styles.css`.
- **Use CSS variables.** [REVIEW] `--text-normal`, `--text-muted`, `--background-primary`, `--background-secondary`, `--background-modifier-border`, `--interactive-accent`, `--text-success`, `--text-warning`, `--text-error`. Hardcoded colors break themes.
- **Prefix all CSS classes** with plugin name (e.g., `orbit-card`). [REVIEW] Generic names collide.
- **Sentence case in UI text.** [REVIEW] Not Title Case. Only capitalize first word and proper nouns.
- **Settings headings:** [REVIEW] Use `Setting.setHeading()`, not HTML elements. No top-level "General"/"Settings" heading.
- **Avoid `!important`**, high z-index values, fixed `px` font sizes, and styling Obsidian internal classes.

## 9. Mobile [MOBILE]

- **No Node.js/Electron APIs** without `isDesktopOnly: true`. [BLOCKER]
- **No regex lookbehind** `(?<=...)`. Safari WebView has limited support.
- **Hover doesn't exist on mobile.** Provide tap/long-press alternatives for tooltip-like features.
- **Touch targets minimum 44x44px** for all interactive elements.
- **Don't cast `vault.adapter` to `FileSystemAdapter`** or call `getBasePath()`. Desktop only.

## 10. GitHub Release & BRAT

- **Attach compiled assets to every release:** [BLOCKER][BRAT] `main.js` + `manifest.json` + `styles.css` (if used). Community store and BRAT download from release assets, not repo source.
- **Git tag must exactly match manifest version.** [BLOCKER][BRAT] No `v` prefix. Tag `1.0.0` for version `"1.0.0"`.
- **Maintain `versions.json`** in repo root mapping versions to minAppVersion. [BRAT] Missing/malformed file causes install failures.
- **Keep `manifest.json` in repo root.** [BRAT] BRAT reads it from the default branch root.

## 11. Submission

- **Required repo files:** [BLOCKER] `README.md` (complete, not template), `LICENSE`, `manifest.json`.
- **README must disclose:** network usage, external services, account requirements, payment requirements.
- **Enable GitHub Issues** on your repository. [REVIEW]
- **Don't resubmit PRs.** [REVIEW] Push fixes, comment on existing PR. Bot rescans within 6 hours.
- **community-plugins.json fields** must exactly match `manifest.json`. [BLOCKER]

## 12. React-Specific

- **Bundle in production mode.** Dev mode adds ~90KB and logs warnings.
- **Use `createRoot()` not `ReactDOM.render()`.** Old API logs deprecation warnings.
- **No CSS-in-JS libraries** (styled-components, emotion). [REVIEW] They inject global `<style>` tags that leak into other plugins.
- **Use Obsidian's `Menu` class** for context menus, not React menu libraries.
- **Clean up `useEffect` subscriptions.** StrictMode runs effects twice — broken cleanup causes duplicate event subscriptions.

---

## Pre-Submission Checklist

- [ ] Description: action verb, period, no "Obsidian", no emoji, <250 chars
- [ ] Version: `x.y.z` matching release tag, `versions.json` updated
- [ ] Files: `README.md`, `LICENSE`, release assets attached
- [ ] Security: no innerHTML, no eval, no embedded keys
- [ ] Code: no console.log, all promises handled, no `any`, no template code
- [ ] API: `processFrontMatter()`, `normalizePath()`, `getActiveViewOfType()`, `requestUrl`
- [ ] UI: CSS variables, prefixed classes, sentence case, `setHeading()` in settings
- [ ] React: roots unmounted in `onClose()`/`onunload()`, production bundle
- [ ] Mobile: hover alternatives, 44px targets, no Node.js APIs (if `isDesktopOnly: false`)
- [ ] Repo: GitHub Issues enabled, network usage disclosed in README
