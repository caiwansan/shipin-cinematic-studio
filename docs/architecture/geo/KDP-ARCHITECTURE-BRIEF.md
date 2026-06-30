# KDP（Knowledge Distribution Plane）架构简报

**版本**: v0.1 — Architecture Brief（仅设计，不编码）
**状态**: ⬜ 规划中（草稿）
**作者**: 熊大 + 熊二
**日期**: 2026-06-30

---

## 1. Plane 边界

### Publishing（上游）
- **职责**: 生成、审核、发布内容
- **输出**: `PublishingRecord`（artifactUrl, channel, version, status）
- **终止状态**: `published`

### KDP（下游）
- **职责**: 让已发布的内容被网站、搜索引擎、知识库、AI 系统消费
- **输入**: `PublishingRecord`
- **输出**: `DistributionRecord`（submittedAt, indexedAt, lastSuccessfulCrawl）
- **终止状态**: `indexed` / `live`

**原则**: Publishing 不知道 KDP 的存在。KDP 只消费 PublishingRecord。

---

## 2. 四层架构

```
Layer 1: Distribution Plan
  ┌─────────────────────────────────────────────┐
  │ 输入: PublishingRecord(s)                   │
  │ 逻辑: 哪些 Record 需要分发到哪些目标        │
  │ 输出: DistributionTask[]                    │
  └─────────────────────────────────────────────┘

Layer 2: Distribution Adapter
  ┌─────────────────────────────────────────────┐
  │ Website    → 直接替换/上传 HTML/MD          │
  │ RSS        → 生成 feed.xml                  │
  │ Sitemap    → 追加/更新 sitemap.xml          │
  │ Knowledge Base → 写入 CMS/知识库 API        │
  │ Search Feed → 格式化后提交搜索平台           │
  └─────────────────────────────────────────────┘

Layer 3: Submission
  ┌─────────────────────────────────────────────┐
  │ Ping Search Engines → Google/Bing/Baidu     │
  │ Notify Index Now → 即时索引 API             │
  │ Submit RSS → 各平台的 Feed 提交入口          │
  │ Retry Queue → 失败自动重试                  │
  └─────────────────────────────────────────────┘

Layer 4: Distribution History
  ┌─────────────────────────────────────────────┐
  │ distributedAt                              │
  │ submittedAt                                │
  │ indexedAt                                  │
  │ lastCrawledAt                              │
  │ lastSuccessfulCrawl                        │
  │ retryCount                                 │
  │ status: distributed / submitted / indexed   │
  │          / failed / expired                │
  └─────────────────────────────────────────────┘
```

---

## 3. 数据模型（概念设计）

```
DistributionPlan {
  id: string
  projectId: string
  recordIds: string[]      // PublishingRecord IDs
  status: draft | active | completed
  createdAt
}

DistributionTask {
  id: string
  planId: string
  recordId: string
  adapter: string          // website | rss | sitemap | knowledge-base | search-feed
  status: pending | submitted | indexed | failed | expired
  retryCount: number
  submittedAt?
  indexedAt?
  lastCrawledAt?
  errorLog?
}

DistributionAdapterRegistry {
  adapterId: string
  type: string
  config: { baseUrl, apiKey?, endpoint? }
  enabled: boolean
}
```

---

## 4. 与 Publishing 的差异

| 维度 | Publishing | KDP |
|------|-----------|-----|
| 职责 | 生成内容 | 分发内容 |
| 关注 | 内容质量、版本、审核 | 可发现性、收录率、索引状态 |
| 用户看到 | "已发布" | "已被 Google 收录" |
| 失败原因 | 内容不合格 | 网络不可达、平台拒收 |
| 重试策略 | 人工重试 | 自动重试 + backoff |
| 对外依赖 | 无 | Search Console / Bing Webmaster |

---

## 5. 开放问题（待熊大决策）

1. **Distribution Plan** 应该由用户手动创建，还是 Publishing 完成后自动触发？
2. **Submission** 层需要外网 API 密钥（Google Search Console / Bing Webmaster），如何管理？
3. **Sitemap** 是作为 Adapter 输出（系统生成），还是需要用户配合配置站点？
4. **Monitor** 已经包含 indexing health，与 KDP 的 indexedAt 是否重叠？

---

## 6. 时间线建议

| 阶段 | 内容 | 预计 |
|------|------|------|
| Brief Review | 本文件的审查和决策 | 当前 Sprint |
| Contract & Prisma | DistributionPlan / Task / AdapterRegistry | P3 RC1 验收后 |
| Adapter Layer | Website / RSS / Sitemap 三种 Adapter | P3 RC1 验收后 |
| Submission 接入 | Google / Bing / Baidu | 后续 |
| KDP 上线 | 端到端分发闭环 | 后续 |
