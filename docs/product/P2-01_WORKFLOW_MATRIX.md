# Workflow Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## 1. Complete User Journey (as designed)

```
[Step 1] 创建品牌 ───→ /workspace/geo/create
[Step 2] 工作台     ───→ /workspace/geo/dashboard
[Step 3] 知识库     ───→ /workspace/geo/knowledge
[Step 4] 优化中心    ───→ /workspace/geo/recommendations
[Step 5] 任务       ───→ /workspace/geo/mission
[Step 6] 任务执行    ───→ POST /missions/execute
[Step 7] 验证       ───→ /workspace/geo/verification
[Step 8] 品牌健康    ───→ /workspace/geo/health
[Step 9] 成长       ───→ /workspace/geo/growth
[Step 10] 持续任务    ───→ Daily mission loop
```

## 2. Current Reality Check

### Step 1 → Step 2: Create → Dashboard

| Check | Status | Details |
|---|---|---|
| Create page exists | ✅ | GEOCreate.vue |
| API real | ✅ | POST /api/geo/projects → DB |
| Redirect after create | ✅ | To GEODetail or GEODashboard |
| Dashboard shows new brand | ✅ | GET /api/geo/projects |
| **Result** | ✅ **WALKABLE** | |

---

### Step 2 → Step 3: Dashboard → Knowledge

| Check | Status | Details |
|---|---|---|
| Navigation enabled | ✅ | Nav item "知识库" is clickable |
| Knowledge page loads | ✅ | GET /api/geo/knowledge returns real data |
| Add KO works | ✅ | POST /api/geo/knowledge → real DB |
| Quality score displays | ✅ | GET /api/geo/knowledge-quality |
| **Result** | ✅ **WALKABLE** | |

---

### Step 3 → Step 4: Knowledge → Optimization

| Check | Status | Details |
|---|---|---|
| KIE produces insights | ✅ | Rule engine runs |
| Insight → Action pipeline | ❌ **BROKEN** | KnowledgeActionAdapter not wired |
| Recommendations API | ✅ | GET /api/geo/recommendations returns data |
| Recommendations UI | ✅ | Can see list, detail, score |
| **Result** | ⚠️ **PARTIAL** — Recommendations page works, but action generation from Knowledge is broken |

---

### Step 4 → Step 5: Optimization → Mission

| Check | Status | Details |
|---|---|---|
| Recommendation → Action → Mission pipeline | ❌ **BROKEN** | This is the critical gap |
| Mission list API | ✅ | GET /api/geo/missions returns HTTP 200 |
| Mission data | ❌ **EMPTY** | ❌ Returns [] — generator has no input |
| Mission UI renders | ✅ | MissionWorkspacePage.vue renders empty state |
| **Result** | ❌ **BLOCKED** — Pipeline breaks here |

---

### Step 5 → Step 6: Mission → Execute

| Check | Status | Details |
|---|---|---|
| Mission exists to execute | ❌ | Empty list — nothing to execute |
| Execute API | ❌**STUB** | POST /api/geo/missions/:id/execute is stub |
| **Result** | ❌ **BLOCKED** — Pipeline ends at empty mission list |

---

### Step 6 → Step 7: Execute → Verification

| Check | Status | Details |
|---|---|---|
| Execute → Verification linkage | ❌**Not connected** | No automation |
| Manual verification | ✅ | POST /api/geo/verification/run works |
| Verification history | ✅ | GET /api/geo/verification/history works |
| **Result** | ⚠️ **PARTIAL** — Manual verification works, but no automatic trigger from mission execution |

---

### Step 7 → Step 8: Verification → Health

| Check | Status | Details |
|---|---|---|
| Verification → Health score linkage | ❌**Not connected** | No cross-module data flow |
| Health page works | ✅ | GET /api/geo/health/:projectId works |
| **Result** | ⚠️ **PARTIAL** — Health page is independently functional, not fed by verification results |

---

### Step 8 → Step 9: Health → Growth

| Check | Status | Details |
|---|---|---|
| Health → Growth linkage | ❌**Not connected** | No cross-module data flow |
| Growth page works | ✅ | GET /api/geo/growth/:projectId works |
| **Result** | ⚠️ **PARTIAL** — Growth page is independently functional, not fed by health |

---

### Step 9 → Step 10: Growth → Daily Mission Loop

| Check | Status | Details |
|---|---|---|
| Growth → Mission loop | ❌**Not connected** | Return to mission from growth refreshes empty list |
| **Result** | ❌ **BLOCKED** — Cannot complete the loop without Mission data |

---

## 3. Walkability per Step

| Step | Design | Reality | Status |
|---|---|---|---|
| 1. Create Brand | ✅ | ✅ | ✅ WALKABLE |
| 2. Dashboard | ✅ | ✅ | ✅ WALKABLE |
| 3. Knowledge | ✅ | ✅ | ✅ WALKABLE |
| 4. Optimization | ✅ | ⚠️ (KIE→Action broken) | ⚠️ PARTIAL |
| 5. Mission | ✅ | ❌ Empty list | ❌ BLOCKED |
| 6. Execute Mission | ✅ | ❌ No missions + stub API | ❌ BLOCKED |
| 7. Verification | ✅ | ⚠️ Manual only | ⚠️ PARTIAL |
| 8. Health | ✅ | ⚠️ Not fed by verification | ⚠️ PARTIAL |
| 9. Growth | ✅ | ⚠️ Not fed by health | ⚠️ PARTIAL |
| 10. Daily Loop | ✅ | ❌ Cannot loop without missions | ❌ BLOCKED |

**Fully Walkable Steps:** 3/10 (30%)
**Partially Walkable:** 4/10 (40%)
**Blocked:** 3/10 (30%)

---

## 4. Data Flow Diagram (Reality)

```
Create → Dashboard → Knowledge → Recommendations → [BROKEN] → Mission → [BLOCKED]
                ↓                                  ↓                    ↓
           BrandOverview                  Manual Verify            Empty list
                ↓                                  ↓
           Presence Engine                  Verification history
                ↓
           Explain Engine
```

---

## 5. Critical Gap Analysis

| Gap | Location | Impact | Fix Required |
|---|---|---|---|
| KIE Insight → Action | KnowledgeActionAdapter | Mission empty, Optimization disconnected | Wire adapter to production data |
| Mission Execute → Verification | Mission → Verification loop | No automated verification after task completion | Add auto-verification trigger |
| Verification → Health | Verification → Health score | Health doesn't reflect verification results | Add cross-module data feed |
| Health → Growth | Health → Growth | Growth doesn't use health trends | Add cross-module data feed |
| Cross-module Timeline | All modules | No unified event history | DB-persisted Timeline engine |
