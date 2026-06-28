# 昆仑镜 Architecture — System Constitution

> Governed by Governance Freeze Phase (2026-05-21).
> No new subsystem, no `-v2`, no `-next`, no runtime refactor.

---

## A. Repository Classification

### Production Runtime — active production inference path

```yaml
src/api:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Runtime API routes (runtime.routes.ts, dto, service)

src/agents:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: aigc-orchestrator, aigc-spec-agent — core LLM orchestration

src/director-v2:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Semantic runtime — intent compiler, constitution compiler, shot planner

src/engine:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: DirectorEngine, cinematic generation engine

src/jobs:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Async job system (showrunner-worker, cognition-worker, job-queue)

src/plugins:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Fastify plugins (auth, cors, runtime-context)

src/routes:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: editable
  notes: All API route definitions — primary production path

src/runtime:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Gateway, execution-guard, degrade-engine, pipeline-executor, narrative-gateway

src/scheduler:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Multi-graph scheduler — production scheduling path

src/services:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Production services (aliyun-llm, aliyun-image, aliyun-video, tts, artifact-sync)

src/utils:
  runtime_status: active
  ownership: production
  integration_level: routed
  mutation_policy: restricted
  notes: Shared utilities, prisma client, logger, env
```

### Research / Experimental — production-adjacent but not production-critical

```yaml
src/cinematic-ir:
  runtime_status: active
  ownership: research
  integration_level: internal
  mutation_policy: restricted
  notes: Cinematic IR — compiler, types, validator. Used by aigc-orchestrator (agents/)

src/cognition-loop:
  runtime_status: frozen
  ownership: research
  integration_level: internal
  mutation_policy: frozen
  notes: Cognition loop engine — async job infra exists but not actively used

src/director:
  runtime_status: frozen
  ownership: research
  integration_level: partial
  mutation_policy: frozen
  notes: Original director intelligence layer (v1). Superseded by director-v2

src/director-simulation:
  runtime_status: frozen
  ownership: research
  integration_level: partial
  mutation_policy: frozen
  notes: Simulation layer (scene/episode/gatekeep preplay). Routes exist

src/governance:
  runtime_status: experimental
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Governance/monitoring API — routed but not production-hardened

src/graph-optimization:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Graph optimization routes — registered but disconnected from production pipeline

src/graph-patch:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Graph patch controller — registered but not production-active

src/observability:
  runtime_status: experimental
  ownership: research
  integration_level: partial
  mutation_policy: frozen
  notes: Observability persistence API — partially wired, not production-hardened

src/optimization:
  runtime_status: experimental
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Optimization routes — registered but experimental

src/production-loop:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Production loop API — registered but never production-active

src/queue:
  runtime_status: frozen
  ownership: research
  integration_level: disconnected
  mutation_policy: frozen
  notes: Legacy queue (capability-dispatcher). Superseded by jobs/

src/replay:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Replay API — registered but not production-active

src/replay-analytics:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Replay analytics — registered but not production-active

src/showrunner:
  runtime_status: frozen
  ownership: research
  integration_level: internal
  mutation_policy: frozen
  notes: Showrunner core (cognitive layers L1-L5). Jobs system exists but frozen

src/simulation:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Simulation API layer — registered but frozen

src/studio:
  runtime_status: frozen
  ownership: research
  integration_level: routed
  mutation_policy: frozen
  notes: Studio routes — registered but frozen

src/workers:
  runtime_status: frozen
  ownership: research
  integration_level: internal
  mutation_policy: frozen
  notes: Worker/simulator processes — engine worker, simulation worker
```

### Disconnected / Archive — no runtime path, write-only

```yaml
src/control-plane:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Control plane v2 — registered but inactive, superseded architecture

src/core:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Core modules (asset-economy API) — registered but no production usage

src/graph-runtime:
  runtime_status: archived
  ownership: legacy
  integration_level: partial  # 12 value imports + 3 type imports across 4 runtime files
  mutation_policy: archive-only
  notes: |
    ARCHIVED subsystem with RUNTIME COUPLING (partial integration_level).
    15 imports across 4 files: api/runtime/runtime.service.ts (6 value + 2 type),
    runtime/executors/executor.registry.ts (2 value + 1 type),
    runtime/pipeline-executor.ts (5 value + 1 type),
    api/runtime/graph.adapter.ts (1 type).
    12 of 15 imports are VALUE imports (class, function) — cannot convert to type-only.
    This is a "dead code coupling" situation: the arch cannot be value-import-dependent
    on an archived module without maintaining execution compatibility.
    Mutation policy remains archive-only — NO refactor of graph-runtime,
    NO migration of runtime.service.ts. Documented as governance debt.

src/payment:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Payment routes — registered but not in production payment flow

src/worker:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Singleton worker entrypoint — superseded by workers/

src/schemas:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Standalone schema definitions — likely migration artifact

src/scripts:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: CLI scripts — not part of production runtime

src/transport:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Transport layer — never production-active

src/storage:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Storage abstraction — never production-active

src/middleware:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Standalone middleware — function moved to plugins/

src/types:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Standalone type definitions — superseded by director-v2 types

src/config:
  runtime_status: archived
  ownership: legacy
  integration_level: disconnected
  mutation_policy: archive-only
  notes: Standalone config loader — functionality merged into utils/
```

---

## B. Repository Governance Rules

### Forbidden Patterns (naming)

```yaml
forbidden_patterns:
  - "*-v2"       # Use feature-flags or adapter replacement instead
  - "*-v3"       # Parallel versioning = parallel cognitive load
  - "*-next"     # "Next" never becomes "now"
  - "*-enhanced" # Enhance the existing module
  - "*-final"    # Nothing is final
  - "new-*"      # Don't create "new" things; modify existing
  - "*_rewrite"  # Rewrites should be in-place refactors
  - "*_new"      # Same as new-*
```

### Forbidden Actions

```yaml
forbidden_actions:
  - "parallel runtime implementation"    # Don't build a second runtime alongside existing
  - "duplicate provider wrappers"        # Don't copy aliyun-llm.ts → volcengine-llm.ts pattern
  - "shadow production path"             # Don't create /api/v3 when /api/v1 works
  - "untracked experimental subsystem"   # Don't add src/new-system/ without governance review
  - "post-build source patch"            # Don't patch dist/ after build (e.g. nitro.mjs)
```

### Required Rules

```yaml
required_rules:
  - "modify existing module before creating new subsystem"
  - "declare ownership before adding architecture layer"
  - "archive disconnected systems (set mutation_policy: archive-only)"
  - "document runtime boundary before integration"
  - "one provider wrapper per provider — extend, don't duplicate"
  - "add tests when modifying production runtime modules"
```

---

## C. Runtime Boundary

```yaml
production_runtime:
  entrypoints:
    - src/index.ts                     # Fastify server bootstrap
    - src/start-with-env.js            # PM2 startup wrapper
  runtime_modules:
    - api/runtime/                      # Runtime API (routes, dto, service)
    - runtime/                          # Core runtime (gateway, guard, degrade)
    - scheduler/                        # Multi-graph scheduler
    - agents/                           # aigc-orchestrator (LLM dispatch)
    - director-v2/                      # Semantic runtime
    - jobs/                             # Async job execution
  critical_paths:
    - "POST /api/v1/script/parse → aigcOrchestrator.generate"      # Script → semantic parse
    - "POST /api/v1/pipeline/* → PipelineExecutor"                 # Pipeline execution
    - "POST /api/v1/showrunner/* → ShowrunnerWorker"               # Showrunner async
    - "PUT  /api/projects/:id/execution-results → PersistenceRuntime"  # Stage persistence
    - "POST /api/projects/:id/journal → ExecutionJournal"          # Event journal

non_production:
  frozen:
    - src/cognition-loop
    - src/director
    - src/director-simulation
    - src/graph-optimization
    - src/graph-patch
    - src/observability
    - src/optimization
    - src/production-loop
    - src/queue
    - src/replay
    - src/replay-analytics
    - src/showrunner
    - src/simulation
    - src/studio
    - src/workers
  archived:
    - src/control-plane
    - src/core
    - src/graph-runtime
    - src/payment
    - src/worker
    - src/schemas
    - src/scripts
    - src/transport
    - src/storage
    - src/middleware
    - src/types
    - src/config
```

---

## D. Approved Evolution Patterns

```yaml
approved_evolution_patterns:
  - feature flags           # Toggle behavior, don't fork runtime
  - staged rollout          # Gradual deployment, not parallel implementation
  - adapter replacement     # Replace provider without changing contract
  - internal refactor       # Restructure within module boundary
  - interface extraction    # Extract interface before implementing alternative
```

---

---

## E. Database Reality Status

### Active Layer (119 models)
Models with active TypeScript references in runtime code. Production path.

### Historical Layer — Orphan Models (36 models)
Defined in schema.prisma with zero TypeScript references in `src/`. Do NOT delete until a migration plan exists. Policy: NO DELETE without manual review.

```yaml
database_layers:
  kernel_layer:
    models:
      - KernelEvent
      - KernelStateSnapshot
      - KernelHealthLog
      - KernelShadowEventLog
      - KernelCutoverScore
      - KernelDualExecutionLog
      - KernelStateDiffLog
      - KernelRollbackHistory
      - KernelHealthMetrics
    notes: "Dual-execution architecture artifact. Never production-active. Entire subsystem abandoned 2025-Q4."
    migration_policy: "DO NOT DELETE — may have production data if test runs hit DB. Require DB dump audit first."

  gpu_layer:
    models:
      - GPUNode
      - GPUTaskLog
      - GPUThrottleState
      - LocalGPUNode
    notes: "GPU scheduler infrastructure. Plans aborted at schema stage. Likely zero rows."
    migration_policy: "Safe to drop after DB audit confirms zero rows."

  dag_layer:
    models:
      - DAGGraph
      - DAGState
      - SchedulerTask
      - RuntimeDependencyGraph
      - EventLoopViolation
    notes: "DAG execution engine schema. Superseded by jobs/ queue system."
    migration_policy: "DO NOT DELETE — DAGGraph may have referenced project rows."

  shadow_layer:
    models:
      - DesktopRuntimeConfig
      - LocalAssetIndex
      - RuntimeRegistry
    notes: "Shadow execution schema (dual execution). Abandoned with kernel/."
    migration_policy: "Safe to drop after DB audit confirms zero rows."

  monitoring_layer:
    models:
      - StabilitySession
      - DegradationEvent
      - SystemMonitor
      - RateLimit
      - WorkerHeartbeat
    notes: "Runtime monitoring schema. Never fully wired."
    migration_policy: "Safe to drop after DB audit confirms zero rows."

  agent_layer:
    models:
      - AgentMemory
      - AgentExecutionLog
    notes: "Legacy agent execution schema. Superseded by jobs/."
    migration_policy: "Safe to drop after DB audit confirms zero rows."

  user_layer:
    models:
      - UserLimit
      - TaskExecution
    notes: "User limit enforcement and task tracking. Likely unused."
    migration_policy: "Safe to drop after DB audit confirms zero rows."

  community_layer:
    models:
      - CommunityPost
      - CommunityComment
      - CommunityLike
      - CommunityCommentLike
      - CommunityReward
    notes: "Community features — schema exists but feature not launched."
    migration_policy: "May be revived for community v1 launch. Keep for now."

  props_layer:
    models:
      - PropLibrary
    notes: "Prop library — standalone, no relations. Unused."
    migration_policy: "Safe to drop."

summary:
  active_models: 119
  orphan_models: 36
  policy: "NO DELETE until migration plan exists. At minimum: DB dump audit to verify zero rows."
  next_step: "Phase 3 — DB dump audit (count rows per orphan table)"
```

---

## F. Intent Engine v3 — Legacy Branch Tagging

```yaml
jobs/intent-engine-v3:
  runtime_status: experimental
  ownership: research
  integration_level: partial
  mutation_policy: restricted
  notes: |
    Legacy evolution branch from the intent-classification experiment lineage.
    Still has runtime dependency via jobs/ module (type imports + import from jobs/index.ts).
    This directory MUST remain unmodified — no rename, no deletion, no refactor.
    It represents a "gray-experiment layer" — active in codebase but not on critical production path.
```

---

---

## G. Known Governance Warnings (non-blocking)

```yaml
duplicate_providers:
  aliyun:
    count: 4
    files:
      - services/aliyun-llm.provider.ts     # OpenAI-compatible LLM (千问)
      - services/aliyun-image.provider.ts   # Image generation (WanX)
      - services/aliyun-tts.provider.ts     # Text-to-speech (qwen3-tts-flash)
      - services/aliyun-video.provider.ts   # Video generation (Wan2.7-i2v/t2v)
    assessment: |
      These are separate capabilities (LLM / image / TTS / video)
      from the same provider. Acceptable as-is — each has distinct API
      shape (text streaming vs image vs async video). Not true duplicates.
    action: mark-as-warned

  volcengine:
    count: 3
    files:
      - services/volcengine-image.provider.ts   # Image generation (Doubao)
      - services/volcengine-video.provider.ts   # Video generation (Volc Video)
      - services/volcengine-tts.provider.ts     # Text-to-speech (Volc TTS)
    assessment: |
      Same pattern as aliyun — distinct capabilities, same provider.
    action: mark-as-warned
```

---

## H. Execution Domain Classification (Phase 4.1)

```yaml
SYNC:
  entry: narrative-gateway
  description: Synchronous LLM/inference execution. All routes converge here.
  file_count: 71
  entries: [narrative-gateway, pipeline-executor]
  governance: |
    All SYNC modules must import through narrative-gateway or pipeline-executor.
    Direct provider calls from SYNC modules are allowed only through provider.registry.

ASYNC:
  entry: narrative-gateway
  description: Asynchronous job-based execution (BullMQ / showrunner jobs).
  file_count: 1
  entries: [narrative-gateway]
  notes: showrunner.ts route is ASYNC; job workers are WORKER domain.

WORKER:
  entry: worker-registry
  description: Background job workers. Must register via worker-registry.
  file_count: 7
  entries: [worker-registry]
  governance: |
    Workers must NOT register Fastify routes.
    Workers must NOT call provider.registry directly (use narrative-gateway).

TOOL:
  entry: provider.registry
  description: AI provider implementations. Must register via provider.registry.
  file_count: 14
  entries: [provider.registry]
  governance: |
    TOOL modules provide API implementations only.
    No route registration allowed.
    No execution orchestration.

OBSERVE:
  entry: director-api
  description: Observability & analytics only. No execution routing allowed.
  file_count: 11
  entries: [director-api]
  governance: |
    Added in Phase 4.1. OBSERVE modules must NOT:
      - call narrativeGateway.execute()
      - call provider.registry
      - register production routes (except /api/v2/director/*)
    director-v2: OBSERVE mode (migrated from SYNC classification).

LEGACY:
  entry: various
  description: |
    Frozen/archived modules. No new code. Read-only usage only.
  file_count: 18
  entries: [cognition-loop, control-plane, director-simulation, director-v1,
           execution-graph, showrunner-v1]
  governance: |
    LEGACY modules must maintain existing behavior.
    No new imports FROM LEGACY into SYNC/TOOL/WORKER modules.
    No new __RUNTIME_OWNER__ mode changes without governance review.

SHADOW:
  entry: various
  description: |
    Frozen-with-coupling modules. Read-only. New imports FORBIDDEN.
    Known debt: graph-runtime has 12 value imports from production path.
  file_count: 35
  entries: [graph-runtime, shadow-jobs, queue-legacy, sandbox, shadow, asset-state]
  governance: |
    SHADOW modules must NOT gain new imports.
    Existing SHADOW → SYNC imports are tracked debt (see Phase 3 graph-runtime report).
    SHADOW modules must NOT register new routes or workers.
```

## I. Enforcement Rules (Phase 4.1 — CI-ready, not yet wired)

```yaml
rule_no_missing_owner:
  description: Every runtime module must export __RUNTIME_OWNER__
  location: backend/eslint-rules/phase4-rules.md
  status: documented, not wired
  CI_ready: true

rule_single_entry_enforcement:
  description: OBSERVE modules must not execute; SHADOW modules must not be imported into SYNC
  location: backend/eslint-rules/phase4-rules.md
  status: documented, not wired
  CI_ready: true

rule_shadow_import_block:
  description: Forbid new imports INTO shadow modules
  location: backend/eslint-rules/phase4-rules.md
  status: documented, not wired
  CI_ready: false (needs import graph baseline)

rule_invalid_domain_routing:
  description: OBSERVE modules must not call gateway/registry/route registration
  location: backend/eslint-rules/phase4-rules.md
  status: documented, not wired
  CI_ready: true
```

## J. Runtime Trace (Phase 4.1)

```yaml
runtime_trace:
  file: src/runtime/trace/runtime-trace.ts
  type: non-invasive instrumentation
  principle: "Does not modify return value or control flow"
  store: in-memory ring buffer (10,000 events max)
  snapshot: runtimeTrace.getEvents() → snapshotTrace()
  status: |
    Injected as skeleton. No production modules yet wired.
    Phase 4.2 will wire into narrative-gateway, pipeline-executor, and key routes.
```

## K. PipelineAdapter (Phase 4.1)

```yaml
pipeline_adapter:
  file: src/runtime/pipeline/PipelineAdapter.ts
  purpose: Designated single entry for pipeline flows
  status: skeleton only (pass-through)
  Phase_4.2: Wire createRuntime() calls through adapter
```

---

*This constitution is live. Violations should be reviewed before merge.*
