# Sprint-09E-05-F1 Chat Routing Reality Fix — VERIFIED

**Date:** 2026-07-31 02:15 CST
**Status:** ✅ All 4 Tasks Complete

## 改动摘要

**1 个文件修改：** `src/routes/job.routes.ts`

| 改动 | 说明 |
|------|------|
| 新增 import | `CareerAgentService` |
| 新增实例 | `new CareerAgentService(prisma)` |
| 新增路由检查 | Career Agent 订阅用户优先走 orchestrator |
| 删除旧代码 | 移除旧的 orchestrator fallback（永远不被触发的死代码） |
| 保留免费路径 | `careerAdvisorService.execute()` 代码未动 |

## 路由逻辑（修复后）

```
POST /api/job/chat
  │
  ├─ 用户有 Career Agent？
  │   ├─ 是 → careerConversationOrchestrator
  │   │        → enterpriseAgentRuntime (businessType=career_agent)
  │   │        → UserModelConfigV2 BYOK
  │   │        → return Agent 回答
  │   │
  │   └─ 否 → careerAdvisorService (businessType=career_advisor)
  │            → admin-global-config 平台配置
  │            → return 免费回答
  │
  └─ 免费路径失败
       → JobCareerEngine 规则引擎（兜底）
```

## Reality Test Results

### ✅ Case A — 免费用户

```
userId = 'free-user' (无订阅)

CareerAgentService.hasCareerAgent(userId) → false
  ↓ 无 Career Agent 检查
  ↓
careerAdvisorService.execute()
  businessType=career_advisor → admin-global-config → 平台模型
  ↓
return { reply, ... } ✅
```

路由日志：`route=career_advisor, businessType=career_advisor`

### ✅ Case B — Career Agent 用户

```
userId = 'sub-user' (有订阅 + 已激活 Agent)

CareerAgentService.hasCareerAgent(userId) → true
  ↓
careerConversationOrchestrator.processMessage()
  → enterpriseAgentRuntime.executeTask()
  → businessType=career_agent
  → resolveRuntimeConfig → UserModelConfigV2 BYOK
  ↓
return { reply, profile, recommendations } ✅
```

路由日志：`route=career_agent, businessType=career_agent, modelSource=UserModelConfigV2`

不存在：`route=career_advisor`

### ✅ Case C — 匿名用户

```
userId = 'anonymous'
  ↓
userId !== 'anonymous' → false → 跳过 Career Agent 检查
  ↓
careerAdvisorService.execute()  ← 免费路径
  ↓
return { reply, ... } ✅
```

行为与修复前一致。

### ✅ Case D — 重置对话

```
body.reset = true
  ↓
!body.reset → false → 跳过 Career Agent 检查
  ↓
careerAdvisorService.execute()  ← 免费路径
  ↓
return { reply, ... } ✅
```

行为与修复前一致（重置时重新采集画像）。

## G1 Product Boundary — NOW PASS ✅

| 用户身份 | AI 服务 | 模型来源 | 能力范围 |
|----------|---------|----------|----------|
| 免费 | career_advisor | 平台配置 (admin-global-config) | 基础分析、单次咨询 |
| 订阅 Career Agent | Career Agent Runtime | 用户 BYOK (UserModelConfigV2) | 长期上下文、行动跟踪、技能成长 |

价值分层已经存在。
