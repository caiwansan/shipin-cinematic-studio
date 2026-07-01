# GEO 工作台架构审计报告

**审计范围**: 昆仑镜短剧工作台 — GEO (Growth & Everything Optimization) 子系统
**审计时间**: 2026-07-19
**审计类型**: 独立第三方代码/架构/数据审计
**项目路径**: `/root/shipin-cinematic-studio`

---

## 0. 执行摘要

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码规模 | **5/10** | 后端 190 文件 / 22,591 行，前端 22 文件 / 1,365 行，整体偏重 |
| 架构一致性 | **2/10** | 两套独立的数据表体系，两个互不兼容的前端实现，V4 架构文档与实际代码严重不符 |
| 数据完整性 | **3/10** | DB 中 24 张表只有 10 张有数据，14 张表完全为空 |
| 前端产品化程度 | **1/10** | RC1 产品化版本与后端接口不匹配，页面不可用 |
| 可维护性 | **2/10** | 严重的技术债务堆积，新旧代码混合，多处 dead code |

**综合评价**: GEO 工作台处于"过度工程化但完成度极低"的状态。投入了巨大的编码量（22k 行后端代码），但产品核心功能（一个可用的品牌健康页面）无法正常工作。建议**暂停一切新功能开发**，先解决基础设施和架构问题。

---

## 1. 数据层审计

### 1.1 表混乱问题（严重）

数据库中存在 **两套表体系**，功能高度重叠：

**体系 A — 正式 Prisma 模型（`kmki_geo_*`，大写 Prisma 模型名）**
| 表名 | 数据量 | 状态 |
|------|--------|------|
| `kmki_geo_projects` | 8 行 | ✅ 有数据 |
| `kmki_geo_entities` | 1 行 | ⚠️ 极少 |
| `kmki_geo_claims` | 1 行 | ⚠️ 极少 |
| `kmki_geo_evidences` | 1 行 | ⚠️ 极少 |
| `kmki_geo_citations` | 1 行 | ⚠️ 极少 |
| `kmki_geo_faqs` | 1 行 | ⚠️ 极少 |
| `kmki_geo_schema_markups` | 1 行 | ⚠️ 极少 |
| `kmki_geo_score_snapshots` | 99 行 | ✅ 有数据 |
| `kmki_geo_freshness_records` | 0 行 | ❌ 空表 |
| `kmki_geo_quality_scores` | 0 行 | ❌ 空表 |
| `kmki_geo_optimization_histories` | 0 行 | ❌ 空表 |
| `kmki_geo_review_queue` | 0 行 | ❌ 空表 |
| `kmki_geo_project_versions` | 3 行 | ⚠️ 极少 |
| `kmki_geo_benchmark_records` | 0 行 | ❌ 空表 |
| `kmki_geo_project_profiles` | — | ❌ 空表 |

**体系 B — 新 Prisma 模型（`geo_*`，小写 Prisma 模型名）**
| 表名 | 数据量 | 状态 |
|------|--------|------|
| `geo_projects` | 0 行 | ❌ 空表 |
| `geo_brand_profiles` | 0 行 | ❌ 空表 |
| `geo_brand_settings` | 4 行 | ⚠️ 极少 |
| `geo_keywords` | 6 行 | ⚠️ 极少 |
| `geo_scan_history` | 4 行 | ⚠️ 极少 |
| `geo_score_versions` | 0 行 | ❌ 空表 |
| `growth_memories` | 0 行 | ❌ 空表 |
| `growth_knowledge` | 0 行 | ❌ 空表 |
| `geo_graph_nodes` | 0 行 | ❌ 空表 |
| `geo_graph_edges` | 0 行 | ❌ 空表 |

**问题**: `kmki_geo_projects`（体系 A）和 `geo_projects`（体系 B）功能等价但表结构不同。体系 B 是 v4 架构新增的模型，但没有数据。代码中部分 Repository 指向体系 A，部分指向体系 B，部分代码混用（如 `calculateScore` 同时调用 `geoBrandProfileRepository`（体系 B）和 `kmki_geo_*` 的 Repository）。

### 1.2 数据量极低（严重）

8 个项目（多为测试数据）、1 条实体、1 条声明、1 条证据。**从产品角度看，系统并未承载任何真实品牌数据。**

99 条 score snapshot 看似最多，但检查这些 snapshot 的来源：它们是否来自真实计算？如果系统只有 1 个 entity、1 个 claim、1 个 evidence，score 计算结果毫无意义。

### 1.3 V4 架构新增模型全部空表（严重）

以下 v4 架构设计时新增的表在数据库中没有数据：
- `VerificationJob`, `VerificationResult`, `VerificationPolicy`
- `GrowthMemory`, `LearningSignal`, `GeoScoreVersion`, `GrowthKnowledge`
- `OptimizationExecution`, `PublishingRecord`
- `KnowledgeObject`, `KnowledgeAsset`, `KnowledgePackage`

**结论**: v4 架构中 90% 的模型是空 shell，没有任何真实业务流程流过它们。

---

## 2. 后端代码审计

### 2.1 代码规模

- **文件数**: 190 个 `.ts` 文件
- **代码量**: 22,591 行
- **路由端点**: ~110 个（fastify.get/post/put/delete 调用数）
- **Repository 文件**: 27 个
- **Agent 文件**: 8 个（citation, claim, entity, evidence, faq, knowledge-graph, research, schema）

### 2.2 体系问题

#### 2.2.1 过度的 Agent 层（中）

8 个 Agent 文件（citation/claim/entity/evidence/faq/knowledge-graph/research/schema）总计约 980 行。这些 Agent 应该是通过 LLM 调用进行知识抽取的。但实际 DB 数据只有 1 条 entity、1 条 claim，说明 Agent 层几乎从未被使用或从未产生有效输出。

#### 2.2.2 两套路由体系（严重）

GEO 系统中的路由分为两套：

**旧路由（`/api/geo/*` 路径）** — ~100 个端点
- `routes/geo-claim.route.ts`, `routes/geo-entity.route.ts`, `routes/geo-evidence.route.ts`
- `routes/geo-brand.route.ts`, `routes/geo-keyword.route.ts`, `routes/geo-graph.route.ts`
- `publishing/publishing.route.ts`, `monitor/monitor.route.ts`
- `growth/growth.route.ts`, `growth/learning.route.ts`
- `recommendation/recommendation.route.ts`, `verification/verification.route.ts`

**新路由（`/api/v1/geo/*` 路径）** — 9 个端点
- `v1/geo-v1-product.route.ts` — 607 行，聚合旧路由数据

**问题**: 新路由是旧路由的聚合映射层。新旧路由共存但没有清晰的替代计划。前端 RC1 指向新路由，但新路由的数据完整性没有保障。

#### 2.2.3 Repository 层的碎片化（严重）

27 个 Repository 文件，每个文件 11-155 行，总量约 1,500 行。问题是：
- 部分 Repository 指向 `kmki_geo_*` 表，部分指向 `geo_*` 表
- 没有一个统一的 Repository Contract 或 Interface（虽然有 `TOOLS.md` 提到 "Repository Contract" 但实际代码中没有）
- `findFirst` 方法的 where 参数签名不一致（有的接受 `{ where: {...} }`，有的接受 `{...}`）

#### 2.2.4 import 路径不一致（中）

旧代码使用相对路径导入（`../../services/geo-claim.service`），新代码也使用相对路径但来自不同目录层级。这在后端运行时（tsx）可能不会报错，但重构时会非常困难。

### 2.3 KDP 层的复杂度评估

KDP（Knowledge Distribution Platform）是 GEO 中最复杂的子系统：
- 36 个文件分布在 `kdp/` 下
- 包含 Delivery Runtime、Git Adapter、HTTP Adapter、Storage Adapter（S3/OSS）、Packaging Pipeline 等
- 总代码量约 4,000 行

**问题**: KDP 的 4,000 行代码几乎没有被真正的 publish 流程触发过（`PublishingRecord` 表为空）。这套系统目前处于"造好了引擎但没有车"的状态。

---

## 3. 前端代码审计

### 3.1 代码规模

- **文件数**: 22 个（6 pages + 6 services + 6 stores + 2 layouts + 1 router + 1 composable）
- **代码量**: 全部约 1,365 行（不含设计系统）

### 3.2 三套前端实现并存（严重）

GEO 前端有**三套互不兼容的实现**：

**实现 A — brand-geo（旧，82 个文件）**
- 路径: `frontend/studio-v2/workspace/brand-geo/`
- 内容: 完整的品牌管理、Claim/Evidence/Keyword CRUD、Dashboard、Report
- 自建的 `GEOApiClient` + `GeoRoutes.ts` + 自己的 Store
- 但当前**没有任何路由指向这套实现**（`/workspace/geo` 已经重定向到 RC1）

**实现 B — brand-geo-v2（旧，12 个文件）**
- 路径: `frontend/studio-v2/workspace/brand-geo-v2/`
- 内容: 简化版 Dashboard + Timeline + Publish + Evidence
- 有自己的 composable（`useGeoV1Dashboard`, `useGeoV1Learning`, `useGeoV1Timeline`）
- 同样**没有路由指向**这套实现

**实现 C — RC1 产品化版本（新，22 个文件）**
- 路径: `frontend/workspaces/geo/`
- 内容: 6 个 Product Block 页 + Design System（43 个组件）
- 当前唯一活跃的前端实现
- **但所有页面均无法正常工作**（数据不匹配导致白屏）

**前端技术债务总量**: 82 + 12 + 22 = **116 个文件**，只有 22 个（19%）是活跃的。

### 3.3 设计系统完成度评估

Design System 位于 `frontend/design-system/`：
- Product Blocks: 15 个 ✅
- Components: 13 个 ✅
- Primitives: 12 个 ✅
- 总计: 43 个 Vue 单文件组件

设计系统的组件定义和解构是完整的，但**所有 Product Block 组件在 HealthPage 中使用时，实际引用的 store 属性与 store 定义不匹配**（如 `store.brandHealth` 在被前端类型中定义为对象但 store 中作为数字使用）。这是导致页面无法渲染的直接原因。

### 3.4 API 层与后端不匹配（严重）

前端 Service 假设后端返回：
```typescript
{
  brandHealth: { score, trend, label, definition },
  dimensions: [{ name, score, previousScore, isWarning, explanation }],
  recommendations: [{ id, title, expectedImpact, effort, reason }]
}
```

但后端实际返回：
```json
{
  "success": true,
  "data": {
    "brand": { ... },
    "healthScore": { "overall": ..., "change": ..., "trend": ... },
    "dimensions": [{ "id": ..., "label": ..., "score": ..., "maxScore": 100 }],
    "explanation": { "summary": ..., "nextFocus": ... },
    "coverage": { "evidenceCount": ..., "entityCount": ..., "claimCount": ... },
    "recentChanges": [...],
    "quickActions": [...]
  }
}
```

所有 6 个页面的 Service 类型都跟后端不匹配，这是页面崩溃的直接原因。

---

## 4. 架构文档与实际代码差异

### 4.1 V4 Verification Engine Architecture

文档 `/docs/architecture/geo/V4-VERIFICATION-ENGINE-ARCHITECTURE.md`（1,061 行）定义了完整的 Verification 体系，包括：
- 6 张新增表（OptimizationExecution, VerificationJob, VerificationResult, VerificationPolicy, GrowthMemory, LearningSignal）
- 4 个架构阶段
- 8 条 P0 评审建议

**实际代码确认**: 这 6 张表全部在 Prisma schema 中定义了，但数据库中全部为空。对应的 Service 代码（`verification/verification.service.ts`, `verification/verification-engine.ts`）是否真正实现了文档描述的异步任务状态机、幂等性等？需要逐一核对。

### 4.2 KDP Architecture Brief

文档 `/docs/architecture/geo/KDP-ARCHITECTURE-BRIEF.md` 设计了完整的 Delivery Pipeline：
- Packaging → Distribution → Delivery → Credential → Manifest
- 适配器模式（Git / HTTP / Storage）

**实际代码**: KDP 的 36 个文件和 4,000 行代码确实实现了一个诚意十足的适配器架构。问题是它**从未被真正调用过**（PublishingRecord 表为空）。

### 4.3 产品白皮书与实际差距

产品白皮书定义了"Build → Analyze → Report → Optimize → Execute → Publish → Verify → Monitor"完整闭环。

**实际覆盖**:
- Build/Analyze: Brand creation + Agent 层存在 ✅（但 Agent 几乎未产生输出）
- Report: 不可用（页面崩溃）
- Optimize: Recommendation 路由存在但未经前端验证
- Execute: 代码存在但没被触发
- Publish: KDP 层完整实现但无数据流过
- Verify: VerificationJob/Result 表全空
- Monitor: Monitor 路由存在但数据未入库

**结论**: 闭环的所有基础设施都搭了框架，但没有任何一个环节真正流通起来。

---

## 5. 关键问题总结

### P0 — 立即需要修复

| # | 问题 | 影响 |
|---|------|------|
| 1 | **前端 Service 类型与后端不匹配** — 6 个 API 全部对不上 | 所有 GEO 页面白屏/崩溃 |
| 2 | **两套数据表体系** — kmki_geo 和 geo_ 互不兼容 | 数据碎片化，Repository 指向混乱 |
| 3 | **三套前端实现共存** — brand-geo (82 files) + brand-geo-v2 (12) + RC1 (22) | 技术债务重，维护成本高 |
| 4 | **v4 架构新增表全部为空** — 11+ 张表 0 数据 | 架构设计无实际运行验证 |

### P1 — 中优先级

| # | 问题 | 影响 |
|---|------|------|
| 5 | **Agent 层产出极低** — 8 个 Agent 写了 980 行代码，DB 只有 1 条数据 | LLM 链路可能无效或配置错误 |
| 6 | **Repository 签名不统一** — where 参数格式不一致 | 代码维护困难 |
| 7 | **KDP 层过度工程** — 4,000 行代码但从未运行过 | 在核心产品未成型前的提前优化 |
| 8 | **Score 计算依赖链脆弱** — 从 project → entity → claim → evidence 依次查找 | 数据不足时直接返回 0 |

### P2 — 长期关注

| # | 问题 | 影响 |
|---|------|------|
| 9 | 旧 brand-geo 的 82 个文件未清理，Build 仍在编译它们 | 延长构建时间、增加包体积 |
| 10 | Design System 组件定义齐全但与 Store/Service 无类型约束 | 运行时类型错误无法在编译期发现 |
| 11 | 产品文档（29 份）与代码实现严重脱节 | 开发者不信任文档 |

---

## 6. 整改建议

### 短期（1-2 天）
1. **修复前端 Service 类型**，使其与后端 API 返回匹配（已完成）
2. **统一数据源**：选择一个表体系（建议 `kmki_geo_*`，因为它有数据），废弃另一个
3. **清理 dead code**：移除旧 brand-geo 和 brand-geo-v2 的未引用文件（或将它们标记并移入 `legacy/`）

### 中期（1-2 周）
4. **让一条数据流走通完整闭环**：新建一个真实项目 → Agent 抽取知识 → Score 计算 → Recommendation → Publish → Verify → Monitor
5. **建立 Repository Contract**：统一 Prisma 查询接口，消除"伪抽象"
6. **Agent 调试**：排查 LLM Agent 为什么没有产生有效输出

### 长期（产品决策）
7. **决定是否继续 GEO**：当前状态说明"过度工程"的投入远大于"产品价值"。需要判断这个产品方向是否值得继续投入，还是把资源放回短剧核心业务上。
8. **如果继续**：重写前端 Service 层，走通一次完整闭环后再考虑扩展功能
9. **如果放弃**：将 GEO 代码冻结标记（git tag），不删代码但不再维护

---

## 7. 附录：数据总览

### 7.1 后端代码分布

| 模块 | 文件数 | 约代码行数 | 状态 |
|------|--------|-----------|------|
| Routes（旧 API） | ~18 | ~5,000 | 可工作但数据不足 |
| V1 Product Routes（新 API） | 1 | 607 | 聚合层 |
| Repositories | 27 | ~1,500 | 定义完整 |
| Services | ~15 | ~3,000 | 部分实现 |
| Agents | 8 | ~980 | 产出极低 |
| KDP | 36 | ~4,000 | 未运行过 |
| Growth/Learning | ~12 | ~1,000 | 部分实现 |
| Monitor | 11 | ~800 | 部分实现 |
| Publishing | 14 | ~1,200 | 未运行过 |
| Verification | ~8 | ~600 | 未运行过 |

### 7.2 前端代码分布

| 模块 | 文件数 | 代码行数 | 状态 |
|------|--------|----------|------|
| RC1 Pages | 6 | ~2,000 (含 template) | ❌ 不可用 |
| RC1 Services | 6 | ~700 | ❌ 类型不匹配 |
| RC1 Stores | 6 | ~550 | ❌ 类型不匹配 |
| Design System | 43 组件 | ~未知 | ✅ 组件定义完整 |
| brand-geo (legacy) | 82 | ~大量 | ❌ Dead code |
| brand-geo-v2 (legacy) | 12 | ~中等 | ❌ Dead code |

### 7.3 数据库数据统计

| 表体系 | 有数据的表 | 空表 | 总计 |
|--------|-----------|------|------|
| kmki_geo_* | 6 | 8 | 14 |
| geo_* | 3 | 7 | 10 |
| **总计** | **9** | **15** | **24** |

---

**审计员签名**: OpenClaw（熊二）
**审计时间**: 2026-07-19
**报告版本**: v1.0
