# Media Workspace — 数据所有权映射

> **Version**: 1.0
> **Date**: 2026-08-08
> **Status**: Design Phase
> **宪法依据**: KMKI-CONST-024 (每个数据对象有且仅有一个 Owner Center)

---

## 1. 新媒体运营数据对象 → Owner Center 完整映射

| 数据对象 | Owner Center | 访问方式 | 说明 |
|---------|-------------|---------|------|
| **凭证 (Credentials)** | **AI Center (Credential Vault)** | Never exposed, 通过 Capability 使用 | 加密存储，Workspace 不接触明文 |
| **平台账号身份** | **Identity Center** | Read via API | 账号名/头像/外部ID（只读，来自平台） |
| **客户身份** | **Identity Center** | Read via API | CustomerIdentity 表，跨平台统一身份 |
| **客户图谱关系** | **Identity Center + Knowledge Center** | Read via API | 图数据，Knowledge Center 提供推理 |
| **内容资产** | **Asset Center** | Read/Write via API | 图片/视频/文案草稿 |
| **发布记录** | **Asset Center** | Read via API | 已发布内容元数据 |
| **热点/趋势数据** | **Knowledge Center** | Read via API | 知识对象，可搜索/订阅 |
| **竞品数据** | **Knowledge Center** | Read via API | 竞品分析报告 |
| **执行记录 (Outcome)** | **Runtime Center** | Read via API | AgentOutcome 统一结果层 |
| **排程 (Schedule)** | **Runtime Center** | Read/Write via API | AgentSchedule 由 Scheduler 管理 |
| **用量/成本 (Usage)** | **AI Center + Billing Center** | Batch sync | UsageLog 归因 |
| **分析报告** | **Media Workspace** | 本地生成+存储 | 业务分析报告（Workspace 自有） |
| **运营策略** | **Media Workspace** | 本地存储 | 用户/AI 制定的运营策略 |
| **审批记录** | **Governance Center** | Read via API | 审批流日志 |
| **审计日志** | **Governance Center** | Read via API | AgentAuditTrail |

---

## 2. 数据流向图

```
外部平台 (抖音/快手/小红书/淘宝/京东...)
    │
    │ (数据回流)
    ▼
┌─────────────────────────────────────────────────────────┐
│                    数据采集层                             │
│  Browser Runtime / API Adapter / Webhook                 │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │ Credential │ │  Identity  │ │ Knowledge  │
   │ Vault      │ │  Center    │ │ Center     │
   │ (AI Center)│ │            │ │            │
   └────────────┘ └────────────┘ └────────────┘
          │              │              │
          │              ├──────────────┤
          │              ▼              │
          │        ┌────────────┐       │
          │        │   Asset    │       │
          │        │  Center    │       │
          │        └────────────┘       │
          │              │              │
          └──────────────┼──────────────┘
                         ▼
              ┌─────────────────────┐
              │  Runtime Center     │
              │  (Outcome/Schedule) │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Media Workspace    │
              │  (业务编排+报告)     │
              └─────────────────────┘
```

---

## 3. 新增数据模型需求

### 3.1 CustomerIdentity（客户统一身份）

```
Owner: Identity Center
创建时机: 首次在新媒体平台与客户互动
数据来源: 各平台评论/私信/订单中提取

字段:
  id: UUID
  platform: PlatformType
  platformUserId: string    // 平台原始ID
  platformUserName: string
  platformAvatar: string
  unifiedIdentity?: string  // 跨平台统一ID（可推断）
  firstInteractionAt: Date
  lastInteractionAt: Date
  tags: string[]            // 自动标签（高价值/投诉/复购...）
  metadata: Json            // 平台特定数据

索引: [platform + platformUserId] 唯一
```

### 3.2 CustomerRelation（客户关系图谱）

```
Owner: Identity Center (基础) + Knowledge Center (推理)
数据模型: 图节点 + 边

节点: CustomerIdentity
边: 
  - SAME_PERSON (跨平台同人推断)
  - REFERRAL (推荐关系)
  - FOLLOW (关注关系)
  - PURCHASE (购买关系)
```

### 3.3 报告/策略（Media Workspace 自有）

```
Owner: Media Workspace (非 Platform)
存储: 可存 Media Workspace 本地或 Knowledge Center

字段:
  id: UUID
  organizationId: UUID
  reportType: 'daily' | 'weekly' | 'competitor' | 'sentiment'
  generatedBy: string      // AI 员工 instanceId
  generatedAt: Date
  period: { start: Date, end: Date }
  content: Json            // 报告内容
  status: 'draft' | 'approved' | 'archived'
```

---

## 4. 跨 Workspace 共享规则

| 场景 | 规则 |
|------|------|
| 招聘 AI 看到同一个客户 | ✅ 通过 Identity Center 共享（同一个 CustomerIdentity） |
| GEO 看到同一个地点数据 | ✅ 通过 Knowledge Center 共享 |
| 媒体 AI 的客户画像被招聘使用 | ✅ 通过 Identity Center API 读取 |
| 媒体凭证被其他 Workspace 使用 | ❌ Credential Vault 严格隔离 |
| 媒体热点数据被其他 Workspace 使用 | ✅ Knowledge Center 共享 |

---

## 5. 数据删除规则

| 数据对象 | 删除时机 | 删除方式 |
|---------|---------|---------|
| 凭证 | 用户解除绑定时 | Credential Vault 立即销毁 |
| 客户身份 | 用户要求删除 | Identity Center 软删除+30天清 |
| 执行记录 | 180天后 | 自动归档（可配置） |
| 发布内容 | 用户删除/平台删除 | 保留元数据，删内容文件 |
| 分析报告 | 用户删除 | 硬删除 |

---

*Task 07 完成。进入 Task 08: UX Blueprint。*
