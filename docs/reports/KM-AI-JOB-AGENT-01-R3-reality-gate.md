# KM-AI-JOB-AGENT-01 — Reality Gate R3 报告

**日期**: 2026-07-26
**执行**: 小二
**审批**: 掌柜

---

## 摘要

**Reality Gate R3: ✅ PASS**

Agent Brain → Gateway → LLM 端到端调用链验证通过。真实 DeepSeek API 返回，耗时 11.5s，788 tokens。

---

## Phase A: 真实 Credential 来源追踪

### 发现的三条路径

| 路径 | 表/来源 | Gateway 是否使用 | 状态 |
|------|---------|-----------------|------|
| A. UserModelConfigV2 | `userModelConfigV2` (30 rows) | ✅ **主路径** | 8 用户有 deepseek key |
| B. EnterpriseLlmConfig | `enterpriseLlmConfig` (2 rows) | ❌ 未使用 | 仅 Agent resolveProvider 用 |
| C. apiKey | `apiKey` (2 rows) | ❌ 未使用 | 存 deepseek_api_key 明文 |

### 结论

**生产真实凭证来源 = 路径 A: `UserModelConfigV2`**

Gateway 的 `resolveRuntimeConfig()` 走 `resolveApiKeyExact(userId, provider, capability)` → `loadFullConfigV2(userId)` → 匹配 `llmProvider === provider && llmApiKey` → `decryptKey()` 返回明文 Key。

### 关键数据

- 30 个用户有 V2 配置
- 8 个用户有 deepseek key (AES 加密, 136-168 chars)
- 6 个用户有 volcengine key
- Provider 分布: deepseek 13, volcengine 7, siliconflow 2, 其他 8

---

## Phase B: Agent Brain 最终调用链

### 完整调用链（确认）

```
用户触发 Agent 任务
  ↓
AgentOrchestrator.executeTask(agentId, task, { organizationId, actorId })
  ↓
contextService.createContext({ organizationId, actorId, agentId })
  ↓
AgentBrain.reason({ input: task }, runtimeCtx)
  ↓
resolveProvider(organizationId, agentId)
  → EmployeeModelBinding → { provider: 'deepseek', model: 'deepseek-v4-flash' }
  ↓
executeViaGateway('llm', { messages, temperature }, { userId: actorId, provider, model })
  ↓
resolveRuntimeConfig('llm', { provider: 'deepseek', model: 'deepseek-v4-flash', userId: actorId })
  → Step 1: input.provider + input.model 命中
  → resolveApiKeyExact(actorId, 'deepseek', 'llm')
  → loadFullConfigV2(actorId)
  → llmProvider === 'deepseek' && llmApiKey → decryptKey()
  ↓
DeepSeek API (https://api.deepseek.com/v1/chat/completions)
  ↓
返回结果 → Agent Brain → TaskResult
```

### 关键确认

1. **Gateway 不走 EnterpriseLlmConfig** — resolveProvider 只是告诉 Gateway 用哪个 provider/model，凭证解析完全由 Gateway 自己完成
2. **actorId 决定凭证** — 谁触发 Agent 任务，就用谁的 UserModelConfigV2 中的 Key
3. **无 Key 用户会失败** — 如果 actorId 对应的用户没有配 deepseek key，会抛 CONFIG_ERROR

---

## Phase C: 真实调用测试

### 测试参数

| 参数 | 值 |
|------|-----|
| Agent | AI 招聘官 (c5ce5982-916d-4965-a455-9a857d679d2f) |
| Actor | 6d503a67-... (有 deepseek key, model=deepseek-chat) |
| Organization | 5ba4891a-511f-4620-8862-7dc83f37ea75 |
| 输入 | "你好，请用一句话介绍你的角色和能力" |

### 测试结果

| 指标 | 值 |
|------|-----|
| Provider | deepseek |
| Model | deepseek-v4-flash |
| Tokens | 788 |
| Duration | 11,476ms |
| 结果 | ✅ 真实 LLM 返回 |

### Reality Gate 判定

| 检查项 | 结果 |
|--------|------|
| 真实模型返回（非 mock） | ✅ PASS |
| 端到端时延合理 (<60s) | ✅ PASS (11.5s) |
| Token 消耗 > 0 | ✅ PASS (788) |
| Provider 匹配配置 | ✅ PASS (deepseek) |

---

## 附加发现

### 1. LLM 返回内容偏题

Agent 的 System Prompt 包含 `name` 和 `role`，但 LLM 返回了动漫角色"神乐"相关内容。原因：

- Agent Profile 的 `goal` 和 `knowledgeScope` 字段可能为空
- System Prompt 构建时缺少足够的业务上下文约束
- **这是 Phase 3（业务工具接入）的问题，不影响 Runtime 连通性**

### 2. EmployeeModelBinding 的 providerConfigId 指向空表

`EmployeeModelBinding.providerConfigId = 'agent-ll'` 但 `AIProviderConfig` 表为空。当前 resolveProvider 只取 `binding.modelName`，不查 `AIProviderConfig`，所以不影响运行。

### 3. 凭证来源统一确认

**Hermes 层不管理 API Key** ✅
- Agent Brain 只提供 provider/model 偏好
- Gateway 负责凭证解析
- 凭证来自 UserModelConfigV2（BYOK）或 env fallback

这与昆仑镜 BYOK 宪法一致。

---

## 后续建议

1. **System Prompt 增强** — 给 AI招聘助理加入业务上下文（角色定义、能力范围、输出格式约束）
2. **无 Key 用户处理** — 当 actorId 没有对应 key 时，应有清晰的错误提示或 fallback 策略
3. **Phase 2 准备** — Runtime 连通后，下一步是 HermesAdapter 真实集成
