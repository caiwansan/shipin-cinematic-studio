# DEPRECATED — Benchmark Module

**Status**: 🗑️ Deprecated (Sprint 4, Phase 2)
**Effective**: 2026-07-28

## Reason

This benchmark module was originally used as the **Workspace data source** for the Discovery Lab feature. As of Sprint 4, the Discovery Lab has been hidden from the navigation and is no longer a production data source for the GEO Workspace.

## Replacement

Use the **Presence Engine** instead for all brand discovery and observation needs:

- **Presence Engine**: `backend/src/services/geo/presence/`
- The Presence Engine provides real-time brand presence detection, coverage analysis, and scenario matching — capabilities that were previously mocked via benchmark data.
- For Discovery 2.0 (planned Sprint 5), Presence Engine will serve as the foundation.

## Code Retention

This code is **retained** for:
- Historical regression testing
- Development / staging environment test scenarios
- Reference implementation for benchmark-driven evaluation

**Do not** delete these files. They are kept for the purposes above.

## Removal Path

A future Sprint may remove this module entirely once:
1. Discovery 2.0 is fully operational on Presence Engine
2. All regression tests have been migrated to Presence-based fixtures
3. No development workflow depends on benchmark data

## Contact

- GEO Workspace Team
- Architecture: `GEO-WORKSPACE-DIRECTIVE-V2.md`
