# ADR Index — Architecture Decision Records

> **Document**: KMKI-ARCH-002 / ADR-INDEX.md  
> **Status**: ✅ Ratified  
> **Date**: 2026-07-02 (KMKI-DOC-001)  
> **Purpose**: Unified catalog of all Architecture Decision Records (ADR-001 through ADR-017). Every number is explicitly accounted for.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Accepted | Decision ratified, implementation complete |
| ✅ Proposed | Decision documented, implementation in progress |
| 🔲 Reserved | ADR number reserved for future formalization; see corresponding PLAT |
| — | N/A |

---

## ADR Index

| # | Title | File | Status | Implements |
|---|-------|------|--------|------------|
| 001 | Runtime Layering | `adr/ADR-001-runtime-layering.md` | ✅ Accepted | Phase I Foundation |
| 002 | Repository Pattern | `adr/ADR-002-repository-pattern.md` | ✅ Accepted | Phase I Foundation |
| 003 | Platform Context | `adr/ADR-003-platform-context.md` | ✅ Proposed | Phase I Foundation |
| 004 | Event Model | `adr/ADR-004-event-model.md` | ✅ Proposed | Phase I Foundation |
| 005 | Capability Contract | `adr/ADR-005-capability-contract.md` | ✅ Proposed | PLAT-006 |
| 006 | Plugin Architecture | `adr/ADR-006-plugin-architecture.md` | ✅ Proposed | Phase I Foundation |
| 007 | Runtime Lifecycle | `adr/ADR-007-runtime-lifecycle.md` | ✅ Accepted | Phase I Convergence |
| 008 | Platform Event Model | `adr/ADR-008-platform-event-model.md` | ✅ Accepted | Phase I Convergence |
| 009 | Platform Error Model | `adr/ADR-009-platform-error-model.md` | ✅ Accepted | Phase I Convergence |
| 010 | Platform SDK | `adr/ADR-010-platform-sdk.md` | ✅ Accepted | PLAT-006~PLAT-012 |
| 011 | Plugin Registry | `adr/ADR-011-plugin-registry.md` | ✅ Accepted | Phase I Convergence |
| 012 | Merge Gate | `adr/ADR-012-merge-gate.md` | ✅ Accepted | Process |
| **013** | **(Reserved — AI Resource Runtime)** | — | 🔲 Reserved | PLAT-008 |
| 014 | Workspace Runtime | `adr/ADR-014-workspace-runtime.md` | ✅ Accepted | PLAT-009 |
| 015 | Agent Runtime | `adr/ADR-015-agent-runtime.md` | ✅ Accepted | PLAT-010 |
| 016 | Workflow Runtime | `adr/ADR-016-workflow-runtime.md` | ✅ Accepted | PLAT-011 |
| **017** | **(Reserved — Platform Governance)** | — | 🔲 Reserved | PLAT-012 |

---

## Notes

### ADR-013 (Reserved)
Scope covers the **AI Resource Runtime** (PLAT-008). Not formalized as a standalone ADR yet because the decision was implemented directly from the Platform Convergence (ARCH-002) findings. Future work may extract a formal ADR if the AI Resource Runtime contract needs ratification.

### ADR-017 (Reserved)
Scope covers **Platform Governance** (PLAT-012). Not formalized as a standalone ADR yet. Governance was implemented as an operational runtime rather than a design-time decision. Future work may formalize if governance policies need ratification.

### Sequence Gap
ADR-013 and ADR-017 are absent from the file system. This is **intentional**: the PLAT-008 and PLAT-012 implementations were committed directly without a separate ADR document. The numbers are reserved to maintain sequence continuity. No decisions are lost — they are documented at the PLAT level (see `PLAT-INDEX.md`).

---

## Quick Reference: ADR → PLAT → Code

```
ADR-005 ──► PLAT-006 (Capability Platform)
ADR-010 ──► PLAT-006~012 (Platform SDK)
ADR-013 ──► PLAT-008 (AI Resource Runtime) — Reserved
ADR-014 ──► PLAT-009 (Workspace Runtime)
ADR-015 ──► PLAT-010 (Agent Runtime)
ADR-016 ──► PLAT-011 (Workflow Runtime)
ADR-017 ──► PLAT-012 (Platform Governance) — Reserved
```

---

*End of ADR-INDEX.md — Unified Architecture Decision Record Index*
