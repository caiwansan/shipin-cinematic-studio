# Sprint-09E-05 Task 01 — Free vs Career Agent Boundary Reality

**Date:** 2026-07-31 02:10 CST
**Status:** ⚠️ Boundary Issues Found

## 审计结论

免费与订阅的 **产品身份边界存在混淆**。核心问题是 chat 入口的 fallback 方向反了。

---

## 扫描的三层路由

### Tier 1 — 免费 career_advisor（Platform AI）
```
POST /api/job/chat
  → careerAdvisorService.execute()
  → businessType='career_advisor'
  → admin-global-config (平台配置)
  → Platform AI（deepseek 默认）
  → 无长期记忆 / 无行动跟踪 / 无技能记录
```

### Tier 2 — 订阅 Career Agent（BYOK）
```
POST /api/job/chat
  → careerConversationOrchestrator.processMessage()
  → enterpriseAgentRuntime.executeTask()
  → businessType='career_agent' (04.5B 修复)
  → UserModelConfigV2 (用户 BYOK)
  → 长期 Context / ActionProgress / SkillTrack
```

### Tier 3 — Fallback 规则引擎
```
POST /api/job/chat
  → JobCareerEngine (代码内规则，无 AI)
  → 仅供兜底
```

---

## ⚠️ Finding 1: Free Tier 优先于付费 Tier

**路径**：`job.routes.ts` 第 64-84 行

```typescript
// Step 1: careerAdvisorService（免费）优先
const result = await careerAdvisorService.execute({ ... })
// … 如果免费失败，才：
// Step 2: careerConversationOrchestrator（付费）
const result = await careerConversationOrchestrator.processMessage(...)
```

**问题**：付费用户的 Career Agent 对话实际上走在免费服务上。
免费路径从不失败，所以付费 Tier 2 几乎从不被触发。

**影响**：
- 付费用户看不到 BYOK 效果
- Career Agent 的长期规划/行动/技能跟踪无法通过 chat 入口工作
- 付费用户和免费用户获得相同服务质量

**建议修复**：

```typescript
// 检查用户是否为订阅 Career Agent 用户
if (hasActiveCareerSubscription(userId)) {
  // 直接走 Career Agent（Tier 2），跳过免费路径
  const result = await careerConversationOrchestrator.processMessage(...)
  return reply.send(result)
}

// 非订阅用户走免费 career_advisor
const result = await careerAdvisorService.execute({ ... })
```

---

## ⚠️ Finding 2: 激活端点硬编码 career_advisor

**路径**：`career-activation.ts` 第 105 行

```typescript
businessType: 'career_advisor',  // ← 硬编码
```

订阅用户激活 Career Agent 时，该任务走的是 `career_advisor`（平台配置），不是用户 BYOK。

**严重性**：中等。激活任务是系统首次对话，不影响后续。
但不符合「订阅即拥有自己的模型」的承诺。

**建议修复**：根据用户订阅状态动态选择：

```typescript
businessType: hasCareerAgentSubscription ? 'career_agent' : 'career_advisor',
```

---

## Finding 3: Agent 创建类型统一为 career_advisor

`career-agent.service.ts` 创建 EnterpriseAgentProfile 时始终使用 `agentType: 'career_advisor'`，
即使该用户已订阅 Career Agent。

付费/免费的区别仅在于 metadata `source: 'career_agent'` 和 capability 绑定。

**影响**：低。04.5B 的 businessType 映射 (`career_advisor → career_agent`) 已解决运行时隔离。
但建议长远在产品层区分 agentType 命名。

---

## ✅ 边界中已正确的部分

| 边界 | 状态 | 验证 |
|------|------|------|
| 权益检查 | ✅ | `checkProvisionEntitlement()` — 无订阅返回 403 |
| Runtime 身份隔离 | ✅ | 04.5B: `career_advisor → career_agent` |
| BYOK vs 平台 | ✅ | `resolveRuntimeConfig` 分层正确 |
| 购买闭环 | ✅ | payment → subscription → agent creation |

---

## Reality Gate G1 状态

```
G1 Product Boundary: ❌ FAIL — Finding 1 需要修复
```

**阻塞点**：付费用户的 chat 入口走免费路径。

## 建议

修复 Finding 1 后重新审计 G1。
Findings 2-3 可作为后续优化，不阻塞。
