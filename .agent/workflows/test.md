---
description: Run the test suite and capture output for reliable reading
---

# Test Runner Workflow

Vitest output is often truncated or garbled by PowerShell's terminal handling. Always pipe test output to a temp file for reliable reading.

## Run All Tests

// turbo
1. **Run the full test suite and capture output.**
```powershell
npx vitest run 2>&1 | Out-File -Encoding utf8 test-output.txt
```

// turbo
2. **Read the summary (last 20 lines).**
```powershell
Get-Content test-output.txt -Tail 20
```

// turbo
3. **Read the full output if needed.**
Use the `view_file` tool on `test-output.txt` to read the full output.

## Run Specific Test Files

// turbo
1. **Run specific test file(s) and capture output.**
```powershell
npx vitest run path/to/test.ts 2>&1 | Out-File -Encoding utf8 test-output.txt
```

// turbo
2. **Read the summary.**
```powershell
Get-Content test-output.txt -Tail 20
```

## Notes

- Always use `2>&1` to capture both stdout and stderr
- Always use `Out-File -Encoding utf8` to preserve Unicode characters
- The `test-output.txt` file is gitignored and safe to overwrite
- **Never** try to parse vitest output directly from the terminal — it will be truncated
- Use `view_file` on `test-output.txt` for the full output when you need error details
- Clean up with `Remove-Item test-output.txt` when done
