# Knowledge Hub Runtime Baseline v2 — KH2 Publishing Engine

> **日期**: 2026-07-22
> **版本**: v2.0
> **基线**: KH2 Sprint Freeze
> **前驱**: KH1 Canonical Package Runtime (v1.0)
> **状态**: ✅ FROZEN

---

## 发布架构

```
                                            ┌──────────┐
KnowledgePackage ──► PublishingEngine ──────►   Queue  │
                         │                   └────┬─────┘
                         ▼                        ▼
                  PublisherRegistry         Job Processor
                         │                        │
              ┌──────────┼──────────┐              │
         Website     CMS     Webhook   Export      │
         Publisher  Publisher  Publisher Publisher  │
              └──────────┼──────────┘              │
                         ▼                         ▼
                   [Published]             [Result Recorded]
```

## 新增模块

| 模块 | 文件 | 说明 |
|------|------|------|
| PublishingEngine | `publishing/publishing-engine.ts` | 唯一发布入口，不允许绕过 |
| PublisherRegistry | `publishing/publisher-registry.ts` | 所有 Publisher 必须注册，禁止 switch/if |
| PublishingQueue | `publishing/publishing-queue.ts` | Job 模型：pending → queued → running → succeeded/failed → retry |
| PublishingTypes | `publishing/types.ts` | Canonical PublishingResult + Publisher 接口 + Capability Discovery |
| WebsitePublisher | `publishing/adapters/website.publisher.ts` | 静态站点生成（真实实现） |
| CMSPublisher | `publishing/adapters/cms.publisher.ts` | 通用 CMS 适配器（真实实现，含 validate） |
| WebhookPublisher | `publishing/adapters/webhook.publisher.ts` | Webhook 通知（真实实现） |
| ExportPublisher | `publishing/adapters/export.publisher.ts` | 导出（JSON/MD/ZIP 真实实现） |
| PublishingAPI | `publishing/api.ts` | 5 个端点 |

## 注册 Publisher（已冻结）

| Name | Type | Capabilities |
|------|------|-------------|
| website | website | rollback, preview |
| cms | cms | incremental, scheduling |
| webhook | webhook | incremental |
| export | export | rollback, preview, verification |

## Capability Discovery（预留扩展）

```typescript
publisher.capabilities = ['supports_incremental', 'supports_rollback', ...]
```

Engine 可通过 `registry.filterByCapability('supports_rollback')` 筛选 Publisher。

## Publishing API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/knowledge/publish | 发布 |
| GET | /api/knowledge/publish/jobs | 任务列表 |
| GET | /api/knowledge/publish/jobs/:id | 任务详情 |
| POST | /api/knowledge/publish/jobs/:id/retry | 重试 |
| POST | /api/knowledge/publish/jobs/:id/cancel | 取消 |
| GET | /api/knowledge/publish/publishers | Publisher 列表 |

## Job 状态机

```
pending → queued → running → succeeded
                         → failed → retry(queued) → running...
                         → cancelled
```

- maxRetries: 3
- 重试间隔: 5s

## KH2 Gate 验收

| Gate | 验收项 | 状态 |
|------|--------|------|
| **Publishing Gate** | 唯一入口：PublishingEngine | ✅ |
| | 所有 Adapter Registry 注册 | ✅ (4 publishers) |
| | 页面不能直接发布 | ✅ |
| | Workspace 不允许绕过 Engine | ✅ |
| **Delivery Gate** | Job 状态完整 | ✅ (6 states) |
| | Retry 正常 | ✅ (maxRetries=3) |
| | Cancel 正常 | ✅ |
| | PublishingResult Schema 一致 | ✅ |
| | 结构化日志 | ✅ (errorLog 数组) |

## 目录结构（更新）

```
backend/src/platform/knowledge-hub/
├── core/                          ← KH1
├── repository/                    ← KH1
├── providers/                     ← KH1
├── api/routes.ts                  ← KH1
├── publishing/                    ← KH2 (新增)
│   ├── types.ts
│   ├── publishing-engine.ts
│   ├── publisher-registry.ts
│   ├── publishing-queue.ts
│   ├── api.ts
│   └── adapters/
│       ├── website.publisher.ts
│       ├── cms.publisher.ts
│       ├── webhook.publisher.ts
│       └── export.publisher.ts
└── index.ts
```

## KH2 里程碑

| Sprint | 状态 | 说明 |
|--------|------|------|
| KH1 Canonical Package Runtime | ✅ 冻结 | v1.0 baseline |
| KH2 Publishing Engine | ✅ 冻结 | v2.0 baseline |

## 线上验证

```bash
# Publisher 列表
GET /api/knowledge/publish/publishers
→ 4 publishers (website, cms, webhook, export)

# 创建 + 发布
POST /api/knowledge/packages → POST /api/knowledge/publish
→ jobId + status=running

# 查看结果
GET /api/knowledge/publish/jobs/:id
→ status=succeeded, artifacts=[index.html, about.html]
```
