# ADR-012: Merge Gate — 架构门禁检查表

- Status: Accepted
- Date: 2025-06-28
- Deciders: Platform Architecture Team
- Tags: process, gate, compliance

## Context
ARCH-001 and ARCH-002 identified multiple compliance violations across Runtimes. Without a formal gate, these violations would recur. A mechanism is needed to prevent architecture drift.

## Decision
Create `docs/process/MERGE_GATE.md` as a mandatory pre-merge checklist:

1. **10 mandatory checks** — build, types, technical debt, ADR compliance, runtime boundary, repository pattern, context, event model, error model, plugin registry
2. **Recommend checks** — dependency matrix, freeze checklist, health dashboard
3. **Process** — run build + typecheck, review checklist, get architecture review, merge
4. **Audit scripts** — grep-based compliance checks for private contexts, EventEmitter, bare throws, switch dispatch
5. **Exceptions** — documented in TECH_DEBT/ for non-Runtime services

## Alternatives Considered
- **Automated CI checks**: Future enhancement; manual checklist first
- **No gate**: Would allow architecture drift
- **Heavy governance process**: Would slow development

## Consequences
- Architecture drift is detected before merge
- Clear expectations for contributors
- Automated scripts simplify compliance verification
- Process is lightweight (checklist + audit scripts)
- Can be automated in CI in a future iteration

## Compliance
- All merges with P0 architecture changes must pass Merge Gate
- Merge Gate result recorded in Architecture Health Dashboard
- Exceptions tracked in TECH_DEBT/
