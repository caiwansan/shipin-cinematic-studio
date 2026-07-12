# Phase 5: Architecture Review

**File**: `docs/reviews/REVIEW-V2-P5-ARCH-REVIEW.md`
**Date**: 2026-07-22
**Task**: GEO Workspace Engineering Review v2 — Phase 5

---

## 1. Executive Architecture Assessment

**Overall Architecture Score: 78/100** ⚠️ Good foundation, significant execution gaps

| Dimension | Score | Assessment |
|-----------|-------|------------|
| High Cohesion / Low Coupling | 75/100 | ✅ Good domain boundaries, ⚠️ but dual page systems |
| AI-First / Config-Driven | 70/100 | ✅ Provider registry + fallback, ⚠️ mock in production path |
| Repository Pattern | 90/100 | ✅ Enforced core, ⚠️ publishing missing |
| DDD / Clean Architecture | 75/100 | ✅ Domain modules, ⚠️ mixed concerns in large files |
| Plugin / Registry Pattern | 85/100 | ✅ Strong use of registries |
| Scalability | 70/100 | ⚠️ Mock-dependent, no proper async queue |
| Maintainability | 65/100 | ⚠️ Dual codebase, 4339-line file, doc drift |

---

## 2. High Cohesion / Low Coupling Analysis

### What's Good
- **Domain decomposition**: 13 well-identified subdomains (verification, publishing, growth, monitor, presence, agents, etc.)
- **Repository isolation**: Core modules don't import Prisma — enforced by linter
- **Service independence**: Route → Service → Repository chain is consistently followed
- **Registry pattern**: Plugins/adapters register at runtime without hardcoding

### What Needs Work
| Issue | Impact | Detail |
|-------|--------|--------|
| **Dual page systems** | 🔴 High | `legacy/brand-geo/` and `workspaces/geo/` serve same purpose. Cross-imports create hidden coupling |
| **BrandOverview.vue 4339 lines** | 🔴 High | Combines brand info, discovery, knowledge, verification — violates Single Responsibility |
| **GEO ↔ KH boundary** | 🟡 Medium | KDP was GEO's Distribution Plane, now Knowledge Hub claims it. Unclear migration path |
| **Monitor DA coverage 50%** | 🟡 Medium | Monitor still has direct Prisma access in half its code |
| **Growth DA coverage 16%** | 🟡 Medium | Growth module mostly bypasses Repository |

### Recommendations
1. **Delete legacy pages** once the new workspace pages fully cover all functionality
2. **Split BrandOverview.vue** into HealthPage + DiscoveryLabPage + KnowledgePage components
3. **Finalize GEO-KH boundary**: Either fully migrate KDP to KH or keep it in GEO
4. **Complete Repository migration** for Monitor and Growth subdomains

---

## 3. AI-First / Config-Driven Analysis

### What's Good
- **ProviderRegistry**: Central AI provider management with registration/fallback
- **ShadowMode**: A/B testing between providers
- **FallbackChain**: Configurable provider priority
- **Capability naming**: `verification.run`, `publishing.preview` naming convention frozen

### What Needs Work
| Issue | Impact | Detail |
|-------|--------|--------|
| **Mock as production fallback** | 🔴 High | `['deepseek', 'mock']` chain means mock data served on DeepSeek failure |
| **Default provider = 'mock'** | 🟡 Medium | `GEO_AI_PROVIDER` defaults to 'mock' — production may not override |
| **No proper routing** | 🟡 Medium | Capability Registry defined in architecture but not used in code — still service-level dispatch |
| **No cost tracking in UI** | 🟢 Low | CostManager exists in platform but not surfaced to user |

### Recommendations
1. **Remove mock from production fallback chain** — fail loud on provider failure
2. **Make default provider config mandatory** — CI check if `'mock'` appears in production path
3. **Implement Capability Router** — replace service-level if/else with capability dispatch
4. **Surface AI cost in dashboard** — let users see per-call costs

---

## 4. Repository / DDD / Clean Architecture Analysis

### Repository Pattern

**Enforcement Status:**
| Subdomain | DA Coverage | Status |
|-----------|------------|--------|
| Core (svc+route) | 100% | ✅ Complete |
| Runtime | 100% | ✅ Complete |
| Verification | 100% | ✅ Complete (1 repo) |
| Monitor | 50% | ⚠️ 2/4 implementations remain |
| Growth | 16% | ⚠️ 5/6 remain |
| Publishing | 0% | ❌ NO repository |

### Clean Architecture (Layering)

**Backend:**
```
Route → Service → Repository → Prisma
```
✅ Consistent throughout core modules
❌ Publishing module bypasses layering

**Frontend:**
```
Page (stateful) → Service (API) → API
Page → Store (state) → Service → API
```
⚠️ Two patterns coexist: some pages use stores, some call services directly

### DDD Assessment
- **Bounded contexts**: Well-identified (Verification, Publishing, Monitor, Growth, etc.)
- **Domain entities**: Clean Prisma models with proper `@@map` conventions
- **Repository isolation**: Good — repositories return domain types, not Prisma types
- **Aggregates**: Not well defined — no explicit aggregate root patterns

### Recommendations
1. **Create Publishing repository** — highest priority missing piece
2. **Complete Monitor + Growth Repository migration**
3. **Define explicit aggregate roots** — especially for Project → Brand → Claim → Evidence chain
4. **Consolidate frontend data access** — choose store pattern or service pattern, not both

---

## 5. Plugin Registry Architecture Analysis

### Registries (Existing)

| Registry | Type | Consumer | Status |
|----------|------|----------|--------|
| ProviderRegistry | provider registration | AI dispatch | ✅ Active |
| ExplainRegistry | explain providers | Explain engine | ✅ Active |
| ReportRegistry | report sections | GeoReportViewer | ✅ Active |
| SectionRegistry | report sections | GeoReportViewer | ✅ Active |
| StatusRegistry | status configs | Verification | ✅ Active |
| WidgetRegistry | widgets | Verification | ✅ Active |
| PriorityRegistry | priority configs | Verification | ✅ Active |
| ProbeRegistry | monitor probes | Monitor engine | ✅ Active |
| PackagingAdapterRegistry | packaging | KDP | ⚠️ Partial |
| PublishingAdapterRegistry | publishing | Publishing pipeline | ❌ Not implemented |

### Assessment
- **Good**: Registry pattern is well-established and consistently used
- **Missing**: PublishingAdapterRegistry from architecture doc is not implemented
- **Improvement**: Registries lack standard discovery/health-check interface

### Recommendations
1. Implement PublishingAdapterRegistry with standard interface
2. Add `health()` and `capabilities()` to all registries (per ADR-020)
3. Add telemetry to registry lookups (success/failure rates)

---

## 6. Scalability Assessment

### Current State
- **Verification**: InMemoryJobRunner — verification jobs run synchronously in-process
- **Growth**: In-process aggregation — no message queue
- **Publishing**: Direct execution — no distributed queue
- **Provider**: Synchronous HTTP calls — no retry queue for external API calls

### Scalability Concerns
| Concern | Risk | Detail |
|---------|------|--------|
| No async job queue | 🔴 High | All jobs run in-process. A single long-running verification blocks the server |
| InMemoryJobRunner | 🟡 Medium | Cannot survive server restart; jobs lost on crash |
| No retry infrastructure | 🟡 Medium | Provider calls have retry logic but no exponential backoff or dead letter queue |
| No distributed processing | 🟡 Medium | Single-instance — cannot scale horizontally |

### Recommendations
1. **Implement proper job queue** — BullMQ or Redis-based for verification jobs
2. **Add retry with exponential backoff** for all provider calls
3. **Separate verification from request-response cycle** — async processing with webhook/progress
4. **Add health checks for long-running operations**

---

## 7. Maintainability Assessment

### Current Issues

| Issue | Impact | Detail |
|-------|--------|--------|
| **Dual frontend codebases** | 🔴 High | 12 legacy pages + 13 new pages = confusion |
| **Documentation drift** | 🔴 High | At least 3 documents (Closure Map, Frontend Manifest, Blueprint) don't match reality |
| **BrandOverview.vue 4339 lines** | 🔴 High | Impossible to maintain or understand |
| **MockProvider always on** | 🟡 Medium | Debugging is harder when mock data masks real results |
| **No test coverage data** | 🟡 Medium | Only 3 test files found in GEO backend |
| **TODO residues** | 🟢 Low | Only 3 TODOs — well managed |

### Code Health Metrics

| Metric | Frontend | Backend |
|--------|----------|---------|
| Total files | ~150+ (geo) | ~200+ (geo) |
| Largest file | 4339 lines (BrandOverview) | 515 lines (verification/engine.ts) |
| Files > 500 lines | 3 | 3 |
| Test files | 0 | 3 |
| Mock data locations | 4 | 6 |
| Direct API calls | 16 services | 26 routes |

### Recommendations
1. **Delete legacy frontend** — consolidate on `workspaces/geo/`
2. **Enforce file size limits** — CI check for files > 500 lines
3. **Update all frozen documents** to match current architecture
4. **Add integration tests** for all 26 routes (at minimum)
5. **Remove MockProvider from production path**

---

## 8. Architecture Strengths (What to Preserve)

| Strength | Why It Matters |
|----------|----------------|
| Repository Pattern enforcement | Ensures clean data access, testability |
| Registry/Plugin architecture | Allows extension without modification |
| State management consistency | Loading/Error/Empty states on every page |
| Domain decomposition | Clear boundaries between subdomains |
| Explain/Decision Intelligence | Differentiated AI capability |
| Walkthrough system | Reduces user onboarding friction |
| Verification Engine | Truth-oriented, no simulated scoring |

---

## 9. Architecture Score Calculation

| Criterion | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Repository Pattern | 15% | 90 | 13.5 |
| Layer Separation | 15% | 80 | 12.0 |
| AI-First / Config-Driven | 15% | 70 | 10.5 |
| DDD / Bounded Contexts | 10% | 75 | 7.5 |
| Plugin/Registry | 10% | 85 | 8.5 |
| Scalability | 10% | 70 | 7.0 |
| Maintainability | 15% | 65 | 9.75 |
| Documentation Alignment | 10% | 55 | 5.5 |

**Total Architecture Score: 74.25/100**

---

*Generated for GEO Engineering Review v2 — Phase 5 Complete*
