# AI Agent 权限系统

> **Version**: 1.0
> **Date**: 2026-08-08
> **Status**: Design Phase
> **宪法补充**: 本文件补充 KMKI Platform Constitution 中未定义的 AI Agent 权限模型

---

## 1. 设计原则

```
AI 员工权限 = 动作分级 × 运行模式 × 用户覆盖

┌──────────────────────────────────────────────┐
│                Permission Model               │
├──────────────────────────────────────────────┤
│ Action Tier    │ Mode        │ Override       │
│ ─────────────  │ ──────────  │ ────────────   │
│ Tier 1: Read   │ AUTO        │ Pause/Resume   │
│ Tier 2: Create │ APPROVAL    │ Takeover       │
│ Tier 3: Send   │ ALERT_FIRST │ Emergency Stop │
│ Tier 4: Modify │             │ Rollback       │
└──────────────────────────────────────────────┘
```

---

## 2. 动作分级

### Tier 1: 读取（自动允许）

| 动作 | Capability | 风险 |
|------|-----------|------|
| 读取账号信息 | `media.platform.profile.read` | 无 |
| 读取热点/趋势 | `platform.search.trends` | 无 |
| 读取评论/私信 | `media.platform.comment.list` | 无 |
| 读取数据面板 | `media.platform.analytics.read` | 无 |
| 读取商品/订单 | `media.platform.product.read` | 无 |

**策略**: AI 自动执行，无需通知，记录审计日志

### Tier 2: 创建（建议+审批）

| 动作 | Capability | 风险 |
|------|-----------|------|
| 生成内容草稿 | `media.content.generate` | 低 |
| 生成分析报告 | `media.report.generate` | 低 |
| 生成竞品分析 | `media.competitor.analysis` | 低 |
| 生成客户画像 | `media.customer.profile` | 中（涉及用户数据） |

**策略**: AI 自动生成，推送给用户审批，用户确认后进入执行队列

### Tier 3: 发送（分级自动）

| 动作 | Capability | 风险 |
|------|-----------|------|
| 回复普通评论 | `media.platform.comment.reply` | 中 |
| 回复常见问题私信 | `media.platform.message.send` | 中 |
| 发布已审批内容 | `media.platform.content.publish` | 中 |
| 发送复购提醒 | `media.platform.message.send` | 中 |

**策略**:
- 普通咨询/夸赞 → 自动回复
- 投诉/复杂问题 → 标记「需人工」
- 涉及金额/法律 → 标记「紧急人工」
- 发布内容 → 需 Tier 2 先审批

### Tier 4: 修改（严格审批）

| 动作 | Capability | 风险 |
|------|-----------|------|
| 修改商品价格 | `media.platform.product.update` | 高 |
| 上下架商品 | `media.platform.product.update` | 高 |
| 删除内容 | `media.platform.content.delete` | 高 |
| 修改店铺信息 | `media.platform.shop.update` | 高 |
| 退款/赔付 | `media.platform.order.refund` | 极高 |

**策略**: 所有 Tier 4 必须人工审批，AI 仅建议

---

## 3. 运行模式

### Mode 1: AUTO（全自动）

```
适用: Tier 1 + Tier 3 低风险
行为: AI 执行 → 记录日志 → 汇总报告
通知: 每日汇总，不实时打扰
用户: 只看报告，不参与执行
```

### Mode 2: APPROVAL_REQUIRED（需审批）

```
适用: Tier 2 + Tier 3 中风险
行为: AI 生成 → 推送审批 → 用户确认 → 执行
通知: 实时推送待审批列表
用户: 每日花 10min 审批
```

### Mode 3: ALERT_FIRST（先告后执行）

```
适用: 异常检测 + 紧急响应
行为: AI 检测异常 → 立即告警 → 同时执行预设应急措施
通知: 实时告警（推送/短信）
用户: 事后确认或回滚
```

### Mode 4: MANUAL（纯手动）

```
适用: Tier 4 + 高风险操作
行为: AI 建议 → 用户手动执行
通知: 建议列表
用户: 完全控制
```

---

## 4. 默认模式配置

| AI 员工 | 默认模式 | 可覆盖 |
|---------|---------|--------|
| Alice（运营总监） | AUTO (T1) + APPROVAL (T2) | ✅ |
| Bob（内容运营） | APPROVAL_REQUIRED (T2+T3) | ✅ |
| Carol（用户增长） | TIERED_AUTO (T1自动, T3分级) | ✅ |

---

## 5. 用户覆盖机制

### 5.1 暂停/恢复

```
用户点击「暂停」:
  1. 当前任务立即停止
  2. 队列任务挂起
  3. 定时任务禁用
  4. 状态 → PAUSED

用户点击「恢复」:
  1. 从断点继续
  2. 队列任务恢复
  3. 定时任务启用
  4. 状态 → ACTIVE
```

### 5.2 接管

```
用户点击「我来处理」:
  1. AI 进入 OBSERVE 模式
  2. 用户手动操作
  3. AI 记录操作日志
  4. 用户完成后 → AI 恢复
```

### 5.3 紧急停止

```
用户点击「紧急停止」:
  1. 所有 AI 员工立即暂停
  2. 所有定时任务禁用
  3. 所有队列清空
  4. 推送确认通知
  5. 需逐个恢复
```

### 5.4 回滚

```
用户点击「回滚」:
  1. 查找最近一次 AI 操作
  2. 生成回滚方案
  3. 用户确认
  4. 执行回滚（如可逆）
  5. 记录回滚日志
```

---

## 6. 权限数据结构

```typescript
/**
 * AI Agent Permission — 存储在 HermesProfileBinding 或独立表
 */
interface AgentPermission {
  agentInstanceId: string
  mode: 'AUTO' | 'APPROVAL_REQUIRED' | 'ALERT_FIRST' | 'MANUAL'
  
  // 动作白名单（允许的动作）
  allowList: string[]
  
  // 动作黑名单（禁止的动作）
  denyList: string[]
  
  // 分级策略
  tierPolicy: {
    tier1: 'AUTO'                    // 读取
    tier2: 'APPROVAL'                // 创建
    tier3: 'TIERED_AUTO'             // 发送（子策略）
    tier4: 'MANUAL'                  // 修改
  }
  
  // Tier 3 子策略
  tier3SubPolicy: {
    normalComment: 'AUTO'            // 普通评论自动回
    praiseComment: 'AUTO'            // 夸赞自动回
    complaintComment: 'FLAG_MANUAL'  // 投诉标记人工
    inquiryMessage: 'AUTO'           // 咨询自动回
    legalMessage: 'FLAG_URGENT'      // 法律相关紧急
    publishContent: 'APPROVAL'       // 发布需审批
  }
  
  // 频率限制
  rateLimit: {
    maxCommentsPerHour: number
    maxMessagesPerHour: number
    maxPublishesPerDay: number
  }
  
  // 审批通知
  approvalNotification: {
    channel: 'push' | 'email' | 'sms'
    batchWindow: number              // 批量推送窗口（分钟）
  }
}
```

---

## 7. 审计日志

```typescript
/**
 * 每次 AI 执行动作必须记录
 */
interface ActionAuditLog {
  id: string
  agentInstanceId: string
  action: string                      // Capability ID
  tier: 1 | 2 | 3 | 4
  mode: string                        // 执行时的模式
  target: string                      // 目标（平台+对象）
  input: any                          // 输入摘要
  output: any                         // 输出摘要
  status: 'success' | 'failed' | 'flagged' | 'rolled_back'
  flaggedReason?: string              // 标记原因
  rollbackRef?: string                // 回滚引用
  timestamp: Date
}
```

---

## 8. 用户控制界面

```
AI 员工卡片 → 权限设置:
  ┌─────────────────────────────────────┐
  │ 模式: [全自动 ▼]                     │
  │                                     │
  │ ✅ 读取数据（自动）                   │
  │ ✅ 生成内容（需审批）                 │
  │ ✅ 回复评论（分级自动）               │
  │ ├── 普通评论: 自动回复               │
  │ ├── 投诉: 标记「需人工」              │
  │ └── 涉及金额: 标记「紧急」            │
  │ ⚠️ 发布内容（需审批）                 │
  │ ❌ 修改商品（禁止）                   │
  │                                     │
  │ 频率: 评论 ≤ 30/h, 私信 ≤ 20/h      │
  │ 通知: 实时推送待审批                  │
  │                                     │
  │ [暂停] [恢复] [紧急停止]             │
  └─────────────────────────────────────┘
```

---

*Task 06 完成。进入 Task 07: 数据所有权映射。*
