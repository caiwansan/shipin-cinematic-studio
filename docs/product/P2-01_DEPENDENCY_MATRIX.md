# Dependency Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## Module Dependency Graph

```
                     ┌──────────────┐
                     │   Project    │
                     │   (Brand)    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Knowledge   │
                     │  (KO + KIE)  │
                     └──────┬───────┘
                            │ Insight
                            ▼
                  ┌───────────────────┐
                  │ KnowledgeAction   │
                  │ Adapter (BROKEN)  │
                  └────────┬──────────┘
                           │ Action[]
                           ▼
                   ┌───────────────┐
                   │    Mission    │
                   │  (Generator)  │
                   └───────┬───────┘
                           │ Mission[]
                           ▼
                  ┌────────────────┐
                  │ Recommendations│
                  └───────┬────────┘
                          │ Execute
                          ▼
                   ┌──────────────┐
                   │ Verification │
                   └───────┬──────┘
                           │ Result
                           ▼
                    ┌─────────────┐
                    │   Health    │
                    └──────┬──────┘
                           │ Score
                           ▼
                    ┌─────────────┐
                    │   Growth    │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Timeline   │
                    │ (All events)│
                    └─────────────┘
```

## Upstream Dependencies

| Module | Depends On | Dependency Type | Status |
|---|---|---|---|
| Knowledge | Project | Data | ✅ Live |
| KIE | Knowledge (KO) | Data | ✅ Live |
| KnowledgeActionAdapter | KIE (Insight) | Transformation | ❌ BROKEN |
| Mission | KnowledgeActionAdapter (Action) | Data | ❌ BLOCKED |
| Recommendations | Knowledge (KIE Insight) | Data | ⚠️ Partial (also accepts manual input) |
| Verification | Any (projectId) | Trigger | ✅ Standalone |
| Health | Verification (optional), Knowledge | Data | ⚠️ Partial |
| Growth | Health (optional), Verification | Data | ⚠️ Partial |
| Timeline | All modules (events) | Data | ❌ In-memory |
| Presence | Brand (brandName) | Data | ✅ Standalone |
| Publishing | Knowledge (KO), Distribution Engine | Data | ❌ Blocked |

## Downstream Dependencies

| Module | Feeds Into | Status |
|---|---|---|
| Project | Knowledge, Dashboard | ✅ |
| Knowledge (KO) | KIE, Recommendations, Mission | ✅ / ❌ (Mission) |
| KIE (Insight) | KnowledgeActionAdapter, RecommendationsPage | ❌ (Adapter) / ✅ (Recs) |
| Recommendations | Mission, Verification | ⚠️ Partial |
| Mission | Verification (auto-trigger) | ❌ Not connected |
| Verification | Health, Growth | ❌ Not connected |
| Health | Growth | ❌ Not connected |

## Circular Dependency Check

| Check | Result |
|---|---|
| Knowledge → KIE → Knowledge? | ✅ Linear, no cycle |
| Verifies → Health → Growth → Verifies? | ❌ Not a cycle (linear chain) |
| Mission → Verify → Mission? | ❌ Not yet connected |
| Recommendations → Knowledge → Recommendations? | ✅ Linear | 

**Circular Dependencies Found:** 0

## Critical Path

The longest dependency chain in GEO:

```
Project → Knowledge → KIE → ActionAdapter → Mission → Verify → Health → Growth → Timeline
```

**Length:** 9 steps
**Currently Functional:** 2 steps (Project → Knowledge)
**Broken at:** Step 4 (KnowledgeActionAdapter)

This is the single most critical dependency issue in the entire system.
