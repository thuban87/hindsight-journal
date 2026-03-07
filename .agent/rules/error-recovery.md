---
description: Error recovery and notification rules for Obsidian API calls
---

# Error Recovery Rule

All service methods that call Obsidian APIs **must** follow these patterns:

## Try/Catch + Notice

Every Obsidian API call (`vault.create()`, `vault.read()`, `vault.process()`, `vault.readBinary()`, `processFrontMatter()`, etc.) must be wrapped in `try/catch`:

```typescript
try {
    await app.vault.create(normalizePath(filePath), content);
    new Notice(`Created ${filePath}`);
} catch (err) {
    console.error(`Failed to create ${filePath}:`, err);
    new Notice(`Error creating note: ${(err as Error).message}`);
}
```

## Graceful Degradation

Services must degrade gracefully on failure, not crash:

- `ThumbnailService.getThumbnail()` → returns `null` on failure (shows placeholder icon)
- `NoteCreationService.createDailyNote()` → shows Notice with error, doesn't crash the wizard
- `AnnotationService.addAnnotation()` → shows Notice, doesn't lose the annotation text
- `ExportService.generateCSV()` → pure function, but file write must be guarded
- `MetricsEngine` functions → return empty arrays on failure, not exceptions

## Duplicate Prevention

Before `vault.create()`, always check if the file already exists:

```typescript
const existing = app.vault.getFileByPath(normalizePath(targetPath));
if (existing) {
    // Open the existing file instead of creating a duplicate
    await app.workspace.openLinkText(existing.path, '');
    return existing;
}
```

## Promise Handling in Event Handlers

Event handlers (drag, click, etc.) that call async methods must handle promises:

```typescript
// ✅ Good — void operator acknowledges the promise
onDrop={() => void saveSettings()}

// ✅ Good — catch prevents unhandled rejection
onDrop={() => saveSettings().catch(console.error)}

// ❌ Bad — unhandled promise
onDrop={() => saveSettings()}
```

## Store Lifecycle (Plugin Unload)

All Zustand stores must be reset in `plugin.onunload()` to prevent stale data when the plugin is disabled and re-enabled. Each store that holds cached/computed data must expose a `reset()` action:

```typescript
onunload(): void {
    this.journalIndex?.destroy();
    this.thumbnailService?.destroy();
    useAppStore.getState().reset();
    useJournalStore.getState().clear();
    useMetricsCacheStore?.getState().reset();
    useChartUiStore?.getState().reset();
    useUiStore?.getState().reset();
}
```
