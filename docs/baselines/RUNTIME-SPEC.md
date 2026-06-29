# 昆仑镜 V4 Runtime 规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **约束**: Runtime 是 Platform 层的专属能力，Workspace 不得实现

---

## 1. Runtime 所有权声明

**Runtime 属于 Platform 层，且仅属于 Platform 层。**

Workspace 层没有 Runtime。没有自己的运行时上下文、没有自己的执行引擎、没有自己的状态管理、没有自己的工作流调度器。

Workspace 只有 Adapter——Adapter 不是 Runtime，Adapter 是 Platform Runtime 的消费者。

### 1.1 背景：当前违规

审查发现当前存在严重的 Runtime 违规：

| 位置 | 文件 | 行数 | 违规 |
|------|------|------|------|
| Brand GEO | `composables/useBrandGEORuntime.ts` | ~280 行 | 🔴 独立 Runtime |
| KMKI GEO | `runtime/geo.runtime.ts` | ~80 行 | 🔴 独立 Runtime |
| 平台 | `modules/platform/workspace/store/useWorkspaceStore.ts` | 存在但未使用 | 🟡 平台 Runtime 被架空 |

**处理方式**: 两个 GEO Runtime 必须删除，功能迁移到 `GEOWorkspaceAdapter`。

---

## 2. 四种运行时类型

Platform 层提供四种运行时，覆盖所有执行场景。

### 2.1 执行运行时（Execution Runtime）

**职责**: 管理单个操作的执行生命周期（初始化 → 执行 → 完成/失败 → 清理）

```typescript
// @studio/platform/runtime/execution
export interface ExecutionRuntime {
  /** 注册一个可执行动作 */
  registerAction<TInput, TOutput>(
    id: string,
    handler: (input: TInput, ctx: RuntimeContext) => Promise<TOutput>
  ): void

  /** 执行一个已注册的动作 */
  execute<TInput, TOutput>(
    actionId: string,
    input: TInput,
    ctx?: Partial<RuntimeContext>
  ): Promise<ExecutionResult<TOutput>>

  /** 获取执行状态 */
  getStatus(executionId: string): Promise<ExecutionStatus>

  /** 取消执行 */
  cancel(executionId: string): Promise<void>
}

export interface ExecutionResult<TOutput> {
  executionId: string
  status: 'completed' | 'failed' | 'cancelled' | 'running'
  output?: TOutput
  error?: ExecutionError
  trace: ExecutionTrace
  durationMs: number
}

export interface RuntimeContext {
  userId: string
  projectId?: string
  workspaceId: string
  sessionId: string
  membership: MembershipInfo
}
```

### 2.2 工作流运行时（Workflow Runtime）

**职责**: DAG 解析、节点调度、并行/串行执行、重试、超时、容错

```typescript
// @studio/platform/runtime/workflow
export interface WorkflowRuntime {
  /** 注册 DAG 定义 */
  registerDAG(dag: DAGDefinition): Promise<void>

  /** 触发工作流执行 */
  trigger<TInput>(workflowId: string, input: TInput): Promise<WorkflowExecution>

  /** 获取工作流执行状态 */
  getExecution(executionId: string): Promise<WorkflowExecution>

  /** 暂停工作流 */
  pause(executionId: string): Promise<void>

  /** 恢复工作流 */
  resume(executionId: string): Promise<void>

  /** 取消工作流 */
  cancel(executionId: string): Promise<void>
}

export interface DAGDefinition {
  id: string
  name: string
  description?: string
  nodes: DAGNode[]
  config?: {
    maxRetries?: number
    timeoutMs?: number
    continueOnFailure?: boolean
  }
}

export interface DAGNode {
  id: string
  agent: string        // Agent ID（在 Platform Agent Registry 中注册）
  dependsOn: string[]  // 依赖的节点 ID
  config?: {
    retries?: number
    timeoutMs?: number
    inputMapping?: Record<string, string>
  }
}
```

### 2.3 能力运行时（Capability Runtime）

**职责**: Provider 路由、调用分发、降级、负载均衡

```typescript
// @studio/platform/runtime/capability
export interface CapabilityRuntime {
  /** 注册一个 Provider */
  registerProvider(provider: ProviderRegistration): Promise<void>

  /** 注册一个 Agent */
  registerAgent(agent: AgentRegistration): Promise<void>

  /** 调用能力（自动路由到合适 Provider） */
  invoke<TInput, TOutput>(
    capabilityId: string,
    input: TInput,
    options?: CapabilityInvokeOptions
  ): Promise<CapabilityResult<TOutput>>

  /** 获取能力状态 */
  health(): Promise<CapabilityHealth>
}

export interface ProviderRegistration {
  id: string            // openai / deepseek / qwen / doubao / gemini / local
  type: 'llm' | 'image' | 'video' | 'tts'
  models: string[]
  priority: number      // 数字越小优先级越高
  enabled: boolean
  config: Record<string, unknown>
}

export interface AgentRegistration {
  id: string
  name: string
  description: string
  capabilities: string[]   // 依赖的能力 ID
  handler: (input: unknown, ctx: AgentContext) => Promise<unknown>
}
```

### 2.4 状态运行时（State Runtime）

**职责**: 管理 Workspace 的短期状态、持久化会话、状态同步

```typescript
// @studio/platform/runtime/state
export interface StateRuntime {
  /** 获取 workspace 状态 */
  getState<T>(workspaceId: string, key: string): Promise<T | null>

  /** 设置 workspace 状态 */
  setState<T>(workspaceId: string, key: string, value: T): Promise<void>

  /** 删除状态 */
  deleteState(workspaceId: string, key: string): Promise<void>

  /** 订阅状态变更 */
  subscribe(
    workspaceId: string,
    key: string,
    callback: (value: unknown) => void
  ): () => void
}
```

---

## 3. 分层执行架构

```
┌─────────────────────────────────────────────┐
│                Platform Runtime              │
│                                              │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │ ExecutionRuntime │  │ WorkflowRuntime  │  │
│  │  (单操作执行)     │  │  (DAG 编排)      │  │
│  └──────────────────┘  └─────────────────┘  │
│                                              │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │ CapabilityRuntime│  │  StateRuntime   │  │
│  │  (Provider 路由)  │  │  (状态管理)      │  │
│  └──────────────────┘  └─────────────────┘  │
│                                              │
└──────────────────┬──────────────────────────┘
                   │ WorkspaceAdapter
                   ▼
┌─────────────────────────────────────────────┐
│         Workspace Adapter Layer               │
│                                              │
│  GEOWorkspaceAdapter.execute(action, input)   │
│     ↓ 委托给 Platform Runtime                 │
│  PlatformSDK.runtime.execution.execute(...)   │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           Business Logic                      │
│  workspace/geo/services/geoService.ts         │
│  workspace/geo/stores/useGeoStore.ts          │
└─────────────────────────────────────────────┘
```

**关键约束**: 箭头方向只能从上到下。Business Logic 不能直接调用 Platform Runtime，必须通过 Adapter。

---

## 4. WorkspaceAdapter 生命周期

```typescript
import { PlatformSDK } from '@studio/platform/sdk'
import { GEOWorkspaceAdapter } from './adapter/GEOWorkspaceAdapter'

// 平台启动时注册所有 Workspace
async function bootstrapWorkspaces() {
  const geoAdapter = new GEOWorkspaceAdapter()

  // 1. 注册 — Workspace 初始化
  await PlatformSDK.runtime.execution.registerAction('geo:analyze-brand', {
    handler: (input, ctx) => geoAdapter.execute('analyze-brand', input, ctx)
  })

  // 2. 注册 DAG
  await geoAdapter.register({ userId: 'system', membership: { tier: 'enterprise', features: [] }, sessionId: 'bootstrap' })

  // 3. 运行时—随时执行
  const result = await PlatformSDK.runtime.execution.execute('geo:analyze-brand', {
    projectId: 'xxx',
    url: 'https://example.com'
  })

  // 4. 销毁 — 应用关闭时
  await geoAdapter.dispose()
}
```

---

## 5. 禁止清单

### 5.1 Workspace 层禁止的 Runtime 模式

| 禁止模式 | 识别特征 | 违规示例 |
|---------|----------|----------|
| 独立 Runtime 类 | `class XXXRuntime` | `class GEORuntime` |
| 独立 Runtime 文件 | `*.runtime.ts`, `use*Runtime.ts` | `geo.runtime.ts`, `useBrandGEORuntime.ts` |
| 独立执行引擎 | 自己管理执行生命周期 | 自己实现 retry/timeout 循环 |
| 独立状态容器 | 自己管理状态树 | `class StateManager` |
| 直接调用 Provider | `new OpenAI()` | 在 Service 中实例化 LLM 客户端 |
| 独立 Workflow Builder | `class WorkflowBuilder` | Workspace 内部实现 DAG 解析 |

### 5.2 Platform 层 Runtime 的正确使用方式

| 操作 | 正确方式 |
|------|----------|
| 执行一个业务操作 | `PlatformSDK.runtime.execution.execute('actionId', input)` |
| 触发一个工作流 | `PlatformSDK.runtime.workflow.trigger('workflowId', input)` |
| 调用 LLM 能力 | `PlatformSDK.runtime.capability.invoke('llm.generate', prompt)` |
| 管理 Workspace 状态 | `PlatformSDK.runtime.state.setState('geo', 'key', value)` |
| 注册新的 DAG | `PlatformSDK.runtime.workflow.registerDAG(dag)` |
| 注册新的 Agent | `PlatformSDK.runtime.capability.registerAgent(agent)` |

---

## 6. 迁移路径：从独立 Runtime 到 Adapter

### 当前状态（违规）

```
workspace/geo/
├── composables/useBrandGEORuntime.ts  ← 🔴 独立 Runtime
├── runtime/geo.runtime.ts             ← 🔴 独立 Runtime
└── stores/useGeoStore.ts              ← 🟡 独立状态管理
```

### 目标状态（合规）

```
workspace/geo/
├── adapter/GEOWorkspaceAdapter.ts  ← ✅ 唯一的执行入口
├── services/geoService.ts          ← ✅ 业务逻辑
└── stores/useGeoStore.ts           ← ✅ 前端状态（通过 PlatformSDK runtime.state）
```

### 迁移步骤（每个 Workspace 通用）

```
Step 1: 识别 Runtime 中哪些是 Platform 能力 → 替换为 PlatformSDK 调用
Step 2: 识别 Runtime 中哪些是业务逻辑 → 移至 services/
Step 3: 识别 Runtime 中哪些是状态管理 → 移至 stores/ 或 StateRuntime
Step 4: 删除独立 Runtime 文件
Step 5: 创建 WorkspaceAdapter，通过 Platform Runtime 暴露执行入口
```

---

## 7. 验证规则

### CI 检查脚本

```bash
#!/bin/bash
# workspace-runtime-check.sh — 检查 Workspace 是否违反 Runtime 规则

ERRORS=0

# 检查 1：不存在 *.runtime.ts 文件
for ws in workspace/*/; do
  if find "$ws" -name "*.runtime.ts" | grep -q .; then
    echo "❌ $ws 包含独立 Runtime 文件"
    find "$ws" -name "*.runtime.ts"
    ERRORS=$((ERRORS + 1))
  fi
done

# 检查 2：不存在 use*Runtime composables
for ws in workspace/*/; do
  if find "$ws" -name "use*Runtime*" | grep -q .; then
    echo "❌ $ws 包含独立 Runtime composable"
    find "$ws" -name "use*Runtime*"
    ERRORS=$((ERRORS + 1))
  fi
done

# 检查 3：不存在 class *Runtime 定义
for ws in workspace/*/; do
  if grep -r "class.*Runtime" "$ws" --include="*.ts" --include="*.vue" | grep -q .; then
    echo "❌ $ws 包含 Runtime class 定义"
    ERRORS=$((ERRORS + 1))
  fi
done

# 检查 4：每个 Workspace 有且只有一个 Adapter
for ws in workspace/*/; do
  adapter_count=$(find "$ws" -name "*Adapter.ts" | wc -l)
  if [ "$adapter_count" -eq 0 ]; then
    echo "❌ $ws 缺少 WorkspaceAdapter"
    ERRORS=$((ERRORS + 1))
  fi
done

echo "共发现 $ERRORS 个 Runtime 违规"
exit $ERRORS
```

---

*Runtime 规范是昆仑镜平台架构的核心约束。Runtime 分散是导致代码重复、架构混乱的根本原因。*
*任何新增的 Runtime 实现必须先在架构评审会上获得批准，并记录在此文档中。*
