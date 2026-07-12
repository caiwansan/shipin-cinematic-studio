# FREEZE NOTICE — v1.0.x

## Freeze Date

**2026-07-05** — v1.0.1 released. Master branch (v1.0.x) is now frozen.

## Allowed Changes

Only the following change types are permitted on the v1.0.x branch:

- **Bug Fix** — Runtime crashes, data corruption, incorrect behavior
- **Security** — Vulnerability patches, dependency updates for CVEs
- **Stability** — Memory leaks, performance degradation, excessive error rates
- **Regression only** — All fixes must include a regression test

## Prohibited Changes

The following change types are **strictly forbidden** on v1.0.x:

- ❌ New Feature — No new capabilities, endpoints, or UI components
- ❌ UI Refactor — No visual or layout changes
- ❌ Architecture — No module restructuring, dependency rework
- ❌ API Breaking — No endpoint contract changes (request/response schema)
- ❌ Schema Breaking — No database migration that requires rollback or data migration

## v1.1 Branch Creation

1. Create `v1.1-dev` branch from current HEAD
2. All new development targets `v1.1-dev`
3. Urgent v1.0.x hotfixes must be:
   - Developed on `v1.1-dev` (or a feature branch off it)
   - Cherry-picked to `v1.0.x` after review
   - Accompanied by a regression test
4. v1.0.x is READ-ONLY except for critical patches approved by release lead

## Duration

Next evaluation: On v1.1 GA release.
