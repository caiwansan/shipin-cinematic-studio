# OpenClaw Generative Operating System (GOS)

## Overview

OpenClaw is a generative operating system designed to produce structured cinematic outputs through a multi-layered system that separates:

- world constraints (truth)
- physical resolution (physics)
- stochastic variation (slack)
- adaptive learning (bias)
- aesthetic evolution (style field)
- deterministic decision-making (policy)
- execution isolation (worker/runtime)
- system observability (control plane)

It is not a pipeline. It is a multi-plane generative system.

---

## Core Design Philosophy

### 1. Separation of Concerns as Physics

Each layer in the system is treated as a physical domain with strict boundaries:

- Truth cannot be modified downstream
- Physics resolves constraints but does not decide aesthetics
- Slack introduces bounded stochasticity
- Bias learns locally per project
- Style evolves globally but does not enforce decisions
- Policy is the only decision authority
- Worker is stateless execution
- Control Plane is strictly observational

### 2. Dual-Plane Architecture

The system strictly separates execution from observation. The Control Plane (observability) operates as an out-of-band ring-buffer projection system — it never blocks, never modifies, never participates in execution.

### 3. No Cross-Layer Mutation

No layer modifies another layer's internal state directly. Data flows forward through interfaces. Each layer has its own authority domain and cannot influence upstream layers.

---

## System Architecture (7 Layers + 2 Planes)

```
TRUTH LAYER                    ─ immutable world semantics
    ↓
PHYSICS LAYER                  ─ constraint conflict resolution
    ↓
SLACK LAYER                    ─ bounded stochastic variation
    ↓
BIAS LAYER                     ─ project-scoped learning
    ↓
STYLE FIELD LAYER              ─ cross-project aesthetic evolution
    ↓
POLICY ADAPTER                 ─ single decision authority
    ↓
WORKER / WRAPPER               ─ pure stateless execution kernel
    ↓
PROVIDERS                      ─ external systems (abstracted)
```

### Observation Plane (out-of-band, read-only)

```
CONTROL PLANE
├── Policy Trace      (why this decision)
├── Execution Trace   (how execution happened)
└── Field Snapshot    (what state existed)
```

Control Plane does not participate in execution. It is a read-only projection system.

---

## Source Map

| Layer | Directory | Key Files |
|-------|-----------|-----------|
| Truth Layer | `src/routes/director.ts` | `analyzeScript()` — world constitution |
| Physics Layer | `src/core/constraint-physics/` | `index.ts` — conflict graph + resolution |
| Slack Layer | `src/core/constraint-physics/slack-engine.ts` | SlackAnalyzer, PerturbationInjector, SafetyClamp |
| Bias Layer | `src/core/constraint-physics/feedback-bias.ts` | per-project bias store |
| Style Field | `src/core/style-evolution/` | `style-vectorizer.ts`, `style-memory-graph.ts`, `style-divergence-controller.ts`, `index.ts` |
| Policy Adapter | `src/core/policy-adapter/` | `policy-adapter.ts`, `fallback-state-machine.ts` |
| Worker | `src/queue/worker-runtime.ts` | pure executor |
| Wrappers | `src/core/provider-wrapper/volcengine/` | proxy factory + method bindings |
| Providers | `src/services/` | `volcengine-image.provider.ts`, `volcengine-video.provider.ts`, etc. |
| Control Plane | `src/control-plane/` | `collector.ts` (ring buffer), `types.ts` |
| Control API | `src/routes/control-plane.ts` | read-only trace endpoints |
| Pipeline | `src/routes/director.ts` | `full-pipeline` — integrates layers 1-7 |

---

## Layer Definitions

### 1. Truth Layer

Defines immutable semantic constraints of the world:
- character identity (name, gender, age, traits)
- scene facts (location, time, mood)
- narrative invariants (story constitution, world rules)

**Never modified downstream.** All subsequent layers read from truth but cannot write back.

**Entry point:** `director.ts: analyzeScript()` → `directorUnderstanding.worldConstitution`

---

### 2. Physics Layer

Resolves constraint conflicts into a consistent state:
- builds a weighted conflict graph from constraints
- uses `weighted_tradeoff` algorithm (hard constraints win over soft)
- allocates residual slack for downstream stochasticity
- deterministic output — same input always produces same resolved field

**Key invariant:** The resolved constraint field is the single truth for all downstream layers. Raw constraints are archived for audit only.

**Entry point:** `constraint-physics/index.ts: resolve()`

---

### 3. Slack Layer

Introduces bounded stochastic variation (the source of "cinematic feel"):
- **SlackAnalyzer**: computes residual space from resolved constraints
- **PerturbationInjector**: generates per-shot perturbations (visual, camera, composition, timing, emotion) with decay
- **SafetyClamp**: protects hard constraints from any variation
- open-loop: does not learn across runs (that's Bias Layer's job)

**Key invariant:** Slack cannot touch hard constraints. It operates only on the residual.

**Entry point:** `slack-engine.ts: CreativeSlackEngine.run()`

---

### 4. Bias Layer

Project-scoped adaptive learning layer:
- stores per-project bias state (visualConsistency, cameraFreedom, colorPaletteFidelity, temporalFlexibility)
- bias is accumulated weight adjustment from feedback → influences prompt compiler
- **never writes back to physics layer** — bias only affects future constraint weighting via adjusted weights
- isolated per project (no cross-project contamination)

**Entry point:** `feedback-bias.ts: recordFeedback()`

---

### 5. Style Field Layer

Cross-project aesthetic evolution system with anti-collapse dynamics:
- **StyleVectorizer**: bias + slack + deformation → 3D vector (visual/camera/emotion)
- **StyleMemoryGraph**: attention-weighted cross-project style memory (max 100 nodes), style transition edges
- **StyleDivergenceController**: proactive repulsion-based anti-collapse:
  - continuous baseline exploration noise
  - pairwise dispersion measurement (not variance-from-mean)
  - style repulsion force when nodes cluster
  - emergency injection when entropy < 0.1
- influence output: style drift + prompt tokens → prompt compiler for injection

**Key invariants:**
- Style does not enforce decisions (Policy Adapter does)
- Style influence only affects prompt layer, never physics
- `identity drift = 0` — style cannot change character identity
- `styleInfluenceScore` clamped `[0.05, 0.4]`

**Entry point:** `style-evolution/index.ts: runStyleEvolution()`

---

### 6. Policy Adapter (Decision Authority)

Single source of execution decisions:
- evaluates `PolicySignal` against configurable rules
- decides: `allow | reroute | fallback | reject`
- rule-based fallback state machine
- no execution logic — decisions only
- produces `policyDecision` payload consumed by worker

**Entry point:** `policy-adapter.ts: evaluate()`

---

### 7. Worker / Wrapper (Execution Kernel)

Pure stateless execution layer:
- receives `policyDecision` — cannot self-decide
- executes handler by provider type
- on missing policyDecision: **hard reject** (throw)
- no routing logic, no fallback logic, no provider awareness
- provider calls go through wrapper layer (proxy factory + method bindings)

**Entry point:** `worker-runtime.ts: callProvider()`

---

### 8. Providers

External systems fully abstracted behind wrappers:
- volcengine (image, video, TTS)
- aliyun (image, video)
- never directly accessed — all calls go through:
  1. PolicyAdapter → 2. Worker → 3. Wrapper → 4. Provider

---

## Control Plane (Observability System)

A fully decoupled system for introspection — the system's ability to see itself.

### Design
- **zero interference**: fire-and-forget, no await, no retry
- **bounded memory**: ring buffer (cap 1000), oldest eviction
- **append-only**: data flows one direction
- **independent query**: separate read-only API

### Data Types

| Type | Source | Content |
|------|--------|---------|
| `PolicyTrace` | `policy-adapter.ts` evaluate() | decision, provider, fallback chain, weights |
| `ExecutionTrace` | `worker-runtime.ts` | step list, latency, success/failure |
| `FieldSnapshot` | `routes/director.ts` full-pipeline | physics state, slack state, bias state, style vector |

### APIs (read-only)

```
GET /api/v1/control/traces              → list recent trace IDs
GET /api/v1/control/trace/:id           → full trace bundle (all 3 types)
GET /api/v1/control/trace/:id/policy    → policy trace only
GET /api/v1/control/trace/:id/exec      → execution trace only
GET /api/v1/control/trace/:id/field     → field snapshot only
GET /api/v1/control/buffers             → buffer statistics
GET /api/v1/control/buffers/policy      → raw policy ring buffer (last 50)
GET /api/v1/control/buffers/exec        → raw execution ring buffer (last 50)
GET /api/v1/control/buffers/field       → raw field ring buffer (last 50)
```

---

## Data Flow Model

### Execution Path

```
Request (script, projectId, episodes)
    │
    ▼
┌──────────────────┐
│  analyzeScript() │  ← Truth Layer
│  characterBible  │
│  atmosphere      │
│  rhythm          │
│  shotDesign      │
└────────┬─────────┘
         │ raw constraints
         ▼
┌─────────────────────┐
│  Physics Engine     │  ← constraint conflict resolution
│  resolve()          │  → resolvedConstraintField
└────────┬────────────┘
         │ resolved constraints
         ▼
┌─────────────────────┐
│  Creative Slack     │  ← bounded stochasticity
│  SlackAnalyzer      │
│  PerturbationInject │
│  SafetyClamp        │
└────────┬────────────┘
         │ perturbed shots
         ▼
┌─────────────────────┐
│  Prompt Compiler    │  ← style + bias injection
│  compileShots()     │  → compiled prompts
└────────┬────────────┘
         │ compiled prompt set
         ▼
┌─────────────────────┐
│  Feedback Bias      │  ← record + adjust
│  recordFeedback()   │  → bias state (next run)
└────────┬────────────┘
         │ bias snapshot
         ▼
┌─────────────────────┐
│  Style Evolution    │  ← cross-project memory
│  runStyleEvolution()│  → style vector + drift
└────────┬────────────┘
         │ influence (prompt tokens)
         ▼
┌─────────────────────┐
│  PolicyAdapter      │  ← decision authority
│  evaluate()         │  → policyDecision
└────────┬────────────┘
         │ provider + model + sla
         ▼
┌─────────────────────┐
│  Worker Runtime     │  ← pure execution
│  callProvider()     │  → provider API call
└────────┬────────────┘
         │ image/video url
         ▼
    Output
```

### Observation Path (independent, concurrent)

```
Every stage above emits trace:
  policy-adapter:  collectPolicyTrace(...)    → ring buffer
  worker-runtime:  collectExecutionTrace(...) → ring buffer
  director route:  collectFieldSnapshot(...)  → ring buffer

All traces keyed by traceId → queryable via Control Plane API.
No stage waits for or depends on trace collection.
```

---

## Key Properties

### 1. Deterministic Execution Kernel
Execution path is fully determined by Policy Adapter. Worker has no decision authority. Same policyDecision + same input → same execution.

### 2. Nonlinear Generative Field
Upper layers (Slack/Style/Bias) introduce controlled nonlinearity. Slack adds bounded randomness. Style adds cross-project influence. Bias adapts per-project. These are the system's source of variation — but they cannot affect execution determinism.

### 3. Dual-Plane Architecture
Execution and observation are fully decoupled. Control Plane cannot influence Data Plane. Data Plane does not depend on Control Plane availability.

### 4. No Cross-Layer Mutation
- Bias never writes to physics (constraintField/resolvedConstraintField are immutable downstream)
- Style never writes to physics
- Policy never writes to style
- Worker never decides policy

### 5. Replayability
Any request can be reconstructed via Control Plane traces. Given a traceId, the system can answer: what was decided, how it was executed, and what field state existed.

---

## System Classification

OpenClaw is not:

- a pipeline system (layers are not sequential transforms but physical domains)
- an AI agent system (no agents decide execution — Policy is rule-based)
- a workflow engine (no DAG, no orchestration — data flows through bounded interfaces)

OpenClaw is:

> A Generative Operating System with separated physical and observational planes.

---

## Design Intent

The system is designed to achieve:

- **controllable generative variability** — creative output varies meaningfully within bounded constraints
- **deterministic execution guarantees** — once decided, execution is repeatable and auditable
- **cross-run aesthetic evolution** — the system learns its own preferences across projects without mode collapse
- **full causal traceability** — every output can be traced back through decision, execution, and field state
- **zero-interference observability** — observation is a separate physical plane, not a layer in the execution stack

---

## Build & Verify

```bash
# Compile check
cd backend && npx tsc --noEmit

# Run server
pm2 start ecosystem.config.cjs

# Verify pipeline
curl -X POST http://localhost:4000/api/v1/director/full-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"script":"...","projectId":"test","totalEpisodes":5}'

# Verify control plane
curl http://localhost:4000/api/v1/control/traces
curl http://localhost:4000/api/v1/control/buffers
```

---

## Evolution History

| Phase | What | Result |
|-------|------|--------|
| v3 | Constraint Physics Engine | conflict graph + resolution + slack allocation |
| v3.5→3.6 | Production loop forced adoption | Physics engine = only constraint resolution authority |
| v3.7 | Creative Slack Engine | constraint residual → cinematic perturbations |
| v4 | Feedback Bias Layer | project-scoped learning loop |
| v5 | Style Evolution Engine | cross-project style memory + anti-collapse |
| v5.1 | Anti-Collapse Stability Patch | continuous noise + repulsion force + pairwise dispersion |
| Phase 1A/1C | Execution Backbone Closure | all calls through wrapper, worker pure executor, policy single authority |
| Phase 2 (CP) | Control Plane | dual-plane architecture, zero-interference observability |

---

## Final Statement

This system is intentionally built as a layered physical model of generation, where:

- **creativity is modeled as a field** (not a prompt)
- **execution is modeled as a kernel** (not logic)
- **observability is modeled as a projection** (not logging)
