# Sprint: Enterprise Commercial Reality 01

**完成时间:** 2026-07-27
**状态:** 🟢 关键问题已修复，商业边界已建立

---

## Phase 1: AI Employee Commercial Flow Audit

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| EnterpriseAgentInstance 包含 tenantId | ✅ | 所有实例正确绑定租户 |
| runtime = 'enterprise' | ✅ | Sprint-02 已修复 |
| Hermes binding | ✅ | 每个实例有独立 hermesAgentId |
| Memory namespace 隔离 | ✅ | `tenant/{tenantId}/agent/{instanceId}` |
| Career Agent 创建链路 | ✅ | Profile → Instance → Hermes Binding 完整 |
| BYOK Gate | ✅ | Career Agent 激活前检查用户 LLM Key |

### 🚨 关键发现：3 个 Agent 创建入口全部没有 entitlement 检查

| 入口 | 文件 | 问题 |
|------|------|------|
| `POST /api/enterprise/:tenantId/agents` | routes/enterprise.ts:147 | 直接调用 create()，无 entitlement 检查 |
| `POST /api/enterprise/media-department/employees` | routes/enterprise-agent-runtime.ts | 直接 prisma.create()，无 entitlement 检查 |
| `createDefaultDepartment()` | enterprise-agent.service.ts | Onboarding 时创建 5 个 Agent，无检查 |
| `POST /api/career/agent/activate-and-execute` | routes/career-activation.ts | Career Agent 无检查 |

**商业风险：**
```
Basic 用户 (限额 1 AI Employee)
  ↓ 调用 POST /api/enterprise/:tenantId/agents
  ↓ 创建第 2 个、第 3 个...第 N 个
  ↓ 无限制
```

---

## Phase 2: Subscription / Plan Boundary Audit

### ✅ 基础设施存在

| 组件 | 状态 | 说明 |
|------|------|------|
| EnterprisePlan 模型 | ✅ | maxEmployees, maxChannels, maxMembers |
| EnterpriseSubscription 模型 | ✅ | status, expireAt, autoRenew |
| EnterpriseEntitlement 服务 | ✅ | checkAgentCapability(), syncAgents() |
| Entitlement 同步逻辑 | ✅ | 超额 → suspend，有空间 → activate |

### 🚨 关键发现：Entitlement 服务存在但从未被调用

`enterprise-entitlement.service.ts` 提供了完整的检查逻辑：
```ts
async checkAgentCapability(organizationId: string): Promise<EntitlementCheck> {
  // 返回 { allowed, current, limit, reason }
}
```

但**没有任何创建 Agent 的代码调用它**。

---

## Phase 3: Usage → Billing Reality Audit

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Agent 执行写入 usageLog | ✅ | cost, tokens, provider, taskType |
| cost 计算 | ✅ | estimateCost() 按 provider 估算 |
| 任务记录完整 | ✅ | tokenInput, tokenOutput, cost, durationMs |
| 审计追踪 | ✅ | AgentAuditTrail 记录所有操作 |

### 🚨 关键发现：UsageLog 没有 tenantId 字段

```prisma
model UsageLog {
  id         String   @id @default(uuid())
  userId     String
  taskId     String?
  cost       Float    @default(0)
  taskType   String
  provider   String
  tokens     String?  // ← tenantId 藏在这里（JSON）
  isPlatform Boolean  @default(true)
  // ❌ 缺少 tenantId 字段
}
```

**商业风险：**
```
企业 A 的 AI 员工执行 100 次任务
  ↓ usageLog 无 tenantId
  ↓ 无法直接聚合企业 A 的总消耗
  ↓ 无法按租户计费
```

---

## Phase 4: Recruitment Value Reality

### ✅ 招聘闭环存在

| 环节 | 状态 | 说明 |
|------|------|------|
| JD 生成 | ✅ | enterprise.routes.ts:jd/generate |
| 候选匹配 | ✅ | enterprise.routes.ts:match |
| 候选人分析 | ✅ | RecruitmentActionService.candidate_analysis |
| 沟通生成 | ✅ | RecruitmentActionService.communication_draft |
| 面试建议 | ✅ | RecruitmentActionService.interview_suggestion |
| Pipeline 建议 | ✅ | RecruitmentActionService.pipeline_suggestion |
| 数据来源标记 | ✅ | 所有输出标注 dataSources |

### ✅ Career Agent 个人求职助理

| 环节 | 状态 | 说明 |
|------|------|------|
| 求职规划 | ✅ | Career Agent capabilities |
| 简历分析 | ✅ | Career Agent capabilities |
| 岗位匹配 | ✅ | Career Agent capabilities |
| 面试准备 | ✅ | Career Agent capabilities |
| 薪资分析 | ✅ | Career Agent capabilities |

---

## Phase 5: Commercial Reality Gate

### Gate-1: AI Employee 创建

| 检查项 | 状态 |
|--------|------|
| 创建成功 | ✅ |
| tenant 正确 | ✅ |
| Hermes binding 正确 | ✅ |
| memory 隔离 | ✅ |
| **Entitlement 检查** | **❌ FAIL** |

### Gate-2: Plan Limit

| 检查项 | 状态 |
|--------|------|
| Trial 限制有效 | ❌ 无检查 |
| Basic=1 | ❌ 无限制 |
| Pro=3 | ❌ 无限制 |
| Enterprise=10 | ❌ 无限制 |

### Gate-3: Usage

| 检查项 | 状态 |
|--------|------|
| Agent 执行产生 usage | ✅ |
| usage 关联 tenant | ❌ 无直接字段 |
| 可追踪消耗 | ⚠️ 需解析 JSON |

### Gate-4: Business Value

| 检查项 | 状态 |
|--------|------|
| 企业用户能完成招聘任务闭环 | ✅ |

---

## Reality Gate: 🟢 GO (with fixes)

### 结论

**基础设施存在，商业边界已修复。**

```
AI Employee 创建链路    ✅ 完整
Entitlement 服务       ✅ 存在
Entitlement 调用       ✅ 已修复 (5个入口)
Usage 记录             ✅ 存在
Usage → Billing 聚合   ✅ 已修复 (tenantId 字段)
招聘闭环               ✅ 完整
Subscription 创建      ✅ 已修复 (Onboarding Step 4)
Entitlement 模型       ✅ 已创建
```

---

## 修复实施

### ✅ Fix-1: Agent 创建入口增加 Entitlement 检查

**已修复文件:**
- [x] `routes/enterprise.ts` — POST /api/enterprise/:tenantId/agents
- [x] `routes/enterprise-agent-runtime.ts` — POST /api/enterprise/media-department/employees
- [x] `services/enterprise/enterprise-agent.service.ts` — createDefaultDepartment()
- [x] `routes/career-activation.ts` — Career Agent 创建
- [x] `routes/recruitment-department.routes.ts` — syncEmployeesToPersistence()

**修复模式:**
```ts
const check = await entitlementService.checkAgentCapability(organizationId)
if (!check.allowed) {
  return reply.status(403).send({
    error: 'AGENT_LIMIT_REACHED',
    message: check.reason,
    current: check.current,
    limit: check.limit,
  })
}
```

### ✅ Fix-2: UsageLog 增加 tenantId 字段

**Prisma 迁移:** ✅ 已执行
```sql
ALTER TABLE usage_logs ADD COLUMN tenant_id UUID;
CREATE INDEX usage_logs_tenant_id_idx ON usage_logs(tenant_id);
```

**写入时填充:** ✅ 已修复
- `enterprise-agent-runtime.service.ts` — 写入时填充 tenantId
- `career-agent-runtime.service.ts` — 写入时填充 tenantId

### ✅ Fix-3: Onboarding 创建 Subscription + Entitlement

**问题:** Onboarding 流程不创建 Subscription 和 Entitlement，导致用户无法创建 Agent。

**修复:** `routes/enterprise-onboarding.routes.ts` Step 4
- 查找或创建 EnterprisePlan
- 创建 EnterpriseSubscription（含 snapshot 字段）
- 创建 EnterpriseEntitlement

### ✅ Fix-4: 新增 EnterpriseEntitlement 模型

**Prisma Schema:**
```prisma
model EnterpriseEntitlement {
  id              String   @id @default(uuid())
  organizationId  String
  subscriptionId  String   @unique
  maxAgents       Int      @default(1)
  maxChannels     Int      @default(1)
  maxMembers      Int      @default(3)
  storageLimit    Int      @default(5)
  features        Json
  status          String   @default("active")
  effectiveFrom   DateTime @default(now())
  effectiveUntil  DateTime?
  // ...
}
```

**数据库迁移:** ✅ 已执行
```sql
CREATE TABLE enterprise_entitlement (...);
```

### ✅ Fix-5: EnterpriseSubscription 添加 snapshot 字段

**Prisma Schema:**
```prisma
model EnterpriseSubscription {
  // ... existing fields ...
  snapshotName         String?
  snapshotMaxEmployees Int?
  snapshotMaxChannels  Int?
  snapshotMaxMembers   Int?
  snapshotFeatures     Json?
}
```

**用途:** 加速订阅查询，避免 join。

---

## 影响统计

| 指标 | 数值 |
|------|------|
| 审计文件数 | 15+ |
| 高危商业边界缺失 | 2 → ✅ 已修复 |
| 创建入口未检查 | 5 → ✅ 全部已加检查 |
| 数据模型缺失字段 | 2 → ✅ 已修复 (UsageLog.tenantId + Subscription snapshot) |
| 新增模型 | 1 (EnterpriseEntitlement) |
| 招聘闭环 | ✅ 完整 |
| 数据库迁移 | ✅ 已执行 |

---

## 架构状态更新

```
Enterprise Recruitment Workspace
├── Identity Layer        ✅
├── Workspace Layer       ✅
├── Tenant Layer          ✅
├── AI Runtime Layer      ✅
└── Commercial Layer      🟢 已修复
    ├── Entitlement 检查  ✅ 5个入口已加检查
    ├── Plan 限制         ✅ Onboarding 创建 Subscription + Entitlement
    ├── Usage → Billing   ✅ UsageLog.tenantId 已添加
    └── 招聘闭环          ✅
```

---

## 交付物

- `docs/sprint/enterprise-commercial-reality-01-report.md`
- ✅ Fix-1: 5 个 Agent 创建入口增加 Entitlement 检查
- ✅ Fix-2: UsageLog 添加 tenantId 字段 + 写入填充
- ✅ Fix-3: Onboarding Step 4 创建 Subscription + Entitlement
- ✅ Fix-4: 新增 EnterpriseEntitlement 模型 + 数据库表
- ✅ Fix-5: EnterpriseSubscription 添加 snapshot 字段
- ✅ 数据库迁移 SQL 已执行
