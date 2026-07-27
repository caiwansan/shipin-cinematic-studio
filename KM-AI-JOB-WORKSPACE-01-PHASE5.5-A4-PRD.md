# A4 AI Runtime Center PRD

**版本**: Draft v0.1  
**日期**: 2026-07-23  
**作者**: OpenClaw  
**状态**: Draft — 不编码，仅产品需求

---

## 一、目标

> 企业老板管理 AI 员工，而不是管理 AI 模型。

一句话：让企业 CEO / HR 负责人直观看到每个 AI 员工的工作状态、成本消耗、任务完成情况。

---

## 二、目标用户

| 角色 | 关注点 | 使用场景 |
|------|--------|----------|
| **CEO** | 整体预算、AI员工效率 | 查看月度成本、调整预算 |
| **HR负责人** | 招聘进度、AI协作效果 | 查看招聘漏斗、Agent 工作状态 |
| **招聘主管** | Pipeline 操作、面试安排 | 日常使用 Pipeline Kanban |

---

## 三、核心对象：AI 员工

不是 Model，而是：

| AI 员工 | 职责 | 状态 |
|---------|------|------|
| 🤖 AI招聘经理 | 招聘策略、JD生成、招聘计划 | 🟢 运行中 |
| 📄 AI简历分析师 | 简历解析、候选人评分、技能匹配 | 🟢 运行中 |
| 🎤 AI面试官 | 面试方案生成、问题生成、面试评价 | 🟢 运行中 |
| 🔍 AI猎聘顾问 | 人才库搜索、候选人关系维护 | 🟡 试用期 |

---

## 四、功能模块

### 4.1 AI 员工列表

每个 Agent 卡片显示：

```
🤖 AI招聘主管
━━━━━━━━━━━━━━━━━━━━
状态:     🟢 运行中
当前模型: DeepSeek
今日任务: 12 次筛选 | 6 次面试 | 2 个 Offer
Token:    120 万
成本:     80 元
━━━━━━━━━━━━━━━━━━━━
```

**数据字段：**
- `displayName` — 显示名称
- `agentType` — 类型标识
- `status` — active / trial / paused / disabled
- `currentModel` — 当前使用的模型
- `monthlyCalls` — 本月调用次数
- `monthlyTokens` — 本月 Token 消耗
- `monthlyCost` — 本月成本（CNY）
- `roleDescription` — 职责描述

### 4.2 BYOK（Bring Your Own Key）

支持的模型提供商：

| 提供商 | 状态 | 说明 |
|--------|------|------|
| OpenAI | ✅ 已支持 | GPT-4 / GPT-3.5 |
| DeepSeek | ✅ 已支持 | DeepSeek Chat |
| 通义千问 | 🔜 待接入 | 阿里云 |
| 豆包 | 🔜 待接入 | 字节跳动 |

**配置界面：**
```
API Key 配置
━━━━━━━━━━━━━━━━━━━━
[✓] 平台默认 Key
[ ] 使用自有 Key

OpenAI API Key:     [sk-...........................]
DeepSeek API Key:   [sk-...........................]
通义 API Key:       [...............................]
豆包 API Key:       [...............................]

[保存配置]
```

**平台 Key 与 BYOK 边界：**
- 平台 Key：免费/基础会员使用，共享配额，限流
- BYOK：VIP 会员自有 Key，不限流，按量计费

### 4.3 预算管理

```
本月预算
━━━━━━━━━━━━━━━━━━━━
总预算:     300 元
已用:       127 元 (42%)
预计月底:   215 元

按 Agent 拆分:
  🤖 AI招聘主管    45 元 (35%)
  📄 AI简历分析师  32 元 (25%)
  🎤 AI面试官      28 元 (22%)
  🔍 AI猎聘顾问    22 元 (18%)

[调整预算]
```

**预算告警：**
- 使用量 > 80%：黄色告警
- 使用量 > 100%：红色告警 + 暂停 AI 操作

### 4.4 Runtime 监控

```
最近 20 个任务
━━━━━━━━━━━━━━━━━━━━
✅ 14:30  AI简历分析师  张三简历分析完成    0.3s
✅ 14:28  AI面试官      生成面试方案 6题    2.1s
✅ 14:25  AI招聘主管    JD生成 - AI工程师    1.8s
⚠️ 14:20  AI猎聘顾问   搜索超时 (已重试)     30s
✅ 14:15  AI简历分析师  李四简历分析完成    0.4s
...
```

**统计面板：**
- 总任务数：128
- 成功：120 (93.8%)
- 失败：5 (3.9%)
- 重试：3 (2.3%)
- 平均响应时间：1.2s

---

## 五、页面布局

```
┌──────────────────────────────────────────────────────┐
│  AI Runtime Center                    [预算: 127/300] │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  导航       │  主内容区                                │
│            │                                         │
│  AI员工 ●  │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  BYOK      │  │招聘主管  │ │简历分析师│ │面试官   │  │
│  预算      │  │运行中   │ │运行中   │ │运行中   │  │
│  Runtime   │  │Token:120万│ │Token:80万│ │Token:60万│  │
│            │  │成本:80元 │ │成本:50元 │ │成本:40元 │  │
│  ─────     │  └─────────┘ └─────────┘ └─────────┘  │
│  设置      │                                         │
│            │  本月预算                                │
│            │  ████████████░░░░░░░░ 42% (127/300)      │
│            │                                         │
│            │  最近任务                                │
│            │  ✅ 14:30 简历分析 张三  0.3s            │
│            │  ✅ 14:28 面试方案 6题   2.1s            │
│            │  ⚠️ 14:20 猎聘搜索 超时  30s             │
│            │                                         │
└────────────┴─────────────────────────────────────────┘
```

---

## 六、API 设计（草稿）

### AI 员工
- `GET /api/enterprise/:enterpriseId/agents` — 获取 AI 员工列表
- `PATCH /api/enterprise/:enterpriseId/agents/:agentId` — 更新 Agent 状态（暂停/恢复）

### BYOK
- `GET /api/enterprise/:enterpriseId/ai-providers` — 获取已配置的 Provider
- `POST /api/enterprise/:enterpriseId/ai-providers` — 配置 Provider Key
- `POST /api/enterprise/:enterpriseId/ai-providers/:providerId/test` — 测试 Provider 连通性

### 预算
- `GET /api/enterprise/:enterpriseId/budget` — 获取预算和消耗
- `PATCH /api/enterprise/:enterpriseId/budget` — 调整预算上限

### Runtime
- `GET /api/enterprise/:enterpriseId/runtime/tasks` — 最近任务列表
- `GET /api/enterprise/:enterpriseId/runtime/stats` — 统计面板数据

---

## 七、数据模型（草稿）

### AgentRuntime 模型（可能已存在）
```prisma
model AgentRuntime {
  id          String   @id @default(uuid())
  agentId     String   // 关联到 EnterpriseAgent
  model       String   // 当前模型 (deepseek/gpt-4/...)
  provider    String   // 平台 / byok
  status      String   // active/paused/disabled
  monthlyTokens Int    @default(0)
  monthlyCost   Float  @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Budget 模型
```prisma
model Budget {
  id              String   @id @default(uuid())
  enterpriseId    String
  monthlyLimit    Float    // 月度预算上限
  currentUsage    Float    @default(0)
  alertThreshold  Int      @default(80) // 告警阈值百分比
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([enterpriseId])
}
```

---

## 八、技术约束

1. **不改变现有 Agent 架构** — Runtime Center 是管理层，不修改 Agent 执行逻辑
2. **复用现有 Dashboard API** — 已有 workforce 数据，直接复用
3. **BYOK 优先级低于 Runtime** — 先展示状态和成本，再配置 Key
4. **预算告警** — 初期使用简单阈值告警，后续可接入邮件/短信

---

## 九、风险与假设

| 风险 | 影响 | 缓解 |
|------|------|------|
| Beta 反馈显示用户更关注某个 Agent | 调整首页布局 | 先做完整版再优化 |
| BYOK 配置复杂度高于预期 | 用户流失 | 初期引导配置 + 默认 Key |
| 预算计算不准确 | 用户投诉 | 使用 Token 精确计算 |
| Runtime 数据量过大 | 性能问题 | 分页 + 缓存 |

---

## 十、建议优先级

| 优先级 | 功能 | 理由 |
|--------|------|------|
| P0 | AI 员工列表 + 状态 | 核心价值 |
| P0 | 预算展示 | CEO 最关心 |
| P1 | Runtime 任务列表 | 运营监控 |
| P1 | 预算告警 | 防止超支 |
| P2 | BYOK 配置 | 进阶功能 |
| P2 | Provider 测试 | 配合 BYOK |

---

*本文档为产品需求草稿，最终实现可能需要根据 Beta 反馈调整。*
