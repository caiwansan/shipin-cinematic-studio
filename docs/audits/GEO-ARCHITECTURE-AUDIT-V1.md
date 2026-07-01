# GEO 工作台深度架构审计报告

**审计方**: 独立第三方  
**审计时间**: 2026-07-19  
**范围**: 前后端代码、Prisma 数据模型、路由配置、组件体系、产品一致性  
**方法**: 静态代码分析 + 结构追踪 + 交叉引用验证

---

## 一、执行摘要

GEO 工作台经历了从"工程驱动"到"产品驱动"的转型，产生了**两套代码体系共存**的局面。GEO 的代码规模很大（后端 ~22,591 行 190 文件，前端 ~1,365 行 22 文件），但实际交付给用户的可运行资产极少——因为前端和后端之间存在严重的结构脱节。

**核心问题**: 前端 RC1 产品层与后端 V4 工程层是两支独立团队的幻觉，从未集成测试过。

**健康度评级**: ⚠️ 严重 (2/10)

---

## 二、架构分裂：三个互不关联的 GEO

系统存在三个版本的"GEO 工作台"：

### 版本 A：Brand GEO 旗舰版（废弃但未删除）
- 路径: `frontend/studio-v2/workspace/brand-geo/`
- 82 个文件，完整的 Claim/Evidence/Keyword/Brand/Report/History 功能
- 有定制的 `GEOApiClient`（`clients/GEOApiClient.ts`），独立 `GeoRoutes.ts`（50+ 路由）
- 有独立 Store（`useBrandGeoStore`）、Sidebar、Layout
- **当前状态**: 存活但无路由入口引导用户到达，属于废弃不删的"僵尸代码"

### 版本 B：Brand GEO V2 胶水层（废弃但未删除）
- 路径: `frontend/studio-v2/workspace/brand-geo-v2/`
- 12 个文件，作为 V1 到 RC1 的桥接层
- **当前状态**: 同属僵尸代码

### 版本 C：GEO RC1 产品层（意图取代但未完成）
- 路径: `frontend/workspaces/geo/`
- 22 个文件（6 页面 + 6 Service + 6 Store + 1 Layout + 1 Router + 1 API + 1 Navigation）
- 设计系统 43 个组件（15 Primitives + 13 Components + 15 Product Blocks）
- **当前状态**: 新建但未打通

### 结论
**三个"GEO"无一方可完整运行。** 版本 A 功能最全但被废弃且无入口，版本 C 有入口但数据管道不通。

---

## 三、路由双轨制

后端同时存在两套 API：

| 路径 | 用途 | 状态 |
|------|------|------|
| `/api/geo/*` | V4 工程 API（claim/evidence/entity/brand 等 CRUD） | ✅ 几乎完整 |
| `/api/v1/geo/*` | RC1 产品 API（health/recommendations/verification 等） | ⚠️ 新建但数据映射存疑 |

前端版本 C 只调用 `/api/v1/geo/*`，版本 A 只调用 `/api`（老版本路由）。两套 API 互不交叉。

**`geo-v1-product.route.ts`（607 行）是整个 RC1 的产品层骨干**，它从 Repository 层直接拉取数据组装成面向用户的 JSON。这条路由文件同时承担了 Data Mapper + 路由定义 + 业务逻辑三重职责，违反单一职责原则。

---

## 四、数据模型审计

### Prisma 模型覆盖度

**GEO 相关模型：18 张表**

| 模型 | 行数 | 用途 | 状态 |
|------|------|------|------|
| GeoProject | 21 | 项目根 | ✅ |
| GeoProjectProfile | 42 | 项目配置 | ✅ |
| GeoBrandProfile | 52 | 品牌信息 | ✅ |
| GeoBrandSetting | 18 | 品牌设置 | ✅ |
| GeoGraphNode / GeoGraphEdge | 19+17 | 知识图谱 | ✅ |
| GeoKeyword | 14 | 关键词 | ✅ |
| GeoScanHistory | 56 | 扫描记录 | ✅ |
| KnowledgeObject | 26 | 知识对象 | ✅ |
| OptimizationExecution | 34 | — | 🟡 可能 unused |
| VerificationJob / Result / Policy | 21+20+18 | 验证 | 🟡 可能 unused |
| GrowthMemory / GrowthKnowledge / LearningSignal | 30+15+25 | 学习 | 🟡 可能 unused |
| GeoScoreVersion | 15 | 版本管理 | 🟡 可能 unused |
| PublishingRecord | 15 | 发布记录 | 🟡 可能 unused |

**担心**: 18 张表中有近半数（~8 张）属于 V4 架构扩展产物（Verification/Growth/Learning/Publishing 状态机等），但 RC1 只用了 GeoProject、GeoBrandSetting、GeoScoreSnapshot 等最基本的数据源。**大量表和字段为未来的功能预留，当前无代码写入也无前端消费。**

### Repository 层健康度

`repositories/` 目录下 28 个文件覆盖 28+ 表的 CRUD，每个仓库平均 ~70 行。但：

- **Repository 与 v1 路由直接耦合**：`geo-v1-product.route.ts` 导入了 10+ 个 Repository，Route 层直接调用 Prisma 查询
- **平台层 Repository Contract 未见使用**：虽然有过 Repository Contract 的架构设计（`repositories/` 下的 `ApiRepository` 基类），但 RC1 路由直接 `import { prisma }` + 调用 repo 具体方法
- **Service 层缺失**: Route → Repository 直接连线，没有中间 Service 做业务编排

---

## 五、前后端数据契约断裂

这是最严重的质量问题。

### 前端期望的后端返回格式

以 HealthPage 为例，前端 `BrandHealthData` 类型：

```ts
{
  brandHealth: { score, trend, label, definition },   // 产品语言
  dimensions: [{ name, score, previousScore, isWarning, explanation }],
  dailyChange: number,
  recommendations: [{ id, title, expectedImpact, effort, reason }]
}
```

### 后端实际返回格式

```json
{
  "success": true,
  "data": {
    "brand": {"name": ..., "website": ..., "industry": ..., "status": ...},
    "healthScore": {"overall": 78, "change": 5, "trend": "improving"},
    "dimensions": [{"id": "visibility", "label": "AI Visibility", "score": 85, "maxScore": 100}],
    "explanation": {"summary": "...", "nextFocus": "knowledge"},
    "coverage": {"evidenceCount": 12, "entityCount": 45, "claimCount": 8},
    "recentChanges": [{date, score, change}],
    "quickActions": [{id, label, impact}]
  }
}
```

**差异**: 字段名完全不对应 (brandHealth vs healthScore, label vs definition 等)，结构不完全匹配。前端 Store 初始化时会尝试读取 `data.brandHealth.score`，但实际是 `data.healthScore.overall`，因此 `brandHealth.value` 始终为 null，所有 computed 和 template 条件判断都会失效。

### 影响范围

**全部 6 个 Service / 6 个 Store / 6 个 Page 都存在此问题。** 整个前端 RC1 的数据管道是建在沙子上的。

---

## 六、设计系统：富饶但未被消费

Design System 有 43 个组件（15 Primitives + 13 Components + 15 Product Blocks），但 HealthPage 实际只用了其中 12 个。

### 未被任何 Page 使用的 Product Blocks（7/15）
- ActionPanel
- ChannelList
- DistributionOverview
- GrowthOverview
- KnowledgeOverview
- MilestoneBanner
- OpportunityBlock
- ProofPanel
- VerificationSummary

**9/15 的 Product Blocks 已创建但未被任何页面引用。** 它们是为"未来页面"（Distribution Center、Growth Page 的完整版本）预建的。这些组件本身可能不 buggy，但在没有消费者的情况下无法验证其可用性。

### 18 个旧 workspace 组件（legacy）未清理
版本 A 和 B 的 94 个文件仍然存在于代码库中，虽然前端 CI 已有 legacy import 检查，但**被检查的文件路径（`//workspaces/geo`）未涵盖旧文件的自我引用**。旧文件内部互相 import，技术上仍然可以编译通过，形成"废弃次元"。

---

## 七、安全与认证审计

### 已发现问题
1. **Auth guard 路由覆盖修补**: `/workspace/geo/*` 最初不在 auth middleware 保护列表内（已修复）
2. **前端 Service 初始为裸 ofetch 无 token**: 6 个 Service 原本不携带 Authorization header（已修复统一 token 注入）
3. **Cookie 敏感信息**: `auth_token` 和 `auth_user` 存为明文 cookie，无 `Secure`/`HttpOnly` 标记

### 已修复
- Auth guard 加入 `/workspace/` 保护路径
- `geoApi` 统一实例自动注入 Bearer token

---

## 八、架构债务明细

### P0 - 阻塞用户的核心问题
| # | 问题 | 影响 |
|---|------|------|
| 1 | 前后端数据契约完全不一致（6/6 Service 类型不匹配） | 任何页面无法渲染数据 |
| 2 | 旧 workspace 代码（94 文件）有入口但无路由可达 | 资源浪费，维护负担 |
| 3 | RC1 新页面缺少真实数据回填 | 即便类型修好，健康页也是空数据 |

### P1 - 质量隐患
| # | 问题 |
|---|------|
| 1 | Route 层直接 import Prisma（绕过 Service 层） |
| 2 | 607 行路由文件承担 Data Mapper + 路由 + 业务逻辑三重职责 |
| 3 | 8 张 V4 扩展表无数据写入路径 |
| 4 | 15 Product Blocks 中 9 个零消费者 |

### P2 - 架构规范
| # | 问题 |
|---|------|
| 1 | 工程宪法 DS-AR-001/002（单向依赖）只检查新建 workspace，不覆盖旧代码 |
| 2 | 无 E2E 测试、API contract 测试、集成测试 |
| 3 | 产品词汇表（Forbidden Vocabulary）定义了但未在 API 返回字段中实施 |

---

## 九、路线图分析

### 6 Sprint 规划 vs 实际进展

根据 `GEO_DEV_ROADMAP.md`，计划了一个 6 Sprint 路线图。实际上完成的是：

| Sprint | 目标 | 实质进展 |
|--------|------|----------|
| UI-01: HealthPage | 可工作的健康页 | ❌ 后端已 build，前端页面已构建，但数据管道不通 |
| UI-02 ~ UI-06 | 其余 5 页 | ❌ 页面骨架存在，数据管道同样全断 |

**当前状态**: 前端骨架完成（6 页面模板），后端产品 API 路由几乎就绪（8 端点），但**没有任何一个端到端的数据流动验证通过**。

---

## 十、建议

### ① 立即止血
- 在 `geo-v1-product.route.ts` 的每个端点添加模拟数据回退（mock fallback），使前端至少在无真实数据时能展示 UI
- 修复 6 个 Service 的 Data Mapper，使其能正确消化后端返回

### ② 清理僵尸代码
- 删除或归档 `brand-geo/` 和 `brand-geo-v2/` 下全部 94 文件
- 这大约占 GEO 前端代码量的 80%

### ③ 建立契约测试
- 为 `/api/v1/geo/*` 的 8 个端点写 Response Schema / TypeScript 类型测试
- 模式：`后端 API 类型` ↔ `前端 Service 类型` 双向校验

### ④ 选择一条路而不是三条
- **方案 A**: 放弃 RC1 新产品，回到版本 A（brand-geo）完善体验
- **方案 B**: 弃用版本 A，集中精力把 RC1 的前后端数据管道打通
- 两边同时维护没有任何收益

---

**总结**: GEO 工作台不是做废了，是**从没真正做完过**。每次"冻结"都是某一层冻结，下层完全没配合。当前最需要的是选择一个方向一次打通端到端，而不是继续在架构文档里加新的 Plane 和 Layer。

---
*审计人: OpenClaw Workspace Agent / 独立第三方*
*审计方法: 静态代码分析，无运行环境介入*
