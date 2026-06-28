# EGOS: Unified Execution Graph System (Activation Layer)

**Phase: KGOCS → EGOS Transition**
**Mode: Incremental Activation (non-breaking)**
**Date: 2026-05-16**
**Objective: Kernel upgrades from passive observer to active graph reconstructor, without modifying runtime execution.**

---

## 0. Core Shift

```
BEFORE (KGOCS):
Execution System → Kernel (read-only observer)
  runtime immutable    interpretation only

AFTER (EGOS):
Execution System → Kernel (live graph reconstructor)
  runtime immutable    active correlation + coordination
```

**Kernel still does NOT execute.**
**Kernel NOW reconstructs execution reality as a unified continuous graph in real time.**

---

## 1. EGOS Core: Unified Execution Graph Runtime Model

### 1.1 Live Graph Model

The Kernel maintains a **live, in-memory execution graph** built from all three planes:

```ts
interface ExecutionGraph {
  /** Root trace identifier */
  traceId: string
  /** All nodes across all planes */
  nodes: Map<string, ExecutionNode>
  /** Causal edges between nodes */
  edges: CausalEdge[]
  /** Current status of the graph */
  status: 'partial' | 'complete' | 'orphaned'
  /** Time window (wall clock bounds) */
  timeWindow: { start: number; end?: number }
}

interface CausalEdge {
  sourceId: string
  targetId: string
  type: 'causal' | 'temporal' | 'composite'
  confidence: number  // 0.0–1.0
  metadata?: Record<string, unknown>
}
```

### 1.2 Graph Construction Flow

```
dispatchByCapability called
    ↓
Kernel.traceStorage.run() creates traceId
    ↓
SYNC adapter completes → Kernel records ExecutionNode (plane=SYNC)
    ↓
Route handler calls dispatchByCapability again → Kernel records child node
    ↓
Kernel.stitch(source, child) creates CausalEdge
    ↓
STREAM session starts → Kernel records ExecutionNode chain
    ↓
ASYNC job submitted → Kernel records ExecutionNode (plane=ASYNC, status=running)
    ↓
ASYNC job completes → Kernel updates node (status=completed)
    ↓
ExecutionGraph assembled

Each step: Kernel observes, records, correlates — never executes.
```

### 1.3 Plane-Specific Node Recording

| Plane | When Node Is Recorded | Node Shape |
|-------|----------------------|------------|
| SYNC | After `adapter.execute()` completes | Single node (completed) |
| STREAM | On session creation + per-chunk | Chain of nodes (streaming...done) |
| ASYNC | On submit + per state transition | Lifecycle cluster (pending→running→terminal) |

**No adapter code is modified.** Recording happens at the **dispatcher wrapper level**:

```ts
// capability-dispatcher.ts — unchanged adapter call, but now wrapped:
const nodeId = kernel.recordStart({ capability, plane, timestamp })
try {
  const result = await adapter.execute(request, candidate)
  kernel.recordEnd(nodeId, { status: 'completed', result })
  return result
} catch (err) {
  kernel.recordEnd(nodeId, { status: 'failed', error: err.message })
  throw err
}
```

---

## 2. Kernel Activation Layer

### 2.1 Passive → Active Upgrade

The Kernel gains three new capabilities while remaining non-executing:

```
Passive Kernel (KGOCS):         Active Kernel (EGOS):
  Record nodes                    Record nodes
  Store edges                     Store edges
  Query on demand                 Correlate in real time
  Post-hoc analysis               Update graph incrementally
  No live view                    Maintain live execution graph
```

### 2.2 Minimal Intervention Points

| Point | What Kernel Does | Impact on Runtime |
|-------|-----------------|------------------|
| `capability-dispatcher.ts` | Wrap with `kernel.recordStart/End` | Zero (wrapper preserves return) |
| `stream-plane.ts` | Record chunk emissions | Zero (stream reader unaffected) |
| `async-plane.ts` | Subscribe to job events | Zero (event listener, not mutator) |
| Route handlers | Inherit `traceContext` | Zero (AsyncLocalStorage, no change) |

### 2.3 Kernel Public API

```ts
// Kernel.ts — active mode
class ExecutionGraphKernel {
  // Record
  recordStart(input: { capability: string; plane: Plane; timestamp?: number }): string  // returns nodeId
  recordEnd(nodeId: string, result: { status: string; result?: any; error?: string }): void
  stitch(sourceId: string, targetId: string, type?: CausalEdge['type']): void

  // Query
  getGraph(traceId: string): ExecutionGraph
  getNode(nodeId: string): ExecutionNode | null
  getTimeline(traceId: string): TimelineEntry[]
  search(filters: { capability?: string; plane?: Plane; status?: string; timeRange?: [number, number] }): ExecutionNode[]

  // Lifecycle
  init(): void
  shutdown(): void
}
```

---

## 3. Cross-Plane Coordination Model

### 3.1 Coordination vs Execution

**Coordination** is observation + correlation.
**Execution** is calling a provider/adapter.

Kernel only coordinates. The system's coordination rules:

| Scenario | Coordination Action |
|----------|-------------------|
| SYNC completes → STREAM starts | Kernel records causal edge (via explicit call from handler) |
| STREAM chunk contains ASYNC request | Kernel links STREAM node → ASYNC node |
| ASYNC job FAILED | Kernel updates node status, no further action |
| Orphan node detected (no parent within 5s) | Kernel flags as `orphaned`, confidence < 1.0 |
| Two nodes share traceId but no explicit edge | Kernel infers temporal edge, confidence 0.5 |

### 3.2 Causal Linking Rules

| Trigger | Link Type | Confidence | Method |
|---------|-----------|------------|--------|
| Explicit `parentNodeId` in request | causal | 1.0 | Handler-author |
| ASYNC job: worker emits result referencing STREAM sessionId | causal | 1.0 | Worker-report |
| Temporal proximity (< 500ms, same user) | temporal | 0.5 | Kernel inference |
| Payload overlap (output URL appears in next input) | composite | 0.8 | Kernel inference |
| No known relation | none | 0.0 | Unlinked node |

---

## 4. Execution Graph Reconciliation Engine

### 4.1 Problem

Inconsistent timelines can arise:
- SYNC node reports `latencyMs: 2000` but wall clock shows 2500ms
- STREAM session ended but job store still shows RUNNING
- ASYNC job completed but Kernel hasn't received the event

### 4.2 Reconciliation Rules

| Inconsistency | Resolution |
|---------------|-----------|
| Node wall clock vs adapter-reported latency | Wall clock wins (Kernel measurement) |
| STREAM session ended but no terminal event | Kernel waits 5s then marks `completed` |
| ASYNC job: Kernel sees terminal but poll() says RUNNING | Poll result wins (job store is authoritative) |
| Duplicate node (same request ID recorded twice) | Dedup by request ID, keep first |
| Missing parent (child has parentNodeId but no recorded parent) | Create placeholder `OrphanParent` node, mark confidence 0.0 |

**Rule: When in doubt, trust runtime state, not Kernel state.**

---

## 5. Unified Timeline Construction

### 5.1 Ordering Rules

The timeline must merge events from three time-incompatible planes into one coherent sequence.

**Priority order:**

```
1. Logical causality (explicit parent-child edges)
2. Wall clock timestamp (epoch ms)
3. Kernel ingestion order (last resort)
```

### 5.2 Timeline Construction

```ts
function buildTimeline(graph: ExecutionGraph): TimelineEntry[] {
  // 1. Topological sort by causal edges
  const sorted = topologicalSort(graph.nodes, graph.edges)

  // 2. Within same depth, sort by wall clock
  sorted.sort((a, b) => a.timestamp.epochMs - b.timestamp.epochMs)

  // 3. Assign visual depth (tree indentation)
  return assignDepths(sorted, graph.edges)
}
```

### 5.3 Timeline Rendering Primitive

```
Depth  Label                           Plane   Status     Wall Clock
────────────────────────────────────────────────────────────────
0      Request: image generate         SYNC    completed  t0+0ms
1        Image: output.png             SYNC    completed  t0+1200ms
0      Request: llm analyze            STREAM  completed  t0+1300ms
1        LLM: chunk 1                  STREAM  streamed   t0+1400ms
1        LLM: chunk 2                  STREAM  streamed   t0+1420ms
1        LLM: chunk 3                  STREAM  streamed   t0+1450ms
1        LLM: done                     STREAM  completed  t0+1600ms
0      Request: video render           ASYNC   running    t0+1700ms
1        Video: submitted              ASYNC   pending    t0+1700ms
1        Video: running                ASYNC   running    t0+5000ms
1        Video: progress 45%           ASYNC   partial    t0+12000ms
1        Video: completed              ASYNC   completed  t0+25000ms
```

---

## 6. Observability Upgrade (EGOS View)

### 6.1 EGOS API

```ts
// GET /api/v1/execution-graph/:traceId
{
  "traceId": "egos_trace_7f3a2b",
  "status": "complete",
  "nodes": [...],
  "edges": [...],
  "timeline": [...],
  "summary": {
    "totalDuration": 25000,
    "planes": ["SYNC", "STREAM", "ASYNC"],
    "capabilities": ["image", "llm", "video"],
    "failed": false
  }
}
```

### 6.2 EGOS Frontend View (conceptual)

Three view modes available via query param:

```
GET /execution-graph/:traceId?view=timeline    ← tree timeline (default)
GET /execution-graph/:traceId?view=graph       ← DAG view
GET /execution-graph/:traceId?view=planes      ← per-plane split view
```

**No existing frontend code changes** — EGOS is a new API endpoint, consumed optionally.

---

## 7. Safety Model (KGOCS Preservation Layer)

### 7.1 Invariants Enforced

| Invariant | Enforcement |
|-----------|-------------|
| Kernel cannot call providers | Kernel has no provider references, no SDK imports |
| Kernel cannot create new execution | Kernel has no `dispatchByCapability` call |
| Kernel cannot modify adapter output | Kernel receives adapter output after execution completes |
| Kernel cannot block execution | Kernel wrapping is `try/finally` — always passes through |
| Kernel cannot cancel jobs | Kernel has no `cancel()` call — only records state |
| Kernel cannot change queue behavior | Kernel does not interact with queue |

### 7.2 Architectural Safeguard

```ts
// In the Kernel class itself:
class ExecutionGraphKernel {
  // 🚫 No provider imports
  // 🚫 No adapter instances
  // 🚫 No dispatchByCapability call
  // 🚫 No queue references
  // 🚫 No database writes (only in-memory graph store)

  // ✅ Only:
  // - Record execution events
  // - Correlate nodes
  // - Serve queries
}
```

### 7.3 Dependency Diagram

```
routes (unchanged)
    │
    ▼
capability-dispatcher (unchanged execution, +Kernel wrapper)
    │
    ├── pluginRegistry (unchanged)
    ├── adapter.execute (unchanged)
    └── Kernel.record (new, non-blocking)
            │
            ▼
        ExecutionGraph (in-memory, queryable)
```

Execution path is untouched. Kernel is a side channel, not a pipeline stage.

---

## 8. File Changes Required

### New Files

| File | Purpose |
|------|---------|
| `src/kernel/execution-graph-kernel.ts` | Main Kernel class (record, stitch, query) |
| `src/kernel/execution-graph-store.ts` | In-memory graph store (nodes + edges) |
| `src/kernel/timeline-builder.ts` | Timeline construction + topological sort |
| `src/kernel/types.ts` | All EGOS types |
| `src/kernel/index.ts` | Public API, singleton init |

### Modified Files (minimal)

| File | Change |
|------|--------|
| `src/index.ts` | `kernel.init()` at startup |
| `src/queue/capability-dispatcher.ts` | Wrap with `kernel.recordStart/End` |
| `src/queue/stream-plane.ts` | Add chunk recording hook |
| `src/queue/async-plane.ts` | Subscribe to job events |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/core/provider-adapters/*` | Kernel does not touch adapters |
| `src/core/provider-registry/*` | Kernel does not touch registry |
| `src/runtime/providers/*` | Kernel does not touch LLM runtime |
| `src/routes/*` | Routes unchanged (Kernel is wrapper, not route) |
| `src/queue/queue-manager.ts` | Kernel does not touch queue |
| `src/queue/worker-runtime.ts` | Kernel does not touch workers |

---

## 9. Verification Checklist

| Criterion | Verification |
|-----------|-------------|
| Kernel cannot execute anything | No provider/adapter/dispatch imports in kernel/ |
| Runtime behavior unchanged | All existing integration tests pass (same output) |
| Graph records all three planes | Manual: execute image+llm+video, query graph |
| Timeline is causality-ordered | Manual: check parent-child order, not wall clock |
| Kernel survives adapter failure | Adapter throws → Kernel records failure → propagates |
| Kernel does not block on slow execution | Wrapping is sync + non-blocking |
| KGOCS invariants preserved | Code review: no execution path modified |

---

## 10. Decision Record

- **EGOS is a live graph reconstruction layer**, not a runtime system. Kernel records, correlates, and serves queries — it does not execute.
- **Adapters are unchanged.** Recording happens at the dispatcher wrapper level, not inside adapters.
- **Timeline is causality-ordered, then clock-ordered, then ingestion-ordered.** This priority ensures logical consistency over temporal precision.
- **When in doubt, trust runtime state.** Kernel's graph is a reconstruction, not an authority. If a job store says RUNNING but Kernel hasn't received the event, the job store wins.
- **Kernel is in-memory.** No persistence layer in v1. This keeps it fast, simple, and clearly non-authoritative.
- **KGOCS invariants are enforced architecturally.** Kernel has no provider references, no adapter instances, no dispatch calls, no queue references. It physically cannot execute.
