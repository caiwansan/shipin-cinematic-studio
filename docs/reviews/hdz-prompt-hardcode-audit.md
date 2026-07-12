# HDZ 混沌珠工作台 Agent 硬编码大模型调用审计报告

> 审计时间：2025-07-17
> 审计范围：`backend/src/services/hdz/`、`backend/src/routes/hdz/`、`backend/src/agents/`
> 审计方法：全量正则搜索 + 人工核查关键文件

---

## 概述

**核心结论：HDZ 混沌珠 Agent 的 LLM 调用** 绝大部分（>95%）已正确使用用户 BYOK 配置，通过 `getUserLLMConfig()` → `callLLM()` 链路调用，不存在 API Key 硬编码。

但在**默认值兜底、非 HDZ 短剧管线、图片生成**三处发现了 3 个硬编码模型名称的 fallback 默认值，需修复。

---

## 发现的问题

### 🔴 问题 1：agents/orchestrator/UOA.ts:126 — 视频生成模型硬编码

| 项目 | 内容 |
|------|------|
| **文件** | `backend/src/agents/orchestrator/UOA.ts:126` |
| **硬编码值** | `'doubao-seedance-1-5-pro-251215'` |
| **代码** | `model: job.model || 'doubao-seedance-1-5-pro-251215',` |
| **影响的函数** | `buildRequest()` — 视频任务请求构建 |
| **关联 Agent** | Unified Orchestrator Agent（短剧视频生成管线，非 HDZ 小说） |
| **是否走用户 LLM 配置** | ❌ 否。该 Agent 使用 `VideoJobContext.model?` 属性，未从 `getUserLLMConfig()` 或用户模型配置读取。 |
| **修复建议** | 将这个默认值改为从 `UserModelConfigV2.videoModel`（或类似字段）读取，或在调用链路上层传入。如果该模型名称仅作为视频生成推理模型（而非 LLM），可考虑从用户配置读取 `videoModel` 字段兜底。 |

### 🔴 问题 2：routes/hdz/project.ts:175 — 图片生成模型硬编码

| 项目 | 内容 |
|------|------|
| **文件** | `backend/src/routes/hdz/project.ts:175` |
| **硬编码值** | `'wanx2.1-t2i-turbo'` |
| **代码** | `const modelName = provider.modelName \|\| v2?.imageModel \|\| 'wanx2.1-t2i-turbo'` |
| **影响的函数** | `POST /hdz/project/:projectId/cover` — 封面图生成路由 |
| **关联 Agent** | 封面图生成（非 LLM Agent，是图片模型调用） |
| **是否走用户 LLM 配置** | 部分 ✅。优先尝试 `provider.modelName` 和 `v2.imageModel`，但两者都为空时 fallback 到通义万相。 |
| **修复建议** | 将 `'wanx2.1-t2i-turbo'` 改为从配置常量中读取或提示用户配置。如果保留默认值，建议移除硬编码字符串，改为定义在配置文件中。 |

### 🔴 问题 3：llm.client.ts:69 — LLM 模型默认值硬编码

| 项目 | 内容 |
|------|------|
| **文件** | `backend/src/services/hdz/llm.client.ts:69` |
| **硬编码值** | `'doubao-seed-2-1-pro-260628'` |
| **代码** | `modelName: v2.llmModel \|\| 'doubao-seed-2-1-pro-260628',` |
| **影响的函数** | `getUserLLMConfig()` |
| **关联 Agent** | 所有 HDZ Agent（planner / writer / reviewer / character / director / worldbuilder） |
| **是否走用户配置** | 部分 ✅。优先从 `UserModelConfigV2.llmModel` 读取，但用户未配置时 fallback 到火山引擎豆包模型。 |
| **修复建议** | 1. 建议将默认值改为 `null` 并抛错提示用户配置，而不是静默 fallback 到一个可能错误的模型；<br>2. 或至少将模型名称提取为常量并在文档中注明；<br>3. 注意这与 `getUserLLMConfig()` 返回 `null` 时上层会抛错的逻辑略有矛盾（如果用户有 llmApiKey 但没 llmModel，静默使用了豆包模型，用户可能不自知）。 |

---

## 确认无硬编码的部分 ✅

| 文件 | 结论 | 说明 |
|------|------|------|
| `services/hdz/orchestrator.service.ts` | ✅ 无硬编码 | 全部通过 `getUserLLMConfig()` → `userCfg` → 传递给各 Service |
| `services/hdz/planner.service.ts` | ✅ 无硬编码 | 接收 `llmCfg: LLMConfig`，调用 `callLLM(llmCfg, ...)` |
| `services/hdz/writer.service.ts` | ✅ 无硬编码 | 接收 `llmCfg: LLMConfig`，调用 `callLLM(llmCfg, ...)` |
| `services/hdz/reviewer.service.ts` | ✅ 无硬编码 | 调用 `getUserLLMConfig()` → `callLLM(userCfg, ...)` |
| `services/hdz/character.service.ts` | ✅ 无硬编码 | 接收 `llmCfg: LLMConfig`，调用 `callLLM(llmCfg, ...)` |
| `services/hdz/director.service.ts` | ✅ 无硬编码 | 接收 `llmCfg: LLMConfig`，调用 `callLLM(llmCfg, ...)` |
| `services/hdz/worldbuilder.service.ts` | ✅ 无硬编码 | 接收 `llmCfg: LLMConfig`，调用 `callLLM(llmCfg, ...)` |
| `services/hdz/screenwriter.service.ts` | ✅ 无硬编码 | 文件中无 LLM 调用 |
| `services/hdz/scene-compiler.service.ts` | ✅ 无硬编码 | 文件中无 LLM 调用 |
| `services/hdz/consistency-verifier.service.ts` | ✅ 无硬编码 | 文件中无 LLM 调用 |
| `services/hdz/entity-contract-checker.service.ts` | ✅ 无硬编码 | 文件中无 LLM 调用 |
| `services/hdz/world-state.service.ts` | ✅ 无硬编码 | 文件中无 LLM 调用 |
| `services/hdz/world-state.service.ts` | ✅ 无硬编码 | 文件中无 LLM 调用 |
| `routes/hdz/chat.ts` | ✅ 无硬编码 | 调用 `getUserLLMConfig()` → `callLLM()` |
| `routes/hdz/agent.ts` | ✅ 无硬编码 | 路由转发 |
| `routes/hdz/tts.ts` | ✅ 无硬编码 | TTS 配置读取，使用 `resolved.modelName` |
| `routes/hdz/library-reader.ts` | ✅ 无硬编码 | 双轨策略：优先 `deepseekChat(userId)`（走用户 BYOK），失败时抛错 |
| `agent/*`（非 HDZ 相关文件） | N/A | 系统中无与 HDZ 小说相关的 Agent 文件 |

---

## 硬编码 API URL / Endpoint

`llm.client.ts:252-256` 中定义了一个默认 Base URL 映射表：

```typescript
const defaults: Record<string, string> = {
    volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
    deepseek: 'https://api.deepseek.com',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}
return defaults[provider] || 'https://api.openai.com/v1'
```

**判定：此处的 provider→baseUrl 映射属于正常的 provider 适配逻辑**，不是硬编码问题。理由：
1. 用户可以在 `UserModelConfigV2.llmBaseUrl` 中自定义 baseUrl，自定义时会覆盖默认值（见 `getBaseUrl()` 函数第一行 `if (customUrl) return customUrl`）
2. 这是 LLM client 的基础设施层代码，而非业务层的硬编码选择
3. 如果不提供这些默认值，URL 将完全不可用

---

## 总结

### 硬编码类型分布

| 类型 | 数量 | 严重程度 |
|------|------|----------|
| A. 硬编码模型名称（L LM） | 2 处（问题 2、3 为默认值 fallback，问题 1 为视频模型） | 🔴 中（均为 fallback 默认值，非绕开用户配置） |
| B. 硬编码 API URL/Endpoint | 0 处 | ✅ |
| C. 直接 new OpenAI / sk- 硬编码 | 0 处 | ✅ |
| D. 不走用户配置直接调用 LLM | 0 处 | ✅ |

### 整体评估

**HDZ 混沌珠小说工作台的 Agent 管线设计规范，不存在"绕过用户 LLM 配置、硬编码调用特定模型"的设计问题。** 所有 Agent（planner/writer/reviewer/character/director/worldbuilder）均通过 `getUserLLMConfig()` → `callLLM()` 链路读取用户配置。

发现的 3 处硬编码均为**默认值 fallback**（当用户没有配置相应字段时的兜底值），且有两处属于非 LLM 的图片/视频模型：

1. `llm.client.ts:69` → LLM 模型默认 `doubao-seed-2-1-pro-260628`（当用户有 apiKey 但无 model 时静默兜底，建议改为抛错或提醒）
2. `project.ts:175` → 图片模型默认 `wanx2.1-t2i-turbo`（当 v2.imageModel 和 provider 都为空时）
3. `UOA.ts:126` → 视频生成模型默认 `doubao-seedance-1-5-pro-251215`（短剧管线，非 HDZ 小说）

### 修复优先级建议

1. **高优先级**：`llm.client.ts:69` — 当用户未配置 `llmModel` 时，建议抛错而非静默使用豆包模型，或至少提前在 `getUserLLMConfig` 返回 `null` 前做判断，让上层的 "未配置 LLM" 错误提示生效。
2. **中优先级**：`UOA.ts:126` — 将视频模型默认值改为从用户配置读取。
3. **低优先级**：`project.ts:175` — 将图片模型默认值移至配置常量。
