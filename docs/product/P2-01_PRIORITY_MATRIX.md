# Product Priority Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only — Priority Assessment for Sprint Planning
**Last Updated:** 2026-07-27

---

## Scoring Dimensions

| Dimension | Scale | Description |
|---|---|---|
| User Impact | H / M / L | How directly this affects the user's ability to complete their workflow |
| Engineering Cost | H / M / L | Estimated effort to implement (relative within GEO context) |
| Blocking Level | BLOCKER / DEPENDENCY / INDEPENDENT | Whether this blocks other capabilities |

## Priority Classification

| Priority | Definition | Action Required |
|---|---|---|
| P0 | Must do before anything else | Immediately actionable |
| P1 | Important, do after P0 | Next sprint after P0 |
| P2 | Should do, not urgent | Can be deferred |
| P3 | Nice to have | Future sprint |

---

## P0 — Critical Path Unblockers

| # | Missing Link | Module | User Impact | Cost | Blocks | Priority |
|---|---|---|---|---|---|---|
| M4 | KIE → Action pipeline (KnowledgeActionAdapter) | Mission | H | M | M1, M2, M3 (entire Mission module) | **P0** |
| M1 | Mission List - Generator has no input | Mission | H | M | M2, M3 | **P0** |
| M5 | Business Value Hero FAKE KPI | Dashboard | H | L | Trust in product | **P0** |
| M7 | Dashboard sub-APIs unconsumed (x5) | Dashboard | M | M | Dashboard completion | **P0** |

## P1 — High Impact / Medium Cost

| # | Missing Link | Module | User Impact | Cost | Blocks | Priority |
|---|---|---|---|---|---|---|
| M2 | Mission Create - Stub | Mission | H | M | M3 | **P1** |
| M3 | Mission Execute - Stub | Mission | H | M | Verification auto-trigger | **P1** |
| M8 | Verification Job Runner in-memory | Verification | M | M | Data reliability | **P1** |
| M6 | Timeline in-memory | Platform | M | M | Event history | **P1** |

## P2 — Medium Impact / Variable Cost

| # | Missing Link | Module | User Impact | Cost | Blocks | Priority |
|---|---|---|---|---|---|---|
| M9 | Entity UI - no consumer | Knowledge | M | L | Knowledge completeness | **P2** |
| M10 | Claim UI - no consumer | Knowledge | M | L | Knowledge completeness | **P2** |
| M11 | Evidence standalone page | Cross | M | M | Evidence management | **P2** |
| M12 | Publishing - empty channels | Publishing | M | H | Needs Distribution Engine | **P2** |
| M13 | Check Published/Indexed - no UI | Health | L | L | Monitor completeness | **P2** |
| M15 | BrandOverview refactoring | Cross | M | H | Page maintainability | **P2** |

## P3 — Low Priority / Future

| # | Missing Link | Module | User Impact | Cost | Blocks | Priority |
|---|---|---|---|---|---|---|
| M14 | KIE AI upgrade | Knowledge | M | H | Not blocking anything | **P3** |
| M16 | Auth gaps on some routes | Platform | M | M | Security hardening | **P3** |
| M17 | Knowledge graph visualization | Knowledge | L | H | Nice to have | **P3** |
| M18 | Discovery Engine rebuild | Discovery | L | H | Not in current IA | **P3** |
| M19 | Distribution Engine integration | Publishing | L | H | Not in current IA | **P3** |
| M20 | Duplicate route cleanup | Cross | L | L | Housekeeping | **P3** |

---

## Recommended Sprint Sequencing

```
Sprint P2-02 (Dashboard Integration)
├── M5 — Fix FAKE KPI (replace with Truth Level / remove Math.random)
├── M7 — Wire 5 unconsumed dashboard APIs to UI widgets
└── Output: Dashboard is 100% real data

Sprint P2-03 (Mission Pipeline — CRITICAL)
├── M4 — Complete KnowledgeActionAdapter integration
├── M1 — Wire Action[] to MissionGenerator → Mission API has data
├── M2 — Real Mission Create (not stub)
└── Output: Mission page shows real missions

Sprint P2-04 (Execute + Verify + Timeline)
├── M3 — Real Mission Execute (not stub)
├── M8 — Verification Job Runner → DB persistence
└── Output: Mission → Execute → Verify cycle works

Sprint P2-05 (Timeline Persistence)
├── M6 — Migrate timeline to Prisma
└── Output: All events persisted

Sprint P2-06 (Knowledge Enhancement)
├── M9 — Entity UI tab
├── M10 — Claim UI tab
└── Output: Knowledge full CRUD in UI

Sprint P2-07 (Verification → Health → Growth cross-module)
├── Wire verification results → Health score
├── Wire health → Growth trends
└── Output: Cross-module data flow working

Sprint P2-08 (Evidence Standalone Page)
├── M11 — EvidencePage.vue
└── Output: Evidence management UI

Sprint P2-09 (Health Monitor Widgets)
├── M13 — "Check Published" / "Check Indexed" in HealthPage
└── Output: Monitor fully exposed

Sprint P2-10 (Publishing + Distribution)
├── M12 — Integration with Distribution Engine
└── Output: Publishing functional

Sprint P2-11 (KIE AI Upgrade)
├── M14 — Upgrade KIE from rules to AI
└── Output: Smarter knowledge quality scoring

Sprint P2-12 (BrandOverview Refactor)
├── M15 — Extract super-page into focused sub-pages
└── Output: Clean maintainable BrandOverview

Sprint P2-13 (Security + Housekeeping)
├── M16 — Auth on all routes
├── M20 — Duplicate route cleanup
└── Output: Secure, clean codebase
```

---

## Priority Distribution

| Priority | Count | Cumulative |
|---|---|---|
| P0 | 4 | 4 (must fix before anything) |
| P1 | 4 | 8 (high impact) |
| P2 | 5 | 13 (medium impact) |
| P3 | 7 | 20 (nice to have) |

**Total Actionable Items:** 20
**Estimated Sprints to Complete:** 12 (P2-02 through P2-13)
