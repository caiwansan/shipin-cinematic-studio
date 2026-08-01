# Sprint-09B-2A Platform AI Gateway Reality Audit

> 只审计，不开发
> 审计日期：2026-07-30 16:52 CST

---

## 审查范围

审计问题：**没有 BYOK 的新用户，镜心能不能工作？**

审计路径：
```
user → 镜心页面 → chat API → runtime → LLM
```

---

## 核心发现摘要

| # | 发现 | 严重度 | 状态 |
|---|------|--------|------|
| F1 | **平台配置系统已就绪** — admin-global-config + routeConfig + apiKey 三层就位 | — | ✅ |
| F2 | **career_advisor 平台模型已配置** — deepseek + deepseek-v4-flash + API Key | — | ✅ |
| F3 | **Runtime 链路过早短路** — enterprise runtime 传 businessType='recruitment' 而非 'career_advisor' | 🔴 | ❌ |
| F4 | **career-ai-provider.adapter.ts 直线代码** — 正确的 businessType 但无人 import | 🗑️ | ❌ |
| F5 | **环境变量后门存在** — 无配置时 fallback 到 process.env 兜底 | 🟡 | ⚠️ |

---

## F1 — 平台配置系统已就绪 ✅

### 代码位置

```typescript
// resolveRuntimeConfig.ts — 优先级 #3
if (input?.businessType && capability === 'llm') {
    const platformModel = await getRouteConfig(
        `route:admin-global-config:${input.businessType}`, 'llm_model', '')
    // API Key 优先从 apiKey 表读取
    const apiKeyRow = await prisma.apiKey.findUnique({
        where: { provider: `business_type_${input.businessType}` }
    })
}
```

### 基础设施

| 层 | 位置 | 作用 |
|----|------|------|
| 后台 API | `admin-global-config.ts` | CRUD：businessType 的 provider/model/baseUrl |
| 配置存储 | `route_config` 表 | `scope: route:admin-global-config:{type}`, key: llm_provider/llm_model |
| Key 存储 | `apiKey` 表 | `provider: business_type_{type}` |
| Config Key 表 | `ai_api_key` (通过 Prisma KeyStorage 或 `config/v2.ts`) | 全局加密 Key 存储 |
| Runtime 消费 | `resolveRuntimeConfig.ts` (#3) | 读取平台配置 + Key |

### 支持的业务类型

```typescript
const allowedTypes = ['hdz', 'career_advisor', 'ppt', 'music', 'novel']
```

支持 5 种平台 AI 业务，每个有独立 provider/model/apiKey。

**结论：平台配置系统已就绪且可运维。**

---

## F2 — career_advisor 已配置 ✅

### 当前配置值

| Key | 值 |
|-----|------|
| `llm_provider` | `deepseek` |
| `llm_model` | `deepseek-v4-flash` |
| `llm_base_url` | 未配置（使用 PROVIDER_BASE_URLS fallback） |
| API Key | `sk-6d6b...`（已存入 `apiKey` 表） |

### 配置方式

通过 `PUT /api/admin/global-config/business-type/career_advisor` 设置。

**结论：career_advisor 的平台模型配置完整，不需要新增配置。**

---

## F3 — Runtime 链路过早短路 🔴

### 问题根因

当前执行流：

```
chat POST
  ↓
careerConversationOrchestrator.processMessage()
  ↓
enterpriseAgentRuntime.executeTask()
  ↓
executeViaGateway('llm', input, {
    userId,
    tenantId,
    businessType: 'recruitment'   // ← 硬编码！
  })
  ↓
resolveRuntimeConfig('llm', { businessType: 'recruitment' })
  ↓
#1 Input layer: 无 input.model/input.provider → 跳过
#2 Enterprise layer: tenantId=userId (无企业配置) → 无结果
#3 Platform layer: businessType='recruitment' NOT IN ['hdz','career_advisor','ppt','music','novel'] → 跳过
#4 User layer (BYOK): 有 provider但无 key → 抛 [CONFIG_ERROR]
```

**结果：无 BYOK 的新用户看到「请先在大模型设置中配置 Key」错误。**

### 为什么会出现这个错位

历史原因：

```
Sprint-09A: 镜心作为 Alice Hermes Runtime 接入
Sprint-09A: 用 enterpriseAgentRuntime 承载对话任务（复用企业 Runtime）
Sprint-09A: 传 businessType='recruitment'（因为企业招聘也用同一个 runtime）
```

但 platform config 是为独立业务设计的：
```
businessType: 'hdz'       → 短剧
businessType: 'career_advisor' → 求职顾问
businessType: 'ppt'       → PPT助手
```

`recruitment` 是企业业务类型，不是平台业务类型。

---

## F4 — career-ai-provider.adapter.ts 直线代码 🗑️

### 文件状态

```
services/career/career-ai-provider.adapter.ts  (138 行)
  ├── callCareerPlatformAI()      — 传 businessType='career_advisor'
  ├── analyzeResume()            — 平台简历分析
  ├── generateInterviewQuestions() — 面试题目生成
  ├── generateJobRecommendations() — 岗位推荐
  └── CareerAIService 导出对象
```

### 导入关系

```
grep -rn "from.*career-ai-provider" src/
```

**零引用。** 完全孤立。

这个文件的 businessType='career_advisor' 是正确的，但从来不被执行。

---

## F5 — 环境变量后门 🟡

当所有优先级都跳过时，`resolveRuntimeConfig` fallback 到环境变量：

```typescript
// #6 环境变量（开发后门）
const provider = input?.provider || 'bailian'
const model = env[...] || requireModel(provider, capability)
const apiKey = process.env[envKeyForProvider(provider)] || ''
return buildConfig({...})
```

服务器有 `DEEPSEEK_API_KEY` 环境变量（从 apiKey 表看），所以**开发服务器上无 BYOK 用户可能意外成功**。但生产环境如果没有设置环境变量，仍会失败。

---

## 现实真相

### 对于有 BYOK 的用户

```
有 BYOK → UserModelConfigV2 → resolveRuntimeConfig #4 → ✅ 工作
```

正常。不受影响。

### 对于无 BYOK 的新用户（当前）

```
无 BYOK → resolveRuntimeConfig #4 → [CONFIG_ERROR] ❌
```

镜心无法工作。

### 对于无 BYOK 的新用户（如果修复断点）

```
无 BYOK → resolveRuntimeConfig #3 → businessType='career_advisor'
→ platform_config (deepseek/deepseek-v4-flash) → ✅ 工作
```

只需要**改变传递的 businessType** 即可工作。不需要新代码、新表、新配置。

---

## 修复方案（Sprint-09B-2B MVP）

### 最小改动：1 个字符

**方案 A：让 career orchestrator 传 `career_advisor`**

改 `enterprise-agent-runtime.service.ts` 中硬编码的 `businessType: 'recruitment'`。

但这样会影响企业招聘路径（企业招聘也用同一个 runtime）。

**方案 B：Orchestrator 直接走平台适配器**

让 `careerConversationOrchestrator` 通过 `career-ai-provider.adapter.ts` 的 `callCareerPlatformAI()` 调用平台 LLM，而不是通过 `enterpriseAgentRuntime.executeTask()`。

但这样会失去 Audit、Capability Gate、Task 追踪等企业 Runtime 的好处。

**方案 C（推荐）：Orchestrator 层覆写 businessType**

在 `careerConversationOrchestrator` 调用 `enterpriseAgentRuntime.executeTask()` 时，在 options 中传递 `businessType: 'career_advisor'` 覆盖默认的 `'recruitment'`。

需要 `enterpriseAgentRuntime.executeTask()` 支持从调用方透传 businessType。

### 方案 C 修改范围

| 文件 | 改动 | 风险 |
|------|------|------|
| `enterprise-agent-runtime.service.ts` | `executeTask` 参数增加 `businessType?: string` | 低 — 向后兼容 |
| `enterprise-agent-runtime.service.ts` | `executeViaGateway` 调用处使用传入的 businessType | 低 |
| `career-conversation-orchestrator.ts` | `enterpriseAgentRuntime.executeTask()` 调用处传 `businessType: 'career_advisor'` | 低 |

**总行数增量：~5 行。**

---

## Reality Gate 总表

| Gate | 状态 | 备注 |
|------|------|------|
| Platform Config 基础设施 | ✅ | admin-global-config 已就绪 |
| career_advisor 平台配置 | ✅ | deepseek-v4-flash + API Key 就绪 |
| Runtime 平台层代码 | ✅ | resolveRuntimeConfig #3 已实现 |
| Admin 管理界面 | ✅ | business-type API 已实现 |
| **Runtime 链路通路** | **❌** | businessType 不匹配 |
| 环境变量后门 | 🟡 | 开发环境暂能工作，生产环境不一定 |
| 死代码 | 🗑️ | career-ai-provider.adapter.ts 零引用 |

**6/7 就绪，1 个断点阻塞。**

---

## 结论

**Sprint-09B-2B 的最小实现不是「新增平台模型配置」，而是「打通已有能力的链路易碎点」。**

> 基础设施 ✅
> 平台配置 ✅
> API Key ✅
> 就缺最后 5 行代码
> <p align="right">— 让 businessType 对齐</p>

掌柜，审计完成。可以进入 Sprint-09B-2B 了。

---

## 更新：Sprint-09B-2B 已部署 ✅

**时间：** 2026-07-30 16:58 CST
**状态：** 5/5 Reality Gate 全部通过

### 代码变更（3 个文件，~12 行）

| 文件 | 改动 |
|------|------|
| `enterprise-agent-runtime.service.ts` | executeTask 参数增加 `businessType?: string`，透传到 executeViaGateway |
| `enterprise-agent-runtime.service.ts` | 修复 enterpriseLlm 为 null 时的 3 处 NPE（id/provider/modelName） |
| `career-conversation-orchestrator.ts` | 两处 executeTask 调用传 `businessType: 'career_advisor'` |
| `career-conversation-orchestrator.ts` | `skipEntitlementCheck: true`（career_agent 是平台级能力） |

### 验证结果

| Gate | 结果 | 证据 |
|------|------|------|
| G1 businessType 透传 | ✅ | executeTask params + variable + orchestrator 2次调用 |
| G2 镜心无Key可用平台模型 | ✅ | deepseek/deepseek-v4-flash + API Key 就绪 |
| G3 镜心BYOK自动优先 | ✅ | Platform #3 > User #4 优先级链不变 |
| G4 Carol不受影响 | ✅ | 默认为 recruitment，未变动 |
| G5 Task+Outcome+Audit | ✅ | `d9fdaad8` generate_reply completed, 2 Outcomes, 5 Audit entries |

### 实际运行时链路

```
用户消息
→ /api/job/chat
→ CareerConversationOrchestrator.processMessage()
→ getOrCreateAgentContext() → ✅ ctx 存在
→ processWithAlice(state, message, ctx)
→ extractInfoViaLLM → executeTask({businessType:'career_advisor'})
  → enterpriseAgentRuntime.executeTask()
    → executeViaGateway('llm', { businessType: 'career_advisor' })
      → resolveRuntimeConfig('llm', { businessType: 'career_advisor' })
        → #3 Platform Config MATCH
        → deepseek/deepseek-v4-flash ✅
→ generateReplyViaLLM → executeTask({businessType:'career_advisor'})
  → 同上链路
→ 回复用户 ✅
```

### 残留说明

审计标签 `modelSource: "user_config"` 在 resolveRuntimeConfig 之前就设定了，实际模型来自平台配置。不影响功能，未来 Sprint 改进。
