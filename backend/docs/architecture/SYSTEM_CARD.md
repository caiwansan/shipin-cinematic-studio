# SYSTEM_CARD.md — OpenClaw GOS vFinal

> 生成物理系统（Generative Operating System）
> Execution Closure + Observability Saturation 已达成

---

## System Classification

**Class:** Deterministic Generative Operating System

**Core Properties:**
1. **Deterministic execution kernel** — PolicyAdapter = single truth source; Worker = stateless executor
2. **Nonlinear generative field** — Slack (controlled randomness) + Style field (long-range coupling) + Bias (local adaptation)
3. **Detached observability substrate** — Control Plane is out-of-band, bounded memory, zero interference

**This system is NOT:**
- ❌ AI pipeline (layers are physical domains, not sequential transforms)
- ❌ Agent system (no agents decide execution — Policy is rule-based)
- ❌ Workflow engine (no DAG, no orchestration — data flows through bounded interfaces)

**This system IS:**
- ✔ 一个可以生成、执行、并完整解释自身行为的物理系统

---

## Architecture (7 Layers + 2 Planes)

```
TRUTH LAYER                    ← immutable world semantics (character/scene/narrative)
    ↓
PHYSICS LAYER                  ← constraint conflict resolution (weighted_tradeoff)
    ↓
SLACK LAYER                    ← bounded stochastic variation (residual → perturbation)
    ↓
BIAS LAYER                     ← project-scoped learning (feedback → next run weights)
    ↓
STYLE FIELD LAYER              ← cross-project aesthetic evolution (anti-collapse)
    ↓
POLICY ADAPTER                 ← single decision authority (rule-based state machine)
    ↓
WORKER / WRAPPER               ← pure stateless execution kernel (hard reject if no policy)
    ↓
PROVIDERS                      ← external systems (abstracted behind wrappers)

CONTROL PLANE                  ← out-of-band projection system (ring buffer, fire-and-forget)
├── PolicyTrace                ← why this decision was made
├── ExecutionTrace             ← how execution happened
└── FieldSnapshot              ← what field state existed at decision time
```

---

## Execution Plane Closure

All entry points → PolicyAdapter (single authority) → Worker (pure executor) → Wrapper → Provider

| Entry Point | Status | Details |
|-------------|--------|---------|
| `routes/director.ts` (full-pipeline) | ✅ 7-layer | Truth → Physics → Slack → Bias → Style → Policy → Worker |
| `routes/images.ts` (image generate) | ✅ Policy-first | `selectImageProviderViaPolicy()` replaces hardcoded priority chain |
| `routes/ai-tasks.ts` (task single/batch) | ✅ Policy-first | `getTaskPolicyDecision()` generates decision BEFORE enqueue |
| `services/scheduler.service.ts` | ✅ Pure transport | Carries policyDecision, no routing/decision logic |
| `queue/queue-manager.ts` (enqueueTask) | ✅ Pure transport | Carries policyDecision in TaskPayload |
| `queue/worker-runtime.ts` | ✅ Policy-driven | Hard rejects if no policyDecision present |
| `services/mock-worker.ts` | ✅ Observable (legacy) | Trace instrumented, no logic changes |

**Key invariant:** No direct provider calls, no fallback logic outside policy, no implicit routing, no self-deciding worker, no hardcoded priority chains.

---

## Observability Plane Saturation

| Trace Type | Emitting Files | Count |
|------------|---------------|-------|
| PolicyTrace | `routes/images.ts`, `routes/ai-tasks.ts`, `core/policy-adapter.ts` | 3 emitters |
| ExecutionTrace | `queue/worker-runtime.ts`, `services/mock-worker.ts` | 2 emitters |
| FieldSnapshot | `routes/director.ts` | 1 emitter |

**Properties:**
- Fire-and-forget (no await, no retry, no backpressure)
- Ring buffer bounded (cap 1000, oldest eviction)
- Append-only, one-directional flow
- Zero interference with execution plane

---

## Source Map

| Layer | Location | Key Files |
|-------|----------|-----------|
| Truth | `src/routes/director.ts` | `analyzeScript()` → worldConstitution |
| Physics | `src/core/constraint-physics/` | `index.ts` (conflict graph + resolution) |
| Slack | `src/core/constraint-physics/slack-engine.ts` | SlackAnalyzer, PerturbationInjector, SafetyClamp |
| Bias | `src/core/constraint-physics/feedback-bias.ts` | per-project bias store |
| Style | `src/core/style-evolution/` | `style-vectorizer.ts`, `style-memory-graph.ts`, `style-divergence-controller.ts` |
| Policy | `src/core/policy-adapter/` | `policy-adapter.ts`, `fallback-state-machine.ts` |
| Worker | `src/queue/worker-runtime.ts` | pure executor |
| Wrappers | `src/core/provider-wrapper/volcengine/` | proxy factory + method bindings |
| Providers | `src/services/` | volcengine/aliyun providers |
| Control Plane | `src/control-plane/` | `collector.ts` (ring buffer), `types.ts` |
| Control API | `src/routes/control-plane.ts` | read-only GET endpoints |
| System Doc | `docs/architecture/STRUCTURE.md` | full architecture document |

---

## Build & Verify

```bash
cd backend
npx tsc --noEmit           # zero errors expected

# Verify pipeline
curl -X POST http://localhost:4000/api/v1/director/full-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"script":"...","projectId":"test","totalEpisodes":5}'

# Verify control plane
curl http://localhost:4000/api/v1/control/traces
curl http://localhost:4000/api/v1/control/buffers

# Deploy frontend
cd ../frontend && npm run build
```

---

## Evolution History

| Phase | What | When |
|-------|------|------|
| Foundation | Project setup, basic routes + providers | — |
| Phase 1A | Provider wrapper layer (volcengine proxy factory) | — |
| Phase 1B | PolicySignal schema + render-intelligence adapter | — |
| Phase 1C | PolicyAdapter (single authority) + fallback state machine | — |
| Phase 3→3.5 | Constraint Physics Engine (conflict graph + resolution) | — |
| Phase 3.5→3.6 | Production loop forced adoption | — |
| Phase 3.7 | Creative Slack Engine (residual → perturbation) | — |
| Phase v4 | Feedback Bias Layer (project-scoped learning) | — |
| Phase v5+v5.1 | Style Evolution Engine (anti-collapse + repulsion) | — |
| Phase 2 (CP) | Control Plane: dual-plane observability layer | — |
| **Closure** | **Execution normalization: images.ts, ai-tasks.ts, scheduler, mock-worker** | **2026-05-16** |

---

## Final Statement

> **This system can generate, execute, and fully explain its own behavior.**
> 
> Execution determinism + nonlinear generative field + detached observability — all three are independently verified and causally complete.

The system is now in **System Closure Phase**. Next reasonable directions:
1. **Freeze**: System lockdown, UX/product layer
2. **Analyze**: Control plane mining, style attractor analysis, slack distribution modeling
3. **Extend**: Increase existing layer expressiveness (not new layers)

---

## Phase 2 Direction: Open Provider Ecosystem

**Not in current scope.** This is a separate problem from execution closure:

| Property | Phase 1 (Done) | Phase 2 (Future) |
|----------|----------------|------------------|
| System type | Closed execution OS | Open provider ecosystem |
| Problem | System correctness | System openness |
| Provider | Code-defined entity (`if API_KEY`) | Runtime-described capability node |
| Discovery | Static enumeration | Declarative registry + metadata |
| Policy input | Known provider set | Dynamic capability graph |
| Extension boundary | Modify code | Add declaration |
| Classification | Multi-system extensibility | Single-system correctness |

### When to consider
- After Phase 1 system is stable in production
- When a new provider needs to be added without code changes
- When the system needs to dynamically negotiate provider capabilities

### What it requires
- `ProviderRegistry` — runtime metadata store (capability, quality, latency, cost, reliability)
- `Registry.query({ capability, minQuality, maxLatency })` → candidate list
- PolicyAdapter.evaluate() already consumes the result; only the input side changes
- Registration API: `POST /api/v1/registry/providers` (for external partners / self-service)

### Key architectural invariant
This layer sits **between Provider Registry and PolicyAdapter**:
```
Provider A ──┐
Provider B ──┼── Registry.query() ──→ PolicyAdapter ──→ Worker
Provider C ──┘
```
PolicyAdapter and below stay unchanged. The change is purely on the input side of `evaluate()` — from a hardcoded list to a dynamic query result.
