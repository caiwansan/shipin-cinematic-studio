# Sprint 3 — Workspace Productization

**Duration:** 2 weeks (Weeks 5–6)
**Priority:** P3 (items 7–9) + P4 (items 10–12)

## Goal

Transform GEO from a single-tenant prototype into a multi-tenant product with proper error UX, score visualization, audit trails, and onboarding.

## Backlog

| ID | Task | Effort | Status |
|----|------|--------|--------|
| GEO-301 | UI Error Explain — Frontend-friendly error messages for GEO pipeline failures (timeout, provider down, invalid project) | M | ⬜ |
| GEO-302 | Score Timeline Chart — Chart.js/Recharts component showing visibility/knowledge/content over time | L | ⬜ |
| GEO-303 | Consumer Activity Log — Structured log viewer in dashboard showing each consumer execution + duration + result | M | ⬜ |
| GEO-304 | Tenant Workspace Model — `tenant_id` isolation on all GEO tables, workspace-scoped API keys | XL | ⬜ |
| GEO-305 | RBAC — Owner / Admin / Viewer roles per workspace | M | ⬜ |
| GEO-306 | Usage Quotas — Rate limits, scan quotas per tenant tier | M | ⬜ |
| GEO-307 | OpenAPI/Swagger docs — All GEO endpoints documented with examples | L | ⬜ |
| GEO-308 | Onboarding Wizard — Brand registration → provider config → first scan guided flow | L | ⬜ |
| GEO-309 | System tests — Multi-tenant isolation, RBAC enforcement, quota limits | M | ⬜ |

## Definition of Done

- [ ] All GEO pipeline errors show human-readable messages in the UI
- [ ] Score trends visible over 7/30/90 day windows
- [ ] Consumer activity logs accessible in dashboard
- [ ] Workspace isolation: Tenant A cannot see Tenant B's data
- [ ] RBAC enforced: Viewer cannot create/modify resources
- [ ] API docs published at `/api/docs`
- [ ] Onboarding wizard works end-to-end
- [ ] Dogfood score ≥ 9.5/10
