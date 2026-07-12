# Frontend Architecture Audit — Kunlun Mirror (昆仑镜)

**Audit Date:** 2026-07-03  
**Focus Areas:** GEO workspace, mock detection, large files, shell components  
**Project Root:** `/root/shipin-cinematic-studio/frontend`

---

## 1. GEO Workspace — Page Components

### Page Inventory (workspaces/geo/pages/)

| Page | Lines | Status | Network Calls |
|------|-------|--------|--------------|
| BrandOverview.vue | **5024** ⚠️ | Real data | Stores + raw `fetch()` |
| DiscoveryLabPage.vue | **1141** ⚠️ | Real data | Via `useDiscoveryStore` → `discoveryService` |
| GEODashboard.vue | 832 | Real data | Via `dashboardMissionService` |
| PublishingPage.vue | 817 | Real data | Via `usePublishingStore` → `publishingService` |
| HealthPage.vue | 577 | Real data | Via `useHealthStore` → `healthService` |
| KnowledgePage.vue | 406 | Real data | Via `useKnowledgeStore` → `knowledgeService` |
| WorkspaceFlowPage.vue | 391 | Real data | Via `useWorkflowStore` |
| GrowthPage.vue | 369 | Real data | Via `useGrowthStore` → `growthService` |
| RecommendationsPage.vue | 380 | Real data | Via `useRecommendationsStore` → `recommendationsService` |
| GEODetail.vue | 269 | Real data | Via stores |
| GEOCreate.vue | 220 | Real data | Via `useGeoProjectStore` |
| VerificationPage.vue | 259 | Real data | Via `useVerificationStore` → `verificationService` |
| ReportCenter.vue | 133 | Real data | Via `reportService` |

**Verdict:** All 13 GEO pages make real API calls. No shell/mock pages detected.

---

## 2. StoryGraph.vue & VideoComposition.vue — Shell Verification

**Files DO NOT EXIST anywhere in the project.**  
Searched recursively under `/root/shipin-cinematic-studio/frontend/` — zero matches for `StoryGraph` or `VideoComposition`. These were removed or renamed since the previous audit.

---

## 3. Large Files (>1000 Lines)

| File | Lines | Severity | Notes |
|------|-------|----------|-------|
| **BrandOverview.vue** | **5024** | 🔴 CRITICAL | Monolithic: template(1441) + script(~1000) + styles(~2600) |
| pages/hdz/workspace/[id].vue | 4521 | 🔴 CRITICAL | HDZ workspace — out of scope |
| studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue | 3661 | 🔴 CRITICAL | Already flagged in previous audit |
| studio-v2/workspace/storyboard/StoryboardWorkspace.vue | 1705 | 🟡 HIGH | Storyboard workspace |
| studio-v2/workspace/script-analysis/ScriptAnalysisWorkspace.vue | 1484 | 🟡 HIGH | Script analysis |
| studio-v2/workspace/music-generation/MusicGenerationWorkspace.vue | 1210 | 🟡 HIGH | Music generation |
| studio-v2/workspace/character-design/CharacterWorkspace.vue | 1208 | 🟡 HIGH | Character design |
| pages/director-os/aigc/market.vue | 1204 | 🟡 HIGH | Admin page |
| **DiscoveryLabPage.vue** | **1141** | 🟡 HIGH | GEO workspace — 2nd largest in GEO |
| pages/admin/aigc/market.vue | 1062 | 🟡 HIGH | Admin page |

**GEO-specific large files: BrandOverview.vue (5024) and DiscoveryLabPage.vue (1141).**

---

## 4. Mock Data Detection

**Patterns searched:** `mock`, `fake`, `stub`, `shell`  
**Scope:** All `.vue`, `.ts`, `.js` files (excluding node_modules/.nuxt/.output)  
**Results:** **ZERO matches.**

No mock data, fake implementations, stubs, or shell components found anywhere in the frontend codebase.

---

## 5. Data Fetching Pattern Analysis

### GEO Architecture (Clean)

```
Page Component → Pinia Store → Service Layer → API Client → Backend
```

- **API Client:** `workspaces/geo/services/api.ts` — single `ofetch`-based client, base URL `/api/geo`, auth token injection
- **Services (15+):** `dashboardService`, `verificationService`, `publishingService`, `discoveryService`, `healthService`, `growthService`, `knowledgeService`, `scanService`, `reportService`, etc.
- **Stores (Pinia, 11 total):** `useGeoProjectStore`, `useDiscoveryStore`, `useWorkflowStore`, `useVerificationStore`, `usePublishingStore`, `useScanStore`, etc.
- **All services use** `geoApi` — confirmed via grep: **50+ `geoApi` call sites** across all service files

### Data Flow by Page
- **DiscoveryLabPage.vue:** → `useDiscoveryStore` → `discoveryService` → `geoApi`
- **GEODashboard.vue:** → `dashboardMissionService` → `geoApi`
- **GEOCreate.vue:** → `useGeoProjectStore` → `apiCall` → `geoApi`
- **PublishingPage.vue:** → `usePublishingStore` → `publishingService` → `geoApi`
- **All other GEO pages:** Follow same store → service → `geoApi` pattern ✓

---

## 6. Issues Found

### 🔴 Critical: BrandOverview.vue (5024 lines) — Monolithic Mega-Component

This single file contains:
- **Template:** ~1441 lines (dozens of sections: header, completeness, identity, knowledge, optimization scores, explain drawer, AI presence, truth summary, provider stats, timeline, verification, action plans)
- **Script setup:** ~1000+ lines with 12+ separate async data-loading functions, multiple helper functions, computed properties
- **Styles:** ~2600 lines of scoped CSS

**Problems:**
1. **Mixed data fetching patterns** — Some sections use stores (`projectStore.loadBrand()`), others use raw `window.fetch()` directly (e.g., `/api/geo/brands/${id}/optimizations`, `/api/geo/brands/${id}/explain`, `/api/geo/brands/${id}/presence`, `/api/geo/brands/${id}/verify`)
2. **Bypasses service layer** — Raw `fetch()` calls miss error handling and auth injection patterns from the service layer
3. **Simulated loading animations** — Several functions (`loadOptimizations`, `loadExplain`, `loadPresence`, `runVerification`) have fake `setTimeout` step animations before real network calls, fusing UX animation logic with data loading
4. **Impossible to unit test** — No separation of concerns; data loading, rendering, and UI state are all tangled

### 🟡 High: Inconsistent API Client Usage

- Most services use `geoApi` (ofetch-based, handles auth, consistent error responses)
- `explainService.ts` uses raw `window.fetch()` instead of `geoApi`
- `BrandOverview.vue` uses raw `window.fetch()` for 5+ endpoints
- This duplicates auth header logic and bypasses centralized error handling

### 🟡 High: DiscoveryLabPage.vue (1141 lines)

- 2nd largest GEO page
- Script section is moderate (132 lines), but template + styles make it large
- Better structured than BrandOverview — uses store → service pattern consistently
- Still large enough to warrant splitting

### 🟡 Medium: Simulated Loading Step Anti-Pattern

Multiple data-loading functions across BrandOverview.vue have patterns like:
```typescript
optStepIndex.value = 0
await new Promise(r => setTimeout(r, 600))  // fake delay
optStepIndex.value = 1
await new Promise(r => setTimeout(r, 500))  // fake delay
// ... then real network call
```

This adds artificial delays (1.5+ seconds total) and couples UX animation with data fetching, making both harder to maintain independently.

---

## 7. Summary

| Category | Finding | Severity |
|----------|---------|----------|
| **GEO Pages** | All 13 pages fetch real data — no shell pages | ✅ Clean |
| **StoryGraph.vue** | **Does not exist** in the codebase | 🟡 Removed |
| **VideoComposition.vue** | **Does not exist** in the codebase | 🟡 Removed |
| **Mock/Fake/Stub data** | **None found** anywhere in frontend | ✅ Clean |
| **Large files (GEO)** | BrandOverview.vue (5024 lines), DiscoveryLabPage.vue (1141 lines) | 🔴 Critical |
| **Large files (all)** | 11 files exceed 1000 lines | 🟡 Several |
| **API clients** | 2 patterns: `geoApi` (ofetch) and raw `fetch()` — inconsistent | 🟡 High |
| **Data fetching** | Store → Service → API pattern is well-designed | ✅ Good |
| **UX coupling** | `setTimeout` animations fused into data-loading code | 🟡 Medium |
