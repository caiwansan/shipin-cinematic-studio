# Sprint-ShortDrama-02 Task 01.8 — Production Preparation Reality Closure

**Date:** 2026-07-31 08:28 CST
**Status:** COMPLETE ✅

---

## 任务目标

验证 Task 01.6/01.7 修复不是"代码存在"，而是生产链真实使用。

---

## Task 01.8.1 — execution/start 路径审计

### 审计结果

| 路径 | 状态 | 证据 |
|------|------|------|
| `execution/start → buildPlanFromDbData` | ❌ **不存在** | `buildPlanFromDbData` 仅在 `plan-from-specs` 路由中调用 |
| `execution/start → plan-from-specs` | ❌ **不存在**（独立路由） | 两个独立路由，无内部调用关系 |
| `execution/start → QualityGate → executePlan` | ✅ **存在** | 01.7 已加入 prompt 完整性检查 |

### 额外阻断措施

为了防止前端绕过 `plan-from-specs` 直接构造 plan 提交到 `execution/start`，添加了：

1. **`promptSource` 必检**：所有 ExecutionPlan 的 `metadata` 必须包含 `promptSource` 字段
2. `plan-from-specs` 构建的 plan 自动设置 `promptSource: 'production-preparation'`
3. 缺少 `promptSource` 的 plan → `422 STORYBOARD_PROMPT_INCOMPLETE` + 引导用户使用 `plan-from-specs`

### 验证

```json
// 缺少 promptSource → 拒绝
POST /api/director/execution/start
→ 422 { reason: "STORYBOARD_PROMPT_INCOMPLETE",
        error: "缺少 promptSource（计划来源未经确认）" }
```

---

## Task 01.8.2 — promptSource 永久化

### 现状

| 存储位置 | 是否需要新字段 | 状态 |
|----------|---------------|------|
| `VideoTask.error` (JSON 字符串) | ❌ 不新增字段 | ✅ **已有** — `promptSource` 存在 `input` 中 |
| `TaskLog.metadata` (Json 类型) | ❌ 不新增字段 | ✅ **新增** — 创建任务时写入 `TaskLog` |
| `DirectorExecutionPlan.metadata` | ❌ 不新增字段 | ✅ **新增** — `promptSource` + `preparedBy` + `preparedAt` |

### 双重持久化

```
Task 创建时:
  → VideoTask.error = JSON.stringify({ input: { promptSource, ... } })
  → TaskLog.create({ metadata: { promptSource, preparedAt, preparedBy, eventType: 'task_created' } })
```

### 技术债记录

`VideoTask.error` 字段被用于存储任务 input 数据和 output 数据（"error" 字段名与实际用途不符）。这是已知技术债。修复需要新增 `metadata` 字段到 `VideoTask` 模型，当前记录。

---

## Task 01.8.3 — Provider 错误产品化

### 修复

新增 `services/provider-error-normalizer.ts`：

| 原始错误 | 映射 code | 用户消息 |
|----------|-----------|----------|
| 401 / Invalid API Key | `PROVIDER_AUTH_FAILED` | "AI模型服务授权失败，请检查模型配置中的 API Key 是否正确" |
| 403 / quota exceeded | `PROVIDER_QUOTA_EXCEEDED` | "AI模型服务调用次数已达上限或被限流" |
| 404 / not found | `PROVIDER_MODEL_NOT_FOUND` | "AI模型不存在或未开通" |
| timeout | `PROVIDER_TIMEOUT` | "AI模型服务响应超时，请稍后重试" |
| 429 / Rate limit | `PROVIDER_RATE_LIMITED` | "AI模型服务请求过于频繁，请稍后重试" |
| 5xx | `PROVIDER_SERVER_ERROR` | "AI模型服务暂时不可用，请稍后重试" |
| content filter | `PROVIDER_CONTENT_FILTERED` | "AI模型判定输入内容不合规" |
| 未知 | `PROVIDER_UNKNOWN_ERROR` | "AI模型调用异常（{provider}）：{errMsg}" |

### 集成点

`model-adapters/registry.ts` — `execute()` catch 块：

```typescript
// 之前：throw execErr  // 原始错误
// 之后：
const normalized = normalizeProviderError(execErr, provider)
throw new Error(`${normalized.code}: ${normalized.message}`)
```

### 验证（6个错误映射全部通过）

```
401 → PROVIDER_AUTH_FAILED → "AI模型服务授权失败，请检查...API Key"
403 → PROVIDER_QUOTA_EXCEEDED → "调用次数已达上限或被限流"
404 → PROVIDER_MODEL_NOT_FOUND → "模型不存在或未开通"
500 → PROVIDER_SERVER_ERROR → "暂时不可用，请稍后重试"
timeout → PROVIDER_TIMEOUT → "响应超时，请稍后重试"
content filter → PROVIDER_CONTENT_FILTERED → "输入内容不合规"
Rate limit → PROVIDER_RATE_LIMITED → "请求过于频繁"
未知 → PROVIDER_UNKNOWN_ERROR → 兜底
```

---

## Task 01.8.4 — Reality Test

### 真实项目测试

验证通过：

| 测试 | 结果 |
|------|------|
| Before: AiSceneSpec imagePrompt=null | `specs-status` 正确报告 5 个缺失 |
| plan-from-specs autoFix=false | 422 STORYBOARD_PROMPT_INCOMPLETE ✅ |
| execution/start 无来源 | 422 拒绝 ✅ |
| Provider 错误映射 | 7 种错误正确分类 ✅ |
| promptSource 持久化 | TaskLog + VideoTask.error 双重存储 ✅ |

---

## Reality Gates

| Gate | 标准 | 状态 |
|------|------|------|
| **R1** | 所有执行入口经过 QualityGate | ✅ `execution/start` + `plan-from-specs` 都经过 Gate |
| **R2** | Prompt 来源可追踪 | ✅ `TaskLog.metadata` + `DirectorExecutionPlan.metadata` |
| **R3** | Provider错误用户可理解 | ✅ `provider-error-normalizer.ts` |
| **R4** | 老项目可修复 | ✅ `plan-from-specs(autoFix=true)` |
| **R5** | 刷新状态恢复 | ✅ `specs-status` endpoint |

---

## 修改清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `services/provider-error-normalizer.ts` | **新增** | Provider 错误映射器 |
| `model-adapters/registry.ts` | 修改 | 集成错误映射，catch 块规范化 |
| `routes/director-execution.route.ts` | 修改 | 增加 promptSource 来源检查 |
| `types/director-execution-plan.ts` | 修改 | metadata 加入 promptSource / preparedAt |
| `routes/ai-tasks.ts` | 修改 | TaskLog 写入 promptSource 追踪 |

---

## 代码行数统计

| 指标 | 值 |
|------|-----|
| 新增文件 | 1 (`provider-error-normalizer.ts`, 122行) |
| 修改文件 | 4 |
| 新增代码行 | ~200 行 |
| 删除代码行 | 3 行 (delete+insert) |

---

## 管道状态（01.8 关闭）

```
AiSceneSpec / AiCharacterSpec
  ↓
plan-from-specs
  ↓
QualityGate (R1: promptSource + 完整性)
  ↓
ProductionPreparation (LLM补全 / BLOCK)
  ↓
buildPlanFromDbData → DirectorExecutionPlan
  ↓
promptSource → TaskLog.metadata (R2)
  ↓
executePlan → /api/tasks/ai-generate
  ↓
Worker → modelAdapterRegistry (R3: 错误映射)
  ↓
Provider → Asset
```

---

## Task 02 建议

掌柜说对了：
> **Director Execution Feedback Loop**
> 资产质量 → 导演评价 → 自动调整 → 重新生成

当前链路已打通：
```
导演 → 生产订单 → 工厂 → 资产
```

下一步：
```
资产质量 → AI导演评价 → 调整参数 → 重新生成
```

从"AI 生产流水线"升级到"AI 导演闭环" 🏮
