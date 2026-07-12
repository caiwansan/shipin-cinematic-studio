# Missing Link Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only — No Solutions, Only Blockers
**Last Updated:** 2026-07-27

---

## P0 — Must Fix (Blocks Multiple Downstream Capabilities)

| # | Capability | Current State | Blocking Reason | Required Work | Estimated Sprint |
|---|---|---|---|---|---|
| M1 | Mission List | API Live (200) → Empty [] | **KnowledgeActionAdapter not wired to production data.** MissionGenerator has no Action[] input. | Wire KIE Insight → KnowledgeActionAdapter → Action[] → MissionGenerator | P2-03 |
| M2 | Mission Create | Stub | Same as M1 — MissionGenerator cannot create missions without input | Same as M1 | P2-03 |
| M3 | Mission Execute | Stub | No missions exist, and execute endpoint is stub anyway | Depends on M1 + real execute pipeline | P2-04 |
| M4 | KIE → Action Pipeline | Engine exists, not connected | **KnowledgeActionAdapter (50% complete) is the only bridge between KIE Insight and Action/Mission — currently not integrated with any product data flow** | Complete adapter integration, connect KIE output to action generation | P2-03 |

---

## P1 — Must Fix (Reduces Product Trust)

| # | Capability | Current State | Blocking Reason | Required Work | Estimated Sprint |
|---|---|---|---|---|---|
| M5 | Business Value Hero | Math.random() on client | No backend analytics service for growth projections | Either build AnalyticsService or replace with Truth Level badge ("No Evidence") | P2-02 |
| M6 | Timeline Persistence | In-memory only | TimelineStore (workspace/timeline.ts) has no DB backing | Migrate to Prisma-backed TimelineRepository | P2-05 |
| M7 | Dashboard sub-APIs (x5) | API exists, no UI consumer | 5 separate endpoints for truth/presence/verification/providers/timeline never wired to Dashboard UI | Build Dashboard widgets or remove endpoints | P2-02 |
| M8 | Verification Job Runner | In-memory | InMemoryJobRunner loses data on restart | Migrate to DB-persisted job queue | P2-04 |

---

## P2 — Should Fix (Enables Deeper Workflows)

| # | Capability | Current State | Blocking Reason | Required Work | Estimated Sprint |
|---|---|---|---|---|---|
| M9 | Entity UI | API exists, no consumer | Entity CRUD endpoints return data but no dedicated page or tab | Add Entity tab to KnowledgePage | P2-06 |
| M10 | Claim UI | API exists, no consumer | Claim CRUD endpoints return data but no dedicated page or tab | Add Claim tab to KnowledgePage | P2-06 |
| M11 | Evidence Standalone Page | Evidence embedded in BrandOverview | Evidence endpoints exist but only exposed inline, no management UI | Build EvidencePage | P2-08 |
| M12 | Publishing Channels (empty) | API exists, returns empty | Publishing plan returns hardcoded empty channels; no real push pipeline | Requires Distribution Engine integration | P2-10 |
| M13 | Check Published / Indexed | API exists, no consumer | Monitor check endpoints exist but no HealthPage widget | Add monitoring widgets to HealthPage | P2-09 |
| M14 | KIE AI Upgrade | Rule engine, not AI | KIE is deterministic rules, could benefit from AI-driven scoring | Upgrade KIE to AI-powered | P2-11 |
| M15 | BrandOverview Refactoring | 4276-line super-page | BrandOverview duplicates entire workspace inline | Extract into focused sub-pages | P2-12 |
| M16 | Some routes skip auth | Security gap | Several GEO routes use preHandler: [] instead of app.authenticate | Add auth consistently | P2-13 |

---

## P3 — Nice to Have (Product Polish)

| # | Capability | Current State | Blocking Reason | Required Work | Estimated Sprint |
|---|---|---|---|---|---|
| M17 | Knowledge Graph | Missing | No visual knowledge graph for entity/claim relationships | Add graph visualization | P2-14 |
| M18 | Discovery Engine | Removed from IA | Would need full product redefinition | Redesign from scratch | Future |
| M19 | Distribution Engine Integration | Not in GEO | Platform-level engine exists but not wired to GEO | Integration sprint | P2-15 |
| M20 | Duplicate Route Cleanup | 4 duplicate route pairs | Route redundancy without clear deprecation plan | Cleanup sweep | P2-13 |

---

## Missing Link Summary

| Priority | Count | Impact |
|---|---|---|
| P0 (Blocks downstream) | 4 | Mission module completely non-functional |
| P1 (Reduces trust) | 4 | 1 FAKE KPI, 5 unused dashboard APIs, in-memory timeline |
| P2 (Deeper workflows) | 8 | Entity/Claim/Evidence UIs, Publishing, KIE upgrade, BrandOverview cleanup |
| P3 (Nice to have) | 4 | Graph viz, Discovery, Distribution, Route cleanup |
| **Total** | **20** | |

## Sprint Dependency Chain

```
P2-02 (Dashboard Integration)
  Fixes: M5 (FAKE KPI), M7 (sub-APIs)
  Depends on: P2-01 audit
  ↓
P2-03 (Mission Pipeline)
  Fixes: M1, M2, M4 (the entire Mission input chain)
  Depends on: P2-02
  ↓
P2-04 (Mission Execute + Verification Loop)
  Fixes: M3, M8
  Depends on: P2-03
  ↓
P2-05 (Timeline Persistence)
  Fixes: M6
  Depends on: P2-02, P2-04 (to have events to persist)
  ↓
P2-06 ~ P2-15 (Feature complete)
```
