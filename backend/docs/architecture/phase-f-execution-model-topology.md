# Phase F — Capability Execution Model Topology

**Status: Architecture Constitution (pre-implementation)**
**Date: 2026-05-16**
**Predecessor: capability-contract-evolution.md (Capability Ontology)**

---

## 1. Core Shift

```
BEFORE:
Provider → Adapter → execute()

AFTER:
Capability → Execution Model → State Ownership → Adapter
```

---

## 2. Top-Level Runtime Architecture

```
                    ┌────────────────────────────┐
                    │      API / Routes Layer     │
                    │ (images / tts / llm / video)│
                    └────────────┬───────────────┘
                                 │ capability + request
                                 ▼
                ┌────────────────────────────────────┐
                │        Capability Dispatcher        │
                │   (single entry, no provider)      │
                └────────────┬───────────────┬──────┘
                             │               │
                             │ capability    │
                             ▼               ▼
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │  Sync Execution Plane     │   │  Stream Execution Plane   │
        │  (Artifact Model)         │   │  (Stateful Model)         │
        └────────────┬─────────────┘   └────────────┬─────────────┘
                     │                              │
                     ▼                              ▼
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │ SyncExecutionAdapter      │   │ LLMExecutionAdapter       │
        │ (image / tts)            │   │ (conversation model)      │
        └────────────┬─────────────┘   └────────────┬─────────────┘
                     │                              │
                     ▼                              ▼
              ┌──────────────┐            ┌────────────────────┐
              │ artifact out │            │ streaming / state  │
              └──────────────┘            └────────────────────┘


                     ▼
        ┌──────────────────────────┐
        │ Async Execution Plane     │
        │ (Job Lifecycle Model)     │
        └────────────┬─────────────┘
                     ▼
        ┌──────────────────────────┐
        │ AsyncJobExecutionAdapter  │
        │ (video / long tasks)      │
        └────────────┬─────────────┘
                     ▼
        ┌──────────────────────────┐
        │ Job Store / Queue System   │
        │ poll / submit / cancel     │
        └──────────────────────────┘
```

---

## 3. State Ownership Model

The fundamental insight that separates Phase F from Phase E:
**Capability ≠ interface problem. Capability = state ownership problem.**

### A. Sync Model (image / tts)

```
State Ownership:   Caller
Lifecycle:         request → execute → response
Adapter Role:      Stateless transformer
State Duration:    None (ephemeral)
```

### B. Stream Model (llm)

```
State Ownership:   External (Conversation Context Layer)
Lifecycle:         request → stream → partial states → completion
Adapter Role:      Stateless transformer over stateful channel
State Duration:    Session-bound (multi-turn)
```

**Critical rule:** Adapter never owns state. State lives outside the execution unit.
The adapter is a stateless transformer over a stateful channel.

### C. Async Model (video, future: export)

```
State Ownership:   Runtime (Job System)
Lifecycle:         submit → jobId → poll → update → complete
Adapter Role:      Job submitter only
State Duration:    Job-bound (minutes–hours)
```

**Critical rule:** Adapter only submits jobs. Execution continues outside runtime boundary.

---

## 4. Dispatcher Logic — The Core Convergence

```ts
dispatch(capability, input):

    plan = policy.evaluate(candidates)

    switch(plan.executionModel):

        CASE SYNC:
            return SyncPlane.execute(plan, input)

        CASE STREAM:
            return StreamPlane.execute(plan, input)

        CASE ASYNC:
            return AsyncPlane.submit(plan, input)
```

**Key implication:** Policy output becomes `ExecutionPlan`, not just `Candidate`.
An ExecutionPlan includes: model, adapter, executionModel, stateOwnership, timeout.

---

## 5. Capability → Execution Model Mapping

| Capability | Execution Model | State Ownership | Current Status |
|-----------|----------------|----------------|---------------|
| image | SYNC | Caller | ✅ Live |
| tts | SYNC | Caller | ✅ Live (Phase E2.1) |
| llm | STREAM | External (conv context) | ❌ Not implemented |
| video | ASYNC | Runtime (job system) | ❌ Not implemented |
| export | ASYNC | Runtime (job system) | ❌ Future |

---

## 6. System Constitution — The New Rules

### ❌ Forbidden

```
- provider-based routing
- adapter decides execution type
- route contains SDK logic
- capability unaware of its execution model
```

### ✔️ Only Legal Path

```
capability → execution model → state boundary → adapter
```

---

## 7. Final System Layering

```
           Capability Layer
                  ↓
        Execution Model Layer
      (SYNC / STREAM / ASYNC)
                  ↓
        State Ownership Layer
   (caller / runtime / external)
                  ↓
        Adapter Execution Layer
                  ↓
         Provider SDKs (hidden)
```

---

## 8. Capability ≠ Execution — The Key Insight

**Capability** answers:
> "What kind of computation is this?"

**Execution model** answers:
> "What kind of state does this computation require?"

These are different questions. Phase A–E answered the first.
Phase F answers the second.

---

## 9. Transition Path from Current Runtime

The current `capability-dispatcher.ts` must evolve from:

```ts
// Current: single execute() path
async function executeWithAdapter(candidate, rawInput) {
  const adapter = pluginRegistry.getAdapter(candidate.provider)
  return adapter.execute(request, candidate)
}
```

To:

```ts
// Phase F: polymorphic dispatch by execution model
async function dispatchByCapability(input) {
  const candidates = await getEffectiveCandidates(userId, capability)
  const plan = policy.evaluate(candidates)
  // plan now includes: { provider, model, executionModel, stateBoundary }

  switch (plan.executionModel) {
    case 'SYNC':
      return SyncPlane.execute(plan, input)
    case 'STREAM':
      return StreamPlane.execute(plan, input)
    case 'ASYNC':
      return AsyncPlane.submit(plan, input)
  }
}
```

Each Plane is a thin coordinator that:
1. Resolves the correct adapter subclass
2. Calls the correct method (execute / complete+stream / submit+poll)
3. Manages state ownership boundaries
4. Reports execution trace with model-level granularity

---

## 10. Decision Record

- **Capability taxonomy is frozen.** No new execution models will be added. SYNC/STREAM/ASYNC cover all known computation types.
- **State ownership is externalized.** No adapter manages its own state. State is owned by caller (SYNC), conversation layer (STREAM), or job system (ASYNC).
- **Provider is invisible at dispatch.** The dispatcher switches on executionModel, not provider. Provider is resolved by the Plane.
- **Phase F does not change existing adapters.** All 7 existing adapters are SYNC. They require no changes — only the dispatcher evolves.
