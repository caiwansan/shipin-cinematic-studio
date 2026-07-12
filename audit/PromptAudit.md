# Audit F: Prompt 审计 (PromptAudit.md)

## 1. Prompt 管理现状

### 1.1 统一管理路径

| 组件 | 路径 | 功能 |
|------|------|------|
| PromptRegistry | `runtime/prompt/PromptRegistry.ts` | Prompt 注册和获取 |
| PromptRouter | `runtime/prompt/PromptRouter.ts` | Prompt 路由 |
| PromptAccessGuard | `runtime/prompt/PromptAccessGuard.ts` | 访问控制 |
| PromptTraceBuilder | `runtime/prompt/PromptTraceBuilder.ts` | 追踪构建 |
| PromptVersionGraph | `runtime/prompt/PromptVersionGraph.ts` | 版本管理 |
| PromptTelemetryAggregator | `runtime/prompt/PromptTelemetryAggregator.ts` | Telemetry |
| PromptRuntimeLogger | `runtime/prompt/PromptRuntimeLogger.ts` | 日志 |
| PromptTemplate (DB) | Prisma Schema | `PromptTemplate` 模型 |
| PromptVariant (DB) | Prisma Schema | `PromptVariant` 模型 |

### 1.2 数据库 Prompt 种子

| Seed 文件 | 内容 |
|-----------|------|
| `prisma/seed-prompts.ts` | 540+ prompt 种子数据 |
| `prisma/seed-prompt-variants.ts` | Prompt variant 种子 |
| `prisma/seed-image-prompts.ts` | 图片 prompt 种子 |
| `prisma/seed-style-profiles.ts` | 风格 prompt 种子 |

## 2. 散落的硬编码 Prompt (15+ 处)

### 2.1 Agent 中的硬编码 Prompt

| 文件 | 行号 | 变量名 | 内容 |
|------|------|--------|------|
| `backend/src/agents/portrait-prompt.agent.ts` | 39 | `FALLBACK_QC_PROMPT` | 肖像质量控制 prompt |
| `backend/src/agents/portrait-prompt.agent.ts` | 59 | `FALLBACK_NEGATIVE_PROMPT` | 负面 prompt 模板 |
| `backend/src/agents/portrait-prompt.agent.ts` | 66 | `FALLBACK_PROMPT_STRUCTURE` | prompt 结构模板 |
| `backend/src/agents/portrait-prompt.agent.ts` | 316 | `QC_PROMPT` | QC prompt (从 DB 读) |
| `backend/src/agents/portrait-prompt.agent.ts` | 317 | `DEFAULT_NEGATIVE_PROMPT` | 负面 prompt (从 DB 读) |
| `backend/src/agents/portrait-prompt.agent.ts` | 318 | `promptStructure` | 结构(从 DB 读) |

**问题**: 既有 FALLBACK 硬编码又有 DB 读取，双重来源。

### 2.2 脚本中的硬编码 Prompt

| 文件 | 行号 | 内容 |
|------|------|------|
| `backend/scripts/regen-bp2.ts` | 29 | 完整 prompt: "你是剧情总指挥 Agent..." |
| `backend/scripts/regen-bp3.ts` | 8 | `SYSTEM_PROMPT` 从文件读取 |
| `backend/scripts/test-volcengine.ts` | 多处 | 测试 prompt |

### 2.3 路由中的内联 Prompt

| 文件 | 行号 | 内容 |
|------|------|------|
| `routes/customer-service.ts` | 多处 | 客服 prompt 内联 |
| `routes/narrative-llm.ts` | 多处 | 叙事 prompt 内联 |
| `routes/script-breakdown.ts` | 多处 | 剧本拆解 prompt 内联 |

## 3. Prompt Registry 使用情况

### 3.1 使用 PromptRegistry 的代码

| 文件 | 调用方式 |
|------|----------|
| `agents/script-breakdown-master.ts:57` | `import('../runtime/prompt/PromptRegistry.js')` — 动态 import |
| `agents/aigc-spec-agent.ts:109` | `buildPromptCached({ agentName: 'aigc-prompt' })` |
| `agents/prompt-service.ts:18` | `prisma.promptTemplate.findUnique()` — 直接读 DB |
| `agents/aigc-orchestrator.ts:78` | `prisma.promptTemplate.findUnique()` — 直接读 DB |

### 3.2 未使用 PromptRegistry 的代码

| 文件 | 获取方式 |
|------|----------|
| `agents/portrait-prompt.agent.ts` | 既有 FALLBACK 硬编码，又从 DB 读取 |
| `agents/scene-image-prompt.agent.ts` | `buildPromptCached` (绕过 Registry) |
| `routes/customer-service.ts` | 无 Prompt 管理 |
| `routes/narrative-llm.ts` | 无 Prompt 管理 |

## 4. 重复/孤立 Prompt

### 4.1 重复 Prompt 检测

通过检查 DB seed 数据:
- `seed-prompts.ts` 中 `PROMPTS` 数组含 540+ 条目
- `seed-image-prompts.ts` 中另有独立的 prompt 列表
- `seed-style-profiles.ts` 中风格 prompt 与其他有重叠

### 4.2 孤立 Prompt (DB 有但代码未引用)

通过代码搜索 `seed-prompts.ts` 中的 prompt name 在源码中的引用:
- `系统角色简介` — 搜索无引用
- `场景设计师` — 仅有 `read-scene-prompt.ts` 脚本读取
- 大量 prompt 仅通过 name 匹配，无法确定实际使用

## 5. Prompt 管理缺陷

| 缺陷 | 描述 | 严重等级 |
|------|------|----------|
| 双重来源 | 硬编码 + DB 并存 | HIGH |
| 无统一管理 | 多处直接内联 | HIGH |
| 无版本追踪 | 虽有 PromptVersionGraph 但未强制 | MEDIUM |
| 无过期清理 | 遗弃 prompt 不删除 | MEDIUM |
| 无 Schema 约束 | prompt 内容无 schema 校验 | MEDIUM |

## 6. 建议

1. **统一 PromptRegistry**: 所有 prompt 获取必须通过 `PromptRegistry.getPrompt()`
2. **消除硬编码**: 所有 FALLBACK_* 常量移到 DB seed
3. **强制版本管理**: 每次更新 prompt 创建新版本
4. **Prompt 内容 Schema**: 使用 Zod 校验 prompt 结构
5. **废弃 prompt 清理**: 标记未使用的 prompt 并清理
6. **Telemetry 强制**: 所有 prompt 调用记录到 telemetry
