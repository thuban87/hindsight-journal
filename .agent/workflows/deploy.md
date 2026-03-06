---
description: Build and deploy to test, staging, or production environments
---

# Deployment Workflow

## Environments & Directories

| Environment | Path | Purpose |
|-------------|------|---------|
| **Development** | Project root directory | Source code, active development |
| **Test** | `C:\Quest-Board-Test-Vault\.obsidian\plugins\{plugin-name}` | Initial testing vault |
| **Staging** | `C:\Quest-Board-Staging-Vault\Staging Vault\.obsidian\plugins\{plugin-name}` | Pre-production staging vault |
| **Production** | `G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\{plugin-name}` | Live personal vault |

> **Note:** Replace `{plugin-name}` with the actual plugin folder name from `manifest.json`.

## Commands

| Command | What It Does |
|---------|-------------|
| `npm run build` | Production build only (no deploy) |
| `npm run deploy:test` | Build + copy to test vault |
| `npm run deploy:staging` | Build + copy to staging vault |
| `npm run deploy:production` | Build + copy to production vault (requires typing 'yes') |
| `npm run dev` | Watch mode — auto-builds on file change |

## Steps

### Deploy to Test (default deployment)

// turbo
1. **Verify tests pass before deploying.**
```powershell
npm run test
```

// turbo
2. **Build and deploy to test vault.**
```powershell
npm run deploy:test
```

3. **Notify Brad.** Let Brad know the build is deployed to the test vault and ready for manual testing in Obsidian.

### Deploy to Staging

// turbo
1. **Verify tests pass before deploying.**
```powershell
npm run test
```

// turbo
2. **Build and deploy to staging vault.**
```powershell
npm run deploy:staging
```

3. **Notify Brad.** Let Brad know the build is deployed to the staging vault and ready for testing.

### Deploy to Production

> **NEVER deploy to production unless Brad explicitly requests it.** Brad will typically handle production deployments himself.

If Brad explicitly asks for a production deploy:

// turbo
1. **Verify tests pass.**
```powershell
npm run test
```

2. **Confirm with Brad** that he wants to proceed with production deployment. Wait for explicit approval.

// turbo
3. **Deploy to production.** This will prompt for a 'yes' confirmation in the terminal.
```powershell
npm run deploy:production
```

4. **Notify Brad** that the production deployment is complete.
