# ADR-018: Website Intelligence as Platform Capability

> **Status**: ✅ Accepted (Architecture Discovery, no implementation)  
> **Date**: 2026-07-17  
> **Author**: Architecture Review  
> **Context**: V4.2A Convergence Baseline — Architecture Discovery  
> **Implements**: Phase B Foundation (Platform Knowledge Acquisition Layer)  

---

## Decision

**Website Intelligence is a Platform Capability, not a GEO Workspace feature.**

It is classified as the **Knowledge Acquisition Layer** within the Platform Knowledge Infrastructure:

```
Website Intelligence (Acquisition)
       ↓
  Citation (Referencing)
       ↓
  Evidence (Verification)
       ↓
  Claim (Assertion)
       ↓
  Trust Engine (Scoring)
```

## Rationale

1. **Wrong hierarchy**: The current implementation places "官网管理" (Website Management) inside `BrandDetailPage` as a sub-card. This is architecturally incorrect — Brand is a business object that Website serves, not the other way around.

2. **Cross-workspace value**: Website scanning / crawling / monitoring is consumed not only by GEO but by Short-drama, Novel, PPT, Music, and future workspaces. A platform-level capability avoids N duplicate implementations.

3. **Knowledge source entry**: Website is the primary entry point for external knowledge acquisition. Without a dedicated Website Intelligence layer, the downstream pipeline (Citation → Evidence → Claim → Trust) lacks a systematic data source.

## Scope (Phase B — Sprint 4)

| Layer | Scope | Status |
|-------|-------|--------|
| Dashboard | Website health, scan stats | 📋 Phase B |
| Website List | CRUD + status + tags | 📋 Phase B |
| Website Detail | Brand, Industry, SSL, sitemap, CMS, etc. | 📋 Phase B |
| Crawler | Scan / rescan / depth / UA / robots | 📋 Phase B |
| Knowledge | Extracted KO entities from website | 📋 Phase B |
| SEO Analysis | Title, description, H1, schema, OG, links | 📋 Phase B |
| Change Monitor | Diff tracking across scans | 📋 Phase B |
| Knowledge Timeline | Scan history → Knowledge evolution | 📋 Phase B |

## Non-Goals (now)

- No code changes
- No API design
- No DB schema
- No UI mockups

This ADR records only the **decision**. Design will begin in **Phase B-0** after the Workspace Audit and AI Capability Audit produce real data on existing crawler/scraper capabilities.

## Dependencies

- Phase A must complete (Batch 3 → Batch 4 → Batch 5)
- Phase B-0 audits must complete (Admin / AI / Workspace)
- AI Center Sprint must complete first (establishes platform Layout/API/CRUD patterns)
- Website Intelligence inherits AI Center's platform infrastructure

## References

- V4.2A Convergence Baseline (`docs/freeze/V4.2A-CONVERGENCE-BASELINE.md`)
- V4.2 Platform Classification (`docs/architecture/V42-PLATFORM-CLASSIFICATION.md`)
- GEO UX Final Map (`docs/freeze/GEO-UX-FINAL-MAP.md`)
