# ADR-016: Workflow Runtime (KMKI-PLAT-011)

## Status
Accepted

## Date
2025-06-30

## Context

The platform requires a unified Workflow Runtime to orchestrate AI execution graphs across all workspace types (short_drama, novel, ppt, geo, seo, research, translation, marketing). Workflows must support:

- **Recoverability** — crash recovery via checkpointing
- **Replayability** — full replay, from-node replay, failed-nodes-only replay, branch replay
- **Orchestration** — DAG-based execution with 16 node types
- **Auditability** — complete event trail for every execution
- **Human-in-the-Loop** — approval, edit, review, upload, decision nodes

## Decision

### Architecture

```
WorkflowDefinition (template/blueprint)
  ↓ instantiate
WorkflowInstance (running instance)
  ├── WorkflowNode[] (DAG nodes)
  ├── WorkflowEdge[] (DAG edges)
  ├── WorkflowCheckpoint[] (snapshots)
  ├── WorkflowVariable[] (scoped variables)
  ├── WorkflowEvent[] (audit trail)
  └── WorkflowExecution[] (agent/capability executions)
```

### Key Design Decisions

1. **Definition/Instance Separation**: WorkflowDefinition stores the template (DAG graph + config). WorkflowInstance stores the runtime state. This enables version upgrades without losing running instances.

2. **Unified DAG Model**: All 16 node types (Start, Agent, Capability, Condition, Parallel, Loop, Merge, Delay, Event, HumanApproval, HumanEdit, HumanReview, HumanUpload, HumanDecision, End) share the same interface via `WorkflowNodeContract`.

3. **Checkpoint Runtime**: Every completed key node triggers an automatic checkpoint. Recovery restores state from the last checkpoint and continues execution.

4. **Replay Runtime**: Four modes:
   - `replay()` — full reset and re-execute
   - `replayFromNode(nodeId)` — reset from specific node
   - `replayFailedNodes()` — retry only failed nodes
   - `replayBranch(startNodeId, endNodeId)` — replay a subgraph

5. **Human-in-the-Loop**: Human nodes use an event-based notification + polling mechanism. Platform events notify listeners; human response handlers submit decisions via REST API.

6. **Variable System**: Five scopes (Global → Workflow → Node → Output → Environment) with template resolution supporting `${variable.path}` syntax.

7. **Repository Pattern**: All data access via repositories; no direct Prisma access from runtime code.

8. **ARCH-002 Lifecycle Compliance**: WorkflowRuntime implements `RuntimeLifecycle` (Init → Load → Validate → Execute → Update → Dispose).

### Scheduler Independence

Workflow Scheduler is independent from Agent Scheduler:
- Workflow Scheduler **schedules Nodes** (DAG dependency resolution, parallelism)
- Agent Scheduler **schedules Agent steps** (planning, tool calls, streaming)

### Component Stack

```
Backend:
├── types.ts                    — Domain types, enums, interfaces
├── repositories/               — 9 repositories (CRUD for each model)
├── graph/workflow-graph.ts     — DAG parsing, validation, traversal
├── scheduler/                  — Node execution orchestration
├── contract/                   — Node interface + abstract base
├── checkpoint/                 — Save/restore snapshots
├── replay/                     — 4 replay modes
├── human/                      — 5 human node types
├── variables/                  — Scoped variable management
├── context/                    — WorkflowContext factory
├── registry/                   — Definition registry
├── events/                     — Event type constants + helpers
├── runtime/                    — ARCH-002 lifecycle runtime
└── workflow.service.ts         — Business orchestration

Frontend:
├── types/index.ts              — Frontend types
├── store/useWorkflowStore.ts   — Pinia store
├── runtime/workflow.runtime.ts — Client-side event polling
├── services/                   — HTTP client + provider
├── pages/WorkflowStudio.vue    — DAG visual editor
├── pages/WorkflowMonitor.vue   — Real-time execution monitor
└── components/                 — 5 UI components
```

### REST API

```
Definitions:
  GET    /api/platform/workflow/definitions
  POST   /api/platform/workflow/definitions
  GET    /api/platform/workflow/definitions/:idOrCode
  PUT    /api/platform/workflow/definitions/:id
  DELETE /api/platform/workflow/definitions/:id

Instances:
  GET    /api/platform/workflow/instances
  POST   /api/platform/workflow/instances
  GET    /api/platform/workflow/instances/:id
  GET    /api/platform/workflow/instances/:id/describe

Execution:
  POST   /api/platform/workflow/executions/:instanceId/execute
  POST   /api/platform/workflow/executions/:instanceId/pause
  POST   /api/platform/workflow/executions/:instanceId/resume
  POST   /api/platform/workflow/executions/:instanceId/cancel

Checkpoints:
  POST   /api/platform/workflow/checkpoints/:instanceId/save
  GET    /api/platform/workflow/checkpoints/:instanceId

Replay:
  POST   /api/platform/workflow/replays/:instanceId/full
  POST   /api/platform/workflow/replays/:instanceId/from-node/:nodeId
  POST   /api/platform/workflow/replays/:instanceId/failed
  POST   /api/platform/workflow/replays/:instanceId/branch

Templates:
  GET    /api/platform/workflow/templates
  POST   /api/platform/workflow/templates

Human:
  POST   /api/platform/workflow/human/:instanceId/respond
  POST   /api/platform/workflow/human/:instanceId/approve
  POST   /api/platform/workflow/human/:instanceId/reject
  POST   /api/platform/workflow/human/:instanceId/upload
```

## Consequences

### Positive
- Complete, auditable workflow lifecycle with checkpoint/replay
- Human-in-the-Loop baked in from first release
- Clean separation between workflow orchestration and agent execution
- Unified variable system with template references
- Frontend Studio for visual DAG editing

### Negative
- Multiple round-trips to database for node/edge/checkpoint operations
- Human-in-the-Loop polling model may introduce latency (mitigated by Event Bus notifications)

### Risks
- Large number of database models (9 new models for Workflow Runtime)
- Replay with complex branch conditions may produce unexpected results
- Human-in-the-Loop timeout handling must be carefully configured

## References
- ADR-007: Runtime Lifecycle
- ADR-010: Platform SDK
- ADR-014: Workspace Runtime
- ADR-015: Agent Runtime
- KMKI-PLAT-011: Workflow Runtime
