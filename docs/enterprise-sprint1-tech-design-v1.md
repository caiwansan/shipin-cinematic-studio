# Enterprise Operation Workspace — Sprint 1 Technical Design v1.0

> CTO 批准日期: 2026-07-15
> 设计状态: 待审批
> 开发范围: CEO Task Center + AI Employee Management

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────┐
│                   CEO Command Center                 │
│                                                     │
│  /enterprise/tasks        /enterprise/agents        │
│  ┌──────────────┐        ┌──────────────┐          │
│  │ 任务列表      │        │ AI员工档案    │          │
│  │ +新建任务     │        │ 目标/权限/模型│          │
│  │ +执行进度     │        │ [调整][暂停]  │          │
│  └──────┬───────┘        └──────┬───────┘          │
│         │                       │                   │
├─────────┼───────────────────────┼───────────────────┤
│         ▼                       ▼                   │
│  ┌──────────────┐        ┌──────────────┐          │
│  │ Command      │        │ Agent Profile│          │
│  │ Service      │        │ Service      │          │
│  └──────┬───────┘        └──────┬───────┘          │
│         │                       │                   │
├─────────┼───────────────────────┼───────────────────┤
│         ▼                       ▼                   │
│  ┌──────────────────────────────────────┐          │
│  │        Existing Agent Runtime         │          │
│  │  HdzAgentTask / Schedule / Goal      │          │
│  │  AuditTrail / Channel / Lead         │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## 二、数据库设计

### 2.1 新增表: `enterprise_command`

作用：记录老板指令，作为 CEO Intent Layer。

```prisma
model EnterpriseCommand {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id")
  creatorId     String   @map("creator_id")
  
  // 指令内容
  content       String   // 原始输入: "帮我寻找华东新能源物流客户"
  
  // AI解析后的结构化意图
  intentJson    Json?    @map("intent_json")  
  // {
  //   "goal": "拓展客户",
  //   "industry": "新能源物流",
  //   "region": "华东",
  //   "expected_output": "30个潜客",
  //   "assigned_agents": ["growth_director", "market_analyst", "content_manager"]
  // }
  
  // 执行状态
  status        String   @default("PENDING")  // PENDING/RUNNING/COMPLETED/FAILED
  
  // 时间戳
  createdAt     DateTime @default(now()) @map("created_at")
  startedAt     DateTime? @map("started_at")
  completedAt   DateTime? @map("completed_at")
  
  // 执行结果摘要
  resultSummary String?  @map("result_summary")
  resultJson    Json?    @map("result_json")
  // {
  //   "tasks_created": 3,
  //   "agents_assigned": 5,
  //   "execution_time_seconds": 180,
  //   "outputs": { "leads": 12, "content": 3, "opportunities": 2 }
  // }
  
  // 关联关系
  tasks         HdzAgentTask[]  // 拆解后的Agent任务
  
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@map("enterprise_command")
}
```

### 2.2 扩展已有表: `enterprise_agent_profile`

不新建表，扩展现有 Agent Profile：

```prisma
model EnterpriseAgentProfile {
  // ... 已有字段保持不变 ...
  
  // 新增字段
  dailyTarget    Int?     @map("daily_target")       // 每日目标数量
  workingHours   String?  @map("working_hours")      // 工作时间段: "09:00-18:00"
  managerNote    String?  @map("manager_note")       // 老板备注
  permissions    Json?    @map("permissions")        // 权限配置
  // {
  //   "allowed_actions": ["market_analysis", "content_planning", "data_query"],
  //   "forbidden_actions": ["auto_pricing", "publish_without_approval"]
  // }
  
  @@map("enterprise_agent_profile")
}
```

### 2.3 复用已有表（零修改）

| 表 | 用途 |
|----|------|
| `HdzAgentTask` | Agent执行任务 |
| `agent_schedule` | 定时调度 |
| `agent_goal` | 目标管理 |
| `agent_audit_trail` | 审计日志 |
| `agent_model_binding` | 模型绑定 |
| `governance_organization` | 组织架构 |
| `enterprise_channel_account` | 渠道账号 |
| `enterprise_content_publish` | 内容发布 |
| `enterprise_interaction` | 互动数据 |

---

## 三、后端 Service 设计

### 3.1 `command.service.ts` — 指令处理核心

```
CEO输入: "帮我寻找华东新能源物流客户"
         │
         ▼
┌─────────────────────┐
│  parseCommandIntent  │  ← 解析自然语言意图
│  (调用LLM)           │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  decomposeToTasks   │  ← 分解为Agent任务
│  (Planner)          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  createAgentTasks    │  ← 写入HdzAgentTask
│  (Reuse existing)   │
└────────┬────────────┘
         │
         ▼
    Agent Runtime 执行
```

**核心方法：**

```typescript
class CommandService {
  // 1. 创建并执行老板指令
  async createCommand(tenantId: string, content: string, creatorId: string): Promise<EnterpriseCommand>
  
  // 2. 解析自然语言为结构化意图
  private async parseIntent(content: string): Promise<CommandIntent>
  
  // 3. 拆解意图到Agent任务
  private async decomposeTasks(intent: CommandIntent): Promise<TaskPlan[]>
  
  // 4. 查询指令列表（支持筛选/分页）
  async listCommands(tenantId: string, filters: CommandFilters): Promise<CommandListResult>
  
  // 5. 查询指令详情（含执行进度）
  async getCommandDetail(commandId: string): Promise<CommandDetail>
  
  // 6. 统计面板数据
  async getCommandStats(tenantId: string): Promise<CommandStats>
}
```

### 3.2 `agent-profile.service.ts` — AI员工管理

```typescript
class AgentProfileService {
  // 1. 获取指定租户所有AI员工
  async listAgents(tenantId: string): Promise<AgentProfile[]>
  
  // 2. 更新日常目标
  async updateDailyTarget(agentId: string, target: number): Promise<void>
  
  // 3. 更新权限配置
  async updatePermissions(agentId: string, permissions: AgentPermissions): Promise<void>
  
  // 4. 暂停/启用员工
  async setAgentStatus(agentId: string, status: 'active' | 'paused'): Promise<void>
  
  // 5. 更新老板备注
  async updateManagerNote(agentId: string, note: string): Promise<void>
  
  // 6. 更换模型绑定
  async updateModelBinding(agentId: string, modelId: string): Promise<void>
}
```

---

## 四、API Route 设计

### 4.1 `/enterprise/tasks` — CEO任务中心

| Method | Path | 功能 |
|--------|------|------|
| `GET` | `/api/enterprise/commands` | 任务列表（状态/时间筛选） |
| `POST` | `/api/enterprise/commands` | 新建任务（输入意图→拆解→执行） |
| `GET` | `/api/enterprise/commands/:id` | 任务详情+执行进度 |
| `GET` | `/api/enterprise/commands/stats` | 统计面板数据 |
| `POST` | `/api/enterprise/commands/:id/cancel` | 取消任务 |

### 4.2 `/enterprise/agents` — AI员工管理

| Method | Path | 功能 |
|--------|------|------|
| `GET` | `/api/enterprise/agent-profiles` | AI员工列表 |
| `GET` | `/api/enterprise/agent-profiles/:id` | 员工详情 |
| `PATCH` | `/api/enterprise/agent-profiles/:id` | 更新（目标/权限/模型） |
| `POST` | `/api/enterprise/agent-profiles/:id/toggle` | 暂停/启用 |
| `PUT` | `/api/enterprise/agent-profiles/:id/note` | 更新备注 |

---

## 五、前端页面设计

### 5.1 `/enterprise/tasks` — CEO任务中心

```
┌──────────────────────────────────────────────────┐
│  📋 任务中心                    [ + 新建任务 ]    │
├──────────────────────────────────────────────────┤
│  📊 今日概览                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│  │ 12 │ │ 3  │ │ 8  │ │ ¥6 │                    │
│  │完成│ │执行│ │机会│ │成本│                    │
│  └────┘ └────┘ └────┘ └────┘                    │
├──────────────────────────────────────────────────┤
│  进行中                                          │
│  ┌──────────────────────────────────────┐       │
│  │ 🔵 寻找新能源物流客户                  │       │
│  │    参与: 🧠增长总监 📊市场 ✍内容     │       │
│  │    进度: [████████░░░░] 67%           │       │
│  │    预计产出: 30个潜客                  │       │
│  └──────────────────────────────────────┘       │
│  ┌──────────────────────────────────────┐       │
│  │ 🔵 拓展华南新能源市场                  │       │
│  │    参与: 🧠增长总监                   │       │
│  │    进度: [████░░░░░░░░] 33%           │       │
│  └──────────────────────────────────────┘       │
├──────────────────────────────────────────────────┤
│  历史任务                                        │
│  ┌──────────────────────────────────────┐       │
│  │ ✅ 内容营销提升 (已完成)               │       │
│  │    结果: 12篇内容, 38个互动, 8个线索   │       │
│  └──────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

**新建任务流程：**
1. [输入框] 老板输入商业目标
2. [开始执行] → AI解析意图+拆解任务
3. 跳转到任务详情，实时显示执行进度

### 5.2 `/enterprise/agents` — AI员工管理

```
┌──────────────────────────────────────────────────┐
│  👥 AI员工管理                    [ 5位员工 ]     │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐       │
│  │ 🟢 AI增长总监 — growth_director       │       │
│  │    状态: 工作中                       │       │
│  │    今日目标: 10个商业机会 (8/10)       │       │
│  │    模型: DeepSeek                     │       │
│  │    权限: 市场分析✅ 内容规划✅ 数据查询✅│       │
│  │    自动报价❌                         │       │
│  │  [调整目标] [修改权限] [暂停]         │       │
│  └──────────────────────────────────────┘       │
│  ┌──────────────────────────────────────┐       │
│  │ 🟢 AI内容经理 — content_manager      │       │
│  │    状态: 工作中                       │       │
│  │    今日目标: 3篇内容 (2/3)            │       │
│  │    ...                               │       │
│  └──────────────────────────────────────┘       │
│  ... 其他3位                                     │
└──────────────────────────────────────────────────┘
```

---

## 六、NLP意图解析设计

### 解析策略：关键词+正则辅助

由于追求MVP快速上线，意图解析**不依赖LLM调用延迟**，采用轻量策略：

```
输入: "帮我寻找华东地区新能源物流客户"

解析结果:
{
  "goal": "acquire_customers",
  "industry": "新能源物流",
  "region": "华东",
  "expected_output": "30个潜客",
  "assigned_agents": ["growth_director", "market_analyst", "content_manager"],
  "priority": "normal"
}
```

**实现**: 基于行业关键词库匹配 → 地区实体识别 → 目标类型映射
**Fallback**: 解析不完整 → 使用默认5-Agent全分配

---

## 七、任务拆解DAG

```
                    老板指令: "寻找新能源客户"
                              │
                              ▼
                    ┌─────────────────┐
                    │   增长总监       │
                    │  扫描市场机会    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │ 市场分析师   │ │ 内容经理     │ │ 客户运营     │
     │ 分析竞争格局 │ │ 生成行业内容 │ │ 监控互动数据 │
     └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                 ┌─────────────────┐
                 │   销售助理       │
                 │  整理客户名单    │
                 └─────────────────┘
```

---

## 八、文件清单

### 后端
| 文件 | 功能 |
|------|------|
| `src/services/enterprise/command.service.ts` | Command Service 核心 |
| `src/services/enterprise/agent-profile.service.ts` | AI员工管理 Service |
| `src/routes/enterprise-command.ts` | Task Center API |
| `src/routes/enterprise-agent-profiles.ts` | AI员工管理 API |
| `backend/prisma/schema.prisma` | 新增 enterprise_command + 扩展 profile |

### 前端
| 文件 | 功能 |
|------|------|
| `frontend/pages/enterprise/tasks/index.vue` | 任务列表页 |
| `frontend/pages/enterprise/tasks/create.vue` | 新建任务页 |
| `frontend/pages/enterprise/tasks/[id].vue` | 任务详情页 |
| `frontend/pages/enterprise/agents/index.vue` | AI员工管理页 |
| `frontend/components/enterprise/AgentCard.vue` | AI员工卡片组件 |
| `frontend/components/enterprise/TaskProgress.vue` | 任务进度组件 |

### Migration
| 文件 | 功能 |
|------|------|
| `backend/prisma/migrations/2026071501_enterprise_command_sprint1.sql` | 新增表 |

---

## 九、复用清单（已有能力）

| 已有基础设施 | 复用方式 |
|------------|----------|
| `HdzAgentTask` | 拆解后直接创建Agent任务 |
| `agent_schedule` | 如需定时执行 |
| `agent_goal` | 关联每日目标 |
| `agent_audit_trail` | 自动记录执行审计 |
| `agent_model_binding` | 读取模型配置 |
| `enterprise_channel_account` | 内容发布渠道 |
| `lead-intelligence` | 线索识别 |
| `EnterpriseRuntime` | Agent执行引擎 |
| Auth/JWT Hook | 已有权限体系 |

---

## 十、时间表

| 阶段 | 耗时 | 产出 |
|------|------|------|
| 数据库 Migration | 0.5h | enterprise_command表 + profile扩展 |
| Command Service | 3h | 意图解析+任务拆解+CRUD |
| Agent Profile Service | 2h | 员工管理API |
| Route挂载 | 0.5h | API路由注册 |
| 前端-任务中心 | 4h | 3个页面+2个组件 |
| 前端-AI员工管理 | 3h | 1个页面+组件 |
| 联调+测试 | 2h | 验收场景通过 |
| **总计** | **15h** | **约2天** |

---

## 十一、验收标准（与CTO批准令对齐）

| # | 场景 | 验收条件 |
|---|------|----------|
| 1 | 打开企业数字部门 | 页面正常加载，导航包含"任务中心"和"AI员工" |
| 2 | 新建任务 | 输入"寻找新能源汽车客户"→ 解析意图 → 拆解DAG展示 |
| 3 | 任务执行 | 关联AgentRuntime产生任务，有进度更新 |
| 4 | AI员工管理 | 展示5位员工，可调整目标/权限，暂停后状态变更 |
| 5 | 次日统计 | 显示"昨日完成12项任务/37互动/8机会/成本¥6.8" |
| 6 | 模块隔离 | 短剧/小说/法律/PPT/GEO/商城零修改 |

---

## 十二、开放问题（需CTO确认）

| # | 问题 | 倾向 |
|---|------|------|
| 1 | 意图解析是否需要LLM，MVP用关键词？ | 关键词（快） |
| 2 | 任务取消是否支持？ | 支持（P1） |
| 3 | 多租户Boss（同tenant多人发指令）？ | MVP只支持单creator |
| 4 | 移动端适配？ | P2暂不处理 |

---

**设计者**: 熊二 (OpenClaw CEO Agent)
**状态**: ⏳ 待CTO审批
**版本**: v1.0
