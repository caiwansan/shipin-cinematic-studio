# GEO 模块工程技术审查报告

> **审查时间:** 2025-07 (Sprint 1A + 1B 完成后)
> **范围:** 昆仑镜平台 GEO (Generative Engine Optimization) 模块
> **审查目标:** 完成度评估、断层识别、优先级建议

---

## 1. 概述

GEO 模块已完成 **Sprint 1A（知识骨架）** 与 **Sprint 1B（知识质量 - 后端运行时基线）** 的开发。E2E 管线已于 Sprint 1B 末验证通过——5 个 Agent 全部运行，数据成功持久化到数据库。

然而，模块中存在 **两条并行系统（KMKI-GEO vs Brand GEO）**、**Sprint 1A 遗留桩代码**、**前端与后端 API 严重断裂** 等关键问题。本报告对全栈每一层的完成度进行了评估，识别了集成断层，并给出了下一阶段的优先行动建议。

**整体完成度估算: 后端 55% · 前端 40% · 集成 25%**

---

## 2. 完成度评估

| 层级 | 完成度 | 状态 | 说明 |
|------|--------|------|------|
| Route (路由) | 40% | 🟡 | 只实现了 CRUD 的 ~50%；Sprint 1B 读写端点大量缺失 |
| Agent (智能体) | 60% | 🟡 | 5 个 Sprint 1B Agent 完整；3 个 Sprint 1A Agent 是空桩 |
| Workflow (工作流) | 75% | 🟢 | WorkflowBuilder/Dispatcher 完整；仅注册了 1 个 DAG |
| Service (服务层) | 55% | 🟡 | 代码完整但 Sprint 1A 无仓储层；Repository 与非仓储混合 |
| Repository (仓储) | 60% | 🟡 | 8 个仓储 ~60% CRUD 覆盖；缺少 delete；重复 map 函数 |
| DB Schema | 50% | 🟡 | KMKI 模型完整；质量问题；Brand GEO 模型与 KMKI 断裂 |
| 前端 - KMKI GEO | 70% | 🟢 | API 路径匹配后端 ✅；功能页面完整 |
| 前端 - Brand GEO | 30% | 🔴 | 代码量多但 100% API 端点后端不存在 |
| 集成/管线 | 25% | 🔴 | Brand GEO 后端为 0；KQ 路由硬编码桩 LLM；无认证 |

---

## 3. Route 完成度

### 3.1 已实现的路由文件

| 路由文件 | 端点数量 | 实现状态 | 问题 |
|----------|----------|----------|------|
| `geo-project.route.ts` | 8 | 🟢 完整 CRUD | 无 Zod 校验；Try/Catch 通用 500 |
| `geo-entity.route.ts` | 7 | 🟢 完整 CRUD | 同上 |
| `geo-graph.route.ts` | 6 | 🟢 完整 CRUD | 同上 |
| `geo-knowledge-quality.route.ts` | 2 | 🟡 仅 POST 触发 + GET 列表 | 触发使用 `createStubLLM()` 硬编码 🔴 |

### 3.2 端点清单

#### geo-project.route.ts (8 endpoints) ✅

```
POST   /api/geo/projects           → create project
GET    /api/geo/projects           → list projects (user filter)
GET    /api/geo/projects/:id       → get by ID (with entities)
PUT    /api/geo/projects/:id       → update project
DELETE /api/geo/projects/:id       → delete project
POST   /api/geo/projects/:id/entities → create entity within project
POST   /api/geo/projects/:id/sync → sync project
```

#### geo-entity.route.ts (7 endpoints) ✅

```
POST   /api/geo/entities                 → create entity
GET    /api/geo/entities                 → list entities
GET    /api/geo/entities/:id             → get by ID (with graph)
PUT    /api/geo/entities/:id             → update entity
DELETE /api/geo/entities/:id             → delete entity
POST   /api/geo/entities/:id/relationships → create relationship
GET    /api/geo/entities/:id/relationships → get relationships
```

#### geo-graph.route.ts (6 endpoints) ✅

```
POST   /api/geo/graphs                   → create graph
GET    /api/geo/graphs                   → list graphs
GET    /api/geo/graphs/:id               → get by ID
PUT    /api/geo/graphs/:id               → update graph
DELETE /api/geo/graphs/:id               → delete graph
POST   /api/geo/graphs/:id/build         → trigger graph build
```

#### geo-knowledge-quality.route.ts (2 endpoints) 🟡

```
POST   /api/geo/knowledge-quality/run    → 触发 KQ pipeline
GET    /api/geo/knowledge-quality/status/:id → 查询运行状态
```

### 3.3 缺失的端口 (Sprint 1B)

| 缺失端点 | 优先级 | 说明 |
|----------|--------|------|
| `GET /api/geo/claims` | 🔴 P0 | Sprint 1B 核心读取端点缺失 |
| `GET /api/geo/claims/:id` | 🔴 P0 | 同上 |
| `POST /api/geo/claims` | 🔴 P0 | 写入端点（claim 提取结果） |
| `PUT /api/geo/claims/:id/review` | 🔴 P0 | 审核操作端点 |
| `GET /api/geo/evidence` | 🔴 P0 | 证据读取端点 |
| `GET /api/geo/citations` | 🔴 P0 | 引用读取端点 |
| `GET /api/geo/faqs` | 🟡 P1 | FAQ 读取端点 |
| `GET /api/geo/schemas` | 🟡 P1 | Schema 读取端点 |
| `GET /api/geo/review-queue` | 🟡 P1 | 审核队列端点 |
| `GET /api/geo/quality/scores` | 🟡 P1 | 质量评分端点 |
| `POST /api/geo/quality/trigger` | 🟡 P1 | 质量评分触发端点 |

### 3.4 跨层问题

- **无 Zod / JSON Schema 输入验证** — 所有路由手动检查 `if (!body.x)` 🟡
- **错误处理均为通用 `500 Internal Server Error`** — 无结构化错误响应 🟡
- **无认证中间件** — 任何路由均可无 token 访问 🔴

---

## 4. Agent 完成度

### 4.1 Agent 清单

| Agent | Sprint | 实现状态 | LLM 调用 | 注册方式 | 说明 |
|-------|--------|----------|----------|----------|------|
| Research | 1A | 🔴 空桩 | ❌ | `agentService` + `geo-registry.ts` | 返回模拟数据 |
| Entity | 1A | 🔴 空桩 | ❌ | `agentService` + `geo-registry.ts` | 返回模拟数据 |
| Knowledge Graph | 1A | 🔴 空桩 | ❌ | `agentService` + `geo-registry.ts` | 返回模拟数据 |
| Claim | 1B | 🟢 完整 | ✅ | `geo-workflow-registration.ts` | 使用 PromptRegistry |
| Evidence | 1B | 🟢 完整 | ✅ | `geo-workflow-registration.ts` | 使用 PromptRegistry |
| Citation | 1B | 🟢 完整 | ✅ | `geo-workflow-registration.ts` | 使用 PromptRegistry |
| FAQ | 1B | 🟢 完整 | ✅ | `geo-workflow-registration.ts` | 使用 PromptRegistry |
| Schema | 1B | 🟢 完整 | ✅ | `geo-workflow-registration.ts` | 使用 PromptRegistry |

### 4.2 注册方式不一致

**双重注册模式存在架构断裂:**

```
Sprint 1A: agentService.register() + geo-registry.ts 显式定义
Sprint 1B: geo-workflow-registration.ts 中注册

→ 问题: 没有统一的 Agent 注册中心和管理入口
→ 风险: WorkflowDispatcher 无法发现和管理 Sprint 1A Agent
```

### 4.3 Sprint 1B Agent 完整度详情

Sprint 1B 的 5 个 Agent 实现质量较高:

- ✅ 全部使用 `PromptRegistry` 管理提示词模板
- ✅ 全部返回标准 `AgentOutput` 类型（含 `status`, `diagnostics`, `trace`）
- ✅ 全部具备 `execute()` 方法集成到 Workflow 管线
- ❌ 缺少 Agent 单元测试（覆盖率报告未覆盖）
- ❌ 缺少 Agent 输出数据格式验证（无 Zod schema 校验输出）

---

## 5. Workflow 完成度

### 5.1 基础设施 🟢

| 组件 | 状态 | 说明 |
|------|------|------|
| `WorkflowBuilder` | ✅ 完整 | DAG 构建、节点配置 |
| `WorkflowDispatcher` | ✅ 完整 | DAG 解析、重试、超时、`continueOnFailure` |
| `WorkflowContext` | 🟡 缺字段 | 类型完整但缺少 `userId` 字段 |

### 5.2 注册的 DAG

```
Workflow: geo.knowledge-quality

   L1: Claim (根节点)
        │
   L2: Evidence ←→ FAQ (并行, 依赖 Claim)
        │           │
   L3: Citation ── Schema (并行, 依赖 Evidence/FAQ)
```

- ✅ DAG 依赖解析正确
- ✅ 并行执行支持
- ✅ 节点级重试与超时
- ❌ 仅注册了 1 个 Workflow — Research/Entity/Graph 未纳入 Workflow
- ❌ 无 Workflow 执行日志持久化
- ❌ 无 Workflow 执行仪表盘

---

## 6. Service 完成度

### 6.1 Service 清单

| Service | Sprint | 使用 Repository | CRUD 覆盖 | 问题 |
|---------|--------|----------------|-----------|------|
| `project.service.ts` | 1A | ❌ 直接 Prisma | 完整 | 无 Repository 层 🔴 |
| `entity.service.ts` | 1A | ❌ 直接 Prisma | 完整 | 无 Repository 层 🔴 |
| `graph.service.ts` | 1A | ❌ 直接 Prisma | 完整 | 无 Repository 层 🔴 |
| `claim.service.ts` | 1B | ✅ | 70% | 缺少 delete |
| `evidence.service.ts` | 1B | ✅ | 65% | 缺少 delete + 部分 query |
| `citation.service.ts` | 1B | ✅ | 60% | 缺少 delete |
| `faq.service.ts` | 1B | ✅ | 70% | 缺少 delete |
| `schema.service.ts` | 1B | ✅ | 65% | 缺少 delete |
| `review.service.ts` | 1B | ✅ | 50% | 新增功能，未完全实现 |
| `quality.service.ts` | 1B | ✅ | 40% | 评分逻辑待完善 |
| `freshness.service.ts` | 1B | ✅ | 30% | 基础框架，逻辑未开发 |

### 6.2 架构问题

- 🔴 Sprint 1A Services 直接调用 Prisma，无 Repository 隔离
- 🟡 Sprint 1B 使用了 Repository 但部分逻辑仍在 Service 中处理 DB 查询
- 🟡 存在重复的 `mapPrisma*` 函数（详见第 7 节）
- 🟢 Service 间依赖通过构造器注入，未使用循环依赖

---

## 7. Repository 完成度

### 7.1 Repository 清单

| Repository | CRUD 覆盖 | 缺失操作 | 问题 |
|-----------|-----------|----------|------|
| `claim.repository.ts` | 70% ✅ | delete | 无 base class |
| `evidence.repository.ts` | 65% 🟡 | delete, 部分 query | 无 base class |
| `citation.repository.ts` | 60% 🟡 | delete | 无 base class |
| `faq.repository.ts` | 70% ✅ | delete | 无 base class |
| `schema.repository.ts` | 60% 🟡 | delete | 无 base class |
| `review.repository.ts` | 50% 🟡 | 多个操作 | 新模块 |
| `quality.repository.ts` | 40% 🟡 | 多个操作 | 新模块 |
| `freshness.repository.ts` | 30% 🔴 | 仅基础 | 新模块 |

### 7.2 重复代码问题

**共发现 11 个重复的 `mapPrisma*` 函数**，分布在 Repository 与 Service 层:

```
evidence.repository.ts: mapPrismaEvidence
citation.repository.ts: mapPrismaCitation
faq.repository.ts: mapPrismaFAQ
schema.repository.ts: mapPrismaSchema
claim.repository.ts: mapPrismaClaim
project.service.ts: mapPrismaProject
entity.service.ts: mapPrismaEntity
graph.service.ts: mapPrismaGraph
review.repository.ts: mapPrismaReview
quality.repository.ts: mapPrismaQuality
freshness.repository.ts: mapPrismaFreshness
```

每个函数执行相同的 Prisma 模型 → 业务模型转换逻辑，应提取到共享的 **mapper utility** 中。

### 7.3 缺少 PrismaBaseRepository

所有 Repository **直接 `import prisma`**，缺少统一的 Base Repository 类。这导致:

- 无法全局控制查询拦截、日志、软删除
- 重复的事务管理代码
- 测试时难以 mock

---

## 8. DB Schema 状态

### 8.1 KMKI-GEO 模型 (10 个主模型 + 2 个关联模型)

| 模型 | 状态 | FK/关联 | 索引 | 说明 |
|------|------|---------|------|------|
| GEOProject | ✅ | 完整 | ✅ | 核心项目模型 |
| GEOEntity | ✅ | 引用 Project ✅ | ✅ | 实体模型 |
| GEOEntityRelation | ✅ | 引用 Entity + Target ✅ | ✅ | 关系模型 |
| GEOGraph | ✅ | 引用 Project ✅ | ✅ | 图谱模型 |
| GEOSubGraph | ✅ | 引用 Graph ✅ | ✅ | 子图模型 |
| GEOClaim | ✅ | 引用 Project ✅ | ✅ | 声明/主张 ✅ |
| GEOEvidence | ✅ | 引用 Claim ✅ | ✅ | 证据 ✅ |
| GEOCitation | ✅ | 引用 Evidence ✅ | ✅ | 引用 ✅ |
| GEOFAQ | ✅ | 引用 Project ✅ | ✅ | FAQ ✅ |
| GEOSchema | ✅ | 引用 Project ✅ | ✅ | Schema ✅ |
| GEOQualityScore | 🟡 | **缺少对 GEOProject 的 FK 约束** 🔴 | ✅ | 质量评分 |
| GEOFreshnessRecord | 🟡 | **缺少对 GEOProject 的 FK 约束** 🔴 | ✅ | 新鲜度记录 |

### 8.2 Sprint 1C 预留模型 (3 个)

| 模型 | 状态 | 说明 |
|------|------|------|
| GEODomainModel | 🔴 空 | 域模型 - 1C 开发 |
| GEOIntentPattern | 🔴 空 | 意图模式 - 1C 开发 |
| GEOGenerationTemplate | 🔴 空 | 生成模板 - 1C 开发 |

### 8.3 Brand GEO 模型 (5 个)

**严重问题:** Brand GEO 包含一个独立的 `GeoProject` 模型（映射到不同的表），与 KMKI 的 `GEOProject` 重复。

| 模型 | 问题 |
|------|------|
| GeoProject (Brand) | 🔴 与 KMKI GEOProject 语义重复且无关联 |
| GeoBrand | 🟡 仅 Brand GEO 使用 |
| GeoAsset | 🟡 仅 Brand GEO 使用 |
| GeoTemplate | 🟡 仅 Brand GEO 使用 |
| GeoAuditLog | 🟡 审计相关 |

### 8.4 Schema 层面的问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| QualityScore 无 FK 到 Project | 🔴 | 数据完整性问题 |
| FreshnessRecord 无 FK 到 Project | 🔴 | 数据完整性问题 |
| 所有枚举字段为 String 类型 | 🟡 | 无 native Prisma enum 约束 |
| Brand GEO 重复 Project 模型 | 🔴 | 两条系统数据断裂 |
| Brand GEO 模型缺少审计字段 | 🟡 | createdAt/updatedAt 缺失 |

---

## 9. 前端完成度

### 9.1 KMKI GEO 前端（`frontend/modules/geo/`）

| 文件 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `projects/` | 页面 | ✅ | 项目列表页 + 详情页 |
| `components/` (6 个) | 组件 | ✅ | EntityList, GraphView, KQPanel 等 |
| `store/` | 状态管理 | ✅ | Pinia store |
| `service/` | API 服务 | ✅ | API 路径全部匹配后端 |

**结论:** KMKI 前端与后端 API 对齐良好，完成度约 **70%** 🟢

### 9.2 Brand GEO 前端（`frontend/studio-v2/workspace/brand-geo/`）

| 文件 | 类型 | 数量 | 问题 |
|------|------|------|------|
| 页面 | 7 | 🔴 | 全部 API 调用后端不存在 |
| 组件 | 5 | 🔴 | 全部 API 调用后端不存在 |
| Services | 4 | 🔴 | 全部 18+ 端点对应后端路由未实现 |
| Store | 1 | 🔴 | 依赖 Services |

**具体缺失的后端路由（Brand GEO 前端调用）：**

```
POST   /api/brand/geo/projects        → 不存在
GET    /api/brand/geo/projects        → 不存在
GET    /api/brand/geo/projects/:id    → 不存在
PUT    /api/brand/geo/projects/:id    → 不存在
DELETE /api/brand/geo/projects/:id    → 不存在
POST   /api/brand/geo/brands          → 不存在
GET    /api/brand/geo/brands          → 不存在
PUT    /api/brand/geo/brands/:id      → 不存在
POST   /api/brand/geo/assets          → 不存在
GET    /api/brand/geo/assets          → 不存在
POST   /api/brand/geo/templates       → 不存在
GET    /api/brand/geo/templates       → 不存在
POST   /api/brand/geo/audit-logs      → 不存在
GET    /api/brand/geo/audit-logs      → 不存在
... 以及更多 ...
```

**结论:** Brand GEO 前端完成度约 **30%** 🔴 — 代码量大但 100% 无法运行

### 9.3 前端整体问题

- 🟢 KMKI GEO: API 路径匹配 ✅ — 可正常对接
- 🔴 Brand GEO: 所有 API 端点后端 404 — 需要后端 Route 实现
- 🟡 两条前端系统具有显著功能重叠（项目管理、实体管理）

---

## 10. 集成断层清单

### 🔴 Critical (P0 — 必须立即修复)

| # | 断层 | 影响 | 建议 |
|---|------|------|------|
| C1 | **Brand GEO 后端完全缺失** | 17 个前端文件引用的 18+ 端点全部 404 | 实现 `routes/brand-geo/` 路由组，或合并到 KMKI GEO |
| C2 | **KQ Route 硬编码 `createStubLLM()`** | 生产环境仍使用假 LLM 输出 | 替换为真实 LLM Provider 客户端 |
| C3 | **Sprint 1A Agents 为空桩** | Research → Entity → Graph 流程无法产出真实数据 | 实现 3 个 Agent 的 LLM 调用逻辑 |
| C4 | **QualityScore / FreshnessRecord 无 FK 约束** | 数据完整性风险 | 在 Schema 中加 `@relation` 到 GEOProject |
| C5 | **无认证/授权** | 所有 GEO 路由无保护 | 接入昆仑镜认证中间件（JWT / Session） |

### 🟡 Medium (P1 — 应在本 Sprint 修复)

| # | 断层 | 影响 | 建议 |
|---|------|------|------|
| M1 | **两条并行 GEO 系统 (KMKI vs Brand)** | 数据孤岛、代码重复、维护成本翻倍 | 评估合并方案或明确分离策略 |
| M2 | **Agent 注册模式不一致** | WorkflowDispatcher 无法发现 Sprint 1A Agent | 统一到 WorkflowRegistry |
| M3 | **11 个重复的 `mapPrisma*` 函数** | 维护负担、bug 风险 | 抽取共享 mapper utility |
| M4 | **无 PrismaBaseRepository** | 无法全局控制查询/日志 | 创建 BaseRepository |
| M5 | **Sprint 1B 服务端点路由缺失** | 前端无法读取 claim/evidence/citation 等数据 | 添加 REST 端点 |
| M6 | **WorkflowContext 缺少 userId** | 无法关联执行记录到用户 | 添加 userId 字段 |
| M7 | **无 Zod 输入验证** | API 输入不可靠 | 添加 Zod schemas 到路由 |
| M8 | **DB Schema 枚举字段为 String** | 无效值无法在数据库层阻止 | 迁移到 native Prisma enum |

### 🟢 Minor (P2 — 低优先级)

| # | 断层 | 影响 | 建议 |
|---|------|------|------|
| N1 | **Sprint 1A Service 直接调用 Prisma** | 无 Repository 层隔离 | 重构为 Repository 模式 |
| N2 | **错误响应均为通用 500** | 前端无法区分错误类型 | 实现结构化错误格式 |
| N3 | **仅 1 个 Workflow 注册** | KQ 之外的流程未自动化 | 逐步注册更多 Workflow |
| N4 | **无 Agent/Service 单元测试** | 回归风险 | 补充测试覆盖率 |
| N5 | **无 Workflow 执行日志** | 难以诊断失败 | 添加执行日志持久化 |
| N6 | **无 Workflow 仪表盘** | 无法监控执行 | 后续 Sprint 添加前端页面 |
| N7 | **Brand GEO 缺少审计字段** | 数据追溯困难 | 添加 createdAt/updatedAt |

---

## 11. 404 / 未注册 Route 清单

以下 Route 前端已调用但后端不存在 🔴

### Brand GEO 路由（完全缺失）

```
/api/brand/geo/projects              ✅/❌
  ├── POST   /projects               🔴 完全缺失
  ├── GET    /projects               🔴 完全缺失
  ├── GET    /projects/:id           🔴 完全缺失
  ├── PUT    /projects/:id           🔴 完全缺失
  └── DELETE /projects/:id           🔴 完全缺失

/api/brand/geo/brands                 🔴 完全缺失（5+ endpoints）
/api/brand/geo/assets                 🔴 完全缺失（3+ endpoints）
/api/brand/geo/templates              🔴 完全缺失（3+ endpoints）
/api/brand/geo/audit-logs             🔴 完全缺失（2+ endpoints）
```

### KMKI GEO 缺失端点

```
/api/geo/claims                       🔴 缺失
/api/geo/evidence                     🔴 缺失
/api/geo/citations                    🔴 缺失
/api/geo/faqs                         🔴 缺失
/api/geo/schemas                      🔴 缺失
/api/geo/reviews                      🔴 缺失
/api/geo/quality/scores               🔴 缺失
/api/geo/quality/trigger              🔴 缺失
```

**共计: ~25+ 个端点未注册 / 404**

---

## 12. 重复实现与遗留 Mock

### 12.1 两条并行 GEO 系统的功能重叠

| 功能 | KMKI GEO | Brand GEO | 重叠度 |
|------|----------|-----------|--------|
| 项目管理 | GEOProject | GeoProject | 🔴 完全重复 |
| 实体管理 | GEOEntity | GeoBrand | 🟡 部分重叠 |
| 资源管理 | (无) | GeoAsset | 🟢 唯一 |
| 模板管理 | (无) | GeoTemplate | 🟢 唯一 |
| 知识质量 | GEOClaim/Evidence 等 | (无) | 🟢 唯一 |

### 12.2 遗留 Mock

| Mock | 位置 | 状态 | 说明 |
|------|------|------|------|
| `createStubLLM()` | KQ Route | 🔴 硬编码 | 应该替换为真实 Provider |
| Research Agent | Sprint 1A | 🔴 空桩 | 返回假数据 |
| Entity Agent | Sprint 1A | 🔴 空桩 | 返回假数据 |
| Knowledge Graph Agent | Sprint 1A | 🔴 空桩 | 返回假数据 |

### 12.3 重复代码

```
11 个 mapPrisma* 函数: 遍布 8 个 Repository + 3 个 Service
每个函数结构相同: { id, ...prismaField } 映射
建议: 创建 src/.../geo/repositories/mappers/index.ts
```

---

## 13. 下一阶段优先建议

### 冲刺 1C — 优先 (Critical 修复)

| 优先级 | 任务 | 预估工作量 | 涉及范围 |
|--------|------|-----------|----------|
| 🔴 P0 | **Brand GEO 后端实现 或 合并策略** | 2-3 天 | Routes, Services, DB |
| 🔴 P0 | **替换 `createStubLLM()` 为真实 Provider** | 1 天 | KQ Route |
| 🔴 P0 | **实现 Sprint 1A Agents (Research/Entity/Graph)** | 3-5 天 | Agents |
| 🔴 P0 | **QualityScore/FreshnessRecord FK 约束** | 0.5 天 | DB Schema |
| 🔴 P0 | **接入认证中间件** | 2 天 | Routes, Auth |

### 冲刺 1C — 跟进 (Medium 修复)

| 优先级 | 任务 | 预估工作量 |
|--------|------|-----------|
| 🟡 P1 | **添加 Sprint 1B 数据读取端点 (claims/evidence/citations 等)** | 2 天 |
| 🟡 P1 | **统一 Agent 注册模式** | 1 天 |
| 🟡 P1 | **提取共享 mapper utility + PrismaBaseRepository** | 1 天 |
| 🟡 P1 | **添加 Zod 输入验证** | 2 天 |
| 🟡 P1 | **Brand vs KMKI 合并评审** | 1 天 |
| 🟡 P1 | **迁移枚举字段到 native Prisma enum** | 1 天 |

### 冲刺 2A — 前瞻 (Minor + 新功能)

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🟢 P2 | Sprint 1A Services 重构为 Repository 模式 | 代码一致性 |
| 🟢 P2 | 结构化错误处理 | 更好的 API 体验 |
| 🟢 P2 | Agent / Service 单元测试 | 回归保护 |
| 🟢 P2 | Workflow 执行日志 + 仪表盘 | 可观测性 |
| 🟢 P2 | 注册更多 Workflow DAG | 自动化扩展 |
| 🔵 P3 | Sprint 1C 预留模型实现 (Domain/Intent/Template) | 新功能 |

### 架构决策建议

**最高优先级: 解决 "两条系统" 问题**

团队需要做出架构决策:

1. **方案 A: 合并** — 扩展 KMKI GEO 以覆盖 Brand GEO 功能，删除 Brand GEO
   - 优点: 单系统，数据统一，维护成本低
   - 风险: 需要大规模重构前端

2. **方案 B: 独立并行** — 完整实现 Brand GEO 后端，保持两条系统
   - 优点: 功能隔离，独立迭代
   - 风险: 持续的双倍维护成本，数据孤岛

3. **方案 C: 仓库模式** — 共享核心模型（Project/Entity），Brand 特有功能单独扩展
   - 优点: 折中方案，减少重复
   - 风险: 架构复杂度增加

**建议选择方案 A（合并）或方案 C（共享仓库）**，避免两条系统长期并行。

---

## 附录 A: Sprint 回顾

### Sprint 1A — 知识骨架 ✅ 完成

- 项目/实体/图谱 CRUD 完整
- 前端 KMKI GEO 页面与组件就绪
- 三条 Agent 管道桩代码就绪
- ✅ **问题:** Agents 均为空桩，未调用 LLM

### Sprint 1B — 知识质量基线 ✅ 完成

- 5 个 Agent (Claim/Evidence/Citation/FAQ/Schema) 完整实现
- WorkflowBuilder + Dispatcher 就绪
- E2E Pipeline 验证通过
- ✅ **问题:** KQ Route 硬编码桩 LLM；Brand GEO 前端无后端支持

### 即将: Sprint 1C — 域模型与合并

**核心目标:** 解决本报告识别的 🔴 Critical 断层 + 实现预留的 3 个 Domain/Intent/Template 模型

---

## 附录 B: 数据概要

| 指标 | 数值 |
|------|------|
| 后端代码文件 | ~60 个 (routes/services/repos/agents/registries) |
| 前端代码文件 | 27 个 (KMKI: 10 + Brand: 17) |
| DB 模型 | 17 个 (KMKI: 12 + Brand: 5) |
| 已注册 Agent | 8 个 (3 桩 + 5 实) |
| 已注册 Workflow | 1 个 |
| 缺失 Route | ~25+ 个 |
| 重复 mapPrisma* 函数 | 11 个 |
| 空桩/Mock | 4 个 |
| 体系断层 | 2 条并行系统 |
| 代码行（估算） | ~8000-10000 行 |

---

*本报告由自动化代码扫描生成，结合手动路由验证与架构分析。*
*生成时间: 2025-07 | 审查版本: v1.0*
