# Async Plane Formal Specification v1.0

**(Temporal Execution Physics Layer)**

**Status: Architecture Constitution (pre-implementation)**
**Date: 2026-05-16**
**Part of: Phase F — Execution Model Separation**

---

## 0. Scope Definition

Async Plane defines the execution model for:
> All capabilities where result is not immediately determinable.

Including:
- video generation
- long-running workflows
- batch rendering
- future LLM batch mode (optional)
- any capability exceeding streaming time horizon

---

## 1. Core Axioms

### Axiom 1 — Time is decoupled from execution

```
submit(request) ≠ execute(request) ≠ resolve(result)
```

### Axiom 2 — State is the only truth source

```
truth = JobStateMachine
not provider
not worker
not queue
```

### Axiom 3 — Execution is irreversible

```
once submitted → cannot be in-place mutated
```

### Axiom 4 — Output is optional, state is mandatory

```
job may never produce result
but must always produce state transitions
```

---

## 2. Async Execution Object Model

### 2.1 Job (execution entity)

```ts
interface Job {
  id: string
  capability: string
  status: JobState
  createdAt: number
  updatedAt: number
}
```

### 2.2 JobState (state machine)

```ts
type JobState =
  | 'PENDING'
  | 'RUNNING'
  | 'PARTIAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
```

### 2.3 JobEvent (time slice)

```ts
interface JobEvent {
  jobId: string
  type: 'STATE_CHANGE' | 'PROGRESS' | 'LOG' | 'RESULT' | 'ERROR'
  payload: any
  timestamp: number
}
```

---

## 3. Async Lifecycle Model

```
t0: submit(request)
t1: job created (PENDING)
t2: RUNNING
t3: PARTIAL (optional, repeatable)
t4: terminal state (SUCCEEDED | FAILED | CANCELLED)
```

**Key property:** There is no guarantee that t4 exists in bounded time.

---

## 4. Async Execution Contract

```ts
interface AsyncExecutionAdapter {
  /** Create execution entity — returns immediately */
  submit(input: any): Promise<JobHandle>

  /** State query only — no side effects */
  poll(jobId: string): Promise<JobState>

  /** Best-effort cancellation — not guaranteed rollback */
  cancel(jobId: string): Promise<void>

  /** Optional: event subscription — not an execution driver */
  stream?(jobId: string): AsyncIterable<JobEvent>
}
```

---

## 5. Execution Semantics Rules

### Rule 1 — Detached Execution

```
submit ≠ execute
```

Execution may happen:
- immediately
- delayed
- distributed
- retried
- migrated

### Rule 2 — State Transition Authority

Only valid transitions:

```
PENDING  → RUNNING
RUNNING  → PARTIAL
RUNNING  → SUCCEEDED
RUNNING  → FAILED
RUNNING  → CANCELLED
PARTIAL  → RUNNING
PARTIAL  → SUCCEEDED
PARTIAL  → FAILED
```

**Invalid:**
- terminal → non-terminal (e.g. SUCCEEDED → RUNNING)
- CANCELLED → RUNNING

### Rule 3 — Event is derivative, not source

```
event = projection(state machine)
event is NOT source of truth
```

### Rule 4 — Partial does NOT imply streaming

| Concept | Meaning |
|---------|---------|
| STREAM | Continuous output |
| PARTIAL | Intermediate state checkpoint |

These are different. PARTIAL is a state machine node, not a data channel.

---

## 6. Capability Mapping

```
capability → AsyncExecutionAdapter
```

| Capability | Adapter Type | Status |
|-----------|-------------|--------|
| video | AsyncJobExecutionAdapter | ⚠️ Stub exists, spec now defined |
| batch render | AsyncJobExecutionAdapter | ❌ Future |
| long workflows | AsyncJobExecutionAdapter | ❌ Future |

---

## 7. Provider Abstraction Rule

**Critical rule:** Async Plane MUST NOT assume existence of a provider layer.

- Video providers may be direct SDK calls
- Or wrapped providers
- Or hybrid queue workers

**Async Plane does not care.**

Only requirement: execution must be representable as `JobStateMachine`.

---

## 8. Failure Model

Async failures are NOT exceptions. They are **state transitions**.

```ts
FAILED:
  - provider_error
  - timeout
  - internal_error
  - dependency_failure
  - unknown

CANCELLED:
  - user_cancelled
  - system_cancelled
  - preempted
```

**Key rule:** No exception escapes Async Plane execution boundary.
Everything becomes state.

---

## 9. Cancellation Semantics

Cancellation is:
```
best-effort signal
not guaranteed immediate stop
not guaranteed rollback
```

**Propagation model:**
1. Cancel request received
2. Job marked CANCELLED in state machine
3. Worker may continue briefly (best-effort stop)
4. Eventual reconciliation required

---

## 10. Retry Semantics

Retry is NOT in-place mutation.

```
retry(job) → new job instance
```

**Rule:** Every retry creates a new execution node.
The original FAILED job remains in the state machine as a historical record.

---

## 11. Observability Model

Async Plane observability is:

Not logs.
Not traces.
Not provider events.

**It is: Job Event Stream Projection.**

Required primitives:
- job timeline
- state transitions
- event replay
- correlation to capability dispatcher trace

---

## 12. Integration with Capability Dispatcher

```
dispatchByCapability('video')
    ↓
AsyncExecutionAdapter.submit()
    ↓
Job created (PENDING)
    ↓
Queue / worker / SDK / provider (opaque execution layer)
    ↓
poll() / stream() for state observation
```

**Dispatcher behavior:**

| Aspect | Sync | Stream | Async |
|--------|------|--------|-------|
| Returns | result | StreamSession | JobHandle |
| Blocks | yes | no | no |
| Time axis | collapsed | continuous | decoupled |

---

## 13. Non-Goals

Async Plane explicitly does NOT define:

- Provider implementation
- Worker architecture
- Queue system internals
- Video rendering pipeline
- Retry infrastructure implementation

---

## 14. Relationship to Other Planes

| Plane | Role |
|-------|------|
| SYNC | Instant execution — request → result |
| STREAM | Continuous emission — request → chunks |
| ASYNC | Time-decoupled lifecycle — request → job → eventual state |

### Temporal comparison

```
SYNC:    t0 ----------- t1 ----------- t2 (collapse)
STREAM:  t0 ------ t1 ---- t2 ---- t3 ---- t4
ASYNC:   t0 ------ t1 ------------------------------- tX / t∞
```

---

## 15. Final System Closure

### Three-plane theorem

```
SYNC   defines computation
STREAM defines flow
ASYNC  defines time
```

### System topology (closed)

```
CAPABILITY DISPATCHER
    ↓
┌──────────────┬──────────────┬──────────────┐
│ SYNC         │ STREAM       │ ASYNC        │
│ image / tts  │ llm          │ video        │
│ ✅ active    │ ✅ spec      │ ✅ spec      │
└──────────────┴──────────────┴──────────────┘
```

**Execution graph is now temporally complete.**

---

## 16. Decision Record

- **State is the primary interface of time.** Not events, not logs, not provider callbacks.
- **Async failures are state transitions**, not exceptions. No exception escapes the plane boundary.
- **Cancel is best-effort.** The state machine immediately reflects CANCELLED; the execution layer converges eventually.
- **Retry is a new execution node.** The original failed job is preserved as history.
- **Provider is invisible to Async Plane.** The plane only requires a `JobStateMachine` representation.
- **Async Plane does not define queue system internals.** It defines the lifecycle contract. The queue is an implementation detail.
