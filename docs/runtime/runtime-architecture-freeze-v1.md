# Runtime Architecture Freeze v1

**Date:** 2026-05-21 02:00  
**Status:** FROZEN — 本文件之后任何新功能修改前必须更新此文档  
**Previous State:** Vue SPA with localStorage state management  
**Current State:** Event-sourced recoverable runtime  

---

## 1. Architecture Overview

```
User Action / AI Agent
        │
        ▼
  appendAndApply() / appendEvent()
        │
        ▼
  Journal (DB, append-only)
        │
        ▼
  replayEvents() → ExecutionRuntimeState (pure reducer)
        │
        ▼
  ProjectRuntimeStore (Vue Pinia store, SSOT)
        │
        ▼
  Vue Components (read-only consumers)
```

**Core principle:** Journal is source of truth. Everything else is derived.

---

## 2. Runtime Truth Rules (IMMUTABLE)

| Rule | Description | Violation Consequence |
|---|---|---|
| **Journal is SSOT** | No state is authoritative unless it can be replayed from journal entries | Inconsistent recovery after crash |
| **Runtime is replayed state** | `replayEvents()` must produce the same state from the same events in any environment | Recovery drift |
| **Components never own core state** | Components may have UI-only local refs (scroll pos, input focus), but never `characterSpecs`, `sceneSpecs`, `voiceConfigs`, `videoSegments` as primary source | Dual state source → runtime drift |

---

## 3. Event Rules (IMMUTABLE)

### 3.1 Append-only

```text
NO update, NO delete of existing events.
Only `appendEvent()` / `appendAndApply()`.
```

### 3.2 Immutable

Events must never be mutated after creation. If an event was wrong:
- Append a correction/compensation event (e.g., `FAILURE_RECOVERED` with previous data)
- Never retroactively modify an existing event

### 3.3 Sequence ordered

```text
events[n].sequence == n + 1 (1-indexed, monotonic)
events[n].previousSequence == n (chain linkage)
```

Sequence is assigned by the server at write time. The client optimistic sequence is temporary and overwritten by server on ACK.

### 3.4 Replay deterministic

Given the same ordered list of events in the same sequence:
```
replayEvents(events) == same result, always
```

NO dependence on:
- `Date.now()` (use event.timestamp from payload if needed)
- `Math.random()`
- localStorage
- API state
- Vue reactivity

---

## 4. Reducer Rules (IMMUTABLE)

### 4.1 Pure function

```typescript
function reduceEvent(state: ExecutionRuntimeState, event: JournalEvent): ExecutionRuntimeState
```

- No side effects
- No async
- No external reads
- Returns new state object (shallow clone + merge)

### 4.2 Stage-specific

Each event type maps to exactly one stage:

| Event Type | Stage | Payload Key |
|---|---|---|
| `CHARACTER_GENERATED` | character | `characterSpecs` |
| `CHARACTER_IMAGE_GENERATED` | character | `images` |
| `SCENE_GENERATED` | scene | `sceneSpecs` |
| `SCENE_IMAGE_GENERATED` | scene | `images` |
| `VOICE_CONFIGURED` | voice | `voiceConfigs` |
| `STORYBOARD_GENERATED` | storyboard | `videoSegments` |
| `VIDEO_RENDER_COMPLETED` | video | `videoProduction` |
| `PIPELINE_STAGE_COMMITTED` | — | `stage` (sets stage status) |
| `RUNTIME_RESUMED` | — | `state` (full snapshot) |
| `FAILURE_RECOVERED` | — | `recoveredStage` |

### 4.3 Stale event rejection

```typescript
if (event.sequence <= stage.lastEventSequence) return  // reject
```

This prevents:
- Double-apply on network retry
- Stale response from earlier request
- Out-of-order delivery from async workers

---

## 5. Component Rules

### 5.1 Read path

```typescript
const rt = useProjectRuntime()
const characterSpecs = rt.getCharacterSpecs()  // NOT a local ref
```

Allowed local component state:
- `ref` for UI transient state (input text, scroll, modal open)
- `ref` for UX state (loading, validation error)
- `ref` for derived UI state that is pure function of runtime state

**Forbidden:**
- Ref/Reactive that duplicates `runtime.characterSpecs`, `runtime.sceneSpecs`, `runtime.voiceConfigs`, `runtime.videoSegments`
- `computed` that reconstructs state from `execution_results` or `plotBlueprint`

### 5.2 Write path

```typescript
// ✅ Correct
const rt = useProjectRuntime()
await rt.appendAndApply({
  type: 'CHARACTER_GENERATED',
  stage: 'character',
  trigger: 'user',
  payload: { characterSpecs: [...] }
})

// ❌ Forbidden
await fetch('/api/projects/...', { ... })
await fetch('/api/.../execution-results', { ... })
```

The only exception is the legacy `script/parse` and `script/regenerate` routes which write via the server-side auto-persist path. These will be migrated to event-first in a future phase.

### 5.3 Lifecycle

```
onMounted:
  hydrateRuntime(projectId)  // reads journal, replays, populates store

beforeUnmount:
  no special action needed (journal is canonical)

Before goNext() / stage switch:
  await rt.commitStage(currentStage)
  // This appends PIPELINE_STAGE_COMMITTED event
```

---

## 6. Hydration Priority

```
1. Journal replay (GET /api/projects/:id/runtime)
   → Restores complete runtime state from events
2. execution_results fallback
   → For projects that were created before journal existed
3. plotBlueprint derivation
   → Last resort: derive character/scene from plot data
4. Empty defaults
   → New project with no data
```

---

## 7. Stage Commit Barrier

```
commitStage(stage):
  1. Flush any pending debounced writes
  2. Append PIPELINE_STAGE_COMMITTED to journal
  3. Update execution_results snapshot (backward compat)
  4. Mark stage as completed in runtime store
  5. Verify read-back (optional, configurable timeout)
```

---

## 8. Error Handling

| Error | Runtime Behavior |
|---|---|
| Journal write fails | `appendAndApply` still updates local store (optimistic). Retry via retry policy. Last resort: IndexedDB queue (future). |
| Replay fails | Fall back to `execution_results` read, then `plotBlueprint` derivation |
| Stale event (sequence < last) | Silently ignored |
| Concurrent append | DB-level sequential writes; no risk of sequence collision at single-instance scale |

---

## 9. Current Audit Status

| Check | Status | Notes |
|---|---|---|
| Double state source | ⚠️ 3 violations | `InspirationField.vue:624` has `sceneDesign` ref duplicating sceneSpecs; `VoiceGeneration.vue` has local `voiceConfigs` ref; `DirectorStudio.vue` has local `videos` ref |
| Direct fetch to execution_results | 🔴 3 components | `VoiceGeneration.vue:354` `saveToBackend()` writes execution_results directly (read-merge-write pattern); `DirectorStudio.vue:602` same for videoResults; `InspirationField.vue:966` reads execution_results for character images |
| Reducer pure function | ✅ Verified | `reduceEvent()` is pure, tested via curl replay |
| Sequence monotonic | ✅ Verified | DB-assigned, 1-indexed, `previousSequence` chain |
| Hydration coverage | ⚠️ Partial | `production.vue` hydrates on mount/load/scriptParsed; individual components (VoiceGeneration, DirectorStudio, InspirationField) not migrated to read from `projectRuntime` |

---

## 10. Future Considerations (NOT for implementation now)

- **IndexedDB offline queue** — for mobile/weak networks
- **Event schema versioning** — forward compatibility when event types evolve
- **Distributed sequence** — when scaling beyond single DB (Citus, sequence sharding)
- **Time travel debugger** — `replayTo(sequence)` for runtime debugging
- **Event streaming (SSE/WebSocket)** — real-time multi-tab sync
- **Compensation events** — undo/rollback mechanism via correction events

---

*This document must be updated before any architectural change to the runtime layer.*
