# TS Error Topology Scan — Gate 3 Report

**Date**: 2026-05-28 21:30  
**Scope**: Backend (`/backend/src/`) + Frontend  
**Method**: `tsc --noEmit` with structural classification

---

## Executive Summary

| Metric | Value |
|---|---|
| Total raw error lines | Backend 363, Frontend 9 |
| Unique errors (backend) | **284** |
| Unique files affected | 90 |
| Auto-fixable ratio (L1) | 32% |
| Recommendation | **PARTIAL_REFACTOR** |

---

## 1. Module Distribution

| Module | Errors |
|---|---|
| `routes/` | 107 |
| `director-v2/` | 86 |
| `runtime/` | 21 |
| `services/` | 20 |
| `model-adapters/` | 14 |
| `queue/` | 3 |
| `engine/` | ~21 |
| `core/` | ~5 |
| Others | ~7 |

### Directory Hotspots

| Directory | Errors |
|---|---|
| `src/director-v2/runtime` | 35 |
| `src/director-v2/render` | 20 |
| `src/director-v2/memory` | 10 |
| `src/engine/director` | 9 |
| `src/runtime/adapters` | 7 |
| `src/engine/prompt-compiler` | 7 |

---

## 2. Error Type Distribution

| Category | Count |
|---|---|
| **Type Drift** (TS2322/2345/2339/2353/2554) | 127 |
| **Import/Export Drift** (TS2307/2614/1192/2305/2724) | 33 |
| **Conversion** (TS2352) | 5 |
| **Enum/Union** (TS2320/2367/2403) | 1 |

**Key insight**: Type drift dominates (127/284 = 45%). These are primarily:
- `Property X does not exist on type Y` — schema/interface mismatch
- `Object literal may only specify known properties` — Prisma type vs extended fields
- `Type X is not assignable to type Y` — generic type variance

---

## 3. Top 10 Hotspot Files

| File | Error Lines |
|---|---|
| `src/routes/admin-global-config.ts` | 21 |
| `src/routes/member.ts` | 16 |
| `src/routes/kernel-causal.ts` | 13 |
| `src/director-v2/runtime/director-projection.ts` | 12 |
| `src/director-v2/runtime/api-surface.ts` | 11 |
| `src/routes/execution-graph.ts` | 9 |
| `src/director-v2/render/backends/execution-plan.ts` | 9 |
| `src/routes/workflow-visualizer.ts` | 8 |
| `src/routes/agent-orchestrator.ts` | 8 |
| `src/director-v2/memory/director-memory.ts` | 8 |

---

## 4. Error Pattern Analysis

### Pattern A: Prisma Type Extension Mismatch (~50 errors)
`failure-event.service.ts` tries to access `failureEvents` on Prisma-generated `VideoTask` type. The field exists in the DB (relation) but isn't included in the Prisma type's `select/include`.

**Fix**: Use Prisma include or cast via `unknown`.

### Pattern B: Director-v2 Interface Drift (~80 errors)
`director-projection.ts`, `api-surface.ts`, `execution-plan.ts` — interfaces defined in earlier phases have diverged from current usage.

**Fix**: Type widening or interface regeneration.

### Pattern C: Route Type Imports (~30 errors)
`admin-global-config.ts`, `member.ts` — routes import types that no longer match.

### Pattern D: JSON ↔ Type Conversion (~5 errors)
`runtime-checkpoint.service.ts`, `execution-journal.service.ts` — JSON.parse results cast directly to typed interfaces.

**Fix**: Add `as unknown as Type` casts.

---

## 5. Fix Cost Classification

| Level | Meaning | Count | % |
|---|---|---|---|
| **L1** | Import/rename fix | 91 | 32% |
| **L2** | Interface/type adjust | 145 | 51% |
| **L3** | Architecture refactor | 0 | 0% |

**Auto-fixable ratio**: 32% (L1 errors only)

---

## 6. Recommendation

**PARTIAL_REFACTOR** — most errors (51%) are type drift that requires interface adjustment but no architectural changes.

### Execution strategy if approved:
1. **Phase A** (auto): Fix L1 import/export errors — automated codemod, ~32% reduction
2. **Phase B** (manual): Fix L2 type drift in director-v2 (86 errors) — 2-3 hour effort
3. **Phase C** (manual): Fix L2 type drift in routes (107 errors) — 1-2 hour effort
4. **Result**: ~284 → ~50 remaining (mostly Prisma extension design decisions)

---

## 7. Frontend

Minimal: 9 errors, all in `studio-v2/` store types. Not blocking the build.

---

## 8. Frontend Error Details

```
Frontend unique errors: 9 lines (from raw output)
Primarily type mismatch in studio-v2 stores and runtime types.
Not build-blocking (Nuxt nuxi build succeeds despite tsc errors).
```
