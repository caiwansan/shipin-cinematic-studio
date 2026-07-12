# v1.0.1 Release Notes

**Release Date:** 2026-07-05
**Tag:** `v1.0.1`
**Branch:** `release/v1.0.1`

## Summary

Hotfix release for GEO Workspace v1.0. Fixes two P0 production bugs identified during Dogfooding session (DOGFOOD-001).

**Gate Status:** All 4 gates passed — Git Diff ✅ | Regression ✅ | Dogfood ✅ | No Feature Inclusion ✅

## Changes

### Fixed

- **ScoreSnapshot Repository query regression.** (`geo-score-snapshot.repository.ts`, `recommendations-consumer.ts`)
  - `findFirst` nested `where: { where: ... }` → flat `where` pattern.
  - `create` and `update` flat field usage (`visibilityScore`, `discoveryId`, `updatedAt`) → Prisma schema-compliant `snapshot` JSON.
  - Repository was missing `update()` method — added.
  - `verification/snapshot.service.ts` had same `{ data: ... }` nesting — fixed.
- **KnowledgeObject UUID validation crash.** (`KnowledgeObjectRepository.ts`, `KnowledgePipeline.ts`)
  - Non-UUID `projectId` (e.g., `"brand-saas-001"`) now returns typed `KnowledgeIngestResult` with `reason: "INVALID_PROJECT_ID"` instead of crashing Prisma with `P2023`.
  - `findByProjectAndTopic` / `findByProject` same UUID guard added.

### Improved

- **`KnowledgeIngestResult`** — typed result type replaces bare `null`, enabling UI/Timeline/Audit to identify skip reasons.
- **Domain Identifier layer** (`domain/identifiers.ts`) — `ProjectIdentifier`, `TenantIdentifier`, `BrandIdentifier`, `KnowledgeObjectIdentifier` type aliases + `isValidUUID()` utility.
- Exported from `domain/index.ts` — zero-cost abstraction, ready for Value Object migration.

### Added

- **Repository Regression Test Suite** — `tests/v1.0.1/regression.test.ts` — 18 test cases covering:
  - ScoreSnapshot `create` / `findFirst` / `update` schema alignment
  - UUID validation (reject slugs, accept UUIDs)
  - KnowledgeObject non-UUID graceful handling
  - KnowledgeObject valid UUID creation

## File Manifest

```
  Modified:
    src/services/geo/discovery/services/recommendations-consumer.ts
    src/services/geo/discovery/services/knowledge-consumer.ts
    src/services/geo/repositories/geo-score-snapshot.repository.ts
    src/services/geo/runtime/knowledge/KnowledgeObjectRepository.ts
    src/services/geo/runtime/knowledge/KnowledgeObjectSchema.ts
    src/services/geo/runtime/knowledge/KnowledgePipeline.ts
    src/services/geo/verification/snapshot.service.ts
    src/services/geo/domain/index.ts

  Added:
    src/services/geo/domain/identifiers.ts
    tests/v1.0.1/regression.test.ts

  No change:
    frontend/  (0 files)
    mission/ dashboard/ workspace/ orchestrator/  (0 files)
```

## Verification

- ✅ Dogfood E2E — 0 Consumer failures, 9.0/10 score
- ✅ Regression tests — 18/18 passed
- ✅ TypeScript — no compilation errors
- ✅ No Feature leakage — 0 UI/Mission/Dashboard/Workspace files

---

## Build Info

| Field | Value |
|-------|-------|
| Version | v1.0.1 |
| Build Time | 2026-07-05T00:33:56+08:00 |
| Build ID | REL-20260705003356 |
| Node Version | v22.23.1 |
| Status | stable |
| Verification Gate | ✅ All Passed |
