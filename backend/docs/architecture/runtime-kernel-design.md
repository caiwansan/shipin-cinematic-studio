# Runtime Kernel: Cross-Plane Orchestration Design

**Phase: KGOCS → Kernel Orchestration Layer**
**Status: Architecture Design (zero-runtime-change)**
**Date: 2026-05-16**
**Objective: Make three incompatible temporal execution models appear as one unified execution graph.**

---

## 0. Core Problem

Three execution planes exist independently:

| Plane | Capabilities | Time Model | State | Status |
|-------|-------------|-----------|-------|--------|
| SYNC | image, tts | Instant (t0→t1) | Caller-owned | ✅ Active |
| STREAM | llm | Continuous (t0→tn) | External conv ctx | ✅ Spec + bridge design |
| ASYNC | video | Decoupled (t0→tX) | Runtime job store | ✅ Spec |

They are semantically incompatible in time model, but must appear as a single unified execution graph.

**The Kernel is NOT a fourth plane.**
It is a **cross-plane interpretation layer** — it reads, correlates, and presents all three planes as one execution graph. It does NOT execute anything.

---

## 1. Unified Execution Graph Model

### 1.1 Graph Abstraction

Every execution across all planes becomes an **Execution Graph Node**:

```ts
interface ExecutionNode {
  /** Unique identifier across all planes */
  nodeId: string
  /** Which plane produced this node */
  plane: 'SYNC' | 'STREAM' | 'ASYNC'
  /** The capability that triggered execution */
  capability: string
  /** Temporal position — normalized to canonical time */
  timestamp: CanonicalTimestamp
  /** Node lifetime */
  duration: {
    start: number   // epoch ms
    end?: number     // undefined if still running (ASYNC)
    status: 'completed' | 'running' | 'pending' | 'failed'
  }
  /** Parent node (if causally dependent) */
  parentNodeId?: string
  /** Child nodes (if this node spawned further execution) */
  childNodeIds: string[]
  /** Execution metadata */
  meta: {
    provider?: string
    model?: string
    jobId?: string     // ASYNC only
    sessionId?: string // STREAM only
  }
}
```

### 1.2 Node Type Mapping

| Plane | Node Shape | Emits | Children |
|-------|-----------|-------|----------|
| SYNC | Single node (t0→t1) | Result artifact | None |
| STREAM | Linear chain (t0→t1→...→tn) | Chunks | May trigger SYNC/ASYNC |
| ASYNC | Lifecycle cluster (submit→poll→...→terminal) | State transitions | None (leaf) |

### 1.3 Edge Types

```
CAUSAL:     nodeA → nodeB   (A's output caused B's execution)
TEMPORAL:   nodeA -- nodeB  (same timeline, no causality)
COMPOSITE:  nodeA ─┐
            nodeB ──┤→ nodeC  (multiple inputs merged)
            nodeC ──┘
```

---

## 2. Cross-Plane Timeline Alignment

### 2.1 The Problem

Each plane measures time differently:

```
SYNC:    [---t0---t1---]          (wall-clock pair)
STREAM:  [--t0--t1--t2--t3--t4]  (event sequence)
ASYNC:   [t0--------t1--------------tX]  (sparse state transitions)
```

These are **incommensurable** — you cannot compare a SYNC duration to an ASYNC duration.

### 2.2 Canonical Time Model

All planes normalize to a single representation:

```ts
interface CanonicalTimestamp {
  /** Wall clock — always present */
  epochMs: number
  /** Sequence position within the parent execution (0-indexed) */
  sequence: number
  /** Plane-specific time qualifier */
  source: 'request' | 'first_token' | 'chunk' | 'state_change' | 'terminal'
}
```

**Normalization rules:**

| Plane | Wall clock source | Sequence source |
|-------|-----------------|-----------------|
| SYNC | request start | 0 (request) / 1 (result) |
| STREAM | chunk arrival | Chunk index |
| ASYNC | state transition | State ordinal (PENDING=0, RUNNING=1, ...) |

### 2.3 Timeline Merge

When displaying an execution that crosses planes:

```
Request A (SYNC: image gen)      t0──t1
  └→ Request B (SYNC: tts for caption)   t2──t3
      └→ Request C (STREAM: llm analysis) t4──t5──t6──t7
          └→ Request D (ASYNC: video render)  t8────t9──────t10
```

Each node has its own temporal axis. The merge concatenates them by causality,
not by clock — because ASYNC's t8 may overlap with STREAM's t6 in wall time.

**Rule: Timeline is causality-ordered, not clock-ordered.**

---

## 3. Global Trace Fabric

### 3.1 Trace ID System

```ts
interface GlobalTrace {
  /** Root trace — created at the first dispatchByCapability call */
  traceId: string
  /** Execution graph nodes — appended by each plane */
  nodes: ExecutionNode[]
  /** Correlation map */
  correlations: Map<string, CorrelationEntry>
}

interface CorrelationEntry {
  sourceNodeId: string
  targetNodeId: string
  relation: 'causal' | 'temporal' | 'composite'
  confidence: 1.0  // 0-1, 1.0 when explicitly linked
}
```

### 3.2 Trace Propagation

The trace fabric must cross plane boundaries without either plane knowing about the other.

**Design: `traceContext` as ambient carrier**

```ts
// Injected at dispatchByCapability, carried through all planes
interface TraceContext {
  traceId: string
  parentNodeId: string   // the node that triggered this execution
  depth: number          // for rate limiting / depth control
}

// Each plane's adapter receives traceContext implicitly
// via the request payload or a side-channel (AsyncLocalStorage)
```

**Cross-plane correlation rules:**

| Trigger | Source Plane | Target Plane | Correlation |
|---------|-------------|-------------|-------------|
| LLM decides to generate image | STREAM | SYNC | Explicit (LLM output → image request) |
| User requests video | API | ASYNC | Explicit (route handler → dispatch) |
| Image result triggers LLM analysis | SYNC | STREAM | Explicit (caller plumbing) |
| Two parallel SYNC requests | SYNC | SYNC | Temporal (same parent) |

### 3.3 AsyncLocalStorage Pattern

```ts
// Kernel.ts (cross-plane, no runtime changes)
import { AsyncLocalStorage } from 'async_hooks'

export const traceStorage = new AsyncLocalStorage<TraceContext>()

// In dispatcher:
dispatchByCapability(input) {
  return traceStorage.run(new TraceContext(), () => {
    // ... existing dispatch logic, unchanged ...
  })
}

// In each plane's adapter (zero code change to adapters):
// The adapter reads traceStorage.getStore() if it wants to participate
// in trace propagation. If it doesn't, trace is still maintained at the
// dispatcher level.
```

---

## 4. Cross-Plane Causality Stitching

### 4.1 The Problem

Causality across planes is NOT automatically detectable.
An image generation (SYNC) followed by an LLM analysis (STREAM) is causally linked — but the dispatcher does not know that. The causality is in the **application logic** (the route handler that calls both).

### 4.2 Stitching Model

Two levels:

**Level 1: Explicit (API layer)**

```ts
// In route handler — the caller knows causality
dispatchByCapability({ capability: 'image', ... })
  .then(imageResult => {
    dispatchByCapability({
      capability: 'llm',
      payload: { messages: [{ role: 'user', content: `Analyze this image: ${imageResult.url}` }] },
      parentNodeId: imageResult.nodeId,  // 👈 explicit causality
    })
  })
```

The route handler is the **causality author**. The kernel just records it.

**Level 2: Inferred (observability layer)**

For nodes without explicit parent linkage, the kernel may infer:
- **Temporal proximity**: two nodes started within 100ms of each other
- **Resource sharing**: same userId, same projectId
- **Payload correlation**: output of one node appears in input of another

Inferred edges get `confidence < 1.0`.

### 4.3 Stitching Engine Design

```ts
class CausalityStitcher {
  constructor(private store: ExecutionNodeStore) {}

  /** Record an explicit causal edge */
  stitch(parentNodeId: string, childNodeId: string): void {
    this.store.addEdge(parentNodeId, childNodeId, { type: 'causal', confidence: 1.0 })
  }

  /** Infer edges for unlinked nodes */
  infer(): InferredEdge[] {
    const pending = this.store.getUnlinkedNodes()
    return pending.map(node => this.findBestParent(node)).filter(Boolean)
  }

  private findBestParent(node: ExecutionNode): InferredEdge | null {
    const candidates = this.store.getNodesBefore(node.timestamp.epochMs)
    // Score by proximity, resource match, payload overlap
    return bestScored(candidates)
  }
}
```

---

## 5. Execution Observation Model

### 5.1 Single-View Representation

```ts
// What a cross-plane execution looks like when observed
interface ExecutionTimeline {
  traceId: string
  planes: {
    sync: SyncNode[]
    stream: StreamNode[]
    async: AsyncNode[]
  }
  timeline: TimelineEntry[]  // merged, causality-ordered
}

interface TimelineEntry {
  time: CanonicalTimestamp
  label: string  // e.g. "image generate", "llm stream chunk 3", "video job running"
  plane: 'SYNC' | 'STREAM' | 'ASYNC'
  status: 'pending' | 'running' | 'completed' | 'failed'
  depth: number  // indentation level for tree view
  nodeId: string
  parentNodeId?: string
}
```

### 5.2 View Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Timeline** | Causality-ordered, wall clock shown | Debugging a single request |
| **Plane split** | Three parallel timelines | Diagnosing plane-specific issues |
| **Graph** | DAG view of execution nodes | Understanding system topology |
| **Log** | Flat event stream | Low-level debugging |

### 5.3 Observable Primitives

The kernel must bridge four different data sources into one view:

| Source | Native Format | Kernel Converted To |
|--------|--------------|-------------------|
| SYNC adapter | `{ content, meta, latencyMs }` | ExecutionNode (single, completed) |
| STREAM bridge | `StreamChunk[]` | ExecutionNode chain |
| ASYNC job store | `JobEvent[]` | ExecutionNode lifecycle cluster |
| Provider logs | raw strings | Attached metadata on nodes |

---

## 6. Failure Propagation Strategy

### 6.1 Isolation Principle

**Failures do not cross plane boundaries by default.**

```
SYNC failure  ──✗──→  STREAM (not affected)
STREAM failure ──✗──→  ASYNC (not affected)
ASYNC failure  ──✗──→  SYNC (not affected)
```

A failing TTS adapter must NOT cause a running LLM stream to error.
A failing video job must NOT invalidate a completed image generation.

### 6.2 Exception: Explicit Dependency

When a failure must propagate (because the downstream depends on upstream):

```ts
// Route handler explicitly chains
const image = await dispatchByCapability({ capability: 'image' })
// image failed → handler throws → catch → no llm call
const llm = await dispatchByCapability({
  capability: 'llm',
  payload: { ...image.result },  // depends on image
})
```

The failure propagation is **in the route handler**, not in the Kernel.

### 6.3 Kernel's Role in Failure

The kernel records, not handles:

| Event | Kernel Action |
|-------|--------------|
| SYNC adapter throws | Record `failed` node |
| STREAM chunk contains error | Record error node in chain |
| ASYNC job enters FAILED | Record terminal failure node |
| Causality chain breaks | Record orphan node |

**The kernel does NOT:**
- Retry failed executions (policy layer's job)
- Fall back to alternative providers (policy layer's job)
- Notify users (application layer's job)
- Clean up orphan resources (cleanup layer's job — future)

---

## 7. Kernel Architecture (File Map)

```
src/kernel/
├── types.ts                    ← Core types (ExecutionNode, TimelineEntry, TraceContext, etc.)
├── execution-graph-store.ts    ← In-memory store of all nodes + edges
├── timeline-normalizer.ts      ← Converts plane-specific timestamps to canonical form
├── trace-fabric.ts             ← Trace ID generation, propagation, AsyncLocalStorage
├── causality-stitcher.ts       ← Explicit + inferred edge creation
├── observation-provider.ts     ← Single-view query interface
└── index.ts                    ← Public API (init, shutdown, etc.)
```

**Zero modifications to:**
- `src/routes/` — route handlers call `dispatchByCapability` as before
- `src/queue/` — dispatcher unchanged
- `src/core/provider-adapters/` — adapters unchanged
- `src/core/provider-registry/` — registry unchanged
- `src/runtime/providers/` — LLM runtime unchanged

---

## 8. Integration Points

### 8.1 What Needs to Change (minimal)

| File | Change | Risk |
|------|--------|------|
| `queue/capability-dispatcher.ts` | Wrap dispatch in `traceStorage.run()` + record node after execution | Low |
| `queue/stream-plane.ts` (new) | Same for STREAM path | Low (new file) |
| `queue/async-plane.ts` (new) | Same for ASYNC path | Low (new file) |
| `index.ts` | `kernel.init()` at startup | Low |

### 8.2 What Does NOT Change

All existing execution code. The kernel sits **outside** the execution path.
It wraps the dispatcher with a thin observability layer, nothing more.

---

## 9. Kernel Invariants

1. **Kernel does not execute.** It wraps, observes, records, and correlates.
2. **Kernel does not replace dispatcher.** Dispatcher remains authority on capability → plane mapping.
3. **Kernel does not change adapter contract.** Adapters remain stateless protocol translators.
4. **Kernel does not change policy contract.** Policy remains pure function over candidates.
5. **Kernel does not store job state.** ASYNC job store remains authoritative for video lifecycle.
6. **Kernel does not manage conversation state.** STREAM conversation context remains external.
7. **Kernel does not own failure handling.** Failures are recorded, not handled.
8. **Timeline is causality-ordered, not clock-ordered.** Cross-plane wall clock comparison is not meaningful.

---

## 10. Decision Record

- **Kernel is an interpretation layer**, not an execution layer. It makes three incompatible time models look unified without modifying any of them.
- **Causality is explicitly authored** by route handlers. The kernel records; it does not infer (except at observability level with confidence < 1.0).
- **Failures are isolated by default.** Cross-plane failure propagation only happens through explicit caller chaining.
- **Trace propagation uses AsyncLocalStorage** — zero code change to adapters. The trace context is ambient.
- **View modes are separated.** Timeline (causality), Plane split (per-plane), Graph (topology), Log (flat events). Different debugging contexts need different views.
- **Kernel does NOT store ASYNC job state.** The job store is authoritative. The kernel only records ExecutionNode snapshots at state transitions.
- **Resource arbitration is explicitly NOT in scope for v1.** It requires plane-aware scheduling which cannot be designed without modifying runtime.
