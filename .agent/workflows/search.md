---
description: Search the codebase using ripgrep or Select-String when grep_search is unreliable
---

# Codebase Search Workflow

The `grep_search` tool can be unreliable in this repository. Use these commands instead to search the codebase.

## Search by Pattern

// turbo
1. **Search source files for a pattern using ripgrep.**
```powershell
rg "SEARCH_TERM" src --line-number
```

// turbo
2. **Search all TypeScript and TSX files project-wide.**
```powershell
rg "SEARCH_TERM" . --line-number -g "*.ts" -g "*.tsx"
```

// turbo
3. **Search with PowerShell Select-String (alternative).**
```powershell
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern "SEARCH_TERM"
```

// turbo
4. **Search CSS files.**
```powershell
rg "SEARCH_TERM" styles.css --line-number
```

// turbo
5. **Search docs and markdown files.**
```powershell
rg "SEARCH_TERM" docs --line-number
```

## Notes

- Replace `SEARCH_TERM` with the actual search pattern
- All commands are read-only and safe to auto-run
- Use `-i` flag with `rg` for case-insensitive search: `rg -i "term" src`
- Use `-C 3` for context lines: `rg "term" src -C 3`
- Use `-g "*.tsx"` to include React component files specifically
