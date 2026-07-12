# GEO v2.0 Phase 1 — P1-001: Architecture Audit & Integration Plan

- **日期**: 2026-07-03
- **审计范围**: Knowledge Hub / Knowledge Compiler / Publish Manifest / JSON-LD Builder / Nuxt Frontend / Deployment
- **审计人**: Agent

---

## A. Knowledge Hub — Platform Layer

**路径**: `backend/src/platform/knowledge-hub/`

**当前能力**:
- 定义了完整的 `KnowledgePackage` 规范类型（core/types.ts），涵盖 identity/claims/evidence/assets/citations/publishingTargets
- `PackageBuilder` 通过 `KnowledgeProvider` 接口工作，支持 provider 注册和实例化
- `PackageValidator` 对 workspace 类型、status、字段完整性做了校验
- `VersionEngine` 支持 snapshot 创建/历史查询/diff/rollback（内存存储，不可变快照）
- `ProviderRuntime` 是 provider 注册中心，支持按 workspace/entity 查找
- CRUD API 已注册在 `/api/knowledge/packages`（创建/列表/详情/校验）
- `PublishingEngine`（KH2）已注册在 `/api/knowledge/publish/`，通过 queue 管理发布任务
- 已有 Publisher 适配器：WebsitePublisher / CMSPublisher / WebhookPublisher / ExportPublisher
- `GeoKnowledgeProvider` 已注册但全部返回空数据（TODO 标记）
- `ReviewEngine` (KH3)、`DistributionEngine` (KH4)、`ObservabilityEngine` (KH5) 均已注册
- 所有 routes 在 `backend/src/index.ts` 中 startup 阶段动态导入注册
- `PackageRepository` 通过 Prisma 读写 `knowledgePackage` 表

**存在缺失**:
- `GeoKnowledgeProvider.buildContent()` 返回空包，未与实际 GEO 数据源集成
- `PackageRepository.toDTO()` 方法丢失结构化内容（claims/evidence/assets 全为 `[]`）—— **Repository 仅存储了 Prisma 表字段，未持久化完整 DTO 内容字段**
- `PublishingEngine` 的 publish 方法中 `pkg` 通过 `repo.findById` 获取后直接 `as any` 传递给 publisher —— 实际拿到的是空 DTO
- `PublishingEngine` 当前是同步处理，文档提到"KH2-T003: async queue in next iteration"
- Manifest 版本没有文件系统持久化方案（当前全部内存存储）
- VersionEngine 同样是内存存储，重启即丢失

**可复用**:
- `KnowledgePackage` 类型定义（core/types.ts）—— 可作为 hub 侧的 canonical 数据合约
- `PackageValidator` —— 验证逻辑可以直接复用
- `ProviderRuntime` 注册/查找模式 —— 设计模式可直接复用
- `VersionEngine` 的 snapshot/diff/getHistory 接口设计
- `PublishingEngine` 的 queue/job/status 状态机设计
- `KnowledgePackageRepository` 的 Prisma 查询层

**需要新增**:
- KnowledgePackage 的**完整 DTO 序列化/反序列化** —— 当前 repo 只存了部分字段，claims/evidence/assets/citations 等 JSON 字段需要存储在数据库或另存
- `GeoKnowledgeProvider` 真正对接 GEO claim/entity/evidence 数据源
- Manifest 体系的内存 → 持久化迁移

**与 Manifest 的关系**:
- 当前: **无关联** —— Platform Knowledge Hub 的 KnowledgePackage 与 GEO Publish Manifest 是两个独立的类型系统
- 改造后: Platform Knowledge Hub 的 KnowledgePackage 作为**数据源之一**输出给 Manifest Builder，但 Phase 1 建议跳过此层，直接让 Manifest Builder 从 GEO services 读取数据

---

## B. Knowledge Compiler (`services/knowledge/`)

**路径**: `backend/src/services/knowledge/`（注意：这是独立于 platform/knowledge-hub/ 的另一套系统）

**当前能力**:
- 完整的知识编译管道：`compileKnowledgePackage()` 并行调用所有 Builder
- 输出 `CompiledKnowledgePackage`，包含 meta/summary/data 三层结构
- 输出内容：brands / products / entities / articles + JSON-LD 5 种 + Prompt Block 5 种
- JSON-LD Builder 支持：`Organization` / `Product` / `Article` / `FAQPage` / `BreadcrumbList` + `@graph` 全集
- Prompt Block Builder 支持：LlmSummary / CitationBlock / RetrievalContext / CanonicalFacts / FaqPrompt
- Snapshot 系统：`createSnapshot` / `getLatestSnapshot` / `diffSnapshots`（内存存储，基于 SHA-256 去重）
- API 注册在 `/api/v1/ai-knowledge/` 下（dashboard/brands/products/articles/entities/publications/package/jsonld/prompt/snapshot）
- Repository 基于 Prisma: `knowledgeBrand` / `knowledgeProduct` / `knowledgeArticle` / `knowledgeEntity` / `knowledgePublication` 五个表
- 支持 Dashboard 指标（aiReadiness / knowledgeCompleteness 等）
- `knowledgeService` 封装了 CRUD 逻辑，`knowledgeApi` 是路由层

**存在缺失**:
- 与 Platform Knowledge Hub 完全隔离 —— **两套独立的 knowledge 体系**（一个在 `services/knowledge/`，一个在 `platform/knowledge-hub/`）
- Compiler 输出未对接 Publish Manifest —— 当前 compileKnowledgePackage() 返回 `CompiledKnowledgePackage` 而非 `PublishManifest`
- Snapshot 系统只记录元数据 stats，不保存完整 content —— 无法用于版本回滚内容恢复
- Compiler 的 Builder（BrandPackage / ProductPackage）直接读取 `knowledgeRepository`（Prisma），没有经过缓存层
- JSON-LD Builder 触发数据库读（buildArticleJsonLd 调用了 knowledgeRepository.getArticles），不是纯函数
- Prompt Block 硬编码了 5 种类型，没有扩展注册机制
- FAQ 目前全部返回 "暂无 FAQ 数据"（Repository 没有 FAQ 字段）

**可复用**:
- `compileKnowledgePackage()` 的并行 Builder 架构设计
- `buildOrganizationJsonLd` / `buildProductJsonLd` / `buildArticleJsonLd` / `buildFaqJsonLd` / `buildFullJsonLd` —— 5 个 JSON-LD Builder 函数
- `buildLlmSummary` / `buildAiCitationBlock` / `buildCanonicalFacts` —— Prompt Block 生成逻辑
- `package-builder.ts` 的 BrandPackage / ProductPackage / EntityPackage 转换逻辑
- Snapshot 的 `packageToSnapshot` / `diffSnapshots` 对比逻辑

**需要新增**:
- **Compiler → Manifest 桥接层**：将 CompiledKnowledgePackage 转换为 PublishManifest
- **JSON-LD 合并器**：当前 JSON-LD Builder 全部嵌在 Compiler 中，Publish Manifest 需要独立的 JSON-LD 生成能力
- **FAQ Builder** 真实数据接入

**与 Manifest 的关系**:
- 当前: **间接关联**—— Compiler 输出 JSON-LD（被 Manifest 需要），但数据格式不匹配 PublishManifest 的类型定义
- 改造后: Compiler 作为 Manifest 的**纯数据生产者**，通过适配层转换为 PublishManifest；或 Compiler 增加一个 `compileToManifest()` 分支

---

## C. Publish Manifest

**路径**: `backend/src/services/geo/publishing/manifest/`

**当前能力**:
- 完整类型定义：`PublishManifest` 含 10 个嵌套子类型（Identity / Routing / Content / StructuredData / Metadata / Discoverability / Assets / Publishing / Version）
- `buildManifestFromPackage()` 从任意 data 对象构造 Manifest，自动生成 slug/routing/metadata/JSON-LD/discoverability
- `buildFromKnowledgePackage()` 智能识别包类型（brand/entity/topic/faq），调用 build 并自动注册
- `buildAllFromPackages()` 批量转换
- `manifestRegistry` 内存存储，支持 get/getByPath/getAll/getByType/save/delete/count/getStats
- 3 个 read-only API：列表 / 统计 / 详情，注册在 `/api/v1/geo/manifests/`
- Route 已在 `backend/src/index.ts` 中 startup 注册（try-catch 包裹，优雅跳过）

**存在缺失**:
- **无持久化** —— manifestRegistry 是纯内存 Map，服务器重启数据丢失
- **无 mutation API** —— 当前只有 read-only 路由，无 POST/PUT/DELETE 来管理 manifest
- **无 Prisma/Repository 层** —— 数据仅存在内存，无法跨实例共享
- `buildManifestFromPackage()` 中知识区块（content blocks）的提取逻辑较浅 —— 目前只检查 summary/description/faqs，未涵盖 claims/evidence/features/useCases
- `determineType()` 逻辑简单，无法处理混合类型
- Manifest 的 JSON-LD 目前只生成 `WebPage` 基础类型，需要集成 Knowledge Compiler 的 5 种 Schema.org 类型
- Manifest content version 和 hash 未与外部版本系统联动

**可复用**:
- `PublishManifest` 类型体系 —— 可作为公开路由渲染的单一数据契约
- `buildManifestFromPackage()` 的 slug/metadata/routing/discoverability 生成逻辑
- `buildMetadata()` 的 OG/Twitter/canonical/robots 配置
- `generateLinks` / `getOgType` 辅助函数
- `manifestRegistry` 的接口设计（get/getByPath/getByType/getStats）

**需要新增**:
- Manifest 持久化（Prisma Repository 或 File System）
- Manifest CRUD API（创建/更新/删除）
- Content Block 丰富提取（对接 claim/evidence/entity 数据）
- JSON-LD 集成（将 Compiler 的 5 个 Builder 输出合并到 Manifest.structuredData）
- Snapshot/Version 联动（Manifest version 对接 VersionEngine）

**与 Manifest 的关系**:
- 自身就是 Manifest 模块
- 与 Knowledge Hub 的关系: `builder-knowledge.ts` 提供了桥接函数，但尚未在真实数据流中串联
- 与 Compiler 的关系: **当前零关联**，需要新建桥接

---

## D. JSON-LD Builder

**路径**: `backend/src/services/knowledge/builders/jsonld-builder.ts`

**当前能力**:
- 支持 6 种 Schema.org 类型: `Organization` / `Product` / `Article` / `FAQPage` / `BreadcrumbList` / `@graph`（full 合集）
- `buildOrganizationJsonLd()` —— 从 buildBrandPackage() 获取数据，组装 Organization + makesOffer + sameAs
- `buildProductJsonLd(productId?)` —— 单产品或全部产品 Product schema，带 offers/featureList
- `buildArticleJsonLd()` —— 从 Repository 读取 articles，组装 Article schema
- `buildFaqJsonLd()` —— 目前返回空的 FAQPage（mainEntity: []）
- `buildBreadcrumbJsonLd(items)` —— 纯函数，输入 items 数组
- `buildFullJsonLd()` —— 合并所有类型为 `@graph`，排除空值
- `compact()` 函数 —— 清理 null/empty 字段

**存在缺失**:
- FAQ JSON-LD 没有真实数据填充（Repository 无 FAQ 字段）
- 与 Publish Manifest 零关联 —— 未被 Manifest Builder 调用
- 作为 Compiler 内部的函数，外部无法独立调用单个类型
- 未暴露为独立 API（只能通过 `/api/v1/ai-knowledge/jsonld` 走 Compiler 获取）

**可复用**:
- 5 个有机 JSON-LD Builder 函数（Organization / Product / Article / FAQ / Full）
- Breadcrumb 纯函数 builder
- compact() 清理工具

**需要新增**:
- Manifest 中的 `ManifestStructuredData` 填充逻辑（调用 JSON-LD Builder）
- 独立可导出的 JSON-LD API（供 SSR / Sitemap / Feed 直接消费）

**与 Manifest 的关系**:
- 当前: **无关联** —— JSON-LD Builder 只在 services/knowledge/compiler 中被调用
- 改造后: Manifest Builder 通过 `buildStructuredDataForManifest()` 调用 JSON-LD Builder，填充 `manifest.structuredData.jsonld`

---

## E. Nuxt Frontend

**路径**: `frontend/`

**当前能力**:
- Nuxt v3 + SSR 模式，preset: `node-server`
- `ssr: false`（实际配置为 SPA 模式）
- 全局路由无 `/knowledge/` 公开路由
- Workspace 页面路径: `/workspace/knowledge-hub/`（6 个子页面）
- 后端 API 调用: `fetch('/api/v1/ai-knowledge/...')` 直接调用（无 server/api 代理层）
- Nuxt config 包含编译后钩子：build-validator / asset-sync / release-meta
- 编译时自动 patch renderer.mjs 为 eager import（解决懒加载问题）
- 编译时 patch require('~/...') 为 window.__tc

**存在缺失**:
- **无公开知识路由** —— 没有 `/knowledge/brand/xxx` 或 `/knowledge/entity/xxx` 路由
- SSR 配置为 `ssr: false`，当前是 SPA 模式 —— 需要设为 `true` 或 `'hybrid'` 才能支持 SEO
- 没有 server/api 代理层 —— 前端直接 fetch 后端 API，存在 CORS / cookie 传递问题
- 没有 routeRules 用于公开页面（如 `/knowledge/**` 需要 SSR，`/workspace/**` 可以 SPA）
- workspace/knowledge-hub 页面中的 `NuxtLink` 指向 `/workspace/knowledge-hub/`, 没有公开页面链接

**可复用**:
- 现有 workspace/knowledge-hub 页面可作为管理端基础
- Nuxt 3 + Pinia + TailwindCSS 技术栈
- build hooks 流程（validator / asset-sync）
- PM2 多进程部署模式

**需要新增**:
- **公开路由** `/knowledge/[type]/[slug].vue` —— 基于 PublishManifest 渲染
- SSR 配置调整（ssr: hybrid，routeRules for public routes）
- server/api 代理层（或直接配置后端地址）
- SEO meta 注入（基于 Manifest.metadata）

**与 Manifest 的关系**:
- 当前: **无关联**
- 改造后: 公开页面通过 ManifestRegistry（或后端 API）获取 PublishManifest，据此渲染页面和注入 JSON-LD/SEO meta

---

## F. AI Knowledge Hub Frontend

**路径**: `frontend/pages/workspace/knowledge-hub/` + `frontend/modules/knowledge-hub/`

**当前能力**:
- 6 个功能页面：Dashboard / Brand / Product / Knowledge / Entity / Publishing
- 完整的模块化结构：types / api / services / stores / router 分层
- 通过 `knowledgeApi` 调用 `/api/v1/ai-knowledge/` 后端接口
- Pinia store (`useKnowledgeHubStore`) 管理全局状态
- Dashboard 展示 6 个指标卡片（AI Ready / 品牌 / 文章 / 实体 / 结构化数据 / 已发布资产）
- 快速入口导航到各子页面
- Product/Brand 页面可进行 CRUD 操作
- Routing 配置通过 Vue Router 注册（在 `modules/knowledge-hub/router/`）

**存在缺失**:
- 页面数据直接通过 NuxtLink/client-side fetch 获取，没有 SSR 数据预取
- 没有 loading skeleton 的详细设计（目前只有简单 skeleton）
- Publishing 页面（`publishing.vue`）与 GEO 的 Publish Manifest 体系未对接
- 前端类型定义（Brand / Product / Entity）与后端 Prisma 模型不完全一致（有额外字段如 logo/timeline/faq 等）
- 没有公开页面模块（所有页面都在 workspace 下，需要登录）

**可复用**:
- 完整的 types/api/services/stores 架构模式
- Dashboard 组件设计和指标展示
- CRUD 操作的数据流模式
- Pinia store 的 action/computed 设计

**需要新增**:
- **公开页面模块**（不在 workspace 下，无需登录）
- 页面组件基于 Manifest 渲染（而非直接调用 API）

**与 Manifest 的关系**:
- 当前: **无关联** —— 页面直接调用 /api/v1/ai-knowledge/ 后端 API
- 改造后: 管理端可继续使用当前 API，公开页面使用 Manifest API

---

## G. Deployment

**PM2 进程**:
- `api-server-aigc`（后端 Fastify）
- `nuxt-frontend`（前端 Nuxt）
- `banana-slides`（其他）

**Nginx**: 未找到 nginx 配置文件（可能在 `/www/server/nginx/` 或其他路径）

**Build 流程**:
- `deploy.sh` 将 `.output/public/` 拷贝到 `/www/wwwroot/aigc.fushtn.com/`
- SSR server 拷贝到 `.output/server/`
- PM2 restart frontend-4000 frontend-4001（负载均衡）

**当前缺失**:
- 公开路由没有 Nginx 缓存策略
- SSR 模式未启用（ssr: false），静态资源直接服务
- 没有 CDN / Redis 缓存策略
- 没有 `/_nuxt/` 的长期缓存控制

**可复用**:
- 现有 deploy.sh 脚本
- PM2 进程管理
- build hooks 中的 asset-sync / build-validator

**需要新增**:
- 公开页面的 Nginx 路由规则（`/knowledge/*` 走 SSR）
- 页面级缓存策略（Server-Side Cache / CDN）
- 如果启用 SSR 需要调整 PM2 内存配置

---

# 最终输出: Integration Plan

## 1. 可复用组件（不需要修改）

| 模块 | 组件 | 说明 |
|------|------|------|
| Manifest | `types.ts` — PublishManifest 全部类型 | 10 个子类型的完整定义 |
| Manifest | `buildManifestFromPackage()` | 基础的 Manifest 构造逻辑 |
| Manifest | `manifestRegistry` 接口设计 | get/getByPath/getByType/getStats |
| Compiler | `compileKnowledgePackage()` | 并行 Builder 架构 |
| JSON-LD | `buildOrganizationJsonLd` | Organization schema |
| JSON-LD | `buildProductJsonLd` | Product schema |
| JSON-LD | `buildArticleJsonLd` | Article schema |
| JSON-LD | `buildBreadcrumbJsonLd` | BreadcrumbList schema |
| JSON-LD | `buildFullJsonLd` / `compact()` | 合并 + 清理 |
| Prompt | `buildLlmSummary` / `buildCanonicalFacts` | AI prompt 生成逻辑 |
| Frontend | Nuxt 3 + Pinia + TailwindCSS 技术栈 | 无需更换 |
| Frontend | workspace/knowledge-hub 管理页面 | 作为管理后台保留 |

## 2. 需要桥接的组件（需要少量适配）

| 模块 | 组件 | 桥接方式 |
|------|------|----------|
| Manifest ↔ Compiler | Manifest JSON-LD 填充 | 新增 `buildStructuredDataForManifest()`，调用 JSON-LD Builder 各函数，填充 `ManifestStructuredData.jsonld` |
| Manifest ↔ Compiler | Content Block 提取 | 改造 `buildContent()`，从 CompiledKnowledgePackage 的 claims/evidence 提取 ManifestContentBlock |
| Manifest ↔ Registry | 持久化 | 新增 ManifestRepository（Prisma），manifestRegistry.save() 同时写 DB |
| Compiler ↔ GEO Claims | 数据源对接 | Compiler 的 Builder 需要能从 GEO 的 claim/evidence/entity 服务获取数据 |
| Frontend ↔ API | 公开路由数据获取 | 新建 `server/api/knowledge/[slug].ts`，调用 Manifest API 获取数据 |

## 3. 需要新增的组件

| 优先级 | 组件 | 说明 | 前置依赖 |
|--------|------|------|----------|
| P1-002 | **PublishManifest Repository** | Prisma Repository + Migration（存储 Manifest 到 DB） | Manifest 类型稳定 |
| P1-002 | **Manifest CRUD API** | POST/PUT/DELETE 路由 | Manifest Repository |
| P1-002 | **Compiler → Manifest 适配器** | `compileToManifest(knowledgePackage, baseUrl)` 新函数 | Compiler 类型 + Manifest 类型 |
| P1-003 | **公开路由 `/knowledge/[type]/[slug]`** | Nuxt page，基于 Manifest 渲染 | P1-002 |
| P1-003 | **SSR 配置调整** | nuxt.config 启用 hybrid SSR，routeRules | P1-003 |
| P1-003 | **SEO meta 注入** | 基于 Manifest.metadata 生成 head/og/twitter | P1-003 |
| P1-004 | **KnowledgePackage Publish Pipeline** | GEO Claim → Compile → Manifest → Publish 完整链路 | P1-002 + P1-003 |
| P1-004 | **Manifest Version 联动** | Manifest.contentVersion ↔ VersionEngine | P1-002 |
| P1-005 | **Nginx Cache 策略** | 公开页面 CDN/Redis 缓存配置 | P1-003 |
| P1-005 | **Monitor 接入** | Manifest 发布后触发 HealthEngine/Metrics | P1-004 |

## 4. 可以删除/合并的组件

| 组件 | 路径 | 处理方式 |
|------|------|----------|
| `platform/knowledge-hub/providers/geo/geo-knowledge.provider.ts` | 全部空实现（TODO） | 暂保留，Phase 2 再对接；Phase 1 不依赖 |
| `services/geo/publishing/_deprecated/` | 旧的 publishing pipeline | **删除**——已被 `manifest/` + `publishing.route.ts` 替代 |
| `services/geo/publishing/claim.service.ts` | 旧的 claim 实现 | 评估是否被 manifest builder 使用，否则**删除** |
| `scripts/architecture-linter.sh` | 与 GEO 无关 | 保留但不用于 GEO |
| `platform/knowledge-hub/publishing/` 中的部分适配器 | WebsitePublisher 等 | 保留，Phase 2 作为 Manifest 的 publishing targets |

**需要注意**：`platform/knowledge-hub/` 和 `services/knowledge/` 是**两套系统**，不建议在 Phase 1 合并。策略是：
- `services/knowledge/`（AI Knowledge Hub）继续作为数据管理后台
- `services/geo/publishing/manifest/` 作为公开渲染的单一契约
- 通过适配器桥接两者，而非重构合并

## 5. 实施路线（按依赖顺序）

```
P1-002: [无依赖]
  - 新增 Manifest Repository（Prisma + Migration）
  - 新增 Manifest CRUD API（POST/PUT/DELETE）
  - 新增 Compiler → Manifest 适配器（compileToManifest）
  - Manifest Registry 增加持久化回写
  - JSON-LD Builder 独立导出（供 Manifest 使用）

P1-003: [依赖 P1-002]
  - 调整 nuxt.config（ssr: 'hybrid'）
  - 新增 routeRules（/knowledge/* → prerender 或 ssr）
  - 新增公开页面 /knowledge/[type]/[slug].vue
  - 新增 server/api/knowledge/[slug].ts（调用 Manifest API）
  - SEO meta 注入（基于 Manifest.metadata）
  - Nginx 路由 /knowledge/* → SSR

P1-004: [依赖 P1-002 + P1-003]
  - GEO Publishing Pipeline 整合（Claim → Manifest → Publish）
  - Manifest Version 联动（contentVersion ↔ VersionEngine）
  - Snapshot 系统扩展（保存完整 Manifest content）
  - Manifest 发布后触发 KH2 PublishingEngine

P1-005: [依赖 P1-003 + P1-004]
  - Nginx 公开页面缓存配置
  - Monitor 接入（HealthEngine / MetricsRegistry）
  - Google Search Console 索引验证
  - 负载测试 + 性能调优
```

---

## 风险清单

| 严重程度 | 风险 | 描述 | 应对 |
|----------|------|------|------|
| **高** | Compiler ↔ Manifest 类型不兼容 | Compiler 输出 `CompiledKnowledgePackage`，Manifest 需要 `PublishManifest`，字段结构差异大 | 提前对齐数据结构，适配器层做防御性转换 |
| **高** | SSR 首次访问延迟 | 如果 Manifest 需要从 DB 读取，SSR 页面首次加载可能 200ms+ | 加 Redis 缓存，SSR 页面级缓存 |
| **高** | 两套 Knowledge 体系冲突 | `services/knowledge/` 和 `platform/knowledge-hub/` 管理相同含义的数据但互不感知 | Phase 1 不做合并，用 Manifest 作为统一出口 |
| **中** | Manifest Registry 内存存储 | 当前无持久化，进程重启后所有 manifest 丢失 | P1-002 必须优先做持久化 |
| **中** | 前端 SPA 转 SSR 兼容性 | 当前 ssr: false，部分代码可能依赖 window/browser API | 渐进式迁移，先对公开路由启用 SSR，workspace 保留 SPA |
| **中** | GEO Provider 空实现 | GeoKnowledgeProvider 返回空数据，上线后内容为空 | Phase 1 Manifest 直接从 GEO services 读数据，跳过 Provider 层 |
| **低** | 编译钩子兼容性 | nuxt.config 中编译后钩子（patch renderer/asset-sync）可能在 SSR 模式下需要调整 | 在 P1-003 分支测试 SSR build |
| **低** | PM2 内存压力 | SSR 模式 Node 进程内存需求增加 | 监控 RSS，考虑增加 max_memory_restart |
| **低** | Nginx 缓存过期策略 | 如果 Manifest 更新频率高，Nginx 缓存可能导致用户看到旧内容 | 版本号 hash 做 cache-busting |

---

## 建议

### 1. 架构分层建议
```
┌─────────────────────────────────────────────────────┐
│  Public Routes (/knowledge/[type]/[slug])           │
│  ← SSR Renderer based on Manifest                  │
├─────────────────────────────────────────────────────┤
│  PublishManifest (单一契约, 公开渲染的唯一数据源)    │
│  - Manifest Registry (内存 + DB 双写)               │
│  - Manifest Repository (Prisma)                    │
├─────────────────────────────────────────────────────┤
│  Compiler → Manifest 适配器层 (.compileToManifest)   │
├──────────────────────┬──────────────────────────────┤
│  AI Knowledge Hub    │  GEO Services                 │
│  (services/knowledge)│  (services/geo)               │
│  - Brand/Product     │  - Claims/Evidence/Entity     │
│  - Article/Entity    │  - Verification/Quality       │
│  - JSON-LD / Prompt  │  - Snapshot/Version           │
├──────────────────────┴──────────────────────────────┤
│  Platform Knowledge Hub (platform/knowledge-hub)     │
│  - Canonical KnowledgePackage / PublishingEngine     │
│  → Phase 2 整合入口                                  │
└─────────────────────────────────────────────────────┘
```

### 2. Phase 1 不做的事
- ❌ 整合 `platform/knowledge-hub` 的两套 Knowledge 体系（Phase 2）
- ❌ 实现 GeoKnowledgeProvider 的真实数据填充（Phase 2）
- ❌ 将 workspace 页面改为 SSR（保留 SPA）
- ❌ 实现完整的 Publishing 异步队列（当前同步够用）
- ❌ 实现 KDP Distribution Plane（Phase 3）

### 3. 快速见效建议
1. **P1-002 优先**：Manifest 持久化 + CRUD API — 基础能力
2. **P1-003 紧跟**：一个公开路由 + 一个品牌页面 — 立刻可验证
3. **测试用例先行**：每个 P1-00x 先写集成测试，确保 Manifest ↔ API ↔ 页面 端到端

### 4. 技术选型建议
- **Manifest 持久化**：Prisma（已有 schema）+ JSON 字段存储完整 Manifest
- **缓存**：Redis（已部署场景）或 Node 内存缓存 + 定时过期
- **SSR 模式**：Nuxt `routeRules` 混合模式 —— `/knowledge/**` 用 `ssr: true`，其余 `ssr: false`
- **JSON-LD 注入**：在 `useHead()` 中动态注入 `<script type="application/ld+json">`
