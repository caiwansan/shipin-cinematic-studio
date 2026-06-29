# Architecture Timeline — KMKI Platform Evolution

> **Document**: KMKI-ARCH-004 / ARCH-TIMELINE.md  
> **Status**: ✅ Ratified  
> **Date**: 2026-07-02 (KMKI-DOC-001)  

---

## Visual Overview

```
2025 Q2             2025 Q3             2025 Q4             2026 Q1             2026 Q2
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Phase I: GEO Infrastructure           │ Convergence        │ Phase II: V3 Platform               │
│                                       │ (ARCH-001/002)     │                                      │
│ Scanner Runtime    ════════════════════╧═══════════════════════ (frozen legacy)                   │
│ Asset Runtime      ════════════════════╧═══════════════════════ (frozen legacy)                   │
│ Semantic Runtime   ════════════════════╧═══════════════════════ (frozen legacy)                   │
│ Goal Runtime       ═══════════╤════════════════════════════════ (frozen legacy)                   │
│ Lifecycle Manager  ═══════════╧════════════════════════════════ (frozen legacy)                   │
│                               │                                                                  │
│                               ├── ADR-007~012 (Convergence ADRs)                                 │
│                               │                                                                  │
│                               │              PLAT-006 Capability ═══════════════ (active)        │
│                               │              PLAT-007 Execution   ═══════════════ (active)        │
│                               │              PLAT-008 AI Resource ═══════════════ (active)        │
│                               │              PLAT-009 Workspace   ═══════════════ (active)        │
│                               │              PLAT-010 Agent       ═══════════════ (active)        │
│                               │              PLAT-011 Workflow    ═══════════════ (active)        │
│                               │              PLAT-012 Governance  ═══════════════ (active)        │
│                               │                                                                  │
│                               │              FREEZE V3 (2026-06-29) 🧊                            │
│                               │              KMKI-DOC-001 (2026-07-02) 📋                         │
```

---

## Phase Detail

### Phase I — Early GEO Infrastructure (2025 Q2–Q3)

**Motivation**: Build knowledge base infrastructure for GEO product (SEO knowledge graph).

**Runtimes created**:
- Scanner Runtime — Web crawling pipeline
- Asset Runtime — Asset lifecycle (import, version, normalize, extract)
- Semantic Runtime — Entity/topic/relation/keyword extraction
- Goal Runtime — Goal→Strategy→Workflow→Task→Execution→Review DAG
- Lifecycle Manager — Timer registry + event buffer + error shield

**Architecture pattern**: `Route → Runtime → Service → Repository → Prisma`
**Platform infrastructure**: None (each Runtime had its own event model, error handling, and lifecycle)

**Status today**: ⏸️ Frozen — all 5 runtimes are legacy. They still exist and serve GEO knowledge base. No new development. No migration.

---

### Convergence Phase — ARCH-001 & ARCH-002 (2025 Q3)

**Motivation**: Audit revealed fragmented event models, inconsistent lifecycle, missing PlatformContext, no typed errors, no SDK layer.

**ADR series**: ADR-007 through ADR-012 defined:
- Unified runtime lifecycle (Init→Load→Validate→Execute→Update→Dispose)
- Unified platform event model with canonical event categories
- Unified error hierarchy (PlatformError base class)
- Platform SDK (facade over all runtimes)
- Unified plugin registry pattern
- Merge gate for architecture compliance

**Infrastructure created**: `platform/events/`, `platform/context/`, `platform/errors/`, `platform/sdk/`, `platform/config/`

---

### Phase II — V3 Platform Runtime Architecture (2025 Q4–2026 Q2)

**Motivation**: Redesign into a unified platform that supports short-drama, GEO, PPT, novel, and future workbenches.

**New runtimes (PLAT stack)**:

| PLAT | Runtime | Origin |
|------|---------|--------|
| PLAT-006 | Capability Platform | Evolved from Goal Runtime + Capability Contract |
| PLAT-007 | Execution Runtime | Evolved from Goal Runtime executor |
| PLAT-008 | AI Resource Runtime | New — provider abstraction + quota + cost |
| PLAT-009 | Workspace Runtime | Evolved from Lifecycle Manager + snapshot |
| PLAT-010 | Agent Runtime | New — intelligent agent orchestration |
| PLAT-011 | Workflow Runtime | Evolved from Goal Runtime DAG engine |
| PLAT-012 | Platform Governance | New — policy enforcement + drift detection |

**Key improvements over Phase I**:
- PlatformContext as first parameter in all Runtime methods
- Unified EventBus (shared across all runtimes)
- Typed PlatformError hierarchy
- PlatformSDK as the only entry point for workspace code
- ConfigRegistry centralized configuration

---

### Phase III — GEO Studio on V3 Platform (2026 Q2)

**GEO Sprint 1A**: Knowledge Skeleton (Claim → Evidence → Citation → FAQ → Schema → Entity)

- Built on top of PLAT-006~PLAT-012 (NOT Phase I runtimes)
- Uses Agent Runtime (PLAT-010) for agent registration
- Uses Workflow Runtime (PLAT-011) for workflow orchestration
- Uses Execution Runtime (PLAT-007) for task execution
- Uses AI Resource Runtime (PLAT-008) for LLM provider management

---

## Timeline Milestones (Git)

| Date | Commit | Milestone |
|------|--------|-----------|
| 2025-06-28 | — | ADR-001~006 (foundation) |
| 2025-06-28 | — | ADR-007~012 (convergence) |
| 2025-06-29 | `c2460d3` | FREEZE V3 proposed |
| 2025-06-29 | `a042e87` | GEO Sprint 1A complete |
| 2026-07-02 | — | KMKI-DOC-001 (doc sync) |
| 2026-07-02 | `geo-v1-sprint1a` | Sprint 1A freeze tag |

---

*End of ARCH-TIMELINE.md — KMKI Platform Architecture Evolution Timeline*
