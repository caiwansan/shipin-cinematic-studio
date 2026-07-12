# DEPRECATED — Benchmark Provider Module

**Status**: 🗑️ Deprecated (Sprint 4, Phase 2)
**Effective**: 2026-07-28

## Reason

This benchmark provider was used as the **Discovery Lab** data source. As of Sprint 4, Discovery Lab is hidden from navigation and no longer serves as a production workspace data source.

## Replacement

Use the **Presence Engine** instead: `backend/src/services/geo/presence/`

The Presence Engine provides real-time brand presence detection, coverage analysis, and scenario matching — replacing the mock benchmark data previously returned by this module.

## Code Retention

Code is retained for historical regression and dev test use only.

## See Also

- `backend/src/services/geo/benchmark/DEPRECATED.md` (canonical deprecation notice)
- `GEO-WORKSPACE-DIRECTIVE-V2.md`
