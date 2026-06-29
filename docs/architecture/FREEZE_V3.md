# FREEZE V3 — Kunlun Mirror Platform Runtime Architecture Freeze

> **Document**: KMKI-ARCH-001 / FREEZE_V3.md  
> **Status**: ✅ Freeze Ratified  
> **Date**: 2026-06-29  
> **Last Updated**: 2026-07-02 (KMKI-DOC-001 Architecture Synchronization)

---

## Table of Contents

0. [Current Platform Runtime Stack](#0-current-platform-runtime-stack)
0. [Runtime Evolution Path](#0-runtime-evolution-path)

1. [Platform Runtime Inventory](#1-platform-runtime-inventory)
2. [Dependency Matrix](#2-dependency-matrix)
3. [Repository Compliance](#3-repository-compliance)
4. [Lifecycle Matrix](#4-lifecycle-matrix)
5. [Platform Context Spec](#5-platform-context-spec)
6. [Platform Event Catalog](#6-platform-event-catalog)
7. [Plugin Inventory](#7-plugin-inventory)
8. [Configuration Inventory](#8-configuration-inventory)
9. [Error Model](#9-error-model)
10. [SDK Proposal](#10-sdk-proposal)
11. [ADR Index](#11-adr-index)
12. [Architecture Violations & Fixes](#12-architecture-violations--fixes)
13. [Freeze Checklist](#13-freeze-checklist)

---

## 0. Current Platform Runtime Stack

> This section documents the **current** V3 Platform Runtime Stack, as implemented in Git HEAD.
> Sections 1–13 below document the **freeze baseline snapshot** from 2026-06-29.
> The relationship between the two is described in [Runtime Evolution Path](#0-runtime-evolution-path).

| # | Runtime | PLAT ID | Status | Path | Description |
|---|---------|---------|--------|------|-------------|
| 1 | **Capability Platform** | PLAT-006 | ✅ Freeze | `services/platform/capability/` | Contract lifecycle, Registry, Resolver, Routing strategies |
| 2 | **Execution Runtime** | PLAT-007 | ✅ Freeze | `services/platform/execution/` | Task execution orchestration, worker dispatch |
| 3 | **AI Resource Runtime** | PLAT-008 | ✅ Freeze | `services/platform/ai-resource/` | AI provider management, quota control, cost tracking |
| 4 | **Workspace Runtime** | PLAT-009 | ✅ Freeze | `services/platform/workspace/` | Workspace state, snapshot, version, autosave |
| 5 | **Agent Runtime** | PLAT-010 | ✅ Freeze | `services/platform/agent/` | Agent lifecycle, dispatcher, scheduler, memory, tools |
| 6 | **Workflow Runtime** | PLAT-011 | ✅ Freeze | `services/platform/workflow/` | DAG workflow engine, stage management, transition |
| 7 | **Platform Governance** | PLAT-012 | ✅ Freeze | `services/platform/governance/` | Policy enforcement, quota audit, compliance, drift detection |

### Platform Infrastructure (shared)

| Component | Path | Description |
|-----------|------|-------------|
| Platform SDK | `platform/sdk/platform-sdk.ts` | Unified facade over all Runtimes |
| Platform Context | `platform/context/platform-context.ts` | Cross-cutting context (traceId, tenantId, etc.) |
| Platform Event Bus | `platform/events/event-bus.ts` | Unified pub/sub event system |
| Platform Errors | `platform/errors/platform-errors.ts` | Typed error hierarchy |
| Config Registry | `platform/config/config-registry.ts` | Centralized configuration |

### Layer Architecture

```
Route → SDK → Runtime → Service → Repository → Prisma
                │
                ├── Capability Platform (PLAT-006)
                ├── Execution Runtime   (PLAT-007)
                ├── AI Resource Runtime (PLAT-008)
                ├── Workspace Runtime   (PLAT-009)
                ├── Agent Runtime       (PLAT-010)
                ├── Workflow Runtime    (PLAT-011)
                └── Governance          (PLAT-012)
```

---

## 0a. Runtime Evolution Path

The V3 Platform Architecture evolved through two major phases:

### Phase I — Early GEO Infrastructure Runtimes (2025 Q2–Q3)

These were the first-generation runtime layers, built to support the GEO knowledge base product:

| # | Runtime | Purpose | Status Today |
|---|---------|---------|-------------|
| 1 | **Scanner Runtime** | Web crawling: fetch home page, robots.txt, sitemap, meta tags, internal pages, static assets | ⏸️ Frozen (legacy) |
| 2 | **Asset Runtime** | Asset lifecycle management: import, version, normalize, extract | ⏸️ Frozen (legacy) |
| 3 | **Semantic Runtime** | Semantic extraction: entities, topics, relations, keywords, taxonomies | ⏸️ Frozen (legacy) |
| 4 | **Goal Runtime** | Goal-driven execution: Goal→Strategy→Workflow→Task→Execution→Review | ⏸️ Frozen (legacy) |
| 5 | **Lifecycle Manager** | Timer registry + event buffer + error shield (standalone) | ⏸️ Frozen (legacy) |

**Status Clarification**: These five runtimes still exist in the repository and are fully functional for GEO knowledge base operations. They are **frozen as legacy** — no new development, no migration, no deletion. They coexist with the Phase II platform runtimes but operate independently.

### Phase II — V3 Platform Runtimes (2025 Q4–2026 Q2)

The platform was redesigned into a unified KMKI platform runtime architecture. The Phase I runtimes' capabilities were re-abstracted into the Phase II PLAT-006~PLAT-012 stack:

| Evolution | Phase I → Phase II |
|-----------|-------------------|
| Goal Runtime | → PLAT-006 Capability + PLAT-007 Execution + PLAT-011 Workflow |
| Lifecycle Manager | → PLAT-009 Workspace |
| Scanner/Asset/Semantic | → PLAT-008 AI Resource (provider abstraction) |
| (new) | → PLAT-010 Agent |
| (new) | → PLAT-012 Governance |

**Key difference**: Phase II runtimes follow the `Route → SDK → Runtime → Service → Repository → Prisma` layering with PlatformContext, EventBus, typed errors, and lifecycle management. Phase I runtimes use the earlier patterns documented in sections 1–9 below.

---

## 1. Platform Runtime Inventory

| # | Runtime | Path | Status | Lines |
|---|---------|------|--------|-------|
| 1 | **Scanner** | `services/geo/scanner/` | ✅ Scanning pipeline, no persistence | 6 step files + 1 pipeline |
| 2 | **Asset** | `services/asset/` | ✅ Full lifecycle with Repository | 4 repositories + runtime |
| 3 | **Semantic** | `services/semantic/` | ✅ Extraction pipeline + Repository | 6 repositories + runtime |
| 4 | **Goal** | `services/goal/` | ✅ Full DAG: Goal→Strategy→Workflow→Task→Execution→Review | 7 repositories + runtime |
| 5 | **Capability** | `services/platform/capability/` | ✅ Contract lifecycle + Registry + Resolver | 2 repositories + runtime |
| 6 | **Lifecycle Manager** | `services/lifecycle-manager.ts` | ✅ Timer registry + event buffer + error shield | Standalone service |

### Scanner Runtime Details

| File | Description |
|------|-------------|
| `pipeline.ts` | Orchestrates all scanner steps, aggregates results |
| `steps/home.ts` | Fetches and parses home page |
| `steps/robots.ts` | Fetches robots.txt |
| `steps/sitemap.ts` | Parses sitemap.xml |
| `steps/meta.ts` | Extracts meta tags, Open Graph, JSON-LD |
| `steps/pages.ts` | Crawls internal pages |
| `steps/assets.ts` | Extracts static assets (images, scripts, styles) |
| `types.ts` | ScannerContext, ScanResult, ScannerStep |

### Asset Runtime Details

| Layer | Files |
|-------|-------|
| Runtime | `runtime/asset.runtime.ts` |
| Service | `asset.service.ts`, `asset-version.service.ts`, `asset-provider.service.ts` |
| Repositories | `repositories/asset.repository.ts`, `repositories/asset-version.repository.ts`, `repositories/asset-relation.repository.ts`, `repositories/raw-document.repository.ts` |
| Pipeline | `normalizer/index.ts`, `extractor/index.ts` |
| Scanner | `scanner/raw-document.ts` |

### Semantic Runtime Details

| Layer | Files |
|-------|-------|
| Runtime | `runtime/semantic.runtime.ts` |
| Service | `semantic.service.ts` |
| Repositories | `repositories/entity.repository.ts`, `repositories/topic.repository.ts`, `repositories/relation.repository.ts`, `repositories/alias.repository.ts`, `repositories/taxonomy.repository.ts`, `repositories/keyword.repository.ts` |
| Pipeline | `pipeline/index.ts`, `pipeline/chunker.ts`, `pipeline/extractor-registry.ts`, `pipeline/extractors/entity-extractor.ts`, `pipeline/extractors/keyword-extractor.ts`, `pipeline/extractors/topic-extractor.ts` |

### Goal Runtime Details

| Layer | Files |
|-------|-------|
| Runtime | `runtime/goal.runtime.ts` |
| Engine | `engine/task-engine.ts`, `engine/task-scheduler.ts` |
| Executor | `executor/executor.ts`, `executor/execution-manager.ts` |
| Planner | `planner/strategy-engine.ts`, `planner/workflow-planner.ts` |
| Registry | `registry/action-registry.ts`, `registry/actions/generate-faq.ts`, `registry/actions/publish-cms.ts`, `registry/actions/update-knowledge-graph.ts` |
| Review | `review/review-loop.ts`, `review/review-validator.ts` |
| Repositories | `repositories/goal.repository.ts`, `repositories/strategy.repository.ts`, `repositories/workflow.repository.ts`, `repositories/task.repository.ts`, `repositories/execution.repository.ts`, `resources/review.repository.ts`, `repositories/action.repository.ts` |

### Capability Runtime Details

| Layer | Files |
|-------|-------|
| Runtime | `runtime/capability.runtime.ts` |
| Service | `capability.service.ts`, `capability-catalog.service.ts` |
| Registry | `registry/capability-registry.ts`, `registry/registry-plugins/plugin-interface.ts` |
| Contracts | `contracts/contract-builder.ts`, `contracts/contract-validator.ts`, `contracts/contract-migrator.ts` |
| Resolver | `resolver/capability-resolver.ts`, `resolver/resolver-interface.ts`, `resolver/routing-strategies/balanced.ts`, `resolver/routing-strategies/cost-first.ts`, `resolver/routing-strategies/latency-first.ts`, `resolver/routing-strategies/quality-first.ts` |
| Validators | `validators/capability-validator.ts`, `validators/input-validator.ts`, `validators/output-validator.ts`, `validators/constraint-validator.ts`, `validators/permission-validator.ts` |
| Events | `events/capability-events.ts` |
| Repositories | `repositories/contract.repository.ts`, `repositories/mapping.repository.ts` |

---

## 2. Dependency Matrix

### Layer-to-Layer Dependency Map

```
              ┌─────────────┐
              │   Routes    │  ← HTTP request handlers
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Runtime   │  ← Lifecycle management, orchestration
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Service   │  ← Business logic, event emission
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Repository │  ← Database operations (Prisma)
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Prisma    │  ← ORM / Database
              └─────────────┘
```

### Cross-Runtime Dependencies

| Runtime | Depends On | Type | Status |
|---------|-----------|------|--------|
| Asset | (self-contained) | — | ✅ Clean |
| Semantic | Asset (via `assetId`) | Foreign Key ref | ✅ Valid |
| Goal | (self-contained) | — | ✅ Clean |
| Capability | (self-contained) | — | ✅ Clean |
| Scanner | (self-contained, no DB) | — | ✅ Clean |

### Audit Results — Import Violations

#### Scanner Runtime → ✅ No violations
```
imports: only step files within scanner/
```

#### Asset Runtime → ⚠️ 1 violation
| File | Import | Violation | Fix |
|------|--------|-----------|-----|
| `asset.service.ts:168` | `import { prisma } from '../../utils/index.js'` | Dynamic import skips Repository | Move `addTag`/`removeTag` to Repository |
| `asset-version.service.ts:7` | `import { onAssetEvent } from './asset.service.js'` | Circular dependency between service files | Extract event bus to shared module |

#### Semantic Runtime → ✅ No violations
```
imports: service → repositories, runtime → service + pipeline
```

#### Goal Runtime → ✅ No violations
```
imports: runtime → repositories + planners + engines, all through Repository
```

#### Capability Runtime → ✅ No violations
```
imports: runtime → registry + service + validators + resolver
```

---

## 3. Repository Compliance

### Repository Inventory

| # | Repository | Runtime | Has `BaseRepository<T>`? | Status |
|---|-----------|---------|--------------------------|--------|
| 1 | `asset.repository.ts` | Asset | ✅ Partial (`findById`, `create`, `update`, `list`) | ✅ OK |
| 2 | `asset-version.repository.ts` | Asset | ⚠️ Custom API (`createVersion`, `listVersions`) | ⚠️ Acceptable (version-specific) |
| 3 | `asset-relation.repository.ts` | Asset | ⚠️ Custom API | ⚠️ Acceptable (relation-specific) |
| 4 | `raw-document.repository.ts` | Asset | ⚠️ Read-only (`create`, `findByProject`) | ⚠️ Acceptable (no update/delete) |
| 5 | `entity.repository.ts` | Semantic | ✅ Full CRUD + `resolveByName` | ✅ OK |
| 6 | `topic.repository.ts` | Semantic | — | ✅ OK |
| 7 | `relation.repository.ts` | Semantic | — | ✅ OK |
| 8 | `alias.repository.ts` | Semantic | — | ✅ OK |
| 9 | `taxonomy.repository.ts` | Semantic | — | ✅ OK |
| 10 | `keyword.repository.ts` | Semantic | — | ✅ OK |
| 11 | `goal.repository.ts` | Goal | ✅ Full CRUD + `countBy*` | ✅ OK |
| 12 | `strategy.repository.ts` | Goal | ✅ Full CRUD + `createMany` | ✅ OK |
| 13 | `workflow.repository.ts` | Goal | ✅ Full CRUD + stage management | ✅ OK |
| 14 | `task.repository.ts` | Goal | ✅ Full CRUD + `listExecutable` | ✅ OK |
| 15 | `execution.repository.ts` | Goal | ✅ Full CRUD + result management | ✅ OK |
| 16 | `review.repository.ts` | Goal | ✅ Full CRUD | ✅ OK |
| 17 | `action.repository.ts` | Goal | ✅ Full CRUD + `upsert` | ✅ OK |
| 18 | `contract.repository.ts` | Capability | ✅ Full CRUD (class-based) | ✅ OK |
| 19 | `mapping.repository.ts` | Capability | ✅ Full CRUD (class-based) | ✅ OK |

### Compliance Summary

| Metric | Count |
|--------|-------|
| Total Repositories | 19 |
| ✅ Fully Compliant | 16 |
| ⚠️ Minor Variation (custom API for domain-specific needs) | 3 |
| ❌ Violations | 0 |

### Common Patterns Observed

1. **Mapping layer**: Every repository has a private `map*` function or inline mapping for DB→Domain conversion
2. **Error handling**: No repository has custom try/catch — errors propagate to service layer
3. **Transaction boundaries**: No explicit transactions in repositories (deferred to service layer)
4. **Soft delete**: Asset and Entity repositories use `deletedAt` pattern; Goal uses `status: 'cancelled'`

---

## 4. Lifecycle Matrix

### Standard Lifecycle: `Init → Load → Validate → Execute → Update → Dispose`

| Runtime | Init | Load | Validate | Execute | Update | Dispose |
|---------|------|------|----------|---------|--------|---------|
| **Scanner** | ❌ (no runtime class) | ✅ `runScannerPipeline` | ❌ | ✅ `runScannerPipeline` | ❌ | ❌ |
| **Asset** | ✅ `initialize()` | ✅ `importFromHtml` | ❌ | ✅ `extractAndStore` | ✅ `version()` | ✅ `deleteAsset` |
| **Semantic** | ✅ `initialize()` | ✅ `load()` | ❌ | ✅ `load()` | ✅ `update()` | ✅ `delete()` |
| **Goal** | ✅ `initialize()` | ✅ `getGoal()` | ❌ | ✅ `runFullPipeline` | ✅ `updateGoal` | ✅ `deleteGoal` |
| **Capability** | ✅ `initialize()` | ✅ `loadRegistry()` | ✅ `validateContract()` | ✅ `resolve()` | ✅ `reload()` | ✅ `(via service)` |

### Lifecycle Gap Analysis

| Missing Lifecycle Step | Runtimes Affected | Priority |
|------------------------|-------------------|----------|
| `Validate` | Scanner, Asset, Semantic, Goal | P1 (should add validation before execute) |
| `Dispose` | Scanner | P0 (Scanner has no runtime — consider adding for consistency) |

---

## 5. Platform Context Spec

### Current State

| Runtime | Context Usage | Notes |
|---------|--------------|-------|
| Scanner | `ScannerContext { url, projectId }` | Custom type, closest to target |
| Asset | Method params only (no context object) | No traceability |
| Semantic | `context?: Record<string, unknown>` in extractors | Partial, non-standard |
| Goal | Method params only (no context object) | No traceability |
| Capability | `request.context` in ResolverRequest | Partial, embedded in request |

### Target State

The `PlatformContext` interface (defined in `platform/context/platform-context.ts`) must be accepted as the first parameter:

```typescript
interface PlatformContext {
  tenantId?: string
  workspaceId?: string
  projectId?: string
  goalId?: string
  workflowId?: string
  taskId?: string
  capabilityId?: string
  providerId?: string
  userId?: string
  locale?: string
  permissions?: string[]
  traceId?: string
  requestId?: string
  metadata?: Record<string, any>
}
```

---

## 6. Platform Event Catalog

### Current Event Implementations

| Runtime | Implementation | File | Event Types |
|---------|---------------|------|-------------|
| Asset | In-memory Map | `asset.service.ts:10-30` | `created`, `updated`, `deleted`, `versioned` |
| Semantic | In-memory Map | `semantic.service.ts:20-40` | `entity:created`, `entity:updated`, `entity:deleted`, `topic:built`, etc. |
| Goal | In-memory Map | `goal.runtime.ts:33-44` | `goal:created`, `goal:updated`, `goal:completed`, `strategy:generated`, etc. |
| Capability | `CapabilityEventBus` class | `events/capability-events.ts` | `Registered`, `Updated`, `Deprecated`, `Removed`, `Validated`, `Resolved` |

### Issue: 4 Separate Event Buses

Each implementation:
- Has its own event type enum/union
- Has its own subscribe/emit API
- Uses silent try/catch error handling
- Has no cross-Runtime event visibility

### Target: Unified Event Bus (`platform/events/event-bus.ts`)

```typescript
interface IEventBus {
  on(type: PlatformEventType, handler: EventHandler): void
  onAny(handler: EventHandler): void
  off(type: PlatformEventType, handler: EventHandler): void
  emit(event: PlatformEvent): void
  getHistory(type?: PlatformEventType): PlatformEvent[]
  clear(): void
}
```

### Canonical Event Categories

```
Created | Loaded | Updated | Deleted | Started | Completed | Failed | Cancelled | Published | Archived
```

---

## 7. Plugin Inventory

### Current Plugin Registries

| # | Registry | Runtime | File | Plugin Interface | # Plugins |
|---|----------|---------|------|-----------------|-----------|
| 1 | **ExtractorRegistry** | Semantic | `pipeline/extractor-registry.ts` | `Extractor` (name + extract method) | 3 (entity, topic, keyword) |
| 2 | **ActionRegistry** | Goal | `registry/action-registry.ts` | `ActionHandler` (name + execute method) | 3 (generate-faq, publish-cms, update-knowledge-graph) |
| 3 | **CapabilityRegistry** | Capability | `registry/capability-registry.ts` | `CapabilityContract` (name + schema) | Dynamic (DB-backed) |
| 4 | **ResolverPluginRegistry** | Capability | `resolver/resolver-interface.ts` | `ResolverPlugin` (resolve method) | 0 (interface defined, no plugins registered yet) |
| 5 | **Routing strategy** | Capability | `resolver/capability-resolver.ts` | `RoutingStrategy` (resolve method) | 4 (quality, cost, latency, balanced) |

### Hardcoded Dispatch Discovered

| File | Line | Dispatch Pattern | Severity | Fix |
|------|------|-----------------|----------|-----|
| `services/balance/index.ts` | 84 | `switch (provider) { case 'deepseek'` | P2 | Replace with Provider Registry |
| `services/image/pipeline/validators/core/quality-anchor.ts` | 62 | `switch (tier) { case 'REJECT'` | P2 | Replace with quality tier registry |
| `services/image/pipeline/decision/decision-graph-lane.ts` | 154 | `switch (nodeId) { case 'action:accept'` | P2 | Replace with action registry |
| `services/visual-constraint/constraint-scoring.ts` | 115, 160 | `switch (check.kind)` | P2 | Replace with check kind registry |

---

## 8. Configuration Inventory

### Current State — Magic Numbers/Strings Found

| Value | Location | Violation | Fix |
|-------|----------|-----------|-----|
| `5000` (chunk size) | `services/semantic/types.ts` | Magic number | Use `configRegistry.get('SEMANTIC_CHUNK_SIZE')` |
| `0.3` (confidence) | `services/semantic/types.ts` | Magic number | Use `configRegistry.get('SEMANTIC_CONFIDENCE_THRESHOLD')` |
| `20` (max keywords) | `services/semantic/types.ts` | Magic number | Use `configRegistry.get('SEMANTIC_MAX_KEYWORDS')` |
| `10` (max topics) | `services/semantic/types.ts` | Magic number | Use `configRegistry.get('SEMANTIC_MAX_TOPICS')` |
| `300000` (timeout) | `services/video-merge.service.ts` | Magic number | Extract to config |
| `120000` (timeout) | `services/video-merge.service.ts` | Magic number | Extract to config |
| `process.env.*` | 16 files across codebase | Decentralized config | Route through configRegistry |

### Target: Config Registry (`platform/config/config-registry.ts`)

```typescript
export const PLATFORM_DEFAULTS = {
  ASSET_DEFAULT_LANGUAGE: 'zh',
  ASSET_DEFAULT_STATUS: 'draft',
  ASSET_PAGE_SIZE: 50,
  SEMANTIC_CHUNK_SIZE: 5000,
  SEMANTIC_CONFIDENCE_THRESHOLD: 0.3,
  SEMANTIC_MAX_KEYWORDS: 20,
  SEMANTIC_MAX_TOPICS: 10,
  GOAL_DEFAULT_PRIORITY: 3,
  GOAL_DEFAULT_MAX_RETRIES: 3,
  CAPABILITY_DEFAULT_STATUS: 'active',
  CAPABILITY_DEFAULT_VERSION: '1.0.0',
  // ...
}
```

---

## 9. Error Model

### Current State

All Runtimes throw generic `new Error()` — no error codes, no typed hierarchy.

Examples from the audit:
```typescript
throw new Error(`Task ${taskId} not found`)
throw new Error('DAILY_LIMIT_REACHED')
throw new Error('[COS] 未配置存储')
throw new Error('LLM 返回格式异常')
```

### Target: Platform Error Hierarchy (`platform/errors/platform-errors.ts`)

```
PlatformError (base)
├── ValidationError     — Input doesn't match schema
├── ContractError       — Capability contract violation
├── RepositoryError     — Data access layer failure
├── RuntimeError        — Generic runtime failure
├── ProviderError       — External provider failure
├── ExecutionError      — Task/action execution failure
├── PermissionError     — Access denied
├── ConfigurationError  — Invalid or missing configuration
└── NotFoundError       — Entity not found
```

All new code should throw these subclasses instead of `new Error()`.

---

## 10. SDK Proposal

### Rationale

Workspace code currently accesses Runtimes via:
- Direct imports (e.g., `import { assetRuntime } from './services/asset/runtime/asset.runtime.js'`)
- Event bus singletons
- Service singletons

This creates tight coupling and makes it impossible to:
- Mock Runtimes for testing
- Add cross-cutting concerns (logging, metrics, auth) transparently
- Version the Runtime API independently

### SDK Interface (`platform/sdk/platform-sdk.ts`)

```typescript
class PlatformSDK {
  async scan(url: string, ctx?: PlatformContext): Promise<ScanResult>
  asset(): AssetService
  semantic(): SemanticService
  goal(): GoalService
  capability(name: string): CapabilityService
  async execute(request: ExecuteRequest, ctx?: PlatformContext): Promise<ExecuteResult>
}
```

### Migration Path

1. Define SDK interface (✅ Done)
2. Implement SDK with lazy imports to Runtime singletons (✅ Done)
3. Migrate workspace code to use `platformSDK` instead of direct imports (🔜 P1)
4. Add full dependency injection in V4 (📅 Future)

---

## 11. ADR Index

### Index by ADR Number

| # | Title | File | Status | Implements |
|---|-------|------|--------|------------|
| 001 | Runtime Layering | `docs/architecture/adr/ADR-001-runtime-layering.md` | ✅ Accepted | Phase I Foundation |
| 002 | Repository Pattern | `docs/architecture/adr/ADR-002-repository-pattern.md` | ✅ Accepted | Phase I Foundation |
| 003 | Platform Context | `docs/architecture/adr/ADR-003-platform-context.md` | ✅ Accepted | Phase I Foundation |
| 004 | Event Model | `docs/architecture/adr/ADR-004-event-model.md` | ✅ Proposed | Phase I Foundation |
| 005 | Capability Contract | `docs/architecture/adr/ADR-005-capability-contract.md` | ✅ Proposed | PLAT-006 |
| 006 | Plugin Architecture | `docs/architecture/adr/ADR-006-plugin-architecture.md` | ✅ Proposed | Phase I Foundation |
| 007 | Runtime Lifecycle | `docs/architecture/adr/ADR-007-runtime-lifecycle.md` | ✅ Accepted | Phase I Convergence |
| 008 | Platform Event Model | `docs/architecture/adr/ADR-008-platform-event-model.md` | ✅ Accepted | Phase I Convergence |
| 009 | Platform Error Model | `docs/architecture/adr/ADR-009-platform-error-model.md` | ✅ Accepted | Phase I Convergence |
| 010 | Platform SDK | `docs/architecture/adr/ADR-010-platform-sdk.md` | ✅ Accepted | PLAT-006~PLAT-012 |
| 011 | Plugin Registry | `docs/architecture/adr/ADR-011-plugin-registry.md` | ✅ Accepted | Phase I Convergence |
| 012 | Merge Gate | `docs/architecture/adr/ADR-012-merge-gate.md` | ✅ Accepted | Process |
| **013** | **(Reserved — see PLAT-008 AI Resource Runtime)** | — | 🔲 Reserved | PLAT-008 |
| 014 | Workspace Runtime | `docs/architecture/adr/ADR-014-workspace-runtime.md` | ✅ Accepted | PLAT-009 |
| 015 | Agent Runtime | `docs/architecture/adr/ADR-015-agent-runtime.md` | ✅ Accepted | PLAT-010 |
| 016 | Workflow Runtime | `docs/architecture/adr/ADR-016-workflow-runtime.md` | ✅ Accepted | PLAT-011 |
| **017** | **(Reserved — see PLAT-012 Platform Governance)** | — | 🔲 Reserved | PLAT-012 |

### Legend

| Status | Meaning |
|--------|---------|
| ✅ Accepted | Decision ratified, implementation complete |
| ✅ Proposed | Decision documented, implementation in progress |
| 🔲 Reserved | ADR number reserved for future formalization; see corresponding PLAT |


### ADR ↔ PLAT Mapping

| ADR | PLAT | Description |
|-----|------|-------------|
| ADR-005 | PLAT-006 | Capability Contract → Capability Platform |
| ADR-010 | PLAT-006~012 | Platform SDK → all platform runtimes |
| ADR-013 (Reserved) | PLAT-008 | AI Resource Runtime decision scope |
| ADR-014 | PLAT-009 | Workspace Runtime |
| ADR-015 | PLAT-010 | Agent Runtime |
| ADR-016 | PLAT-011 | Workflow Runtime |
| ADR-017 (Reserved) | PLAT-012 | Platform Governance decision scope |

---

## 12. Architecture Violations & Fixes

### P0 Violations (Must Fix)

| # | Violation | Location | Severity | Fix | Status |
|---|-----------|----------|----------|-----|--------|
| V1 | Direct Prisma access (dynamic import) | `asset.service.ts:168` (addTag/removeTag) | P0 | Move to asset.repository.ts | 🔜 Planned |
| V2 | Separate event buses (x4) | Asset, Semantic, Goal, Capability | P0 | Migrate to shared EventBus | 🔜 Planned |
| V3 | No PlatformContext in Asset, Semantic, Goal | Runtime method signatures | P0 | Add PlatformContext as first param | 🔜 Planned |
| V4 | No lifecycle validation step | Scanner, Asset, Semantic, Goal | P0 | Add Validate method | 🔜 Planned |
| V5 | Generic Error throws | All Runtimes | P0 | Replace with PlatformError subclasses | 🔜 Planned |

### P1 Violations (Should Fix)

| # | Violation | Location | Severity | Fix | Status |
|---|-----------|----------|----------|-----|--------|
| V6 | Magic numbers for config | semantic/types.ts, video-merge.service.ts | P1 | Extract to configRegistry | 🔜 Planned |
| V7 | Scan runtime has no class/encapsulation | geo/scanner/ | P1 | Consider ScannerRuntime class | 🔜 Planned |
| V8 | Workspace imports Runtime directly | Multiple files | P1 | Route through PlatformSDK | 🔜 Planned |
| V9 | Circular import in asset services | asset.service.ts ↔ asset-version.service.ts | P1 | Extract event bus | 🔜 Planned |

### P2 Violations (Nice to Fix)

| # | Violation | Location | Severity | Fix | Status |
|---|-----------|----------|----------|-----|--------|
| V10 | Hardcoded switch/case dispatch | balance/index.ts, image/* | P2 | Replace with registries | 📅 Future |
| V11 | process.env scattered | 16 files | P2 | Centralize via configRegistry | 📅 Future |

---

## 13. Freeze Checklist

### Platform Infrastructure (Ratified)

- [x] `platform/events/event-types.ts` — Unified event type definitions
- [x] `platform/events/event-bus.ts` — Platform Event Bus interface + in-memory implementation
- [x] `platform/context/platform-context.ts` — Platform Context interface
- [x] `platform/config/config-registry.ts` — Unified configuration registry
- [x] `platform/errors/platform-errors.ts` — Typed error hierarchy
- [x] `platform/telemetry/telemetry-interface.ts` — Telemetry collector interface
- [x] `platform/sdk/platform-sdk.ts` — Platform SDK with Runtime facade

### Architecture Decision Records

- [x] ADR-001 Runtime Layering
- [x] ADR-002 Repository Pattern
- [x] ADR-003 Platform Context
- [x] ADR-004 Event Model
- [x] ADR-005 Capability Contract
- [x] ADR-006 Plugin Architecture
- [x] ADR-007 Runtime Lifecycle
- [x] ADR-008 Platform Event Model
- [x] ADR-009 Platform Error Model
- [x] ADR-010 Platform SDK
- [x] ADR-011 Plugin Registry
- [x] ADR-012 Merge Gate
- [ ] ADR-013 (Reserved — PLAT-008)
- [x] ADR-014 Workspace Runtime
- [x] ADR-015 Agent Runtime
- [x] ADR-016 Workflow Runtime
- [ ] ADR-017 (Reserved — PLAT-012)

### Platform Runtime Implementations (PLAT Index)

- [x] PLAT-006 Capability Platform
- [x] PLAT-007 Execution Runtime
- [x] PLAT-008 AI Resource Runtime
- [x] PLAT-009 Workspace Runtime
- [x] PLAT-010 Agent Runtime
- [x] PLAT-011 Workflow Runtime
- [x] PLAT-012 Platform Governance

### Freeze Report

- [x] `docs/architecture/FREEZE_V3.md` — this document (updated: 2026-07-02 KMKI-DOC-001)

### Runtime Audit Checklist

- [x] Layer dependency audit complete
- [x] Repository compliance audit complete
- [x] Runtime lifecycle audit complete
- [x] Event model audit complete
- [x] Context usage audit complete
- [x] Plugin/registry audit complete
- [x] Configuration audit complete
- [x] Error model audit complete

### Documentation Governance (KMKI-DOC-001)

- [x] Current Platform Runtime Stack (Section 0)
- [x] Runtime Evolution Path (Section 0a)
- [x] ADR Index with full numbering (Section 11)
- [x] ADR ↔ PLAT mapping
- [x] PLAT Index in Freeze Checklist
- [ ] Sprint 1A tag (`geo-v1-sprint1a`)

### Future Work (V4+)

- [ ] Migrate all 4 event buses to use `platformEventBus`
- [ ] Add `PlatformContext` param to all Runtime method signatures
- [ ] Refactor all `new Error()` to `PlatformError` subclasses
- [ ] Move `asset.service.ts` direct Prisma calls to Repository
- [ ] Convert magic numbers to `configRegistry` references
- [ ] Convert switch/case dispatch to plugin registries
- [ ] Add ScannerRuntime class for parity with other Runtimes
- [ ] Standardize telemetry collection across all Runtimes
- [ ] Full Prometheus integration (observability)
- [ ] Workspace code migrates to PlatformSDK

---

*End of FREEZE_V3.md — Kunlun Mirror Platform Runtime Architecture Freeze*
