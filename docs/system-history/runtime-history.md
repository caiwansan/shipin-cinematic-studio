# Runtime Architecture History

## Overview

The runtime system evolved through several architectural phases. The current active design is Runtime Architecture Freeze v1 (see `docs/runtime/`).

## Phase 1 — Gateway + Pipeline

- **Files**: `src/runtime/` (gateway, execution-guard, degrade-engine, pipeline-executor)
- **Design**: Synchronous pipeline with degrade fallback
- **Still active**: Core pipeline execution still uses this layer

## Phase 2 — Graph Runtime

- **Location**: `src/graph-runtime/`
- **Status**: archived
- **Design**: Compile → Validate → Execute graph model
- **Components**: compiler, validator, core types, runtime engine, execution context
- **Why archived**: graph-runtime was intended as the universal execution model but never became the sole runtime. Only type imports remain in `runtime.service.ts`
- **Integration**: `runtime.service.ts` still imports `GraphValidator` and `compileGraph` but execution path is disconnected

## Phase 3 — Async Job System

- **Location**: `src/jobs/`
- **Status**: active, production
- **Design**: PostgreSQL SKIP LOCKED queue + BullMQ-style workers
- **Workers**: showrunner-worker, cognition-worker
- **LLM Pool**: 5-slot concurrent + Circuit Breaker

## Phase 4 — Director Field Theory Observability (runtime-freeze)

- **Current end-state**: Runtime (causal closed) + Observability Plane (epistemic, non-causal)
- **Physical isolation**: diagnostics/ directory has zero external dependencies
- **Documentation**: `docs/runtime/runtime-architecture-freeze-v1.md`

## Why the graph-runtime Never Reached Production

The graph runtime was designed as a "universal executor" but:
1. The pipeline executor was already working
2. Switching required migrating all production paths
3. The cognitive load of two live runtimes was unsustainable
4. Decision made: freeze graph-runtime, keep pipeline executor

## Current Runtime Topology

```
HTTP request → Routes → Gateway → Pipeline Executor / Director v2 → async Jobs → Result
                              └→ narrative-gateway (LLM dispatch)
                              └→ degrade-engine (fallback)
```
