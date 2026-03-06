---
description: End-of-session documentation updates and commit message
---

# Session Wrap-Up Workflow

Run this at the end of each coding session, **after testing has been completed and confirmed by Brad**.

## Steps

// turbo
1. **Review what was done this session.** Check git status and recent changes to understand the scope of work completed.
```powershell
git status
git diff --stat
```

2. **Update session documentation.** Update session log at "docs\development\Implementation Session Log.md". Follow the existing entry format in the file. Include: date, what was done, files changed, test results, and any issues discovered.

3. **Update the roadmap/priority docs.** Update implementation plan document (docs\development\Implementation Plan.md) to reflect completed work, status changes, or any new items discovered during the session.

4. **Provide a git commit message.** Generate a clear, descriptive commit message summarizing all work done this session. **Do not use quotation marks anywhere in the message.** Format:

```
feat/fix/refactor/test/docs(scope): short summary

- Bullet point details of changes
- Another change
- etc
```

5. **Note any bugs or issues discovered.** List anything that came up during the session that needs attention in future sessions.