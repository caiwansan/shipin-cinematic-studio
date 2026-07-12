# Phase 2: Architecture Understanding

**File**: `docs/reviews/REVIEW-V2-P2-ARCH-UNDERSTANDING.md`
**Date**: 2026-07-22
**Task**: GEO Workspace Engineering Review v2 — Phase 2

---

## 1. Overall Product Positioning

GEO Workspace is the **first productized workspace** on the **Brand Knowledge OS** platform.

```
Brand Knowledge OS (Platform)
  └── GEO Workspace (AI brand visibility optimization)
  └── Drama Workspace (short drama production)
  └── Novel Workspace (novel production)
  └── PPT Workspace (presentation production)
  └── ... (future workspaces)
```

**Core Loop (8 stages):**
```
Build → Analyze → Report → Optimize → Execute → Publish → Verify → Monitor
```

**Platform Hierarchy:**
```
KMKI Platform Constitution (29 immutable rules)
  └── KMKI Platform Blueprint v2.1
        ├── Center Specifications (AI/Capability/Gateway/Runtime/etc)
        ├── Workspace Specifications
        │     └── Workspace Adapter (translation layer)
        └── Implementation Guides
              └── KMKI Implementation Baseline v1.0
```

---

## 2. Four-Layer Architecture (GEO-specific)

The `GEO-PATTERN-GUIDELINES.md` defines the frontend architecture specifically:

```
Workspace Page (Stateful)
      │
      ▼
Geo Pattern / Geo Viewer (Stateless)
      │
      ▼
Registry (Extension Points)
      │
      ▼
Geo Components (Domain UI)
      │
      ▼
kmki-ui (Base UI Components)
      │
      ▼
Design Tokens (CSS Variables)
```

### Layer Responsibilities

| Layer | Responsibility | Files (Live) |
|-------|---------------|--------------|
| **Workspace Page** | State, data fetching, user input | `pages/GEODashboard.vue`, `HealthPage.vue`, etc. (13 pages) |
| **Geo Pattern/Viewer** | Stateless container, pure render | `GeoVerificationPattern/`, `GeoReportViewer/` |
| **Registry** | Extension points, dynamic registration | `lib/registry.ts`, `report-registry.ts`, `status-registry.ts` |
| **Geo Components** | Domain-level UI | `GeoScoreCard/`, `GeoCard/`, `GeoBadge/`, `GeoMetricCard/` |
| **kmki-ui** | Base UI (no business semantics) | `components/kmki-ui/Badge/`, `Card/`, `EmptyState/`, `Skeleton/` |
| **Design Tokens** | CSS variables | Spacing/Color/Typography/Radius/Elevation/Motion |

---

## 3. Backend Architecture (Route → Service → Repository)

### Data Access Chain (Enforced by Linter)
```
Route → Service → Repository → Prisma
```

**Enforcement Status (GEO-V4-CORE-FREEZE):**
- Core modules (svc+route): 100% Repository-ized ✅
- 26 service files: 0 direct Prisma imports ✅
- 27 Repository files in `repositories/` ✅
- Runtime: 100% ✅
- Verification: 100% ✅ (1 repository)
- Monitor: 50% ⚠️ (2 of 4 remaining)
- Growth: 16% ⚠️ (5 of 6 remaining)
- Publishing: 0% ❌ (no dedicated repository)

### Route Layer (26 route files)
```
geo-action-plan
geo-brand           geo-claim         geo-dashboard
geo-dashboard-mission geo-deliverable geo-discovery
geo-entity          geo-evidence      geo-explain-engine
geo-explain         geo-graph         geo-history
geo-keyword         geo-knowledge     geo-knowledge-quality
geo-optimization    geo-presence      geo-project
geo-report          geo-scan          geo-showcase
geo-trace           geo-verification  geo-walkthrough
geo-watcher
```

### Repository Layer (28 files)
```
geo-project.repository    geo-claim.repository
geo-entity.repository     geo-evidence.repository
geo-citation.repository   geo-faq.repository
geo-schema.repository     geo-quality.repository
geo-brand-profile         geo-brand-setting
geo-keyword               geo-scan-history
geo-score-snapshot        geo-freshness
geo-review                optimization-execution
publishing-record         verification-result
geo-entity-relation       geo-project-version
api-key                   llm-usage-record
resource-credential       user-model-config
workspace-runtime         workspace-snapshot
GEOReportRepository       geo-watcher
```

### Service Layer (13 service files)
```
geo-project.service     geo-quality.service
geo-entity.service      geo-claim.service
geo-evidence.service    geo-faq.service
geo-schema.service      geo-freshness.service
geo-graph.service       geo-persistence.service
geo-review.service      geo-report-generator.service
geo-report-v2.service
```

---

## 4. Domain Modules (13 subdomains)

```
geo/
├── action-plan/           # Action plan engine & builder
├── adapters/citation/     # Citation data adapters
├── agents/               # AI agents (entity, claim, evidence, faq, schema, etc.)
├── decision-intelligence/ # Issue graph, strategy patterns
├── explain/              # Explain engine (discovery/presence/recommendation/verification)
├── growth/               # Learning engine, optimization executor, monitor
├── knowledge-learning/   # Knowledge candidate, promotion, review
├── lifecycle/            # Lifecycle aggregator
├── monitor/              # Monitor engine, probes (http, index, sitemap)
├── presence/             # AI presence adapters (ChatGPT, Claude, Gemini, etc.)
├── provider/             # Provider registry, fallback, benchmark
├── publishing/           # Publishing service, claim, plan, manifest
├── recommendation/       # Recommendation engine
├── registry/             # Registry (domain specific)
├── routes/               # 26 route files (listed above)
├── repositories/         # 28 repository files (listed above)
├── runtime/              # Discovery, generation, golden, replay, provider, prompt
├── services/             # 13 service files (listed above)
├── showcase/             # Showcase service
├── utils/                # Utilities
├── verification/         # Verification engine, policy, job runner
├── v1/                   # Legacy v1 routes
├── walkthrough/          # Guided walkthrough
└── workflow/             # Workflow definitions
```

---

## 5. Key Architectural Patterns

### 5.1 Repository Pattern (Enforced)
- All database access through Repository layer
- Service layer never imports Prisma directly
- Repository files in `services/[domain]/repositories/` directory
- Architecture linter validates at CI level

### 5.2 Registry / Extension Pattern
- `createRegistry<T>()` for type-safe extensible registries
- Used in: Explain engine, Publishing adapters, Monitor probes, Report sections, Verification widgets
- Registry pattern allows runtime registration without code modification

### 5.3 Provider Pattern (AI capabilities)
- `ProviderRegistry` with fallback chain
- `ShadowMode` for A/B testing between providers
- Fallback chain: `['deepseek', 'mock']`
- Mock provider always registered as fallback

### 5.4 Pattern / Viewer Pattern (Frontend)
- Pages = stateful (loading/error/data)
- Patterns/Viewers = stateless (props in, events out)
- GeoVerificationPattern example: receives report props, emits actions

### 5.5 State Machine Pattern
- VerificationJob: `pending → running → completed/failed → retrying`
- PublishingRecord: `draft → approved → publishing → published → rolled_back`
- DistributionPlan: `draft → pending_review → approved → distributing → completed`

---

## 6. Pipeline Architectures

### 6.1 Verification Pipeline
```
Recommendation
  → Optimization Executor (creates OptimizationExecution)
  → Verification Engine triggers
    → GeoScorer re-scores
    → Creates GeoScoreSnapshot
    → Calculates delta
    → Creates VerificationResult
  → Growth Memory aggregate update
  → Learning Engine (weighted signals)
  → Recommendation weight adjustment
```

### 6.2 Knowledge Distribution Pipeline (KDP → Knowledge Hub)
```
PublishingRecord
  → KnowledgeAsset (human/search/AI three layers)
  → DistributionPlan (auto-generated, user approved)
  → DistributionTask (attempt-based)
  → 5 adapters: Sitemap / RSS / Knowledge Feed / robots.txt / AI Crawl Manifest
  → Delivery (local: static site)
```

### 6.3 Publishing Pipeline
```
draft → approved → publishing → published → verified_online → indexed
                                                 ↘ failed → retry
                                                 ↘ rolled_back
```

---

## 7. Frontend Workspace Architecture

### Page Structure (Live — 13 pages)
```
/workspace/geo/dashboard        → GEODashboard.vue (Mission Control)
/workspace/geo/health           → HealthPage.vue (Brand Health report)
/workspace/geo/discovery        → DiscoveryLabPage.vue (AI Discovery)
/workspace/geo/recommendations  → RecommendationsPage.vue
/workspace/geo/verification     → VerificationPage.vue
/workspace/geo/publishing       → PublishingPage.vue
/workspace/geo/knowledge        → KnowledgePage.vue
/workspace/geo/growth           → GrowthPage.vue
/workspace/geo/report/:id       → ReportCenter.vue
/workspace/geo/create           → GEOCreate.vue
/workspace/geo/detail/:id       → GEODetail.vue
/workspace/geo/brand/:id        → BrandOverview.vue (4339 lines — largest page)
/workspace/geo/workflow         → WorkspaceFlowPage.vue
```

### Store Layer (10 stores)
```
useAdiStore, useDiscoveryStore, useGeoProjectStore, useGrowthStore,
useHealthStore, useKnowledgeStore, usePublishingStore, useRecommendationsStore,
useScanStore, useVerificationStore, useWorkflowStore
```

### Services Layer (14 service files)
```
adiService, api, dashboardMissionService, discoveryService, diService,
explainService, growthService, healthService, knowledgeService,
publishingService, recommendationsService, reportService, scanService,
showcaseService, verificationService, walkthroughService
```

---

## 8. Frontend Freeze Constraints

Three frozen layers (from `GEO-FRONTEND-FREEZE-MANIFEST.md`):

| Layer | Pages | Status |
|-------|-------|--------|
| Layer 1 — Execution Core | ExecutionStudioPage (legacy) | ✅ Stable |
| Layer 2 — Lens (seeing) | SystemLensPage | ✅ Stable |
| Layer 3 — Control | SystemControlPage | ✅ Stable |
| Layer 4 — Metadata | SystemMetadataPage | ✅ Stable |

**But the live workspace has a DIFFERENT set of pages** — the 13 `workspaces/geo/pages/` are the NEW architecture, while `legacy/brand-geo/pages/` holds the OLD pages. The freeze manifest applies to legacy.

---

## 9. Key Architecture Decisions (ADRs)

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-020 | Brand Domain separate from Execution | ✅ Frozen |
| ADR-001 (Platform) | Runtime layering | ✅ Active |
| ADR-002 (Platform) | Repository pattern | ✅ Active |
| ADR-005 (Platform) | Capability contract | ✅ Active |
| ADR-011 (Platform) | Plugin registry | ✅ Active |
| ADR-012 | Workspace runtime | ✅ Active |
| ADR-014 | Merge gate | ✅ Active |

---

## 10. Architecture Consistency Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Dual page systems | 🟡 Medium | Legacy `/legacy/brand-geo/pages/` (12 pages) AND new `/workspaces/geo/pages/` (13 pages) exist simultaneously |
| Old store still active | 🟡 Medium | `useBrandGeoStore` in legacy still exists, used by legacy pages |
| Frontend freeze vs reality | 🟡 Medium | Freeze Manifest says "3 data sources only" but new pages use 10+ stores with individual service files |
| GEO vs KH overlap | 🟡 Medium | KDP Packaging started under GEO, Knowledge Hub now claims it as platform-level |
| Publishing backend incomplete | 🔴 High | Publishing module has NO repository, only route + service files. Missing full DB persistence |
| Monitor backend partial | 🟡 Medium | Monitor has 50% DA coverage per v4 freeze |

---

*Generated for GEO Engineering Review v2 — Phase 2 Complete*
