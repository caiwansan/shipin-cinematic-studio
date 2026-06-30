# Sprint P3 Brief: Publishing Layer - Brand Health Operating System

**版本**: v1.0
**状态**: 待批准
**关联**: GEO Product Whitepaper V1（第4章 "Publishing Plane"）

---

## 1. 白皮书章节

GEO Product Constitution v1.0, Chapter 4 — **Publishing Plane**

> "已验证的优化需要被发布到用户真实可访问的渠道（官网、知识库、CMS），才能产生实际商业价值。Publishing Plane 是优化闭环的出口。"

具体涉及：
- 4.1 Publishing Plane 定位与原则
- 4.2 Publish Plan & Pipeline
- 4.3 Channel Adapter 架构
- 4.4 Review & Approval Lifecycle
- 4.5 Publishing Record & Audit Trail

---

## 2. 产品路线图映射

GEO Product Roadmap V1, **Phase 3: Publishing Plane**

> "验证后的优化内容通过适配器发布到公网渠道，建立发布计划、审核流程和发布历史追踪。"

当前所处的完整产品路线：

```
Assessment  →  Recommendation  →  Optimization  →  Verification  →  Publishing
   RC1           RC1                RC1               RC1              P3 ← 你现在在这里
```

---

## 3. 页面蓝图映射

GEO Workspace Blueprint V1 中，Publishing Plane 覆盖：

| 工作台 tab | 新增/改造 | 说明 |
|------------|----------|------|
| Publish（现有） | **改造** | 从占位符页面升级为 Publishing Dashboard |
| Insights | 新增区块 | 显示可发布的已验证 Action |
| Overview | 新增区块 | 显示发布概况（已发布/Pending/Draft 计数） |

---

## 4. 用户价值

| 用户 | 价值 |
|------|------|
| 品牌负责人 | 优化内容不再停留在"已验证"状态，可以一键推送到官网/知识库 |
| SEO 运营 | 知道哪些内容已经发布、哪些还在草稿、什么时候需要更新 |
| 管理层 | Dashboard 一眼看到品牌内容"已经发布到哪里了" |

关键指标：**从"已验证"到"已发布"的转化率**。

---

## 5. 影响页面

| 页面/组件 | 变更类型 | 说明 |
|-----------|----------|------|
| `GeoPublish.vue` | **核心改造** | 从占位符变为完整 Publishing Dashboard |
| `GeoOverview.vue` | 新增区块 | 增加 Publishing Summary 微件 |
| `GeoInsights.vue` | 新增按钮 | 已验证的 Action 可"立即创建发布计划" |
| `GeoWorkspaceV1.vue` | 无变更 | Tab 结构不变 |
| `GeoEvidence.vue` | 无变更 | Evidence 详情页 |

---

## 6. 影响 API

### 新增端点

| Method | Route | 说明 |
|--------|-------|------|
| `GET` | `/geo/publish/plans/:projectId` | 获取项目的发布计划列表 |
| `POST` | `/geo/publish/plan` | 创建一个发布计划（从 Verified Action 生成） |
| `PUT` | `/geo/publish/plan/:id` | 更新发布计划（Draft→Review→Approve→Publish） |
| `DELETE` | `/geo/publish/plan/:id` | 删除发布计划（仅 Draft 状态） |
| `GET` | `/geo/publish/history/:projectId` | 获取发布历史 |
| `POST` | `/geo/publish/preview/:id` | 生成发布预览（HTML/Markdown） |
| `GET` | `/geo/channels` | 获取已配置的发布渠道列表 |
| `POST` | `/geo/publish/:id/channel/:channelId` | 发布到指定渠道 |

### 修改端点

无。所有现有 API 保持不动。

### 数据模型

#### PublishPlan

```typescript
interface PublishPlan {
  id: string
  projectId: string
  title: string
  content: string  // 将要发布的内容（Markdown 或 HTML）
  actionId: string  // 关联的 Verified Action
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'rolled_back'
  createdAt: string
  updatedAt: string
  publishedAt?: string
  channels: PublishChannelResult[]
}
```

#### PublishChannelResult

```typescript
interface PublishChannelResult {
  channelId: string
  channelName: string  // 'wordpress' | 'markdown' | 'html' | 'knowledge_base' | etc.
  status: 'pending' | 'published' | 'failed'
  publishedUrl?: string
  publishedAt?: string
  error?: string
  version: number
}
```

#### PublishingSummary

```typescript
interface PublishingSummary {
  totalPlans: number
  draftCount: number
  inReviewCount: number
  approvedCount: number
  publishedCount: number
  channelBreakdown: Array<{ channel: string; count: number }>
}
```

---

---

## 7. 冻结原则（Three Freeze Rules）

以下三条为 P3 架构级冻结原则，后续任何 Sprint 不得违反。

### FR-1: Publishing 的核心对象是 Publishable Claim，不是 Action

```
Action → Verified → Publishable Claim → Channel Adapter
```

一个 Action 可能生成多个 Publishable Claim。例如 Authority 优化可以同时生成：
- About Page 内容
- FAQ 条目
- Schema.org Organization JSON-LD

Claim 是发布的最小可寻址单元，Action 是优化触发源。Channel Adapter 消费 Claim，而非 Action。

### FR-2: Publishing History 记录 Version 与 Source Claims，而非导出的文件

```
PublishRecord {
  version,         // 语义版本
  channel,         // 目标渠道
  hash,            // 内容指纹
  publishedAt,
  sourceClaimIds,  // 关联的 Publishable Claim
  verificationId,  // 关联的 Verification
  artifact?: URL   // 可选的已发布产物链接，但非核心字段
}
```

History 记录 Version 而非文件，确保：
- Rollback 可 diff
- 审计可追溯
- 多渠道同源可比对

### FR-3: Channel Registry 统一 Adapter 接口

所有 Channel Adapter 统一四个方法：

```typescript
interface ChannelAdapter {
  render(claim: PublishableClaim): Artifact       // Claim → 渠道格式
  validate(artifact: Artifact): ValidationResult  // 格式校验
  preview(artifact: Artifact): string             // 输出预览（HTML/Text）
  export(artifact: Artifact): Buffer | string     // 导出产物
}
```

新增渠道 = 新增 Adapter，不改 Engine。
不允许多个 Adapter 对同一接口有不同的命名约定（禁止 `publish()` / `preview()` / `download()` / `renderMarkdown()` 混用）。

---

## 8. 验收标准

引用 `GEO_ACCEPTANCE_STANDARD_V1.md` 第 3 章（Publishing Plane）：

| ID | 标准 | 验收方式 |
|----|------|----------|
| PUB-01 | 每个已验证 Action 能自动生成包含标题、内容、推荐渠道的发布计划 | 在 Insights 中点击已验证 Action → "创建发布计划" → 验证计划内容正确 |
| PUB-02 | 发布计划支持 Draft → Review → Approved → Published 生命周期 | 手动推进状态，确认每一步状态变更正确 |
| PUB-03 | 通过统一 Channel Adapter 模式输出到至少两种渠道（HTML 预览 + Markdown 导出） | 创建发布计划 → 选择渠道 → 预览 → 确认输出格式正确 |
| PUB-04 | 每次发布生成完整记录（渠道、版本、时间、关联 Action） | 查看发布历史 tab |
| PUB-05 | 新增发布渠道无需修改 Engine，仅新增 Adapter | 验证 Channel Registry 是否通过配置而非硬编码 |
| PUB-06 | Publishing Dashboard 显示发布概况（已发布/Draft/Review 计数 + 渠道分布） | 切换到 Publish tab |

---

## 8. 风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 发布内容需要真实 CMS 对接才能端到端验证 | 高 | 验收时只能测 HTML/Markdown/Schema | Adapter 设计成可插拔，Mock Channel 用于测试 |
| 后端无 Publishing 基础设施 | 中 | 需要新增数据表 | 最少表设计：PublishPlan + PublishChannelResult |
| Review Flow 可能引发并发审核冲突 | 低 | 多人同时审同一计划 | P3 先单人审核，P5 加多人/Agent 审核 |
| 用户可能不确定发布到哪里 | 低 | Publishing Dashboard 无渠道配置 | 先做 HTML 预览 + Markdown 下载，再加 Channel 注册 |

---

## 9. 回滚方案

### 代码回滚
```
git revert HEAD  # 或指定包含 P3 的 commit
pm2 restart 43
```

### 数据回滚
- PublishPlan 状态支持 `rolled_back`，不清除数据
- 已发布的渠道内容需手动恢复（P3 不实现自动回滚，P5 加）

### 数据库迁移回滚
```bash
npx prisma migrate down 2
npx prisma generate
pm2 restart 41
```

---

## 10. 实施顺序（建议）

```
P3.1 (Sprint)    P3.2 (Sprint)      P3.3 (Sprint)
Publish Plan     Channel Adapter    Review Flow + Dashboard
──────           ──────              ──────
Data model       HTML Preview       State machine
CRUD API         Markdown export    Publishing History
                 Channel Registry   Overview Summary
```

---

**Sprint Brief 批准后，进入 P3.1 Sprint（Publish Plan 数据模型 + CRUD API + 基础 UI）。**
