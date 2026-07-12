# Phase 6: Engineering Rules — Updated Execution Standards

**File**: `docs/reviews/REVIEW-V2-P6-ENGINEERING-RULES.md`
**Date**: 2026-07-22
**Task**: GEO Workspace Engineering Review v2 — Phase 6

---

## 1. Development Workflow (Default)

Every GEO development task MUST follow this sequence:

```
Phase 1: Context Recovery
  1. Read GEO_PRODUCT_WHITEPAPER_V1.md (product constitution)
  2. Read relevant architecture docs for the module
  3. Read relevant Sprint Brief / Backlog items
  4. Check Feature Gate (all 6) before starting
  5. Read latest reviews/audits for module context

Phase 2: Assessment
  1. Determine impact scope (which pages/services/routes/repos)
  2. Check for existing mock data in the path
  3. Check for existing TODO/FIXME markers
  4. Identify regression risk areas
  5. Check Frontend Freeze Manifest for constraints

Phase 3: Design Review
  1. Propose approach (for architecture-impacting changes)
  2. Document ADR if needed
  3. Wait for approval before implementation

Phase 4: Implementation
  1. Backend: Route → Service → Repository (never direct Prisma)
  2. Frontend: Page (state) → Pattern/Viewer (render) → Components (UI)
  3. UI First: every backend capability must have visible UI
  4. Config Driven: prefer registries over if/else
  5. Business Language: no "Prisma", "Repository", "mock" visible to users

Phase 5: Verification
  1. Build: npx tsc --noEmit (zero errors)
  2. Prisma: prisma generate + prisma validate
  3. Frontend: TypeScript check on changed files
  4. Architecture Linter: bash scripts/architecture-linter.sh
  5. Unit Tests: existing tests still pass (npm test)

Phase 6: Regression Check
  1. GEO workspace pages load without errors
  2. Legacy brand-geo pages (if still active) load without errors
  3. Knowledge Hub pages unaffected
  4. Drama/Novel/PPT workspace routes unaffected
  5. Dashboard/Admin/User routes unaffected

Phase 7: Deployment
  1. PM2 Restart (if backend changes)
  2. Health Check (all critical endpoints return 200)
  3. Nuxi Build (if frontend changes)
  4. Verify production: at least one user flow end-to-end

Phase 8: Documentation
  1. Update TASK_RESULT with Demo Changes section
  2. Document API changes in relevant docs
  3. Update CAPABILITY_MATRIX if new capability added
  4. Update FRONTEND_ARCHITECTURE if pages/stores change
```

---

## 2. Prohibited Patterns (Hard Block)

### ❌ NEVER Do These

| # | Pattern | Reason | Example |
|---|---------|--------|---------|
| P1 | **Direct Prisma import in service/route** | Violates Repository pattern | `import { prisma } from '...'` in geo-project.service.ts |
| P2 | **Mock as production fallback** | Masks real failures | `provider: 'mock'` in production path |
| P3 | **useFetchWithFallback for GEO** | Silently returns fake data | Mock fallback on any API failure |
| P4 | **Architecture-bypassing shortcuts** | Erodes separation of concerns | Service calling another service's repository |
| P5 | **Internal terms in UI** | Confuses users | "Prisma", "Repository", "state machine" in user-facing text |
| P6 | **Files > 500 lines** | Violates Single Responsibility | BrandOverview.vue at 4339 lines |
| P7 | **New store imports for legacy pages** | Freeze violation | New page using useBrandGeoStore |
| P8 | **New frozend API endpoints** | Freeze violation | Creating `/api/geo/dashboard/*` endpoints |
| P9 | **Invisible features** | No user value | Backend-only changes with no UI |
| P10 | **Skipping Feature Gate** | Product alignment failure | Starting Sprint without Gate-1 through Gate-6 |

---

## 3. Mandatory Patterns (Hard Requirement)

### ✅ ALWAYS Do These

| # | Pattern | Description | Check |
|---|---------|-------------|-------|
| M1 | **Route → Service → Repository → Prisma** | Data access chain strictly enforced | Linter Module 15 |
| M2 | **Loading/Error/Empty states on every page** | All 3 states must be handled | Manual review |
| M3 | **UI First** | Every Sprint must have visible frontend change | Sprint review |
| M4 | **Registry pattern for extension points** | No if/else for platform-specific logic | Code review |
| M5 | **Business language in user-facing text** | No internal jargon | UI review |
| M6 | **Feature Gate before Sprint** | All 6 gates must pass | Backlog entry |
| M7 | **Document everything** | API/UI/UX changes must be documented | PR checklist |
| M8 | **Cross-workspace regression** | Verify GEO, Drama, Novel, PPT, KH unaffected | Manual test |
| M9 | **Architecture Linter pass** | Zero violations | CI job |
| M10 | **Demo Script** | Every Sprint must include "what users can see now" | TASK_RESULT |

---

## 4. Repository Pattern Enforcement

### Current Coverage Targets

| Subdomain | Current | Target | Deadline |
|-----------|---------|--------|----------|
| Core (svc+route) | ✅ 100% | Maintain 100% | Continuous |
| Runtime | ✅ 100% | Maintain 100% | Continuous |
| Verification | ✅ 100% | Maintain 100% | Continuous |
| Monitor | ⚠️ 50% | 100% | Next Sprint |
| Growth | ⚠️ 16% | 100% | Next Sprint |
| Publishing | ❌ 0% | 100% | Next Sprint |

### Rule
- Any new route/service on Monitor, Growth, or Publishing MUST:
  1. Create a dedicated Repository file in `repositories/`
  2. Not import Prisma directly
  3. Pass Architecture Linter check

---

## 5. Frontend Architecture Rules

### Store vs Service Pattern
- Pages SHOULD use Stores for state management
- Services SHOULD be called through Stores, not directly
- Exception: simple data fetching without state (use composable)

### Component Hierarchy
```
Page (stateful, data fetching)
  → Pattern/Viewer (stateless, pure render)
    → Geo Component (domain)
      → kmki-ui (generic)
        → Design Tokens (CSS variables)
```

### Page Standards
Every page MUST implement:
1. **Loading state** — GeoPageSkeleton or GeoLoading
2. **Empty state** — GeoEmptyState with contextual guidance
3. **Error state** — GeoErrorState with retry
4. **Data state** — meaningful content with CTAs

### File Size Limit
- **Hard limit: 500 lines per file**
- Exception: Vue template + script + style (max 600 lines combined)
- **BrandOverview.vue** MUST be split — creates immediate technical debt

---

## 6. Mock Data Policy

### Production Code
- ❌ No mock data in production provider chain
- ❌ No `useFetchWithFallback` with mock data for GEO APIs
- ✅ Mock only allowed in:
  - Unit tests
  - Development/Staging environment only
  - Feature flag gated (isMockEnabled)

### Existing Mock Cleanup
| Location | Action | Priority |
|----------|--------|----------|
| ProviderRegistry mock fallback | Remove from production chain | 🔴 Critical |
| DiscoveryRunner default provider='mock' | Change to 'deepseek' or fail | 🔴 Critical |
| Provider types default provider='mock' | Remove default | 🟡 High |
| DiscoveryLab UI "Mock" text | Replace with business language | 🟡 High |
| useFetchWithFallback | Remove GEO usage | 🟡 High |
| Stores/project.ts MOCK_PROJECTS | Remove | 🟡 Medium |

---

## 7. Publishing Module Requirements

The Publishing module is the single biggest architectural gap. Fix targets:

| Requirement | Details | Priority |
|-------------|---------|----------|
| Create PublishingRepository | Full CRUD for PublishingRecord | P0 |
| Implement PublishingAdapterRegistry | Standard interface | P0 |
| Wire frontend to real backend | PublishingPage → real API | P0 |
| Add rollback support | per architecture design | P1 |
| Add preview/diff | Before/after content comparison | P1 |
| Add status monitoring | Publishing→Monitor integration | P1 |

---

## 8. Documentation Standards

### Keep These Updated
| Document | Update Trigger | Owner |
|----------|---------------|-------|
| GEO_PRODUCT_WHITEPAPER_V1.md | Major feature addition | Product |
| GEO_WORKSPACE_BLUEPRINT_V1.md | Page changes | Frontend |
| GEO_CAPABILITY_MATRIX_V1.md | Capability status changes | Engineering |
| GEO_FRONTEND_ARCHITECTURE.md | Architecture changes | Frontend |
| GEO-CLOSURE-MAP.md | Page structure changes | Architecture |
| GEO-FRONTEND-FREEZE-MANIFEST.md | API contract changes | Architecture |

### Document Drift Monitoring
- Monthly: Compare Closure Map, Frontend Manifest, Blueprint against live code
- Flag any discrepancy > 2 weeks old as technical debt

---

## 9. Cross-Workspace Compatibility

Every GEO change MUST verify:
1. **Knowledge Hub** — KH routes/services unaffected
2. **Drama Workspace** — `/hdz/*` routes unaffected
3. **Novel Workspace** — `/novel/*` routes unaffected
4. **PPT Workspace** — not yet live but schema compatible
5. **Admin** — `/admin/aigc/*` routes unaffected
6. **User** — `/user/*` routes unaffected
7. **Legacy GEO pages** — if still active, verify them too

---

## 10. Sprint Completion Checklist

```markdown
## Sprint Completion Verification

### Build & Lint
- [ ] npx tsc --noEmit (zero errors)
- [ ] prisma generate (zero errors)
- [ ] bash scripts/architecture-linter.sh (zero violations)
- [ ] Frontend TypeScript check (zero errors)

### Tests
- [ ] Existing unit tests pass
- [ ] New integration tests for changed routes
- [ ] No test regressions

### UX / Product
- [ ] All 3 states (loading/error/empty) verified
- [ ] UI First: user-visible change exists
- [ ] Business language: no internal jargon in UI
- [ ] Demo Script documented in TASK_RESULT

### Cross-Workspace Regression
- [ ] GEO pages load correctly
- [ ] Knowledge Hub pages load correctly
- [ ] Drama / Novel / PPT workspace routes unaffected
- [ ] Admin / User routes unaffected

### Deployment
- [ ] PM2 Restart (if backend)
- [ ] Health Check (endpoints return 200)
- [ ] Nuxi Build (if frontend)
- [ ] Production E2E verified

### Documentation
- [ ] TASK_RESULT includes Demo Changes section
- [ ] CAPABILITY_MATRIX updated (if needed)
- [ ] FRONTEND_ARCHITECTURE updated (if pages/stores changed)
```

---

*Generated for GEO Engineering Review v2 — Phase 6 Complete*
