# ADR-014: Workspace Runtime (AI 创作工作空间内核)

- **Status:** Accepted
- **Date:** 2025-06-29
- **Tags:** platform, workspace, runtime, snapshot, version, autosave

## Context

The Studio platform supports multiple workbench types (短剧/小说/PPT/GEO/Asset and more to come).
Each workbench has similar needs for state management, version control, undo/redo, crash recovery,
and manifest generation. Without a unified Runtime, each workbench would duplicate these capabilities,
leading to inconsistent behavior and higher maintenance costs.

## Decision

We will implement a **Workspace Runtime** as the Single Source of Truth for all workbench types.

### Core Principles

1. **Workspace Runtime = Single Source of Truth** — All workbenches share one Runtime
2. **No Execution** — Runtime only saves/restores/manages state; does NOT execute business logic
3. **Execution Runtime Binding** — Each Workspace links to ExecutionPlan records; execution results auto-persist
4. **Snapshot-Only Recovery** — Undo, Redo, and Crash Recovery all go through Snapshots
5. **Unified Operation Log** — Every workbench gets Undo/Redo via WorkspaceOperation table
6. **Runtime-level AutoSave** — Not a frontend concern; scheduled by the Workspace Runtime
7. **Auto-Generated Manifest** — Every workspace produces a dependency/cost/audit manifest

### Architecture

```
┌─────────────────────────────────────────────┐
│              Workspace Runtime               │
├─────────────────────────────────────────────┤
│  WorkspaceService (Orchestration)           │
├─────────┬─────────┬─────────┬───────────────┤
│ Snapshot│ Version │ AutoSave│ Undo/Redo     │
│ System  │ Runtime │ Service │ (OperationLog)│
├─────────┴─────────┴─────────┴───────────────┤
│  Repository Layer (Prisma)                  │
├─────────────────────────────────────────────┤
│  PostgreSQL (10 new tables)                 │
└─────────────────────────────────────────────┘
```

### Data Model

10 new Prisma models (see `schema.prisma` for full definitions):

- **WorkspaceRuntime** — Core workspace record
- **WorkspaceSnapshot** — Runtime state snapshots (recovery mechanism)
- **WorkspaceVersion** — Version labels (publish/fork)
- **WorkspaceDraft** — Draft auto-saves
- **WorkspaceOperation** — Unified operation log (undo/redo)
- **WorkspaceAsset** — Workspace-bound asset references
- **WorkspaceConversation** — AI conversation history
- **WorkspaceCheckpoint** — Named restore points
- **WorkspaceExecution** — Execution plan bindings

### Key Behaviors

- **Snapshot** = only way to restore state (undo/redo/crash recovery all use it)
- **AutoSave** = debounced snapshot creation at Runtime level
- **Version** = labeled snapshots with publish/fork support
- **Manifest** = generated from aggregated workspace data

## Consequences

### Positive

- All workbenches get undo/redo for free via unified Operation Log
- Crash recovery is standardized: snapshot restore
- Manifest provides a portable workspace description for export/import
- AutoSave is Runtime-managed, not frontend logic

### Negative

- Slightly more DB writes due to snapshot-based recovery model
- Initial learning curve for new workbench adopters

### Mitigations

- AutoSave prunes old snapshots (configurable max)
- Repository pattern isolates DB concerns

## References

- ADR-002: Repository Pattern
- ADR-003: Platform Context
- ADR-004: Event Model
- ADR-007: Runtime Lifecycle (ARCH-002)
- KMKI-PLAT-009: Workspace Runtime Implementation
