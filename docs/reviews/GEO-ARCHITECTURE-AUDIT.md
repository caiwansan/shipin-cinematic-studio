# GEO 全工程收敛审计报告（Architecture Convergence Audit）

> 状态: 完成 · 日期: 2026-07-17 · 审计版本: v1.0

---

## 1. 工程全景总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        🎯 用户层 (pages/workspace/geo.vue)               │
│                   渲染 BrandGEOWorkspace（入口唯一但指向半成品）           │
├─────────────────────────────────────────────────────────────────────────┤
│                  📱 Brand GEO 前端 (15 活跃文件 + 4 页面)                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ pages/(7) · services/(6) · stores/(1) · composables/(1)         │   │
│  │ components/(2) · config/(2) · BrandGEOWorkspace.vue              │   │
│  │ ⚠️ 100% 的 API 调用 → 后端不存在 → 运行即 404                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│               🧩 KMKI GEO 前端 (12 文件 — 确认死代码)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ pages/(2) · components/(6) · runtime/(1) · store/(1)             │   │
│  │ services/(1) · types/(1)                                         │   │
│  │ ✅ 零外部引用：grep "modules/geo" 仅模块自身内引用                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                  ⚙️ KMKI GEO 后端 (36+ 文件，全部 OK)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ routes/(4) · services/(11) · repositories/(8) · agents/(8)       │   │
│  │ registry/(4) · types/(1) · index/(1)                             │   │
│  │ ✅ 4 routes 已注册，23 endpoints 全部可访问                        │   │
│  │ ❌ 0 auth middleware · 8/8 agents are stubs · 18+ 缺失 endpoints  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ DB: 19 模型（15 KMKI + 5 Brand − 1 重复）= 17 独特表              │   │
│  │ ❌ 2 套 Project 模型 · 5 模型缺 FK (QualityScore/Freshness 等)    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                       🏗️ 平台层 (集成现状)                                │
│  Auth ❌ · Membership ❌ · Permission ❌ · Asset Center ❌                │
│  Storage ❌ · Workspace Runtime ❌ · Capability Runtime ⚠️ (框架在但全 stub) │
└─────────────────────────────────────────────────────────────────────────┘
```

**关键数字**: 36+ 后端文件 · 29 前端文件 · 19 DB 模型 · 23 后端端点 · 18+ 前端无效端点 · 8/8 代理全存根 · 882 TS 错误（GEO 仅 8） · 7 平台能力 ❌缺失 · 13 个 mapPrisma 重复函数

---

## 2. Platform Integration 完成度

### 2.1 Auth

| 指标 | 值 |
|---|---|
| 状态 | ❌ Missing |
| 平台 Auth | `backend/src/plugins/auth.ts` — 已注册，有 jwt verify + AI_API_PREFIXES 拦截 |
| GEO Route 使用 | **零** — `grep -rn "authenticate\|preHandler\|onRequest" geo/routes/` → 0 命中 |
| Brand 前端 | `services/utils.ts:9-20` — 手动 `getAuthHeaders()` 从 localStorage/\_\_NUXT\_\_ 读 token |
| Store 认证 | `useBrandGeoStore.ts:103-118` — 手动 `authHeaders()`，同上逻辑 |
| 后果 | 任何知道路径的人可能调 /api/geo/\* 而不需要 token |

**Gap**: GEO 后端完全不验证 token。平台 authPlugin 已注册但只拦截 `AI_API_PREFIXES`（`/api/ai/*`），GEO 路径不在其列。

### 2.2 Membership & Permission

| 指标 | 值 |
|---|---|
| 状态 | ❌ Missing |
| 证据 | 系统中无 `GeoPermission`/`GeoRole` 模型或概念。GEO routes 无角色/权限检查 |

**Gap**: GEO 无任何权限概念。所有用户等价，数据无隔离。

### 2.3 Workspace Runtime

| 指标 | 值 |
|---|---|
| 状态 | ❌ Missing |
| Brand GEO | `composables/useBrandGEORuntime.ts` (~280 行) — 独立运行时 |
| KMKI GEO | `runtime/geo.runtime.ts` (~80 行) — 独立运行时 |
| 平台 | `modules/platform/workspace/store/useWorkspaceStore.ts` — 已存在但未被 GEO 使用 |

**Gap**: 两个 GEO 各自有独立 Runtime，功能重叠，均未对接平台 WorkspaceStore。

### 2.4 Project Center

按收敛方案 §5.1，GeoProject 作为 GEO 领域概念保留，本次不合并到平台 Project Center。

### 2.5 Asset Center

| 指标 | 值 |
|---|---|
| 状态 | ❌ Missing |
| Brand 前端 | `pages/AssetCenterPage.vue` — 完整页面但无后端 |
| 平台后端 | `backend/src/routes/asset/asset.route.ts` — 存在（try/catch 动态导入） |

**Gap**: Asset Center 页面完整，无后端，平台 Asset Runtime 已存在但未对接。

### 2.6 Storage

| 指标 | 值 |
|---|---|
| 状态 | ❌ Missing |
| 证据 | GEO 无任何存储功能实现 |

### 2.7 Capability Runtime

| 指标 | 值 |
|---|---|
| 状态 | ⚠️ Partial |
| 后端 | `capability.runtime.js` 已初始化（index.ts:548-577） |
| Sprint 1B Agents | 调用 `ctx.capabilities.llm.generate()` — 架构正确 |
| Sprint 1A Agents | 不通过 Capability Runtime — 直接返回硬编码 stub |
| 根因 | KQ route:256-267 注入的是 `createStubLLM()`，导致所有 5 个 1B agent 底层仍是假数据 |

**Gap**: 8/8 agents 全部是 stub。1B 架构正确但底层被 `createStubLLM` 阻断；1A 完全不通过 Capability Runtime。

### 2.8 Platform Integration 总结

| 能力 | 状态 | 优先级 (Phase) |
|---|---|---|
| Auth | ❌ Missing | Phase 1 |
| Membership | ❌ Missing | Phase 1 |
| Permission | ❌ Missing | Phase 1 (若已有，可本期不做) |
| Workspace Runtime | ❌ Missing | Phase 3 |
| Project Center | 📝 N/A (按收敛方案决策) | — |
| Asset Center | ❌ Missing | Phase 1 |
| Storage | ❌ Missing | Phase 4 (低优先级) |
| Capability Runtime | ⚠️ Partial | Phase 2 |

---

## 3. 后端全景扫描

### 3.1 Routes

#### geo-project.route.ts — 7 endpoints

| Method | Path | Auth | Stub | Status |
|---|---|---|---|---|
| POST | /api/geo/projects | ❌ | ❌ | ✅ |
| GET | /api/geo/projects | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:id | ❌ | ❌ | ✅ |
| PUT | /api/geo/projects/:id | ❌ | ❌ | ✅ |
| DELETE | /api/geo/projects/:id | ❌ | ❌ | ✅ (软删) |
| POST | /api/geo/projects/:id/snapshot | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:id/versions/:version | ❌ | ❌ | ✅ |

#### geo-entity.route.ts — 7 endpoints

| Method | Path | Auth | Stub | Status |
|---|---|---|---|---|
| POST | /api/geo/projects/:projectId/discover | ❌ | ❌ | ✅ |
| GET | /api/geo/entities/:id | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:projectId/entities | ❌ | ❌ | ✅ |
| PUT | /api/geo/entities/:id | ❌ | ❌ | ✅ |
| POST | /api/geo/entities/:sourceId/relations | ❌ | ❌ | ✅ |
| GET | /api/geo/entities/:id/relations | ❌ | ❌ | ✅ |
| GET | /api/geo/entities/:id/provenance | ❌ | ❌ | ✅ |

#### geo-graph.route.ts — 6 endpoints

| Method | Path | Auth | Stub | Status |
|---|---|---|---|---|
| POST | /api/geo/projects/:projectId/graph/build | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:projectId/graph | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:projectId/graph/node/:entityId | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:projectId/graph/edges | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:projectId/graph/versions/:version | ❌ | ❌ | ✅ |
| GET | /api/geo/projects/:projectId/graph/visualize | ❌ | ❌ | ✅ |

#### geo-knowledge-quality.route.ts — 2 endpoints

| Method | Path | Auth | Stub | Status |
|---|---|---|---|---|
| POST | /api/geo/knowledge-quality | ❌ | `createStubLLM()` | 🟡 运行但 stub |
| GET | /api/geo/knowledge-quality/health | ❌ | ❌ | ✅ |

**总计: 4 route 文件 · 23 endpoints · 0 auth · 1 明显 stub · 20 功能完整 · 2 stub 影响全部 8 agents**

#### 注册状态 (index.ts)
- L431: `geo-project.route.js` ✅ 已注册
- L432: `geo-entity.route.js` ✅ 已注册
- L433: `geo-graph.route.js` ✅ 已注册
- L436: `geo-knowledge-quality.route.js` ✅ 已注册
- 所有 4 个 route 文件均已注册，无未注册 route

#### Brand 前端缺失端点 (~18)

| 端点 | Store 行 | 后端状态 |
|---|---|---|
| GET /api/geo/brands | L495 | 🔴 不存在 |
| GET /api/geo/brands/:id/visibility | L512 | 🔴 不存在 |
| GET /api/geo/brands/:id/citations | L530 | 🔴 不存在 |
| GET /api/geo/brands/:id/topics | L547 | 🔴 不存在 |
| GET /api/geo/brands/:id/competitors | L564 | 🔴 不存在 |
| POST /api/geo/dashboard/stats | L581 | 🔴 不存在 |
| GET /api/geo/dashboard/stats | L581 | 🔴 不存在 |
| POST /api/geo/tasks | L658 | 🔴 不存在 |
| GET /api/geo/tasks | L641 | 🔴 不存在 |
| GET /api/geo/brands/:id/entities | L682 | 🔴 不存在 |
| GET /api/geo/brand/:projectId | L279 | 🔴 不存在 |
| PUT /api/geo/brand/:projectId | L293 | 🔴 不存在 |
| POST /api/geo/scan | L340 | 🔴 不存在 |
| GET /api/geo/scan/:id/status | L355 | 🔴 不存在 |
| GET /api/geo/snapshot/:projectId | L364 | 🔴 不存在 |
| GET /api/geo/projects/:id/graph/nodes | L382 | 🔴 存在但路径不匹配 |
| POST /api/geo/projects/:id/graph/nodes | L400 | 🔴 不存在 |
| POST /api/geo/graph/edges | L440 | 🔴 不存在 |

### 3.2 Services

| Service | Sprint | Repo | Status | 备注 |
|---|---|---|---|---|
| geo-project.service.ts | 1A | ❌ 直接Prisma | ✅ 完整 | mapPrismaProject |
| geo-entity.service.ts | 1A | ❌ 直接Prisma | ✅ 完整 | mapPrismaEntity/Relation |
| geo-graph.service.ts | 1A | ❌ 直接Prisma | ✅ 完整 | mapPrismaEntity/Relation (重复) |
| geo-claim.service.ts | 1B | ✅ | 🟡 70% | 缺批量查询 |
| geo-evidence.service.ts | 1B | ✅ | 🟡 65% | 缺 delete |
| geo-citation.service.ts | 1B | ✅ | 🟡 60% | 缺 delete |
| geo-faq.service.ts | 1B | ✅ | 🟡 70% | 缺 delete |
| geo-schema.service.ts | 1B | ✅ | 🟡 65% | 缺 delete |
| geo-review.service.ts | 1B | ✅ | 🟡 50% | 新模块 |
| geo-quality.service.ts | 1B | ✅ | 🟡 40% | 评分待完善 |
| geo-freshness.service.ts | 1B | ✅ | 🔴 30% | 仅框架 |

### 3.3 Repositories

| Repository | Status | 缺操作 | mapPrisma | 行数 |
|---|---|---|---|---|
| geo-claim.repository.ts | 🟡 70% | 无 | mapPrismaClaim | ~95 |
| geo-evidence.repository.ts | 🟡 65% | 无 delete | mapPrismaEvidence | ~90 |
| geo-citation.repository.ts | 🟡 60% | 无 delete | mapPrismaCitation | ~85 |
| geo-faq.repository.ts | 🟡 70% | 无 | mapPrismaFAQ | ~80 |
| geo-schema.repository.ts | 🟡 60% | 无 delete | mapPrismaSchema | ~85 |
| geo-review.repository.ts | 🟡 50% | 多个操作 | mapPrismaReview | ~65 |
| geo-quality.repository.ts | 🟡 40% | 多个操作 | mapPrismaScore | ~55 |
| geo-freshness.repository.ts | 🔴 30% | 仅基础 | mapPrismaFreshness | ~45 |

**⚠️ 13 个 mapPrisma\* 函数重复，无 Repository base class**

### 3.4 Agents

| Agent | Sprint | Real LLM | Stub | 注册方式 | Status |
|---|---|---|---|---|---|
| research.agent.ts | 1A | ❌ | ✅ 硬编码 stub | agentService.register() | 🔴 |
| entity.agent.ts | 1A | ❌ | ✅ generateStubEntities() | agentService.register() | 🔴 |
| knowledge-graph.agent.ts | 1A | ❌ | ✅ 纯映射，无 LLM | agentService.register() | 🔴 |
| claim.agent.ts | 1B | ⚠️ | ⚠️ createStubLLM 注入 | workflow-registration | 🟡 |
| evidence.agent.ts | 1B | ⚠️ | ⚠️ 同上 | workflow-registration | 🟡 |
| citation.agent.ts | 1B | ⚠️ | ⚠️ 同上 | workflow-registration | 🟡 |
| faq.agent.ts | 1B | ⚠️ | ⚠️ 同上 | workflow-registration | 🟡 |
| schema.agent.ts | 1B | ⚠️ | ⚠️ 同上 | workflow-registration | 🟡 |

**关键发现: 8/8 agents 全部是 stub。1B agents 架构正确（PromptRegistry + capabilities），但 KQ route L256 注入 createStubLLM，因此底层仍是假数据。**

### 3.5 Registry & Workflow

- **geo-prompt-registry.ts**: 5 个 prompt（claim.extract / evidence.gather / citation.format / faq.generate / schema.generate）
- **geo-registry.ts**: Sprint 1A 的 3 个 agent 配置
- **geo-workflow.ts**: WorkflowBuilder + WorkflowDispatcher（DAG, retry, timeout, continueOnFailure 均支持）
- **geo-workflow-registration.ts**: 仅 1 workflow（geo.knowledge-quality），DAG 结构:
  ```
  claim → [evidence → citation]
       └→ [faq → schema]
  ```

**⚠️ 注册不一致**: 1A agents 通过 `agentService.register()`（平台），1B agents 通过 `geo-workflow-registration.ts`。WorkflowDispatcher 无法发现 1A agents。

### 3.6 Prisma Schema

**KMKI 模型 (12 + 3 Sprint 1C 预留):**

| 模型 | FK | 状态 |
|---|---|---|
| GEOProject | 无 FK → User | ✅ |
| GEOEntity | FK→GEOProject | ✅ |
| GEOEntityRelation | FK→GEOProject, GEOEntity×2 | ✅ |
| GEOProjectVersion | FK→GEOProject | ✅ |
| GEOClaim | FK→GEOEntity | ✅ |
| GEOEvidence | FK→GEOClaim | ✅ |
| GEOCitation | FK→GEOEvidence | ✅ |
| GEOFAQ | FK→GEOEntity | ✅ |
| GEOSchemaMarkup | FK→GEOEntity | ✅ |
| GEOReviewQueue | 无 FK | 🟡 |
| GEOQualityScore | **❌ 无 FK→GEOProject** | 🔴 |
| GEOFreshnessRecord | **❌ 无 FK→GEOProject** | 🔴 |
| GEOBenchmarkRecord | **❌ 无 FK→GEOProject** | 🔴 (1C) |
| GEOScoreSnapshot | **❌ 无 FK→GEOProject** | 🔴 (1C) |
| GEOOptimizationHistory | **❌ 无 FK→GEOProject** | 🔴 (1C) |

**Brand 模型 (5):**

| 模型 | FK | Index | 状态 |
|---|---|---|---|
| GeoProject | 无 FK → User | ❌ | ✅ |
| GeoBrandProfile | FK→GeoProject | ❌ | ✅ |
| WebsiteSnapshot | FK→GeoProject | ❌ | ✅ |
| GeoGraphNode | FK→GeoProject | ✅ | ✅ |
| GeoGraphEdge | FK→GeoGraphNode×2 | ✅ | ✅ |

**Critical: 2 套 Project 表重复。5 个 KMKI 模型缺 FK。Brand 模型缺索引。**

---

## 4. 前端全景扫描

### 4.1 Brand GEO API-Backend Mapping

| 文件 | 调用端点 | 后端 | KM 决策 |
|---|---|---|---|
| BrandGEOWorkspace.vue | 无直接 | — | Migrate |
| BrandGEOSidebar.vue | 无直接 | — | Migrate |
| GeoDashboard.vue | fetch(api/goal/stats/:id) | 🟢 Goal Runtime | Keep |
| GeoPlaceholderPanel.vue | 无 | — | Keep |
| useBrandGEORuntime.ts | 通过 store | — | Migrate |
| dashboard-cards.ts | 无 | — | Keep |
| sidebar.ts | 无 | — | Keep |
| AssetCenterPage.vue | 通过 store | 🔴 无 | Keep |
| BrandProfilePage.vue | 通过 store | 🔴 品牌全缺 | Keep |
| KnowledgeGraphPage.vue | 通过 store | 🔴 节点缺 | Keep |
| ProjectCreatePage.vue | createV2Project() | 🟡 部分 OK | Keep |
| ProjectSelectPage.vue | 通过 store | 🟡 部分 OK | Keep |
| SemanticExplorer.vue | useSemanticStore | 🟢 Semantic | Keep |
| WebsiteScannerPage.vue | 通过 store | 🔴 扫描全缺 | Keep |
| brandService.ts | brands/* | 🔴 全缺 | Remove |
| citationService.ts | brands/:id/citations | 🔴 全缺 | Merge |
| competitorService.ts | brands/:id/competitors | 🔴 全缺 | Merge |
| services/index.ts | — | — | Remove |
| projectService.ts | projects/* | 🟡 部分 OK | Merge |
| utils.ts | getAuthHeaders() | — | Remove |
| visibilityService.ts | visibility/* | 🔴 全缺 | Merge |
| useBrandGeoStore.ts | 18+ 端点 | 🔴 ~18 404 | Migrate |

### 4.2 KMKI GEO Dead Code Confirmed

```
grep -rn "modules/geo" --include="*.ts" --include="*.vue" --include="*.js"
→ 仅模块自身内引用，零外部命中
```

**12 个文件全部确认死代码**。

### 4.3 API Client Duplication

- Brand GEO: 5 个独立 service + store 内嵌 API — 均手动实现 `authHeaders()`
- KMKI GEO: `geo.service.ts` — 独立实现
- 平台: 未发现统一 API Client (`grep "api-client\|apiClient"` → 0)

**无统一 API 客户端**。6 个独立 API 调用模式。

### 4.4 Store Duplication

| Store | 位置 | 状态 |
|---|---|---|
| useBrandGeoStore | brand-geo/stores/ | 🟢 活跃 (8+ 组件用) |
| useGEOStore | modules/geo/store/ | 🗑️ 死代码 |
| useSemanticStore | modules/semantic/store/ | 🟢 SemanticExplorer 用 |
| 7 平台 stores | modules/platform/*/store/ | 🟢 平台用 |

---

## 5. 工程健康度

### 5.1 TypeScript Build

- **Backend**: `npx tsc --noEmit` → **882 错误**（GEO 仅 8 个在 KQ route，其余在 director-v2/core/agents 等）
- **Frontend**: 无 tsconfig.json，`npx tsc` 不可运行。`nuxi typecheck` 也失败

### 5.2 重复模式

| 模式 | 次数 | 位置 |
|---|---|---|
| mapPrisma* | 13 | 8 repos + 3 services (mapPrismaEntity x2) |
| authHeaders() | 2 | utils.ts + useBrandGeoStore.ts |
| GEO Project | 2 DB 表 | kmki_geo_projects + geo_projects |

### 5.3 死代码清单

| 路径 | 文件 | 行数 |
|---|---|---|
| frontend/modules/geo/ | 12 | ~800 |
| brand-geo/services/brandService.ts | 1 | ~60 |
| brand-geo/services/citationService.ts | 1 | ~40 |
| brand-geo/services/competitorService.ts | 1 | ~50 |
| brand-geo/services/visibilityService.ts | 1 | ~40 |

### 5.4 Stub 清单

| 位置 | 类型 |
|---|---|
| geo-knowledge-quality.route.ts:256 | createStubLLM() — 第 49 行定义，所有 LLM 调用转硬编码回复 |
| research.agent.ts | 全部硬编码返回 |
| entity.agent.ts | generateStubEntities() |
| knowledge-graph.agent.ts | 纯数据转换，无 LLM |
| Sprint 1B 5 agents | 架构正确但底层被 createStubLLM 阻断 |

---

## 6. 依赖关系分析

### 6.1 Frontend→Backend Dependency

```
Brand GEO Frontend
  ├── /api/geo/projects/*  → KMKI geo-project.route 🟡 路径匹配，payload 需验证
  ├── /api/geo/brands/*    → 🔴 18 端点全不存在
  ├── /api/geo/brand/:id   → 🔴 不存在
  ├── /api/geo/scan/*      → 🔴 不存在
  ├── /api/geo/tasks       → 🔴 不存在
  ├── /api/geo/dashboard   → 🔴 不存在
  ├── /api/geo/*/visibility → 🔴 不存在
  ├── /api/geo/graph/edges  → 🔴 不存在（KMKI 路径: /projects/:id/graph/edges）
  └── /api/geo/*/citations  → 🔴 不存在
```

### 6.2 Backend→DB

```
geo-project.route → direct prisma → kmki_geo_projects
geo-entity.route → direct prisma → kmki_geo_entities/kmki_geo_entity_relations
geo-graph.route → direct prisma → kmki_geo_entities (复用)
geo-KQ.route → 8 services → 8 repos → prisma → 8 KMKI domain tables
                 → workflowDispatcher → 8 agents (all stub)
```

### 6.3 GEO→Platform

| 依赖 | 状态 |
|---|---|
| Auth Plugin | ❌ 不依赖 - GEO 无任何 auth |
| Capability Runtime | ⚠️ 依赖但注入的是 stub |
| AgentService.register | ✅ 1A agents 已注册 |
| WorkspaceStore | ❌ 未依赖 |
| Goal Runtime | ✅ GeoDashboard 调用 |
| Semantic Runtime | ✅ SemanticExplorer 使用 |
| Prisma Client | ✅ 所有 repos 使用 |

---

## 7. Keep/Merge/Remove 最终名单

### Keep (保留不动)

| 文件/模块 | 原因 |
|---|---|
| 后端 36 文件全部 | 功能完整，需要对接 Brand 前端而非删除 |
| Brand config/(dashboard-cards.ts, sidebar.ts) | 配置可用 |
| Brand pages/(7) | UI 可用，后端缺失待补 |
| Brand components/(GeoDashboard, GeoPlaceholderPanel) | |
| 8 张 KMKI 领域表 | 数据结构完整 |

### Merge (合并到统一)

| 文件 | 合并目标 |
|---|---|
| citationService.ts | → geoService.ts |
| competitorService.ts | → geoService.ts |
| projectService.ts | → geoService.ts |
| visibilityService.ts | → geoService.ts |
| KMKI EntityDiscoveryPanel | → KnowledgeGraphPage |
| KMKI FlowPipeline | → GEO Workspace 组件 |
| KMKI KnowledgeGraphViewer | → KnowledgeGraphPage |
| KMKI ProvenanceTimeline | → 通用组件 |

### Migrate (移动并重命名)

| 当前 | → 目标 |
|---|---|
| BrandGEOWorkspace.vue | → GEOWorkspace.vue |
| BrandGEOSidebar.vue | → components/GEOSidebar.vue |
| useBrandGEORuntime.ts | → composables/useGEORuntime.ts |
| useBrandGeoStore.ts | → stores/useGeoStore.ts |
| KMKI types/index.ts | → 到 Studio V2 GEO types |

### Remove (删除/弃用)

| 文件 | 原因 |
|---|---|
| frontend/modules/geo/ (12 文件) | 死代码，C3 删除 |
| brandService.ts | 后端不存在，不重建 |
| services/index.ts | 导出调整 |
| services/utils.ts | authHeaders 由平台替代 |

---

## 8. Platform Boundary

### 8.1 属于平台（必须集成）

- **Auth**: 需要在 GEO routes 上加 `preHandler: authPlugin`
- **Membership/Permission**: 至少加用户隔离
- **Workspace Runtime**: 对接平台 WorkspaceStore，删除独立 Runtime
- **Asset Center**: 前端对接平台 Asset API
- **Storage**: 使用平台存储
- **Capability Runtime**: 1A agents 改为通过 capability runtime 调用

### 8.2 属于 GEO Domain（保留）

- Claims/Evidence/Citations/FAQ/Schema 管线、Repos、Services
- Knowledge Graph Entity 管理
- Brand Profile/Website Scanner 领域逻辑
- GeoProject（按收敛方案决策保留）
- 8 个 Agent 的业务逻辑

### 8.3 跨层关注点

- **Prompt Registry**: 属于 GEO Domain，但可以被平台 Agent Runtime 发现
- **Workflow**: 属于 GEO Domain，但 DAG/Dispatcher 模式可以推广到平台
- **mapPrisma 函数**: 可以抽象为 PrismaBaseRepository（平台层）

---

## 9. C2 实施计划（按依赖顺序）

### Phase 0: 架构审计 ✅（本文档完成）

### Phase 1: Platform Integration（必须优先）

| 子任务 | 依赖 | 估算 | 完成标准 |
|---|---|---|---|
| 1.1 Auth middleware on all GEO routes | 无 | 0.5天 | 所有 GEO endpoint 返回 401 无 token |
| 1.2 添加 userId 到 WorkflowContext | 1.1 | 0.5天 | KQ pipeline 绑定用户 |
| 1.3 Asset Center 对接平台 API | 无 | 1天 | Asset page 正常工作 |

### Phase 2: Backend Integration

| 子任务 | 依赖 | 估算 | 完成标准 |
|---|---|---|---|
| 2.1 替换 createStubLLM → 真实 LLM Capability | 1.1 | 1天 | 5 个 1B agent 返回真实 LLM 结果 |
| 2.2 实现 1A 3 agents 的真实 LLM 调用 | 2.1 | 1.5天 | research/entity/knowledge-graph 不再 stub |
| 2.3 新增 ~18 缺失端点 | 1.1 | 2天 | Brand 前端调用不再 404 |
| 2.4 Prisma: 补 FK/索引 | 无 | 0.5天 | QualityScore/Freshness etc 加 FK |
| 2.5 统一 agent 注册模式 | 2.1 | 0.5天 | 所有 agents 通过同一方式注册 |

### Phase 3: Frontend Integration

| 子任务 | 依赖 | 估算 | 完成标准 |
|---|---|---|---|
| 3.1 重命名组件 (Brand→移除前缀) | 无 | 0.5天 | GEOWorkspace.vue 等 |
| 3.2 统一 API 客户端 (6→1 geoService) | 2.3 | 1天 | 所有 API 调用通过 geoService |
| 3.3 Store refactor (useBrandGeo→useGeo) | 3.2 | 1天 | Store 对接 KMKI 后端 |
| 3.4 合并 KMKI 前端组件 | 3.1 | 1天 | ProvenanceTimeline/FlowPipeline 可用 |
| 3.5 更新 workspace entry 导入路径 | 3.1 | 0.5天 | geo.vue 导入更新 |

### Phase 4: Engineering Cleanup

| 子任务 | 依赖 | 估算 | 完成标准 |
|---|---|---|---|
| 4.1 删除 modules/geo/ | 3.4 | 0.5天 | 目录删除 |
| 4.2 删除 brandService/citationService 等 Remove 文件 | 3.2 | 0.5天 | 5 文件删除 |
| 4.3 删除重复 Store（useGEOStore） | 3.3 | 0.5天 | 1 文件删除 |
| 4.4 mapPrisma 抽象为 BaseRepository（可选） | 无 | 1天 | 13→1 个 mapPrisma |

**总估算**: ~12 人天（前端 5 + 后端 5 + 清理 2）

---

## 附录 A: 审计方法

- 实际文件扫描: `grep -rn`, `find`, `cat`, `head` 等命令
- TypeScript build: `npx tsc --noEmit` (backend)
- Import 链追踪: `grep -rn "modules/geo"` 及手动跨文件跟踪
- 端点映射: store.ts 中每个 `apiFetch()`/`fetch()` 调用与后端 route 逐一比对
- DB 检查: schema.prisma 所有 GEO/Geo 前缀模型，逐一验证 FK + 索引

## 附录 B: 关键文件路径

- 收敛设计: `docs/plans/GEO-PLATFORM-CONVERGENCE.md`
- 工程审查: `docs/reviews/GEO-ENGINEERING-REVIEW.md`
- 本审计: `docs/reviews/GEO-ARCHITECTURE-AUDIT.md`
- 后端入口: `backend/src/index.ts`
- GEO 后端: `backend/src/services/geo/`
- Brand 前端: `frontend/studio-v2/workspace/brand-geo/`
- KMKI 前端: `frontend/modules/geo/`
- DB Schema: `backend/prisma/schema.prisma`
