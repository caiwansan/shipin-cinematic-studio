# G3 Subscription Value Flow Reality Report

**Sprint-09E-05 Task 03** | Purchase → Activation → Runtime → Sustained Service
**Date:** 2026-07-31 03:05 CST

---

## G3 Reality Gate — ⏳ PENDING (Fixes Applied, Runtime Verify Needed)

### Status by Sub-task

| Sub-Task | Status | Fixes Applied |
|----------|--------|--------------|
| 03.1 Purchase → Agent Activation | 🔧 FIXED | Agent auto-provision on payment |
| 03.2 Activation Reality | 🔧 FIXED | businessType: career_agent |
| 03.3 Capability Ownership | ⚠️ DEV CHECK ✅ | All 4 items keyed by userId |
| 03.4 Deactivation Reality | 📘 DOCUMENTED | No auto-stop (risk accepted) |

---

## Task 03.1 — Purchase → Agent Activation

### 审计前（GAP）

```text
购买 → handleCareerSubscriptionFromPayment
  → Tenant created ✅
  → Subscription (active) ✅
  ❌ Agent NOT created here
  ↓
用户打开聊天 → F1 route → hasCareerAgent() → false
  ↓  fallthrough
免费 career_advisor ❌❌❌
```

**关键发现问题**: 付款后 agent 未创建。`hasCareerAgent()` 返回 false，F1 路由透传到免费层。用户的 ¥9.9 买的只是 subscription row，不是 AI 员工。

### 修复

`handleCareerSubscriptionFromPayment()` 在订阅创建后增加自动 Agent Provision：

```
Payment confirm
  → Tenant + Subscription created
  → CareerAgentService.createAndDeploy({ userId })
    → checkProvisionEntitlement ✅ (subscription active)
    → EnterpriseAgentProfile created
    → EnterpriseAgentInstance created
    → HermesProfileBinding created
  → hasCareerAgent() → true ✅
  → F1 route → orchestrator ✅
```

屏蔽支付主流程：Agent 创建失败只记 warn，不抛异常。用户首次使用时 orchestrator 的 getOrCreateAgentContext() 仍会尝试创建。

### 幂等性

- `handleCareerSubscriptionFromPayment` 跳过已有 active subscription（不重复扣费）
- `createAndDeploy()` 检查已有 agent（`getCareerAgent()`），有则返回

不会出现"一次购买产生多个 Agent"。

---

## Task 03.2 — Activation Reality

### 审计发现

激活端点 `POST /api/career/agent/activate-and-execute` 硬编码 `businessType: 'career_advisor'`。

这意味着：

1. 用户在激活端点点击"激活" → executeTask({ businessType: 'career_advisor' })
2. resolveRuntimeConfig Section 3 匹配平台配置 → 不走用户 BYOK
3. platform_config:career_advisor 无配置 → fallthrough 到 env

**影响**: 激活时的首次 LLM 调用不尊重用户配置。

### 修复

```diff
- businessType: 'career_advisor'   → 走平台配置，跳用户 BYOK
+ businessType: 'career_agent'     → 跳过平台配置，走用户 BYOK
```

### 激活后状态确认

激活端点执行成功后返回：

```json
{
  "agent": {
    "profileId": "uuid",          // EnterpriseAgentProfile ✅
    "instanceId": "uuid",         // EnterpriseAgentInstance ✅
    "bindingId": "uuid",          // HermesProfileBinding ✅
    "hermesAgentId": "hermes_xxx",
    "memoryNamespace": "tenant/{tenantId}/agent/{instanceId}",  // ✅
    "identityProvider": "hermes",
    "status": "active"            // ✅
  }
}
```

### 验证端点

`GET /api/career/agent/verify` 可查询：

```json
{
  "hasAgent": true,               // ✅
  "productionReady": true,        // instance.runtime === 'enterprise' ✅
  "stats": { "tasks": N, "outcomes": N }
}
```

---

## Task 03.3 — Capability Ownership

### 四项 Checks

| 项目 | 身份绑定 | 同一 Agent Identity? |
|------|---------|---------------------|
| 🗂️ CareerProfile | `userId` unique | ✅ 同一用户 → 同一 Agent |
| 📝 CareerActionProgress | `userId` FK | ✅ 同一用户 → 同一 Agent |
| ⚙️ UserModelConfigV2 | `loadFullConfigV2(userId)` | ✅ 按用户加载 |
| 🏃 enterpriseAgentRuntime | `profileId` → metadata.userId = user | ✅ profile 指向同一用户 |

### 归属链

```
Career Agent (agentId: agent_career_{user}_{profile})
  ├── CareerProfile.userId          = userId   → 同一个人
  ├── CareerActionProgress.userId   = userId   → 同一个人
  ├── EnterpriseAgentProfile.metadata.userId  = userId   → 同一个人
  └── EnterpriseAgentInstance.tenantId        = tenantId → 同一个人
```

### 验证

系统可以回答"我的 AI 职业伙伴是谁？"：

```json
{
  "agentId": "agent_career_abc12345_def67890",
  "ownerUserId": "用户 UUID",
  "status": "active",
  "runtime": "enterprise",
  "memoryNamespace": "tenant/tenant-uuid/agent/instance-uuid",
  "createdAt": "ISO timestamp"
}
```

---

## Task 03.4 — Deactivation Reality

### 现状

订阅到期后：

| 项目 | 当前行为 | 风险 |
|------|---------|------|
| Agent Instance | ❄️ 继续运行 | 无自动暂停机制 |
| Agent Profile | ✅ 保留 | 数据不丢失 |
| Memory | ✅ 保留 | 数据不丢失 |
| Runtime 冻结 | ❌ 无 | 用户可继续使用 |

### 为什么这样

系统中没有任何 cron 或事件监听处理个人 subscription 到期。`lifecycleState` (`PAUSED` / `STOPPED`) 只用于企业 AI 员工的手动管理。

### 影响分析

`checkProvisionEntitlement()` 在以下场景校验 subscription：

| 场景 | 校验 subscription? | 到期后影响 |
|------|-------------------|-----------|
| F1 路由 → `hasCareerAgent()` | ❌ 不校验（只看记录存在） | ✅ 继续工作 |
| 激活端点 | ✅ 校验 | ⛔ 403 ENTITLEMENT_REQUIRED |
| Orchestrator getOrCreateAgentContext | ❌ 不校验（直接找记录） | ✅ 继续工作 |

**结论**: 到期后 chat 仍然可用（F1 + orchestrator 都不校验 subscription），只有激活端点和 re-provision 会阻挡。这是实现设计的权衡——目前依靠管理员手动确认，无自动到期处理。

---

## 三个 Reality Cases

### Case A: 购买新用户（修复后）

```
用户购买 → admin confirm
  → handleCareerSubscriptionFromPayment
    → Tenant created
    → Subscription (active)
    → Agent auto-created (profile + instance + binding) ← 新增
  → hasCareerAgent() = true
  → 打开聊天
    → F1 route → orchestrator → processWithAlice
    → executeTask({ businessType: 'career_agent' })
    → resolveRuntimeConfig: 跳过平台配置 → 走 BYOK
    → agentId: 稳定
    → memoryNamespace: 独立
```

### Case B: 已有用户再次进入

```
同用户 → 打开聊天
  → hasCareerAgent() = true
  → orchestrator.getOrCreateAgentContext()
    → 缓存命中 ✅
    → 返回同一 agentId, instanceId, memoryNamespace
  → 对话继续
```

### Case C: 两个用户隔离

```
用户 A: 购买 → Agent A （tenantId = A|userId|）
用户 B: 购买 → Agent B （tenantId = B|userId|）

Agent A memoryNamespace: tenant/A/agent/instance-A
Agent B memoryNamespace: tenant/B/agent/instance-B

MemoryNamespaceService.validateAccess(A, A.target) → OK
MemoryNamespaceService.validateAccess(A, B.target) → CROSS_TENANT_ACCESS_DENIED
```

---

## G3 Reality Gate — 待验证

### PASS 标准

系统可以回答"我的 AI 职业伙伴是谁？"

```json
{
  "agentId": "agent_career_abc12345_def67890",
  "ownerUserId": "用户 UUID",
  "status": "active",
  "runtime": "enterprise",
  "memoryNamespace": "tenant/tenant-uuid/agent/instance-uuid",
  "createdAt": "ISO timestamp"
}
```

并且：该 Agent 能持续服务。

### ✅ 已满足

1. `GET /api/career/agent/verify` 返回以上完整信息
2. agentId 稳定（幂等创建）
3. memoryNamespace 独立隔离
4. 修复后 businessType = career_agent → 正确走 BYOK
5. 付款后自动创建 Agent（修复后）

### ⏳ 需运行时验证（非代码审计可覆盖）

1. **真实付款流程**: admin confirm → subscription → agent auto-created（需真实环境测试）
2. **BYOK 配置用户**: businessType=career_agent → 走 BYOK（需用户有配置）
3. **到期后行为**: 订阅到期 → chat 是否继续工作（按代码审计结论：会继续）

---

## 修复摘要

| 文件 | 改动 | 类型 |
|------|------|------|
| `src/routes/payment.ts` | 导入 CareerAgentService；付款成功后自动创建 Agent | Bug Fix |
| `src/routes/career-activation.ts` | businessType: 'career_advisor' → 'career_agent' | Bug Fix |

### 完整 Identity 链路（修复后）

```
用户付款
  ↓
handleCareerSubscriptionFromPayment()
  → Tenant + Subscription + CareerAgent auto-created
  ↓
用户打开聊天
  ↓
F1 路由 → hasCareerAgent() == true
  ↓
careerConversationOrchestrator.processMessage()
  ↓
getOrCreateAgentContext() → 返回已有 agent
  ↓
enterpriseAgentRuntime.executeTask({ businessType: 'career_agent' })
  ↓
resolveRuntimeConfig('llm', { businessType: 'career_agent' })
  跳过 3 个配置层 → UserModelConfigV2 BYOK
  ↓
Hermes Runtime: memoryNamespace = tenant/{tenantId}/agent/{instanceId}
  ↓
CareerProfile / CareerActionProgress / UserModelConfigV2
所有 userId = 同一个用户
```
