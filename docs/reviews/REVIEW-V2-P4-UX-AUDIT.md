# Phase 4: Product Experience Audit (UX Audit)

**File**: `docs/reviews/REVIEW-V2-P4-UX-AUDIT.md`
**Date**: 2026-07-22
**Task**: GEO Workspace Engineering Review v2 — Phase 4

---

## 1. Audit Scope

Audited all 13 workspace pages, the GeoWorkspaceLayout, and walkthrough components from a **final user perspective** (not developer).

---

## 2. Page-by-Page Assessment

### 2.1 GEODashboard (Mission Control)

**Score: 7/10** ✅ Good

**What works:**
- Strong landing page with KPI bar (brand count, avg ADI, AI visibility)
- "Today Progress" + "Continue Journey" sections create task completion feel
- Brand priority table with ADI scores and action buttons
- Walkthrough welcome card for new users (Level 0)
- Loading/Error/Empty states all handled properly
- VIP prompt for authentication/upgrade awareness

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| Hardcoded header user | 🟡 Medium | "Acme Robotics" hardcoded in layout |
| No real-time updates | 🟢 Low | Dashboard doesn't auto-refresh; manual refresh needed |
| Back-link to home | 🟢 Low | "返回首页" link goes to '/' — not clear what home is |

### 2.2 HealthPage (Brand Health)

**Score: 7/10** ✅ Good

**What works:**
- Brand selector dropdown with refresh button
- ADI overall score display with dimension breakdown
- GeoReportViewer integration for detailed reports
- All 3 states (loading/error/empty) properly handled
- Navigation links to Brand List and Knowledge Evaluation

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| Report content depth | 🟡 Medium | Report shows scores but lacks actionable "next steps" section |
| No trend comparison | 🟡 Medium | Shows current state but not how it changed |
| No export functionality | 🟢 Low | No report export |

### 2.3 DiscoveryLabPage

**Score: 8/10** ✅ Good

**What works:**
- Clean entity search with clear empty state guidance
- ADI score card with 3 sub-dimensions (Coverage/Share/Position)
- Scenario Coverage table with pass/fail indicators
- High-priority opportunities list with Expected ADI Gain
- Top 5 scenarios comparison
- Walkthrough guide bar integration
- @media responsive breakpoints present

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| "Mock" in UI text | 🟡 Medium | "Mock 发现扫描" shown to user — should be business language |
| Page complexity | 🟢 Low | 1118 lines, dense information — could overwhelm new users |

### 2.4 RecommendationsPage

**Score: 7/10** ✅ Good

**What works:**
- Impact preview section
- Action list with priority indicators
- Explanation panel integration
- Next steps panel
- All 3 states handled

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| Action execution visible | 🟡 Medium | Execution status visible but "一键执行" might not give enough feedback |
| No batch actions | 🟢 Low | Can only execute one recommendation at a time |

### 2.5 VerificationPage

**Score: 8/10** ✅ Good

**What works:**
- Clean entity input + verification trigger
- Before/After score comparison via GeoVerificationPattern
- Explain drawer integration (RC1-T004)
- Dimension changes visualization
- Evidence list with confidence indicators
- Loading spinner on button, error handling
- Clear subtitle explaining purpose

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| Poor empty state | 🟡 Medium | No empty state when page first loads before any verification |
| No historical comparison | 🟡 Medium | Can only see current verification, not compare with past |
| Result persistence | 🟢 Low | Results disappear on refresh |

### 2.6 PublishingPage

**Score: 7/10** ✅ Good

**What works:**
- Distribution overview (active/total channels)
- Connected channels list with status badges
- Pending updates tracking
- Publishing history (last 5)
- Publish/Update CTA buttons
- Success/Error banners with dismiss/retry
- All 3 states handled

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| "分发" metaphor unclear | 🟡 Medium | Non-Chinese-native users may not understand the publish metaphor |
| No real channels | 🟡 Medium | Backend adapters not implemented — channels may be mock/simulated |
| No preview/diff | 🟡 Medium | Can't preview what will be published before clicking |
| No rollback UI | 🟡 Medium | Architecture defines rollback but no UI button |

### 2.7 KnowledgePage

**Score: 7/10** ✅ Good

**What works:**
- Knowledge score + dimension breakdown via brand health
- Knowledge sources list with freshness badges
- Freshness indicator with progress bar
- Missing knowledge warnings
- Knowledge statements with verified/pending status
- Edit toggle for knowledge base
- All 3 states handled

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| Dual data source confusion | 🟡 Medium | Loads both knowledge store AND health store — unclear boundaries |
| Statement click is no-op | 🟡 Medium | `handleStatementClick` only logs to console — no detail view |
| No knowledge graph | 🟡 Medium | Knowledge graph page exists in legacy but not integrated here |
| No AI feed preview | 🟢 Low | Can't see how knowledge will look to AI systems |

### 2.8 GrowthPage

**Score: 7/10** ✅ Good

**What works:**
- Growth metrics display
- Learning signals visualization
- Opportunity blocks
- Milestone banners
- All 3 states handled

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| No trend chart | 🟡 Medium | Growth direction shown but no historical trend chart |
| Learning signals lack narrative | 🟡 Medium | Shows signals but doesn't tell user "what this means for you" |
| No recommendation learning feedback | 🟡 Medium | User can't see how their actions influenced future recommendations |

### 2.9 BrandOverview

**Score: 5/10** ⚠️ Needs Refactor

**What works:**
- Comprehensive brand detail view
- Entity/Claim/Evidence integration
- ADI score and discovery data
- Knowledge score calculation

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| 4339 lines | 🔴 High | Impossible to maintain. Any single change risks regression |
| Multiple responsibilities | 🔴 High | Combines brand info, discovery, knowledge, verification in one file |
| No clear page purpose | 🟡 Medium | Too many things happening — no single user goal is obvious |

### 2.10 WorkspaceFlowPage (Walkthrough)

**Score: 7/10** ✅ Good

**What works:**
- Step-by-step workflow: Assessment → Discovery → Opportunity → Action Plan → Publish
- WorkflowStepper component for navigation
- Embedded content for each step
- Clear back-to-dashboard link

**Issues:**
| Issue | Severity | Detail |
|-------|----------|--------|
| No completion celebration | 🟢 Low | No confetti or congratulations on completing all steps |
| Step persistence unknown | 🟢 Low | Unclear if progress persists across sessions |

### 2.11 Other Pages

| Page | Score | Notes |
|------|-------|-------|
| GEOCreate | 7/10 | Clean brand creation form |
| GEODetail | 6/10 | Functional but minimal |
| ReportCenter | 4/10 | Very bare — just renders a report with no export/save |

---

## 3. Cross-Cutting Concerns

### 3.1 Navigation & Consistency

| Check | Result | Notes |
|-------|--------|-------|
| Consistent header/footer | ⚠️ Partial | GeoWorkspaceLayout provides consistent header + sidebar, but pages vary in their internal navigation patterns |
| Consistent color scheme | ✅ Good | Geo components use consistent indigo-based color scheme |
| Consistent spacing | ✅ Good | GeoCard, GeoPageHeader create consistent spacing |
| Consistent typography | ⚠️ Partial | Some pages use local scoped styles (PublishingPage, KnowledgePage define their own .geo-btn) |
| Breadcrumbs | ❌ Missing | No breadcrumb navigation on any page |
| Page titles | ✅ Good | `definePageMeta` used on most pages |

### 3.2 Responsive Design

| Check | Result | Notes |
|-------|--------|-------|
| Mobile navigation toggle | ✅ Present | GeoWorkspaceLayout has hamburger menu + overlay |
| Responsive breakpoints | ⚠️ Partial | Only GEODashboard + DiscoveryLabPage have `@media (max-width: 768px)` |
| Desktop-only behavior | ⚠️ Common | Most pages center content at 960px with no mobile adaptation |
| Touch targets | 🟡 Partial | Buttons are reasonable size but not optimized for touch |

### 3.3 State Management

| State | Assessment | Details |
|-------|-----------|---------|
| Loading | ✅ Well handled | GeoPageSkeleton and GeoLoading components used consistently |
| Empty | ✅ Well handled | GeoEmptyState with contextual icons and CTAs on all pages |
| Error | ✅ Well handled | GeoErrorState with retry capabilities on all pages |
| Partial data | 🟡 Partial | Some pages (KnowledgePage) show inline loading for secondary data |
| Optimistic updates | ❌ Missing | No optimistic UI updates on any page |

### 3.4 Accessibility

| Check | Result | Notes |
|-------|--------|-------|
| Keyboard navigation | ⚠️ Partial | Layout has keyboard navigation + focus management |
| ARIA labels | ⚠️ Partial | Some components have aria-labels, but not comprehensive |
| Focus management | ⚠️ Partial | Layout has focus-visible, but pages don't manage focus on navigation |
| Color contrast | 🟠 Cannot Verify | No automated test run |
| Screen reader support | 🟠 Cannot Verify | No screen reader testing done |

### 3.5 AI Explainability

| Check | Result | Notes |
|-------|--------|-------|
| Explain buttons on scores | ✅ Present | GeoExplainButton + ExplainDrawer integrated |
| Issue Graph access | ✅ Present | Decision Intelligence Panel with Issue Graph |
| Score breakdown | ✅ Present | Dimension-level breakdown with colored bars |
| Before/After comparison | ✅ Present | GeoVerificationPattern shows diff |
| AI confidence indicators | ✅ Present | ConfidenceMeter in kmki-ui |

---

## 4. UX Score Summary

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Mission Control (Dashboard) | 7/10 | Good |
| Brand Discovery → Optimization → Verification flow | 7/10 | Good — walkthrough helps |
| Knowledge Hub page | 7/10 | Good |
| Publishing Walkthrough | 6/10 | Functional but no real adapters |
| Issue Graph / Explainability | 8/10 | Excellent — best feature |
| Loading/Empty/Error states | 8/10 | Well handled everywhere |
| Mobile responsive | 4/10 | Desktop-first, mobile weak |
| Visual consistency | 7/10 | Good but with local style overrides |
| Accessiblity | 4/10 | Basic keyboard nav only |

**Overall UX Score: 6.5/10** — Functional and well-structured but not polished for mobile or accessibility.

---

## 5. Top UX Improvements (Priority Order)

| # | Improvement | Impact | Effort | Current State |
|---|------------|--------|--------|---------------|
| 1 | Remove "Mock" from DiscoveryLab UI text | High | Low | Shows "Mock 发现扫描" to users |
| 2 | Implement Publishing Adapter real backends | High | High | Simulated channels only |
| 3 | Add mobile responsive layouts | High | Medium | Desktop-only |
| 4 | Add breadcrumb navigation | Medium | Low | No breadcrumbs anywhere |
| 5 | Split BrandOverview.vue (4339 lines) | High | Large | Single monolithic file |
| 6 | Knowledge statement detail view | Medium | Low | Clicking statement does nothing |
| 7 | Verification trend comparison | Medium | Medium | No historical compare |
| 8 | Publishing preview/diff | Medium | Medium | Publish without preview |
| 9 | Publishing rollback UI | Medium | Medium | Architecture defined, no UI |
| 10 | Report export functionality | Medium | Medium | ReportCenter minimal |

---

*Generated for GEO Engineering Review v2 — Phase 4 Complete*
