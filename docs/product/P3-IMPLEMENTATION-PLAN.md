# P3 Implementation Plan — Publishing Layer

**基于**: `SPRINT_BRIEF_P3_PUBLISHING_LAYER.md`
**状态**: 已批准 ✅
**三条 Freeze Rule**: FR-1 (Claim 核心), FR-2 (Version 历史), FR-3 (Adapter 接口)

---

## P3.1 Sprint 范围（唯一已批准）

**只做**:
1. Publishable Claim — 数据模型 + CRUD API
2. Publish Plan — 从 Claim 聚合生成发布计划
3. Channel Registry — 统一 Adapter 接口
4. Markdown Adapter — render() / validate() / preview() / export()
5. HTML Preview Renderer — Markdown → HTML
6. Publishing History — Version 记录

**不做**:
- ❌ CMS Adapter（WordPress/Ghost/Confluence — 全部后置）
- ❌ 多人审批（Review Flow 只做 Draft→Review→Approved→Published 状态）
- ❌ Schema.org 输出（P3.2）
- ❌ PDF/Word/Slides Renderer（后置）
- ❌ Dependency Graph（P3.3）
- ❌ Overview 区块的 Publishing Summary 微件（P3.3 Dashboard）

---

## 数据模型

### PublishableClaim

```prisma
model PublishableClaim {
  id             String   @id @default(cuid())
  projectId      String
  verificationId String   // 关联 VerificationJob

  title          String
  contentType    String   // 'about_page' | 'faq_entry' | 'schema_entity' | 'press_release' | 'knowledge_article'
  content        String   // Markdown body
  status         String   @default('draft') // draft | ready | published

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  plans    PublishPlan[]
  records  PublishingRecord[]
}
```

### PublishPlan

```prisma
model PublishPlan {
  id             String   @id @default(cuid())
  projectId      String
  title          String
  status         String   @default('draft') // draft | in_review | approved | published | rolled_back
  dependencyOrder String? // JSON array of claim IDs (optional dependency graph)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  publishedAt    DateTime?

  claims   PublishableClaim[]
  records  PublishingRecord[]
}
```

### PublishingRecord

```prisma
model PublishingRecord {
  id             String   @id @default(cuid())
  planId         String
  claimId        String
  channel        String   // 'markdown' | 'html_preview' | 'wordpress' | etc.
  version        String   // semantic version
  hash           String   // content fingerprint
  artifactUrl    String?  // optional: URL to published result
  status         String   @default('pending') // pending | published | failed | rolled_back

  publishedAt    DateTime?
  createdAt      DateTime @default(now())

  plan   PublishPlan    @relation(fields: [planId], references: [id])
  claim  PublishableClaim @relation(fields: [claimId], references: [id])
}
```

---

## API 端点（P3.1）

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/geo/publish/claims/:projectId` | List claims |
| `POST` | `/geo/publish/claim` | Create claim (from verified action) |
| `PUT` | `/geo/publish/claim/:id` | Update claim content |
| `DELETE` | `/geo/publish/claim/:id` | Delete claim (draft only) |
| `GET` | `/geo/publish/plans/:projectId` | List plans with claims |
| `POST` | `/geo/publish/plan` | Create plan (from selected claims) |
| `PUT` | `/geo/publish/plan/:id` | Update plan status |
| `DELETE` | `/geo/publish/plan/:id` | Delete plan (draft only) |
| `GET` | `/geo/publish/history/:projectId` | List publishing history |
| `POST` | `/geo/publish/plan/:id/preview` | Generate preview (Markdown→HTML) |
| `POST` | `/geo/publish/plan/:id/export` | Export artifact |
| `GET` | `/geo/channels` | List registered channels |

---

## Channel Adapter 接口

```typescript
interface Artifact {
  format: string         // 'markdown' | 'html' | 'jsonld' | etc.
  content: string        // rendered content
  metadata: Record<string, any>
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface ChannelAdapter {
  readonly name: string
  readonly formats: string[]

  render(claim: PublishableClaim): Artifact
  validate(artifact: Artifact): ValidationResult
  preview(artifact: Artifact): string
  export(artifact: Artifact): Buffer | string
}
```

---

## P3.1 实施步骤

### Step 1: 数据层
- Prisma schema: `PublishableClaim` + `PublishPlan` + `PublishingRecord`
- `npx prisma generate`
- `npx prisma migrate dev --name geo-publishing`

### Step 2: 后端
- `PublishingClaimService` — CRUD + status management
- `PublishingPlanService` — Plan lifecycle
- `PublishingHistoryService` — History + versioning
- `ChannelRegistry` — Adapter registration
- `MarkdownAdapter` — First adapter
- `HtmlPreviewRenderer` — Markdown → HTML

### Step 3: API 路由
- `geo/publishing.route.ts` — All P3.1 endpoints
- `geo/publishing.service.ts` — Business logic

### Step 4: 前端 UI
- `GeoPublish.vue` — Full Publishing Dashboard
  - Plan list with status tabs
  - Claim list for each plan
  - Preview modal
  - Export button
- `GeoInsights.vue` — Add "创建发布计划" button on verified actions
- `GeoOverview.vue` — Add Publishing Summary count widget (P3.3, not P3.1)

### Step 5: 部署
- Build + PM2 restart

---

## 验收标准

见 `SPRINT_BRIEF_P3_PUBLISHING_LAYER.md` 第 8 节（PUB-01 至 PUB-06）。

P3.1 验收重点：
- `FR-1`: Claim 创建来自 Verified Action ✓
- `FR-2`: PublishingRecord 记录 version/hash/sourceClaimIds ✓
- `FR-3`: ChannelAdapter 接口 render/validate/preview/export 统一 ✓
- PUB-01: 已验证 Action → 创建 Claim → 聚合为 Plan ✓
- PUB-03: 至少 Markdown + HTML Preview 两种格式 ✓
- PUB-04: Publishing History 可追溯 ✓

---

## 时间估计

| 步骤 | 工作量 |
|------|--------|
| 数据模型 + Migration | ~1 小时 |
| 后端 Service × 3 | ~2 小时 |
| API 路由 | ~1 小时 |
| Channel Adapter + Markdown | ~1 小时 |
| HTML Preview Renderer | ~0.5 小时 |
| 前端 UI (Publish Dashboard) | ~2 小时 |
| 前端对接 (Insights + Overview) | ~1 小时 |
| Build + Deploy + 验证 | ~0.5 小时 |
| **总计** | **~9 小时** |
