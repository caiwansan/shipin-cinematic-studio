# Audit E: Agent 审计 (AgentAudit.md)

## 1. Agent/Brain/Engine/Worker/Scheduler 清单

### 1.1 Agent 类

| Agent | 文件路径 | 职责 |
|-------|----------|------|
| character.agent.ts | `backend/src/agents/character.agent.ts` | 角色 Agent |
| script-breakdown-master.ts | `backend/src/agents/script-breakdown-master.ts` | 剧本拆解 |
| narrative-schema-v2.ts | `backend/src/agents/narrative-schema-v2.ts` | 叙事 Schema V2 |
| narrative-schema-v3.ts | `backend/src/agents/narrative-schema-v3.ts` | 叙事 Schema V3 |
| aigc-spec-agent-v2.ts | `backend/src/agents/aigc-spec-agent-v2.ts` | AIGC 规格 V2 |
| aigc-spec-agent.ts | `backend/src/agents/aigc-spec-agent.ts` | AIGC 规格 |
| portrait-prompt.agent.ts | `backend/src/agents/portrait-prompt.agent.ts` | 肖像提示词 |
| prompt-service.ts | `backend/src/agents/prompt-service.ts` | Prompt 服务 |
| scene-image-prompt.agent.ts | `backend/src/agents/scene-image-prompt.agent.ts` | 场景图片提示词 |
| visual-feature-validator.ts | `backend/src/agents/visual-feature-validator.ts` | 视觉校验 |
| aigc-orchestrator.ts | `backend/src/agents/aigc-orchestrator.ts` | 编排器 |
| UOA.ts | `backend/src/agents/orchestrator/UOA.ts` | 统一编排 Agent |
| UOAShadow.ts | `backend/src/agents/orchestrator/shadow/UOAShadow.ts` | Shadow 编排 |

### 1.2 Brain/Engine/Worker

| 类型 | 文件 | 职责 |
|------|------|------|
| Director-Selection-Brain | `jobs/multi-scenario-v4/director-selection-brain.ts` | 导演选择 |
| Causal Engine | `causal-engine/` | 因果引擎 |
| CKB Engine | `runtime/ckb-engine.ts` | 知识引擎 |
| COE Engine | `runtime/coe-engine.ts` | 成本优化引擎 |
| CEE Engine | `runtime/cee-engine.ts` | 执行评估引擎 |
| CCP Compiler | `runtime/ccp-compiler.ts` | 编译引擎 |
| Worker Runtime | `queue/worker-runtime.ts` | 队列 Worker |
| Worker Pool | `workers/worker-pool.ts` | Worker 池 |
| Task Scheduler | `services/goal/engine/task-scheduler.ts` | 任务调度 |
| Agent Scheduler | `services/platform/agent/scheduler/agent-scheduler.ts` | Agent 调度 |
| Workflow Scheduler | `services/platform/workflow/scheduler/workflow-scheduler.ts` | 工作流调度 |
| DAG Scheduler | `services/geo/execution/scheduler/dag-scheduler.ts` | DAG 调度 |

### 1.3 Platform Agents

| Agent | 路径 |
|-------|------|
| Agent Registry | `services/platform/agent/registry/agent-registry.ts` |
| Agent Contract | `services/platform/agent/contract/agent-contract.ts` |
| Agent Context | `services/platform/agent/context/agent-context.ts` |
| Agent Runtime | `services/platform/agent/runtime/agent.runtime.ts` |
| Agent Memory | `services/platform/agent/memory/agent-memory.ts` |
| Agent Dispatcher | `services/platform/agent/dispatcher/` |
| Agent Tools | `services/platform/agent/tools/` |
| Agent Events | `services/platform/agent/events/` |

## 2. 硬编码问题

### 2.1 硬编码 Prompt 模板

| Agent 文件 | 行号 | 硬编码内容 |
|------------|------|-----------|
| `portrait-prompt.agent.ts` | 39 | `const FALLBACK_QC_PROMPT` |
| `portrait-prompt.agent.ts` | 59 | `const FALLBACK_NEGATIVE_PROMPT` |
| `portrait-prompt.agent.ts` | 66 | `const FALLBACK_PROMPT_STRUCTURE` |
| `narrative-schema-v3.ts` | 多处 | 硬编码 schema 定义 |
| `script-breakdown-master.ts` | 73-77 | 直接拼接 systemPrompt |

### 2.2 硬编码模型/Provider

| 文件 | 行号 | 内容 |
|------|------|------|
| `runtime/providers/deepseek.provider.ts` | 全部 | 仅支持 deepseek |
| `runtime/providers/openai.provider.ts` | 全部 | 仅支持 OpenAI |
| `services/deepseek-llm.provider.ts` | 全部 | 硬编码 deepseek |
| `model-adapters/video/aliyun-video.adapter.ts` | 全部 | 硬编码 aliyun |
| `model-adapters/video/volcengine-video.adapter.ts` | 全部 | 硬编码 volcengine |

### 2.3 硬编码 API Key/Environment

| 文件 | 行号 | 硬编码 |
|------|------|--------|
| `config/env.ts` | 12 | `MINIO_SECRET_KEY: z.string().default('minioadmin')` |
| `scripts/dry-run-video-runtime-v2.ts` | 105 | `apiKey: 'mock-api-key'` |
| `scripts/dry-run-video-runtime-v2.ts` | 159 | `apiKey: 'mock-key'` |

### 2.4 硬编码 Temperature/参数

| 文件 | 内容 |
|------|------|
| `agents/script-breakdown-master.ts` | 调用 LLM 时未设置 temperature |
| `agents/aigc-spec-agent.ts` | 未设置 temperature (使用 provider 默认) |
| `runtime/providers/` | 各 provider 初始化参数硬编码 |

## 3. Agent 调用链审计

### 3.1 Agent → Prompt → LLM 调用链

```
Agent (UOA/aigc-orchestrator)
  → PromptService.getPrompt() 或 PromptRegistry.getPrompt()
    → PromptTemplate DB 读取 或 硬编码字符串
  → LLM 调用 (runtime/providers 或 routes/service 直连)
    → Response Parsing
  → Return to Controller
```

### 3.2 问题链

| 步骤 | 问题 | 严重等级 |
|------|------|----------|
| Agent → Prompt | 部分硬编码 | HIGH |
| Prompt → LLM | 部分绕过 Runtime | CRITICAL |
| LLM Response | 无 schema 校验 | MEDIUM |
| Response → Output | 无 retry/fallback 统一 | MEDIUM |

## 4. 碎片化问题

### 4.1 多处独立的 "Agent" 实现

- `agents/` — 原始 Agent 目录
- `services/platform/agent/` — 平台 Agent 系统 (新版)
- `services/geo/agents/` — GEO 专用 Agent
- `decision-runtime/agents/` — 决策 Agent

### 4.2 重复功能

- Agent Registry 在 `agents/` 和 `services/platform/agent/registry/` 各有一份
- Prompt Service 在 `agents/prompt-service.ts` 和 `runtime/prompt/PromptRegistry.ts` 各有一份

## 5. 建议

1. **消除 Agent 中的硬编码**: 所有 prompt 走 PromptRegistry，所有模型配置走 Config
2. **统一 Agent Runtime**: 使用 `services/platform/agent/` 作为唯一 Agent 运行时
3. **Agent 调用统一经过 Runtime**: 禁止 Agent 直连 Provider
4. **Schema 强制**: Agent 输出必须有 schema 校验
5. **Temperature 等参数统一管理**: 通过 Config 中心配置
