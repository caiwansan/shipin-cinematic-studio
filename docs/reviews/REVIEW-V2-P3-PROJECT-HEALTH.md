# Phase 3: Current Project Audit — Project Health Report

**File**: `docs/reviews/REVIEW-V2-P3-PROJECT-HEALTH.md`
**Date**: 2026-07-22
**Task**: GEO Workspace Engineering Review v2 — Phase 3

---

## 1. Executive Summary

The GEO project is a **large, actively developed** workspace with **dual codebases** (legacy + new). 
The new workspace (`frontend/workspaces/geo/`) is the current focus of development with 13 pages, 10 stores, 16 services, and ~20 components. 
The backend (`backend/src/services/geo/`) has 13 subdomains, 28 repositories, 26 routes, and 13 services.

**Overall Health**: ⚠️ Moderate — strong architecture foundation but significant deviance between documentation and reality.

---

## 2. Module Completion Status

### 2.1 Backend Modules

| Module | Status | Lines | Routes | Repos | Notes |
|--------|--------|-------|--------|-------|-------|
| **Routes** | ✅ Complete | - | 26 | - | All routes registered via Fastify |
| **Repositories** | ✅ Complete | - | - | 28 | Repository pattern fully enforced for core |
| **Services** | ✅ Complete | - | - | 13 | Business logic services |
| **Verification** | 🟡 Functional | ~2000 | 1 (verification) | 1 | Engine + policy + job runner all present |
| **Publishing** | ⚠️ Partial | ~500 | 1 (publishing) | ❌ 0 | NO dedicated repository. Uses `publishing-record.repository.ts` from repositories/ but files are in publishing/ _deprecated dir |
| **Monitor** | 🟡 Functional | ~500 | 1 | 1 | Engine + probes (http, index, sitemap) |
| **Growth** | 🟡 Functional | ~1000 | 2 | 1 | Learning engine + optimization executor |
| **Presence** | ⚠️ Partial | - | 1 | - | Multiple AI platform adapters (ChatGPT, Claude, Gemini, etc.) |
| **Provider** | 🟡 Functional | - | - | - | Registry + fallback + shadow mode |
| **Agents** | ⚠️ Partial | - | - | - | 8 agents (citation, claim, entity, evidence, faq, knowledge-graph, research, schema) |
| **Explain** | ✅ Complete | - | 2 | - | 4 providers (discovery, presence, recommendation, verification) |
| **Decision Intelligence** | 🟡 Functional | - | 1 | - | Issue graph builder + registry |
| **V1 Legacy** | ❄️ Frozen | - | 1 | - | V1 product route, should not be extended |

### 2.2 Frontend Modules

#### Workspace Pages (New Architecture)

| Page | Lines | Status | Load/Empty/Error | Notes |
|------|-------|--------|-----------------|-------|
| **GEODashboard** | 795 | ✅ Complete | ✅ All 3 states | Mission Control with KPI, journey, brand table, walkthrough |
| **DiscoveryLabPage** | 1118 | ✅ Complete | ✅ All 3 states | Entity search, ADI score, scenarios, opportunities |
| **HealthPage** | 590 | ✅ Complete | ✅ All 3 states | Brand health + dimensions (embedded version exists) |
| **RecommendationsPage** | 379 | ✅ Complete | ✅ All 3 states | Action plan + recommendations |
| **VerificationPage** | 241 | ✅ Complete | ✅ All 3 states | Entity verification with Explain drawer |
| **PublishingPage** | 347 | ✅ Complete | ✅ All 3 states | Channels, distribution health, history |
| **KnowledgePage** | 420 | ✅ Complete | ✅ All 3 states | Knowledge sources, freshness, statements |
| **GrowthPage** | 370 | ✅ Complete | ✅ All 3 states | Growth metrics, learning signals |
| **ReportCenter** | 127 | ⚠️ Minimal | ❌ Missing states | Bare-bones report display |
| **GEOCreate** | 231 | ✅ Complete | ✅ Loading/Error | Brand creation form |
| **GEODetail** | 272 | ✅ Complete | ✅ Loading/Error | Brand detail view |
| **BrandOverview** | 4339 | ⚠️ Oversized | ✅ All 3 states | Single largest file — needs decomposition |
| **WorkspaceFlowPage** | 440 | 🟡 Functional | ✅ Loading/Error | Stepper-guided workflow (assessment→discovery→opportunity→action-plan→...) |

#### Legacy Pages (Frozen)

| Page | Status | Notes |
|------|--------|-------|
| ExecutionStudioPage | ❄️ Frozen | Layer 1 |
| SystemLensPage | ❄️ Frozen | Layer 2 |
| SystemControlPage | ❄️ Frozen | Layer 3 |
| SystemMetadataPage | ❄️ Frozen | Layer 4 |
| BrandDetailPage | ❄️ Frozen | Phase 2 stub |
| BrandListPage | ❄️ Frozen | Legacy |
| KnowledgeGraphPage | ❄️ Frozen | Legacy |
| ClaimTreePage | ❄️ Frozen | Phase 2 stub |

### 2.3 Design System Components (kmki-ui)

| Component | Status | Notes |
|-----------|--------|-------|
| Badge | ✅ Complete | |
| Card | ✅ Complete | |
| EmptyState | ✅ Complete | |
| Skeleton | ✅ Complete | |
| Timeline | ✅ Complete | |
| Metric | ✅ Complete | |
| DiffViewer | ✅ Complete | |
| StepList | ✅ Complete | |
| ScoreComparison | ✅ Complete | |
| StatusChip | ✅ Complete | |
| HealthIndicator | ✅ Complete | |
| ConfidenceMeter | ✅ Complete | |
| ExplainPanel | ✅ Complete | |
| **Foundations (Design Tokens)** | ❌ Not implemented | `design-system/foundations/` directory doesn't exist. Color/spacing/tokens not extracted to system |

---

## 3. Critical Issues Found

### 🔴 High Severity

| # | Issue | Location | Details |
|---|-------|----------|---------|
| H1 | **Mock Provider as Production Fallback** | `provider/provider-registry.ts:69` | MockProvider is registered and used as fallback in production chain `['deepseek', 'mock']`. If DeepSeek fails, users get mock/simulated data silently |
| H2 | **Publishing Module Missing Repository** | `publishing/` | No dedicated repository. The `publishing-record.repository.ts` exists in `repositories/` but the publishing service files in `publishing/` don't use it. Publishing has 0% DA coverage per v4 freeze |
| H3 | **BrandOverview.vue is 4339 lines** | `frontend/workspaces/geo/pages/BrandOverview.vue` | Single file with all state, rendering, and logic. Massive violation of Single Responsibility. Dangerous to maintain |
| H4 | **Dual Frontend Page Systems** | `legacy/brand-geo/pages/` + `workspaces/geo/pages/` | Two complete page systems coexist. 12 legacy pages + 13 new pages = 25 total. Confusion about which is authoritative |
| H5 | **useFetchWithFallback Composable** | `frontend/composables/useFetchWithFallback.ts` | Composable that silently falls back to mock data on ANY API failure. Masks real failures in production |

### 🟡 Medium Severity

| # | Issue | Location | Details |
|---|-------|----------|---------|
| M1 | **Frontend Freeze Manifest ≠ Reality** | `GEO-FRONTEND-FREEZE-MANIFEST.md` vs live code | Document says "3 data sources only" but live workspace has 10+ stores each with independent API calls |
| M2 | **Closure Map ≠ Reality** | `GEO-CLOSURE-MAP.md` vs live code | Document says 4 product layers. Live code has 13 pages with different layout |
| M3 | **Mock Discovery Scan in UI** | `DiscoveryLabPage.vue:62` | UI text reads "Mock 发现扫描" — exposes implementation detail to user |
| M4 | **Monitor DA Coverage Only 50%** | Per v4 freeze | Only 2 of 4 monitor files have Repository access |
| M5 | **Monitor Migration Gap** | Various | Presence adapters exist but monitor integration with publishing is incomplete |
| M6 | **Publishing Pipeline backend only** | `publishing/publishing.route.ts ` | Route exists but the full pipeline (artifact-renderer, claim, plan, recorder) has no frontend representation beyond PublishingPage |
| M7 | **Adapters: citation adapter only** | `adapters/citation/` | Only one adapter in the adapters directory. Publishing adapters (website, wordpress, shopify, knowledge-base) from architecture design are NOT implemented |
| M8 | **TODO residues minimal but exist** | 3 files | `v1/geo-v1-product.route.ts` has 2 TODOs, `promotion/engine.ts` has 1 TODO |

### 🟢 Low Severity

| # | Issue | Location | Details |
|---|-------|----------|---------|
| L1 | **No responsive media queries (most pages)** | Geo pages | Most pages use `max-width: 960px` centering but no responsive breakpoints except GEODashboard and DiscoveryLabPage have `@media (max-width: 768px)` |
| L2 | **No mobile-first approach** | Layout | GeoWorkspaceLayout has mobile toggle, but no dedicated mobile layout |
| L3 | **Hardcoded user info** | `GeoWorkspaceLayout.vue:32` | `Acme Robotics` hardcoded as user display |
| L4 | **Design Tokens not extracted** | N/A | `design-system/foundations/` referenced in FRONTEND_ARCHITECTURE.md does not exist in codebase |

---

## 4. Mock Data Hardcoding Audit

### Backend Mocks (System-Level)

| File | Line(s) | Type | Impact |
|------|---------|------|--------|
| `provider/provider-registry.ts:69` | 69, 75, 264-268 | MockProvider production fallback | 🔴 Masks real failures |
| `provider/types.ts:20` | 20 | Default provider='mock' | 🔴 Production default is mock |
| `runtime/discovery/discovery-runner-routes.ts:13-14` | 13-14 | Mock provider always registered | 🟡 Always-on mock |
| `runtime/discovery/discovery-runner.ts:65` | 65 | Default provider='mock' | 🟡 Mock as default |

### Frontend Mocks (Application-Level)

| File | Lines | Type | Impact |
|------|-------|------|--------|
| `composables/useFetchWithFallback.ts` | Full file | Mock data fallback composable | 🔴 Silently masks API failures |
| `stores/project.ts:15-16` | 15-16 | MOCK_PROJECTS constant | 🟡 Mock project data |
| `DiscoveryLabPage.vue:62` | 62 | UI text mentions "Mock" | 🟢 Misleading users |
| `BrandOverview.vue:1383` | 1383 | Comment reference to mock | 🟢 Comment only |

---

## 5. API Integration Status

| Frontend Service | Backend Route | Connected? | Notes |
|-----------------|---------------|-----------|-------|
| `healthService.ts` | `geo-dashboard-mission.route.ts` | ✅ Connected | Dashboard mission data |
| `discoveryService.ts` | `geo-discovery.route.ts` | ✅ Connected | Discovery scanning |
| `verificationService.ts` | `geo-verification.route.ts` | ✅ Connected | Verification |
| `publishingService.ts` | No dedicated backend service? | ⚠️ Partial | Publishing route exists but service may not match |
| `recommendationsService.ts` | Various | ⚠️ Partial | Routes exist but mapping unclear |
| `knowledgeService.ts` | `geo-knowledge.route.ts` | ✅ Connected | Knowledge endpoints |
| `growthService.ts` | `growth.route.ts` + `learning.route.ts` | ✅ Connected | Growth + learning |
| `explainService.ts` | `geo-explain.route.ts` | ✅ Connected | Explain engine |
| `reportService.ts` | `geo-report.route.ts` | ✅ Connected | Report generation |
| `scanService.ts` | `geo-scan.route.ts` | ✅ Connected | Brand scanning |
| `walkthroughService.ts` | `geo-walkthrough.route.ts` | ✅ Connected | Walkthrough |

---

## 6. Regression Risk Assessment

| Risk Area | Risk Level | Rationale |
|-----------|-----------|-----------|
| **Dual page systems** | 🔴 High | Any change to a shared composable/store must verify both new AND legacy pages |
| **Silent mock fallback** | 🔴 High | `useFetchWithFallback` hides real API failures — regressions become invisible |
| **BrandOverview.vue (4339 lines)** | 🔴 High | Modifying this file risks breaking multiple features simultaneously |
| **Repository changes** | 🟡 Medium | Repository contract changes affect all consumers |
| **Prisma schema migration** | 🟡 Medium | GEO has 30+ models — schema changes have wide impact |
| **Provider registry changes** | 🟡 Medium | Affects all AI-dependent modules |
| **Legacy-to-new migration** | 🟡 Medium | Only partial migration; some features may still depend on legacy |

---

## 7. Technical Debt Summary

| Category | Items | Severity |
|----------|-------|----------|
| Mock in production path | 6 locations | 🔴 High |
| Dual codebase | 12 legacy pages + 13 new pages | 🔴 High |
| Oversized files | 1 file > 4000 lines | 🔴 High |
| Missing repository | Publishing module | 🔴 High |
| Documentation drift | 3+ documents not matching reality | 🟡 Medium |
| Missing design tokens | Foundations not extracted | 🟡 Medium |
| No responsive design | Most pages desktop-only | 🟢 Low |
| Hardcoded values | User info, UI text | 🟢 Low |

---

*Generated for GEO Engineering Review v2 — Phase 3 Complete*
