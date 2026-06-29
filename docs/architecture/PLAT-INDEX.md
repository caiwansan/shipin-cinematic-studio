# PLAT Index — Platform Runtime Implementation Register

> **Document**: KMKI-ARCH-003 / PLAT-INDEX.md  
> **Status**: ✅ Ratified  
> **Date**: 2026-07-02 (KMKI-DOC-001)  
> **Purpose**: Maps PLAT implementation milestones to ADR decisions and Git commits.

---

## Structure

```
ADR (Decision)
  ↓
PLAT (Implementation Milestone)
  ↓
Code (Git commit)
```

---

## PLAT-006 — Capability Platform

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-005 (Capability Contract) |
| **Runtime Layer** | PLAT Layer 1 |
| **Path** | `backend/src/services/platform/capability/` |
| **Git Milestone** | `a042e87` (Sprint 1A) |
| **Dependencies** | None (platform foundation) |
| **Purpose** | Contract lifecycle, Registry, Resolver, Routing strategies. Governs how capabilities are defined, registered, resolved, and validated. |

### Components

| Component | Type | Description |
|-----------|------|-------------|
| `runtime/capability.runtime.ts` | Runtime | Lifecycle management |
| `capability.service.ts` | Service | Business logic |
| `capability-catalog.service.ts` | Service | Catalog management |
| `registry/` | Registry | Registration + lookup |
| `contracts/` | Contracts | Builder, validator, migrator |
| `resolver/` | Resolver | Routing strategies (balanced, cost, latency, quality) |
| `validators/` | Validators | Input, output, constraint, permission |
| `repositories/` | Repository | Contract + mapping persistence |

---

## PLAT-007 — Execution Runtime

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-007, ADR-008, ADR-009 (lifecycle, events, errors) |
| **Runtime Layer** | PLAT Layer 2 |
| **Path** | `backend/src/services/platform/execution/` |
| **Git Milestone** | `a042e87` (Sprint 1A) |
| **Dependencies** | PLAT-006 (resolves capabilities) |
| **Purpose** | Task execution orchestration, worker dispatch, execution state management. |

---

## PLAT-008 — AI Resource Runtime

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-013 (Reserved — decision scope not yet formalized as ADR) |
| **Runtime Layer** | PLAT Layer 3 |
| **Path** | `backend/src/services/platform/ai-resource/` |
| **Git Milestone** | Phase II (2026 Q2) |
| **Dependencies** | PLAT-006 (capability contracts) |
| **Purpose** | AI provider management, quota control, cost tracking, provider abstraction layer. |

---

## PLAT-009 — Workspace Runtime

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-014 (Workspace Runtime) |
| **Runtime Layer** | PLAT Layer 4 |
| **Path** | `backend/src/services/platform/workspace/` |
| **Git Milestone** | Phase II (2026 Q2) |
| **Dependencies** | PLAT-006, PLAT-007 |
| **Purpose** | Workspace state management, snapshot, version control, autosave, crash recovery. |

---

## PLAT-010 — Agent Runtime

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-015 (Agent Runtime) |
| **Runtime Layer** | PLAT Layer 5 |
| **Path** | `backend/src/services/platform/agent/` |
| **Git Milestone** | Phase II (2026 Q2) |
| **Dependencies** | PLAT-006, PLAT-007, PLAT-008, PLAT-009 |
| **Purpose** | Agent lifecycle, dispatcher, scheduler, memory, tools. Intelligent agent orchestration across capabilities. |

---

## PLAT-011 — Workflow Runtime

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-016 (Workflow Runtime) |
| **Runtime Layer** | PLAT Layer 6 |
| **Path** | `backend/src/services/platform/workflow/` |
| **Git Milestone** | Phase II (2026 Q2) |
| **Dependencies** | PLAT-006, PLAT-007, PLAT-010 |
| **Purpose** | DAG workflow engine, stage management, state transitions, workflow templates. |

---

## PLAT-012 — Platform Governance

| Field | Value |
|-------|-------|
| **Status** | ✅ Freeze (Ratified) |
| **ADR** | ADR-017 (Reserved — decision scope not yet formalized as ADR) |
| **Runtime Layer** | PLAT Layer 7 |
| **Path** | `backend/src/services/platform/governance/` |
| **Git Milestone** | Phase II (2026 Q2) |
| **Dependencies** | PLAT-006 through PLAT-011 (cross-cutting) |
| **Purpose** | Policy enforcement, quota audit, compliance, architecture drift detection. |

---

## Dependency Graph

```
PLAT-006 Capability    (no deps)
    ↓
PLAT-007 Execution     (depends: PLAT-006)
    ↓
PLAT-008 AI Resource   (depends: PLAT-006)
    ↓
PLAT-009 Workspace     (depends: PLAT-006, PLAT-007)
    ↓
PLAT-010 Agent         (depends: PLAT-006, PLAT-007, PLAT-008, PLAT-009)
    ↓
PLAT-011 Workflow      (depends: PLAT-006, PLAT-007, PLAT-010)
    ↓
PLAT-012 Governance    (cross-cutting, depends on all)
```

---

## PLAT ↔ ADR Mapping (Quick Reference)

| PLAT | ADR | Decision |
|------|-----|----------|
| PLAT-006 | ADR-005 | Capability Contract |
| PLAT-006~012 | ADR-010 | Platform SDK |
| PLAT-008 | ADR-013 (Reserved) | AI Resource Runtime |
| PLAT-009 | ADR-014 | Workspace Runtime |
| PLAT-010 | ADR-015 | Agent Runtime |
| PLAT-011 | ADR-016 | Workflow Runtime |
| PLAT-012 | ADR-017 (Reserved) | Platform Governance |

---

*End of PLAT-INDEX.md — Platform Runtime Implementation Register*
