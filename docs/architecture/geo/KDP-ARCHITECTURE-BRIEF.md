# KDP（Knowledge Distribution Plane）架构简报 v0.2 — RC1 启动

**版本**: v0.2 — Architecture Brief（RC1 规划，不涉及第三方 API）
**状态**: 🚀 已批准启动
**作者**: 熊大 + 熊二
**日期**: 2026-06-30

---

## 核心定位：AI Knowledge Distribution

KDP 不是传统的 CMS 分发模块。

每一次 Distribution 必须同时输出三个维度的内容：

```
人类可读         → 网站、RSS、知识库文章
搜索引擎可抓取   → Sitemap、robots.txt、结构化标记
AI 大模型可消费  → Knowledge Feed、AI Crawl Manifest、知识表达
```

这就是 GEO 和普通 SEO 工具拉开差距的地方。

---

## Plane 边界（冻结）

### Publishing Plane（上游，冻结中）
- **职责**: 生成、审核、发布内容
- **输出**: `PublishingRecord`
- **终止状态**: `published`
- **冻结规则**: 除 Bug Fix 外不新增功能

### KDP（下游）
- **输入**: `PublishingRecord`
- **输出**: `DistributionRecord`
- **终止状态**: `distributed`
- **当前范围不包含**: 第三方平台提交

**原则**: Publishing 不知道 KDP 的存在。KDP 只消费 PublishingRecord。

---

## KDP RC1 — Scope

### 包含
- Distribution Plan（自动生成，用户审批）
- Distribution Task（Attempt 模型）
- Distribution History（Attempt-based）
- Distribution Queue
- 无外部依赖的 Adapter（Sitemap / RSS / Knowledge Feed / robots.txt / AI Crawl Manifest）

### 不包含（后续 KDP RC2+）
- Search Console / Bing Webmaster API
- 任何第三方平台提交通道
- Credential Registry（由 Platform 统一管理，KDP 只拿 credentialId）

---

## Sprint 划分

### Sprint K1：Distribution Planning

```
PublishingRecord
  ↓ （自动触发，也可手动）
DistributionPlan（独立于 PublishPlan）
  ├── DistributionTask[]
  │     ├── adapter: sitemap
  │     ├── adapter: rss
  │     ├── adapter: knowledge-feed
  │     ├── adapter: robots-txt
  │     └── adapter: ai-crawl-manifest
  └── status: draft → pending_review → approved → distributing → completed
```

交付物：
- `DistributionPlan` CRUD
- `DistributionTask` 状态机（pending → running → success / failed）
- `Attempt` 模型（每次重试一条记录）
- 自动生成策略：PublishingRecord 创建后自动创建 DistributionPlan
- 用户审批：Review → Approve / Reject / Schedule

### Sprint K2：Distribution Adapter

```text
Adapter Registry（接口+实现）

┌─ Local Adapters（无外部依赖，KDP RC1 范围）────┐
│  Sitemap          → sitemap.xml 增量生成       │
│  RSS Feed         → feed.xml（Atom/RSS2）      │
│  Knowledge Feed   → 内部标准格式 JSON/MD       │
│  robots.txt       → robots.txt 增量更新        │
│  AI Crawl Manifest→ 面向 AI 平台的知识索引     │
└────────────────────────────────────────────────┘
```

每个 Adapter 实现：
- `adapterId: string`
- `generate(input: PublishingRecord[]): Artifact[]`
- `preview(input: PublishingRecord[]): string`（让用户预览分发结果）

### Sprint K3：Submission Adapter（KDP RC2+）

此阶段才开始对接外部平台。凭据走 Platform Credential Registry。

```text
┌─ External Adapters（KDP RC2+）───────────────────┐
│  Search Console     → URL 提交 & 索引状态查询    │
│  Bing Webmaster     → URL 提交 & 索引状态查询    │
│  Baidu Zhanzhang    → URL 提交（国内）            │
│  WordPress Plugin   → 内容同步                   │
│  （后续扩展：GitBook / Notion / 飞书知识库）     │
└──────────────────────────────────────────────────┘
```

---

## 数据模型（概念设计 — KnowledgeAsset-first）

```prisma
// KDP Domain — Knowledge Distribution Plane

model KnowledgeAsset {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  claimId   String   @map("claim_id")         // ↔ PublishableClaim
  recordId  String   @map("record_id")        // ↔ PublishingRecord

  assetType String   // 'article' | 'schema_entity' | 'entity_graph'
                     // | 'fact_sheet' | 'claim_graph' | 'brand_profile'
                     // | 'qa_pack' | 'ai_knowledge_feed' | 'ai_manifest'

  status    String   @default("draft")

  // Three layers — all required
  humanContent  String  // Human Layer (HTML / MD)
  searchContent String  // Search Layer (JSON-LD / Schema)
  aiContent     String  // AI Layer (Knowledge JSON)

  version       String
  artifactHash  String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model DistributionPlan {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  title     String

  assetIds  String[] // KnowledgeAsset IDs
  targets   String[] // DistributionTarget[]
  strategy  Json     // { incrementalOnly, forceFull, scheduleAt }

  status    String   @default("draft")
  // 'draft' | 'pending_review' | 'approved' | 'distributing' | 'completed' | 'cancelled'

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  approvedAt DateTime?
  completedAt DateTime?
}

model DistributionAttempt {
  id        String   @id @default(uuid())
  planId    String   @map("plan_id")

  taskKey   String   // `${planId}:${adapter}:${attemptNo}`
  adapterId String

  attemptNo Int      @default(1)
  assetIds  String[]

  status    String   // 'pending' | 'preparing' | 'validating'
                     // | 'packaging' | 'delivering' | 'success' | 'failed'

  outputUrl     String?
  artifactHash  String?
  durationMs    Int?
  errorLog      String?

  createdAt DateTime @default(now())
  startedAt  DateTime?
  finishedAt DateTime?
}

// Adapter Registry
model DistributionAdapter {
  id      String   @id @default(uuid())
  type    String   // 'local' | 'external'
  name    String
  enabled Boolean  @default(true)
  config  Json?
}
```

---

## AI Knowledge Distribution — 核心能力

这是和其他优化工具拉开差距的关键。

### 面向 AI 平台的知识表达

```text
Human Layer                     AI Layer
  ↓                               ↓
Website content     ===→    AI Crawl Manifest
  (读给人看的)              (告诉 AI：这个品牌
                           的核心事实是什么、
                           数据源在哪里)
```

具体来说，每个 `ai_crawl_manifest` Adapter 生成的 Artifact 包含：

```json
{
  "schemaVersion": "1.0",
  "projectId": "...",
  "brand": "Acme Robotics",
  "knowledgeBase": [
    {
      "claimKey": "about-page-v1",
      "content": "Acme Robotics 成立于 2018 年...",
      "verifiedAt": "2026-06-30T...",
      "sourceUrl": "https://...",
      "confidence": "HIGH"
    }
  ],
  "knowledgeGraph": {
    "entities": ["Acme Robotics", "深圳", "工业协作机器人"],
    "relations": [
      { "subject": "Acme Robotics", "predicate": "locatedIn", "object": "深圳" }
    ]
  }
}
```

### 三个层次的产出

| 层次 | 产出 | 消费方 |
|------|------|--------|
| Human Layer | HTML、Markdown、图文 | 网站用户 |
| Search Layer | Sitemap、robots.txt、结构化数据 | Google/Bing/Baidu |
| AI Layer | AI Crawl Manifest、Knowledge Feed | ChatGPT/Claude/Gemini 等 |

---

## 永久原则（Permanent Rules）

### PR-K1：KnowledgeAsset 是核心对象
Distribution Task / Attempt 是实现细节。
每一层 API、接口、数据模型必须 KnowledgeAsset-first，不可 Task-first。

### PR-K2：三层可消费性
**Every KnowledgeAsset must be consumable by both humans and AI systems.**
- `humanContent` → Human Layer（HTML / Markdown）
- `searchContent` → Search Layer（JSON-LD / Schema.org）
- `aiContent` → AI Layer（Entity Graph / Fact Sheet / Claim Graph / QA Pack）
- 三个字段全填满才算一个完整的 KnowledgeAsset，缺一不可。

---

## Freeze Rules（Sprint 级，可随版本升级调整）

### FR-K1：消费 PublishingRecord
Distribution 永远消费 PublishingRecord，而不是 PublishableClaim。

### FR-K2：Attempt-based History
分布历史记录每次 Attempt，而非最终状态。

### FR-K3：AI First
每个 Adapter 必须同时考虑三层次输出（Human / Search / AI），不可只实现 Human Layer。

### FR-K4：零外部依赖（RC1）
KDP RC1 不调用任何第三方 API。所有 Adapter 本地生成、本地可验证。

### FR-K5：Credential Registry 分离
KDP 不存储任何凭据，只拿 credentialId。凭据由 Platform 统一管理。

---

## 开放问题（已解决）

| 问题 | 决策 |
|------|------|
| Distribution Plan 自动还是手动？ | 自动创建 + 用户审批 |
| API 密钥谁管理？ | Platform Credential Registry |
| Sitemap 如何配置？ | Adapter 通过 DistributionAdapter.config 配置 baseUrl |
| Monitor 的 indexing health 是否重叠？ | KDP indexedAt 记录本地分发状态；Monitor 获取搜索引擎真实收录状态，两者互补 |
| KDP RC1 范围？ | 仅 Local Adapter，不碰第三方 API |

---

## 时间线

| Sprint | 内容 | 前置 | 备注 |
|--------|------|------|------|
| K1 | Distribution Planning 核心 | Publishing RC1 ✅ | Contract + Prisma + API |
| K2 | Local Adapters（5种） | K1 ✅ | 无外部依赖 |
| K3 | UI: Distribution Plan 列表 / 审批 / 预览 | K2 ✅ | 与 GEO Workspace 集成 |
| RC1 Freeze | E2E 验收 + Tag | K3 ✅ | |
| K4+ | Submission Adapter（外部平台） | RC1 ✅ | KDP RC2，需 Credential Registry |
