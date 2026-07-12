# GEO Workspace + AI Knowledge Hub — 第三方产品审计报告

**审计机构:** Independent Product Auditor  
**审计日期:** 2026-07-15  
**审计版本:** RC1  
**审计范围:** GEO Workspace (frontend/workspaces/geo, backend/src/services/geo) + AI Knowledge Hub (frontend/pages/workspace/knowledge-hub, backend/src/services/knowledge)

---

## 审计方法

- 全文件递归检查（300+ 前端文件，500+ 后端文件）
- 代码静态分析：数据流追踪、依赖分析、架构模式检查
- 每个结论附带文件路径+行号证据

---

## A. 产品成熟度评分: 52/100 ⚠️

### 页面可访问性检查

| 页面 | 路径 | 返回200 | 有实际内容 | 非Mock数据 | 评分 |
|------|------|---------|-----------|-----------|------|
| GEO Dashboard | `frontend/pages/workspace/geo/dashboard.vue` → `GEODashboard.vue` | ✅ | ✅ | ✅ | PASS |
| GEO Discovery | `frontend/pages/workspace/geo/discovery.vue` → `DiscoveryLabPage.vue` | ✅ | ✅ | ⚠️ Mock | PARTIAL |
| GEO Workflow | `frontend/workspaces/geo/pages/WorkspaceFlowPage.vue` | ✅ | ✅ | ✅ | PASS |
| GEO Optimization | `frontend/workspaces/geo/pages/RecommendationsPage.vue` | ✅ | ✅ | ✅ | PASS |
| GEO Verification | `frontend/pages/workspace/geo/verification.vue` → `VerificationPage.vue` | ✅ | ✅ | ⚠️ Mock | PARTIAL |
| GEO Publishing | `frontend/pages/workspace/geo/publishing.vue` → `PublishingPage.vue` | ✅ | ✅ | ✅ | PASS |
| GEO Knowledge | `frontend/pages/workspace/geo/knowledge.vue` → `KnowledgePage.vue` | ✅ | ✅ | ✅ | PASS |
| AI Knowledge Hub 首页 | `knowledge-hub/index.vue` | ✅ | ✅ | ❌ 硬编码全0 | PARTIAL |
| AI Knowledge Hub 品牌 | `knowledge-hub/brand.vue` | ✅ | ❌ 空状态 | ❌ 无数据 | FAIL |
| AI Knowledge Hub 产品 | `knowledge-hub/product.vue` | ✅ | ❌ 空状态 | ❌ 无数据 | FAIL |
| AI Knowledge Hub 知识 | `knowledge-hub/knowledge.vue` | ✅ | ❌ 空状态 | ❌ 无数据 | FAIL |
| AI Knowledge Hub 实体 | `knowledge-hub/entity.vue` | ✅ | ❌ 空状态 | ❌ 无数据 | FAIL |
| AI Knowledge Hub 发布 | `knowledge-hub/publishing.vue` | ✅ | ❌ 空状态 | ❌ 无数据 | FAIL |
| Brand Overview | `frontend/workspaces/geo/pages/BrandOverview.vue` | ✅ | ✅ | ✅ | PASS |
| Report Center | `frontend/workspaces/geo/pages/ReportCenter.vue` | ✅ | ✅ | ✅ | PASS |

### 关键发现

1. **AI Knowledge Hub 6 页面中 5 个处于"空状态"** (brand, product, knowledge, entity, publishing)—除首页有硬编码全0指标外，其余4个子页面完全为空模板。  
   → 证据: `knowledge-hub/brand.vue:14-20`, `knowledge-hub/product.vue:14-20`, `knowledge-hub/knowledge.vue:14-20`, `knowledge-hub/entity.vue:14-20`, `knowledge-hub/publishing.vue:14-20` (全部是 `<div class="kh-empty">`)

2. **GEO Discovery 数据完全由 MockScanner 生成**，不调用任何真实 AI Provider。  
   → 证据: `backend/src/benchmark/discovery/mock-scanner.ts:1-10` — "所有数据均为模拟生成，不调用任何真实 AI Provider"

3. **Showcase Stories 和 Trending 返回空数组**  
   → 证据: `backend/src/services/geo/showcase/showcase.service.ts:161: stories: [], trending: []`

4. **Health 页面** (`frontend/pages/workspace/geo/health.vue`) 有完整的 Brand Selector + 品牌健康评估 UI，但依赖真实 project 数据。

---

## B. 商业可发布程度: 35/100 ❌

### 关键商业缺陷

1. **AI Knowledge Hub 不可商用** — 5/6 页面仅为占位符（空状态页面），市场价值为0。  
   → 证据: 同上

2. **AI Presence Engine 所有 Adapter 为 Stub** — 12个AI平台适配器全部模拟实现，不调用任何真实 API：  
   - ChatGPT: `backend/src/services/geo/presence/adapters/chatgpt.ts:3-5` — "Stub implementation (no real API call)"  
   - Claude: `backend/src/services/geo/presence/adapters/claude.ts:3-5`  
   - DeepSeek: `backend/src/services/geo/presence/adapters/deepseek.ts:3-5`  
   - 所有12个适配器均如此

3. **Discovery 使用 MockScanner** — 无法实际验证品牌在 AI 生态的真实可见度。  
   → 证据: `backend/src/benchmark/discovery/mock-scanner.ts:7-10`

4. **Verification 引擎依赖 MockClaims** — `MockProvider.verify()` 生成确定性伪随机 claims。  
   → 证据: `backend/src/services/geo/provider/mock-provider.ts:73-100`

5. **Dashboard 首页判断 VIP 权限后才允许创建品牌** — 非 VIP 用户看到的是付费墙而非产品。  
   → 证据: `GEODashboard.vue:99-115`

---

## C. 工程成熟度: 58/100 ⚠️

### Repository Pattern 审计

| 模式 | 状态 | 证据 |
|------|------|------|
| 路由直接调用 Repository | ✅ 通过 | 所有路由都通过 repository 访问数据 |
| 路由直接调用 Prisma | ❌ **违规** | `geo-verification.route.ts:9-12`: 直接在路由中 new PrismaClient() |
| 路由包含业务逻辑 | ⚠️ **严重违规** | `geo-explain.route.ts`: 包含 explain 生成、recommendation 生成、evidence 构建等全部业务逻辑（~250行）|
| 路由包含业务逻辑 | ⚠️ **严重违规** | `geo-optimization.route.ts`: 包含 recommendation 生成、potentialGain 计算的完整规则引擎（~200行）|
| Benchmark 依赖在 GEO Routes 中 | ⚠️ **架构违规** | `geo-discovery.route.ts:10-18`: 导入 `benchmark/discovery/`, `benchmark/opportunity`, `benchmark/sie/`, `benchmark/scenario/`, `benchmark/action-plan/`, `benchmark/verification/` 全部6个模块 |

### Registry Pattern 审计

| Registry | 状态 | 证据 |
|----------|------|------|
| Provider Registry (GeoProviderRegistry) | ✅ 存在 | `backend/src/services/geo/provider/provider-registry.ts` |
| Scenario Store | ✅ 存在 | `backend/src/benchmark/scenario/scenario-store.ts` (但在 benchmark/ 而非 services/geo/) |
| Intent Registry (Industry Intent Registry) | ✅ 存在 | `backend/src/benchmark/sie/industry-intent-registry.ts` |
| Prompt Registry | ✅ 存在 | `backend/src/services/geo/registry/geo-prompt-registry.ts` + `backend/src/services/geo/runtime/prompt/PromptRegistry.ts` |
| ProviderAdapterRegistry (Presence) | ✅ 存在 | `backend/src/services/geo/presence/registry.ts` |

### 遗留文件审计

| 问题 | 严重程度 | 证据 |
|------|---------|------|
| 20+ 个 .bak 文件 | ⚠️ | `backend/src/services/geo/services/geo-entity.service.ts.bak` 等共20个 |
| `_deprecated/` 目录包含发布代码 | ⚠️ | `backend/src/services/geo/publishing/_deprecated/` 包含5个文件 |
| 重复 Discovery Route 端点 | ⚠️ | `geo-discovery.route.ts:110-130`: `/api/geo/discovery/verify` 和 `/api/v1/geo/discovery/verify` 完全重复 |

### 重复实现

| 发现 | 状态 |
|------|------|
| Explain 引擎在路由 + 服务中重复实现 | ⚠️ `geo-explain.route.ts` + `explain/engine.ts` |
| Recommendation 生成在 explain 和 optimization route 中重复 | ⚠️ 逻辑高度相似 |

---

## D. AI GEO 专业度: 45/100 ⚠️

### Golden Dataset

| 组件 | 状态 | 文件 |
|------|------|------|
| Golden Dataset v1.0 (SaaS + Ecommerce 共40实体) | ✅ 已冻结 | `backend/src/services/geo/provider/benchmark/golden/v1.0/` |
| Schema Validator | ✅ | `schemaValidator.ts` |
| Registry Validator | ✅ | `registryValidator.ts` |
| Evidence Validator | ✅ | `evidenceValidator.ts` |
| Signal Validator | ✅ | `signalValidator.ts` |
| Band Validator | ✅ | `bandValidator.ts` |
| Report Builder | ✅ | `reportBuilder.ts` |
| 统一入口 | ✅ | `validator/index.ts` |

### Benchmark Runner

| 组件 | 状态 | 证据 |
|------|------|------|
| Benchmark Runner 类 | ✅ 存在 | `backend/src/benchmark/runner/benchmark-runner.ts` |
| CLI | ✅ 存在 | `backend/src/benchmark/cli/run.ts` |
| 是否连接到实际 UI | ❌ 无 | 无前端页面调用 Benchmark Runner |

### AI Provider 基础设施

| 组件 | 状态 |
|------|------|
| DeepSeek Provider | ✅ 存在（生产级） |
| Mock Provider | ✅ 存在（用于开发） |
| Circuit Breaker | ✅ |
| Cache | ✅ |
| Rate Limiter | ✅ |
| Fallback Chain | ✅ |
| Shadow Mode | ✅ |
| Request Deduplicator | ✅ |
| Observability | ✅ |

### 关键问题

1. **MockScanner 生成的数据在多个页面使用** — Discovery Page, Verification Page, Project Detail 均依赖 MockScanner  
2. **Presence Engine Adapters 全部为 Stub** — 无任何真实 AI 平台 API 调用  
3. **Benchmark Runner 无前端集成** — 仅在 CLI 可运行  
4. **Golden Dataset Validator 无前端 UI** — 纯后端工具

---

## E. UI 产品完成度: 60/100 ⚠️

### 组件使用一致性

| 检查项 | 状态 | 证据 |
|--------|------|------|
| 导航统一性 (KunlunNav) | ✅ 已集成 | `KunlunNav.vue:34`: 有 Knowledge Hub + GEO 入口 |
| 空状态 (GeoEmptyState) | ✅ 统一使用 | Dashboard, Discovery, Knowledge, Publishing 等页面均使用 |
| Loading (GeoPageSkeleton) | ✅ 统一使用 | KnowledgePage, PublishingPage, VerificationPage 等 |
| 卡片组件 (GeoCard) | ✅ 统一使用 | 多个 data state 页面使用 |
| 指标卡片 (GeoMetricCard) | ✅ | Dashboard KPI Bar |
| 评分卡片 (GeoScoreCard) | ✅ | KnowledgePage |
| 颜色主题一致性 | ✅ | 统一的蓝-绿-灰配色方案 |

### 页面跳转

| 检查项 | 状态 |
|--------|------|
| Dashboard → Discovery | ✅ |
| Dashboard → Workflow | ✅ |
| Dashboard → Brand Detail | ✅ |
| Dashboard → Create | ✅ |
| Knowledge Hub → 子页面 | ✅ (所有链接存在) |
| Knowledge Hub → GEO Dashboard | ✅ |

### 关键 UI 缺陷

1. **Knowledge Hub 首页全部指标硬编码为0**  
   → 证据: `knowledge-hub/index.vue:11-16` — `metric-value: 0` x6, `readiness-value: 0%` x5

2. **Knowledge Hub 子页面仅显示空状态** — 用户看到5个几乎完全相同的 "暂无XX数据" 页面  
   → 证据: `knowledge-hub/brand.vue`, `knowledge-hub/product.vue`, `knowledge-hub/knowledge.vue`, `knowledge-hub/entity.vue`, `knowledge-hub/publishing.vue`

3. **部分页面使用内联 CSS 而非统一组件** — PublishingPage 和 KnowledgePage 有重复的 `.geo-btn` 定义  
   → 证据: `PublishingPage.vue:284-305`, `KnowledgePage.vue:219-236`

4. **Brand Overview 页面 4000+ 行** — 包含大量内联样式，可能影响维护性  
   → 证据: `BrandOverview.vue` 共约 4300 行

---

## F. Knowledge Hub 完成度: 15/100 ❌

### 后端完成情况

| 组件 | 状态 | 证据 |
|------|------|------|
| API Routes (6 端点) | ✅ 已注册 | `backend/src/services/knowledge/api/index.ts:12-50` |
| Service Layer | ✅ 存在 | `backend/src/services/knowledge/application/service.ts` |
| Repository Layer | ❌ 全空实现 | `backend/src/services/knowledge/repository/index.ts:13-55` — 所有方法返回 `[]` 或全0 metrics |
| Prisma 连接 | ❌ 无 | Repository 不做任何数据库查询 |
| Domain Types | ✅ 完整 | `backend/src/services/knowledge/domain/types.ts` |

### 前端完成情况

| 组件 | 状态 | 证据 |
|------|------|------|
| 导航入口 (KunlunNav) | ✅ 存在 | `KunlunNav.vue:34` |
| 首页 Dashboard | ⚠️ 硬编码 | 所有指标值是 `0` |
| 品牌中心 | ❌ 空状态 | 无任何数据 |
| 产品中心 | ❌ 空状态 | 无任何数据 |
| 知识中心 | ❌ 空状态 | 无任何数据 |
| 实体图谱 | ❌ 空状态 | 无任何数据 |
| 发布中心 | ❌ 空状态 | 无任何数据 |
| Store/API Client | ❌ 不存在 | 无 Pinia Store，无 API Service |

### 结论

AI Knowledge Hub 目前仅为**占位级别**。后端 Repository 全部返回空数据，前端 5/6 页面全部为空状态，首页显示六个"0"。**不可发布**。

---

## G. 最终结论: ❌ NOT READY

| 评分维度 | 分数 | 等级 |
|----------|------|------|
| A. 产品成熟度 | 52/100 | ⚠️ RC2 候选 |
| B. 商业可发布程度 | 35/100 | ❌ 不可发布 |
| C. 工程成熟度 | 58/100 | ⚠️ 需修复 |
| D. AI GEO 专业度 | 45/100 | ⚠️ 需完善 |
| E. UI 产品完成度 | 60/100 | ⚠️ 可接受 |
| F. Knowledge Hub 完成度 | 15/100 | ❌ 严重不足 |
| **综合** | **44/100** | **❌ NOT READY** |

### 不能发布的原因

1. **AI Knowledge Hub 未完成 (5/6 页面为空，后端无数据)** — 产品承诺的一个完整模块完全没有交付
2. **AI Presence Engine 全部为 Stub** — 核心产品价值（跨AI平台可见度检测）无法实际工作
3. **Discovery 数据完全 Mock** — 无法对真实品牌进行评估
4. **大量 .bak 文件和 `_deprecated/` 代码** — 工程质量不达标
5. **路由层包含大量业务逻辑** — 架构模式被违反

---

## H. P0/P1/P2 整改清单

### P0 — 不修复不能上线

| ID | 问题 | 位置 | 建议修复 |
|----|------|------|---------|
| P0-1 | AI Knowledge Hub 后端 Repository 全部返回空数据 | `backend/src/services/knowledge/repository/index.ts:13-55` | 实现 Prisma 查询，连接真实数据库 |
| P0-2 | AI Knowledge Hub 5/6 子页面全部为空状态 | `knowledge-hub/brand.vue`, `product.vue`, `knowledge.vue`, `entity.vue`, `publishing.vue` | 实现数据渲染，至少显示创建/占位 UI |
| P0-3 | AI Knowledge Hub 首页指标全部硬编码为0 | `knowledge-hub/index.vue:11-16` | 连接后端 API，显示真实数据 |
| P0-4 | AI Presence Engine 12 个 Adapter 全部为 Stub | `presence/adapters/chatgpt.ts:3-5` 等12个文件 | 至少实现 2-3 个真实 API 适配器（ChatGPT, DeepSeek, Claude） |
| P0-5 | Discovery 数据完全依赖 MockScanner | `backend/src/benchmark/discovery/mock-scanner.ts:7-10` | 集成至少一个真实 AI Provider |
| P0-6 | 20+ .bak 文件污染代码库 | `backend/src/services/geo/services/*.bak`, `routes/*.bak` 等 | 清理所有 .bak 文件 |

### P1 — 建议 RC 前修复

| ID | 问题 | 位置 | 建议修复 |
|----|------|------|---------|
| P1-1 | 路由层包含业务逻辑（Explain, Recommendation, Optimization） | `geo-explain.route.ts`, `geo-optimization.route.ts` | 将业务逻辑抽取到 Service 层 |
| P1-2 | 路由直接 new PrismaClient() | `geo-verification.route.ts:9-12` | 通过 Repository/Service 访问数据库 |
| P1-3 | Benchmark 模块被 GEO Routes 直接依赖 | `geo-discovery.route.ts:10-18` | 通过 Service 接口解耦 |
| P1-4 | Presence Engine Stub 的部署影响 | `presence/engine.ts` | 添加特征标记，生产环境禁用 Stub 模式 |
| P1-5 | Knowledge Hub 无前端 Store/API 客户端 | 缺少 `useKnowledgeHubStore` | 实现 Pinia Store + API Service |
| P1-6 | Showcase Stories 和 Trending 返回空数组 | `showcase.service.ts:161-162` | 添加示例数据或连接真实数据源 |
| P1-7 | `/api/geo/discovery/verify` 和 `/api/v1/geo/discovery/verify` 重复 | `geo-discovery.route.ts:110-130` | 统一路由命名 |
| P1-8 | 部分页面 UI 组件重复定义 (.geo-btn) | `PublishingPage.vue:284-305`, `KnowledgePage.vue:219-236` | 提取到统一组件 |
| P1-9 | Dashboard 首页 VIP 付费墙过于严格 | `GEODashboard.vue:99-115` | 允许非VIP用户查看演示/只读数据 |
| P1-10 | Benchmark Runner 无前端集成 | `benchmark-runner.ts` | 至少添加一个状态页面 |

### P2 — 后续迭代优化

| ID | 问题 | 建议 |
|----|------|------|
| P2-1 | `_deprecated/` 目录清理 | 移除 Publishing 旧实现 |
| P2-2 | Brand Overview 页面 4000+ 行 | 拆分为子组件 |
| P2-3 | Golden Dataset 覆盖更多行业 | 当前仅有 SaaS + Ecommerce |
| P2-4 | Benchmark Runner CLI → API 集成 | 提供 REST 端点 |
| P2-5 | Verification Engine 集成真实 Provider | 减少 Mock 依赖 |

---

## I. 逐项验收清单

### 1. 产品成熟度

| 检查项 | 结果 | 备注 |
|--------|------|------|
| GEO Dashboard 可访问 | ✅ PASS | `dashboard.vue` → `GEODashboard.vue` |
| GEO Discovery 可访问 | ✅ PASS | `discovery.vue` → `DiscoveryLabPage.vue` |
| GEO Workflow 可访问 | ✅ PASS | `WorkspaceFlowPage.vue` |
| GEO Optimization 可访问 | ✅ PASS | `RecommendationsPage.vue` |
| GEO Verification 可访问 | ✅ PASS | `verification.vue` → `VerificationPage.vue` |
| GEO Publishing 可访问 | ✅ PASS | `publishing.vue` → `PublishingPage.vue` |
| GEO Knowledge 可访问 | ✅ PASS | `knowledge.vue` → `KnowledgePage.vue` |
| Brand Overview 可访问 | ✅ PASS | `BrandOverview.vue` |
| Report Center 可访问 | ✅ PASS | `ReportCenter.vue` |
| 非 Mock 数据 | ⚠️ PARTIAL | Discovery + Verification 依赖 Mock |
| 无空状态 | ⚠️ PARTIAL | Knowledge Hub 5/6 页面为空 |

### 2. 数据真实性

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Dashboard 指标来自数据库 | ✅ PASS | 通过 Repository 查询 Prisma |
| Discovery 数据真实 | ❌ FAIL | 依赖 MockScanner |
| Presence 数据真实 | ❌ FAIL | 所有 Adapter 为 Stub |
| Verification 数据真实 | ⚠️ PARTIAL | 包含真实 DB 查询 + Mock Claims |
| Showcase 数据部分真实 | ⚠️ PARTIAL | overview 来自 DB, stories/trending 为空 |
| Knowledge Hub 数据真实 | ❌ FAIL | Repository 返回空数组 |

### 3. 架构合规性

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Repository Pattern 遵守 | ⚠️ PARTIAL | 多数通过，1处直接 Prisma + 2处路由含业务逻辑 |
| Registry Pattern 遵守 | ✅ PASS | Provider/Intent/Prompt/Scenario/Adapter 均注册 |
| 无 .bak 文件 | ❌ FAIL | 20+ .bak 文件 |
| 无重复实现 | ⚠️ PARTIAL | Explain + Recommendation 逻辑重复 |
| 无死代码 | ❌ FAIL | `_deprecated/` 目录 |

### 4. UI/UX

| 检查项 | 结果 |
|--------|------|
| KunlunNav 导航 | ✅ PASS |
| GeoEmptyState 统一 | ✅ PASS |
| GeoPageSkeleton 统一 | ✅ PASS |
| GeoCard 统一 | ✅ PASS |
| GeoMetricCard 统一 | ✅ PASS |
| 颜色主题一致性 | ✅ PASS |
| 页面跳转合理性 | ✅ PASS |

### 5. 数据流完整性

| 步骤 | Route | Service | Repository | 真实 DB | 前端页面 |
|------|-------|---------|-----------|---------|---------|
| Discovery | ✅ geo-discovery.route | ✅ discovery-service | ✅ geo-project.repo | ⚠️ MockScanner | ✅ DiscoveryLabPage |
| Issue Analysis | ✅ geo-discovery.route | ✅ opportunity-service | — | ⚠️ 算法生成 | ✅ DiscoveryLabPage |
| Optimization | ✅ geo-recommendation.route | ✅ recommendation-* | ✅ geo-project.repo | ✅ | ✅ RecommendationsPage |
| Verification | ✅ geo-verification.route | ✅ verification.engine | ✅ verification.repository | ⚠️ 部分Mock | ✅ VerificationPage |
| Publishing | ✅ geo-publishing.route | ✅ plan.service + claim.service + recorder.service | ✅ publishing-record.repo | ✅ | ✅ PublishingPage |
| Knowledge Hub | ✅ geo-knowledge.route | ✅ KnowledgeObjectService | ✅ KnowledgeObjectRepository | ✅ | ✅ KnowledgePage.vue |
| Monitoring | ✅ geo-monitor.route | ✅ monitor.service | ✅ monitor.repository | ✅ | — (数据端) |

### 6. AI Knowledge Hub 专项

| 检查项 | 结果 | 备注 |
|--------|------|------|
| KunlunNav 入口 | ✅ PASS | `KunlunNav.vue:34` |
| 首页可访问 | ✅ PASS | 返回200 |
| 5个子页面可访问 | ✅ PASS | 全部返回200 |
| 5个子页面有内容 | ❌ FAIL | 全部为空状态 |
| 后端 API 全部注册 | ✅ PASS | 6端点已注册 |
| 后端 API 返回非404 | ⚠️ PARTIAL | 返回空数据而非404 |
| Store/Service/API client | ❌ FAIL | 不存在 |
| 连接到 Prisma | ❌ FAIL | Repository 全部返回空 |
| 数据真实 | ❌ FAIL | 全部硬编码/空 |

### 7. AI GEO 专业能力

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Golden Dataset | ✅ 成品 | 40实体, 2行业, 已冻结 |
| Golden Validator | ✅ 成品 | 7文件 + index.ts |
| Benchmark Runner | ✅ 成品 | 支持 job-based 运行 |
| Scenario Registry | ✅ 成品 | 128+ 场景预定义 |
| Intent Registry | ⚠️ Demo级别 | industryIntentRegistry 存在但较小 |
| Provider Registry | ✅ 成品 | GeoProviderRegistry + fallback + circuit breaker |
| Prompt Registry | ✅ 成品 | PromptRegistry + GeoPromptRegistry |
| MockScanner | ⚠️ Demo级别 | 确定性伪随机，无真实 AI |

---

## 附录: 关键证据索引

| 证据 | 文件 | 行 |
|------|------|----|
| MockScanner 声明 | `backend/src/benchmark/discovery/mock-scanner.ts` | 7-10 |
| Presence Adapter Stub 声明 | `presence/adapters/chatgpt.ts` | 3-5 |
| Showcase stories/trending 为空 | `showcase/showcase.service.ts` | 161-162 |
| Knowledge Repo 全空 | `knowledge/repository/index.ts` | 13-55 |
| Verification Route 直接 new PrismaClient | `routes/geo-verification.route.ts` | 9-12 |
| Explain Route 包含全部业务逻辑 | `routes/geo-explain.route.ts` | 全文件~250行 |
| Optimization Route 包含规则引擎 | `routes/geo-optimization.route.ts` | 全文件~200行 |
| Discovery Route 依赖6个Benchmark模块 | `routes/geo-discovery.route.ts` | 10-18 |
| Knowledge Hub 首页全零 | `knowledge-hub/index.vue` | 11-16 |
| Knowledge Hub 子页面空状态 | `knowledge-hub/brand.vue` 等5个 | 14-20 |
| KunlunNav 入口 | `components/kunlun/business/KunlunNav.vue` | 34 |
| 20+ .bak 文件 | `services/*.bak`, `routes/*.bak` 等 | — |
| 重复路由端点 | `routes/geo-discovery.route.ts` | 110-130 |

---

*审计结束 — 客观、独立、不美化*
