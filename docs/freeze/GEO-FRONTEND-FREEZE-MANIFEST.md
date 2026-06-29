# GEO Frontend Freeze Manifest

**File**: `docs/freeze/GEO-FRONTEND-FREEZE-MANIFEST.md`
**Status**: ENFORCED
**Freeze Date**: 2026-07-30
**Next Review**: Phase 2 启动前

---

## 1. API Contract Freeze（硬约束）

### ❌ 禁止路径（禁止新增任何前端调用）
```
/api/geo/dashboard/*
/api/geo/tasks/*
/api/geo/brands/*
/api/geo/projects/*/snapshot
/api/geo/projects/*/brand-profile
```

### ✅ 唯一允许的 API Scope

#### Execution Core（唯一合法）
```
GET  /api/projects/:id/hydrate
GET  /api/geo/watcher/*
POST /api/geo/projects/:id/discover
POST /api/geo/projects/:id/graph/build
POST /api/geo/knowledge-quality
```

#### Graph Read
```
GET /api/geo/projects/:id/graph
GET /api/geo/projects/:id/graph/edges
```

---

## 2. State Layer Freeze（状态系统冻结）

### ❌ 禁止项
- `useBrandGeoStore` 扩展（禁止新增 state / fetch）
- `useGeoStore` / `useGEOStore` 分叉接入 brand-geo
- 任何新 store 引入 brand / task / dashboard 概念

### ✅ 唯一允许的 state model
```
useGeoHydrate()  —  唯一状态入口
```

### 规则
- ❌ 不允许任何 page 独立 fetch API
- ❌ 不允许 multiple store compose state
- ❌ 不允许 page-level cache state
- ✅ 所有 Panel 必须是纯派生组件（derived from hydrate）

### 已清理项（确认 0 外部引用）
| File | Status |
|------|--------|
| `useBrandGEORuntime.ts` | ❄️ Deprecated — 0 imports |
| `useBrandGeoStore` (22 fetch functions) | ❄️ Deprecated — no UI consumers |
| `store.fetchDashboardStats` | 🗑️ removed from call graph |
| `store.fetchBrands` / `fetchVisibility` / `fetchCitations` / `fetchTopics` / `fetchCompetitors` | 🗑️ removed |
| `store.fetchTasks` / `store.createTask` | 🗑️ removed |
| `store.fetchProjects` / `store.createProject` | 🗑️ removed |

### 仍活跃的 store 函数（保留）
| Function | Consumer |
|----------|----------|
| `fetchV2Projects` | ProjectSelectPage |
| `createV2Project` | ProjectCreatePage |
| `createGraphNode` | KnowledgeGraphPage |
| `createGraphEdge` | KnowledgeGraphPage |

---

## 3. UI Module Boundary Freeze

### Layer 1 — Execution Core UI（唯一允许扩展）
```
ExecutionPanel.vue
InspectorPanel.vue
GeoDashboard.vue
KnowledgeGraphPage.vue
```

- ✅ 可以继续优化
- ❌ 不能新增业务 domain

### Layer 2 — UI Shell（结构层）
```
BrandGEOSidebar.vue
BrandGEOWorkspace.vue
ProjectSelectPage.vue
ProjectCreatePage.vue
```

- ✅ 只允许 layout / 路由修改
- ❌ 不允许业务逻辑进入

### Layer 3 — Frozen Modules（绝对冻结）
| Page | Status |
|------|--------|
| `BrandProfilePage.vue` | ❄️ Stub — Phase 2 Module |
| `WebsiteScannerPage.vue` | ❄️ Stub — Phase 2 Module |
| `SemanticExplorer.vue` | ❄️ Dead page — no route |
| `Tasks UI` | ❄️ No backend |

- ✅ 只能 stub
- ❌ 不允许接 API
- ❌ 不允许恢复 store fetch

---

## 4. Data Flow Rule（强制单向数据流）

```
API → useGeoHydrate → Derived Panels
```

### ❌ 禁止
- Panel → API（独立 fetch）
- Panel → store → API（绕过 hydrate）
- store → store cross-call

### ✅ 唯一合法路径
```
Panel calls useGeoHydrate() composable
  → loads GET /api/projects/:id/hydrate
  → loads GET /api/geo/watcher/recent
  → derives all Panel state
```

---

## 5. Architecture Lock / Advisory

### 已锁定的架构决策

| Decision | Status |
|----------|--------|
| GEO is an Execution System, not a Brand SaaS | ✅ Locked |
| Data root is ProjectID → hydrate | ✅ Locked |
| Watcher is read-only feedback | ✅ Locked |
| No Brand / Task / Dashboard API expansion | ❄️ Frozen |
| No new stores for GEO | ❄️ Frozen |
| Phase 2 = VIP gates + Project lifecycle | 📋 Planned |

### 系统三层模型（确认）
```
Layer 1: Execution Core   → stable   （3 pages: Dash/Exec/Inspector/KnowledgeGraph）
Layer 2: UI Shell         → stable   （Sidebar / ProjectSelect / Topbar）
Layer 3: Brand Extension  → frozen   （stub only）
```

---

## 6. Enforcement

在 `docs/freeze/` 目录下锁定此 Manifest。以下 merge 规范：

- **禁止** PR 包含禁止路径的 API 调用
- **禁止** PR 新增 GEO store 或 composable
- **禁止** PR 恢复已冻结的 fetch 函数
- **允许** PR 修改 `useGeoHydrate.ts`（唯一可扩展的 composable）
- **允许** PR 修改 ExecutionPanel / InspectorPanel（唯一可扩展的 Panel）

---

*Next: Phase 2 — GEO Productization Map & VIP Feature Gate integration*
