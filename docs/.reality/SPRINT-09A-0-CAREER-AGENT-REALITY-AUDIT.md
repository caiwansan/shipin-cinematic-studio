# Sprint-09A-0 Career Agent Reality Audit

**Date:** 2026-07-30
**Scope:** `/workspace/job` 求职管家全链路身份/模型/执行审计
**Method:** 静态代码审计（后端 + 前端），不改一行代码

---

## 核心结论

当前求职管家处于**产品割裂状态**：AI Employee 身份基础设施已经建成，但主用户交互链路完全不经过它。

```
企业侧 Carol：                                      求职侧：
subscription ─→ AgentProfile ─→ Instance ─→ Binding     CareerAgentService.createAndDeploy()
                                        ↓               ↕ (已配身份…但聊天不走它)
                                  Hermes Runtime         Map<string, JobCareerEngine>
                                        ↓               ↕ (纯规则引擎，无AI)
                                  executeTask()
                                        ↓
                                  Task + Outcome + Audit

→ 单条链路，统一执行                              → 两条平行路，互相不通
```

---

## 1. Identity Gate（身份层）

### 审计对象

| 检查项 | 当前后端文件 | 前端文件 |
|--------|-------------|---------|
| Agent Profile 创建 | `career-agent.service.ts` → `createAndDeploy()` | `useCareerAgent.ts` → `createAgent()` |
| Agent Instance 创建 | 同上 → `enterpriseAgentInstance.create()` | N/A |
| Hermes Binding | 同上 → `hermesProfileBinding.create()` | N/A |
| Capability Binding | 未创建 ❌ | N/A |

### Gate 状态

| 项目 | 状态 | 证据 |
|------|------|------|
| Agent Profile | ✅ PASS | `CareerAgentService.createAndDeploy()` 创建 `EnterpriseAgentProfile` (`agentType: 'career_advisor'`) |
| Agent Instance | ✅ PASS | 同上，创建 `EnterpriseAgentInstance` (`runtime: 'enterprise'`) |
| Hermes Binding | ✅ PASS | 同上，创建 `HermesProfileBinding` |
| Capability Binding | ❌ FAIL | `employeeCapabilityBinding` 未创建。企业侧 Carol 有 6 个 Capability Binding 用于 Runtime 门控。Career Agent 无此绑定→ executeTask 时 capability gate 无对应。 |
| 聊天路复用身份 | ❌ FAIL | 主聊天调用 `POST /api/job/chat` → `Map<string, JobCareerEngine>`，完全不经过 `EnterpriseAgentProfile`。Career Agent 身份仅在 `POST /api/career/*` 端点使用。 |

### 发现

**P0 █ 双轨身份**

求职管家有**两条完全独立**的身份路径：

```
路径 A（主聊天 — 无身份）：
POST /api/job/chat → JobCareerEngine (内存 Map) → 规则引擎

路径 B（Career Agent 身份 — 已建成但未使用）：
POST /api/career/agent/activate-and-execute → CareerAgentService → EnterpriseAgentProfile + Instance + Binding
```

路径 A 是用户每天用的聊天入口。路径 B 仅在顶部"创建 AI 职业助理"按钮调用，且创建后聊天依旧走路径 A。

**P2 缺失 Capability Binding**

- `enterprise_agent_runtime.executeTask()` 内部执行 capability gate
- Career Agent 没有 `EmployeeCapabilityBinding`，如果正式接入 executeTask 会触发 `CAPABILITY_NOT_BOUND` 拒绝
- 参考 Carol：已绑定 `resume_analysis`, `job_matching`, `market_analysis`, `content_publishing`, `candidate_scoring`, `interview_evaluation`

---

## 2. Model Authority Gate（模型层）

### 审计对象

| 检查项 | 文件 | 数据流向 |
|--------|------|---------|
| UserModelConfigV2 | `UserModelConfigV2` 表 | `llmProvider` / `llmModel` / `llmApiKey`（全局 BYOK） |
| Unified Config | `unified-model-config.ts` | `capabilityLlmConfigs.career_agent`（JSONB 字段，独立于 UserModelConfigV2.llm*） |
| BYOK 检查 | `llm.client.ts` → `getUserLLMConfig()` | 只读 `UserModelConfigV2.llm*` |
| ModelSettingsModal | `ModelSettingsModal.vue` | career_agent 模式写 `capabilityLlmConfigs.career_agent` |
| 全局 LLM 设置模态 | 同上 | 写 `UserModelConfigV2.llm*` |

### Gate 状态

| 项目 | 状态 | 证据 |
|------|------|------|
| UserModelConfigV2 存在 | ✅ PASS | 表存在，`getUserLLMConfig()` 正常读取 |
| resolveRuntimeConfig 链路 | ✅ PASS | 优先级链完整：EnterpriseLlmConfig → Platform → UserModelConfigV2 → Env |
| BYOK 链 | ✅ PASS | `checkUserBYOK() → getUserLLMConfig()` 读取 `UserModelConfigV2.llm*` |
| ModelSettingsModal 对齐 | ⚠️ PARTIAL | career_agent 过滤器写 `capabilityLlmConfigs.career_agent`（JSONB），但 BYOK 检查读 `UserModelConfigV2.llm*`。**两个不同的存储** |

### 发现

**P1 █ 模型配置孤岛**

`ModelSettingsModal` 在 `filterCapability="career_agent"` 模式下写入 `capabilityLlmConfigs.career_agent`（JSONB），但 `checkUserBYOK()` 和 `resolveRuntimeConfig()` 读取 `UserModelConfigV2.llm*`（独立字段）。

```
模态 career_agent 模式 → 用户配置 → capabilityLlmConfigs.career_agent.jsonb
                                                                      ↓
                                                                  ❌ 不可见
                                                                      ↓
checkUserBYOK() → UserModelConfigV2.llmProvider + llmModel + llmApiKey
```

影响：
- 用户如果只在"AI 职业助理"模态配置了模型 → BYOK 检查失败（`NO_BYOK_CONFIG`）
- 用户必须在全局 LLM 设置配置模型 → career agent 才能工作
- 但全局 LLM 设置和 career_agent 模式是不同的 UI 入口，用户容易混淆

**这是与 Sprint-08G 相同的模式问题**（EnterpriseLlmConfig 覆盖 UserModelConfigV2），只是方向相反：career_agent 的配置存了但没被读到。

---

## 3. Runtime Gate（执行层）

### 审计对象

| 检查项 | 路径 A（主聊天） | 路径 B（快捷任务） |
|--------|-----------------|-------------------|
| 入口 | `POST /api/job/chat` | `POST /api/career/workflow/execute` |
| Engine | `JobCareerEngine` | `CareerWorkflowExecutor` |
| AI | 纯规则引擎（Regex） | `AgentExecutorImpl` → LLM（Gateway） |
| 会话 | `Map<string, JobCareerEngine>`（内存） | `AgentMemory`（DB） |
| Task 记录 | 无 | `EnterpriseAgentTask`（间接） |
| Outcome | 无 | `EnterpriseOutcome`（间接） |
| Audit | 无 | 无独立审计（workflow executor 不调用 agentAuditService） |

### Gate 状态

| 项目 | 状态 | 证据 |
|------|------|------|
| Conversation Memory | ❌ FAIL | 路径 A 使用 `Map<string, JobCareerEngine>`（内存，服务器重启丢失）。路径 B 使用 `agentMemory` 表但不可搜索（`embeddingVector: null`） |
| Hermes executeTask | ❌ FAIL | 路径 A 不调用。路径 B 走 `AgentExecutorImpl` → `AgentOrchestrator` → `executeViaGateway`，但不走 `enterpriseAgentRuntime.executeTask()` |
| Agent Task | ❌ FAIL | 路径 A 无。路径 B 创建 `EnterpriseAgentTask`（在 `career-activation.ts` 中）但 `career-workflow-executor.ts` 不创建 |
| Outcome Audit | ❌ FAIL | 路径 A 无。路径 B 无 `agentAuditService` 调用 |
| CareerAgent 聊天复用 | ❌ FAIL | Career Agent 创建后，聊天依旧走 `JobCareerEngine`（规则引擎），不走 AI Runtime |

### 发现

**P0 ██ 主聊天完全在 Runtime 之外**

```
用户打字 → POST /api/job/chat → JobCareerEngine.processMessage()
                                       ↓
                              regex 匹配教育/技能/经验
                                       ↓
                              硬编码回复模板
                                       ↓
                              100% 规则引擎，0% AI
```

`JobCareerEngine` 是一个**纯规则引擎**：
- 没有 LLM 调用
- 没有 Hermes Runtime
- 没有 Task/Outcome/Audit
- 会话存储在内存 Map 中（重启丢失）
- 推荐的岗位由 `matchJobs()` 硬编码匹配

**P0 █ 快捷任务虽用 AI 但无完整审计**

`CareerWorkflowExecutor` 的工作流通过 `AgentExecutorImpl` 调用 LLM（走 Gateway），但：
- 不通过 `enterpriseAgentRuntime.executeTask()`（跳过 capability gate + audit trail）
- 不创建 `EnterpriseAgentTask` 记录（仅在 `career-activation.ts` 中为首次激活创建）
- 不创建 `EnterpriseOutcome`
- 无 `agentAuditService` 调用
- `agentMemory` 记录无 embedding 向量（不可搜索）

**P1 规则引擎与 AI 员工不互通**

路径 A 收集的用户画像（`CandidateProfile`）只存在 `JobCareerEngine.state` 中，不被 Career Agent 使用。Career Agent 有独立的 `CareerToolRegistry` 从 DB 读取数据。

---

## 综合 Reality Gate

| Gate | 状态 | 偏差 |
|------|------|------|
| G1 身份统一 | ❌ FAIL | 存在两条身份路径，主聊天不经过 Agent Profile |
| G2 模型配置统一 | ⚠️ PARTIAL | `capabilityLlmConfigs.career_agent` 与 `UserModelConfigV2.llm*` 不互通 |
| G3 执行链路统一 | ❌ FAIL | 主聊天为纯规则引擎，快捷任务虽用 AI 但跳过 executeTask 管线 |
| G4 审计追踪 | ❌ FAIL | 无 auditService 调用，无 EnterpriseAgentTask/Outcome 记录 |
| G5 会话持久化 | ❌ FAIL | 内存 Map，服务器重启丢失 |

### 关键断裂路径

```
用户打开 /workspace/job
        ↓
看到 AI 职业助理卡片（路径 B 身份已就绪）
        ↓
点"创建 AI 职业助理" → EnterpriseAgentProfile + Instance + Binding 创建成功 ✅
        ↓
开始聊天 → POST /api/job/chat → JobCareerEngine（规则引擎）
        ↓
Agent Profile 存在但未使用 ❌
Runtime 存在但未使用 ❌
Task/Outcome/Audit 不存在 ❌
```

---

## 偏差分析（vs Carol 企业端）

| 维度 | Carol（企业招聘） | Career Agent（求职） |
|------|------------------|---------------------|
| Profile | `EnterpriseAgentProfile` ✅ | 有，但主聊天不用 ❌ |
| Instance | `EnterpriseAgentInstance` ✅ | 有，但主聊天不用 ❌ |
| Capability Binding | 6 个 Capability ✅ | 0 个 ❌ |
| executeTask | `enterpriseAgentRuntime.executeTask()` ✅ | `CareerWorkflowExecutor`（非标准） |
| Audit Trail | `capability.allowed/denied` + 执行审计 ✅ | 无 ❌ |
| 会话持久 | `agentMemory`（有 embedding） | `Map<string, Engine>`（内存，重启丢） |
| 模型配置 | `resolveRuntimeConfig` 链读取 `UserModelConfigV2.llm*` ✅ | 同链，但有 `capabilityLlmConfigs.career_agent` 孤岛 ⚠️ |
| 聊天体验 | Carol 通过 `executeTask` 执行工作任务 | 规则引擎面试收集 + 快捷任务（两套） |

---

## 建议执行顺序

### 优先级排序（从最安全到最激进）

```
P0 █ Chat Runtime Migration
  → 将主聊天从 JobCareerEngine（规则引擎）迁移到 Hermes Runtime
  → 保持 JobCareerEngine 作为 fallback 或关闭
  → 复用 career_advisor prompt 模板 + conversation memory
  → Sprint-09A-01

P0 █ Capability Binding
  → 创建 EmployeeCapabilityBinding：resume_analysis, job_match, interview_coach, career_plan, salary_benchmark
  → 让 capability gate 放行 career agent 调用
  → Sprint-09A-02

P1 Model Config Alignment
  → resolveRuntimeConfig 增加对 capabilityLlmConfigs.career_agent 的读取
  → 配置链：EnterpriseLlmConfig → capabilityLlmConfigs.career_agent → UserModelConfigV2.llm*
  → Sprint-09A-03

P1 Audit Trail
  → Career Workflow 增加 agentAuditService 调用
  → 产生 capability.allowed + execution + outcome 审计事件
  → Sprint-09A-04
```

### 违反规则检查

本审计报告期间未执行任何代码修改：
- ❌ 未改 `JobCareerEngine` ✅
- ❌ 未引入新表 ✅
- ❌ 未创建 `CareerLlmConfig` ✅
- ❌ 未重做聊天 UI ✅
- ❌ 未添加新能力按钮 ✅

仅阅读代码并记录观察。

---

**审核人:** OpenClaw
**掌柜确认:** 待签名
