# KMKI Studio Platform V4.1 — C2 Architecture Report

| | |
|---|---|
| **Date** | 2026-07-17 |
| **Version** | v4.1.0 |
| **Status** | **C2 Complete — Execution Kernel + Capability Orchestrator Frozen** |
| **Previous Freeze** | v4.0 Architecture Baseline |

---

## 1. Architecture Overview

V4.1 在 V4.0 四层架构基础之上，将此前规划中的 **Runtime Scheduler** 和 **Capability Router** 两个延期项正式实现并冻结。

新接入的两大模块位于 Platform Layer，与现有模块平级：

```
                    ┌──────────────────────────────────────────┐
                    │           Workspace Layer                │
                    │  GEO | Video | Novel | PPT | ...        │
                    │         (通过 WorkspaceAdapter 接入)      │
                    └──────────────────┬───────────────────────┘
                                       │
                                       │ workspace: CapabilityRequest
                                       │ capabilityId: "llm.reasoning"
                                       ▼
              ┌─────────────────────────────────────────────────┐
              │               Execution Kernel                  │
              │  ┌──────────────────────────────────────────┐   │
              │  │         ExecutionEngine                  │   │
              │  │  submit / cancel / getStatus / getResult  │   │
              │  │                                          │   │
              │  │  Pipeline: validate → plan → acquire     │   │
              │  │            → execute → persist → publish │   │
              │  └──────────────────┬───────────────────────┘   │
              │                     │                           │
              │  ┌──────────────────┴───────────────────────┐   │
              │  │    ExecutionScheduler (interface)        │   │
              │  │    └── InMemoryScheduler (C2 default)    │   │
              │  └──────────────────┬───────────────────────┘   │
              └─────────────────────┼───────────────────────────┘
                                    │
                                    │ CapabilityRequest
                                    ▼
              ┌─────────────────────────────────────────────────┐
              │           CapabilityOrchestrator                │
              │  ┌──────────────────────────────────────────┐   │
              │  │        PolicyEngine (config-driven)      │   │
              │  │  YAML policy → resolve(workspace, health) │   │
              │  └──────────────────┬───────────────────────┘   │
              │  ┌──────────────────┴───────────────────────┐   │
              │  │        CapabilityRouter (executor)       │   │
              │  │  resolve → execute → fallback             │   │
              │  └──────────────────┬───────────────────────┘   │
              │                     │                           │
              │  ┌──────────────────┴───────────────────────┐   │
              │  │   Registries:                           │   │
              │  │    ├── CapabilityRegistry (ID → desc)   │   │
              │  │    ├── ProviderRegistry (ID → provider) │   │
              │  │    └── ModelRegistry (provider×model)   │   │
              │  │   Services:                             │   │
              │  │    ├── HealthManager (success/latency)   │   │
              │  │    ├── CostManager (every call recorded) │   │
              │  │    └── FallbackManager (multi-level)    │   │
              │  └──────────────────┬───────────────────────┘   │
              └─────────────────────┼───────────────────────────┘
                                    │
                                    │ CapabilityProvider.execute()
                                    ▼
              ┌─────────────────────────────────────────────────┐
              │             Provider Layer                      │
              │  OpenAI | DeepSeek | Qwen | ...                 │
              │  (implements CapabilityProvider interface)      │
              └─────────────────────────────────────────────────┘
```

---

## 2. Execution Kernel

执行内核是平台运行时的调度中枢，所有 Workspace 通过它提交和执行任务。

### 2.1 ExecutionContext — 单一上下文

```typescript
interface ExecutionContext {
  // 身份标识
  requestId: string;
  traceId: string;
  userId: string;
  projectId: string;
  workspaceType: string;
  workspaceId: string;

  // 运行时能力
  cancellationToken: AbortSignal;
  capabilities: Map<string, unknown>;

  // 生命周期
  startedAt: number;
  timeoutMs: number;
  retryCount: number;
  maxRetries: number;

  // 自定义元数据
  metadata: Record<string, unknown>;
}
```

**关键约束**：所有 Agent 和 Task 共享唯一的 ExecutionContext。Workspace 特定逻辑不允许出现在 ExecutionContext 中。`capabilities` 是 `Map<string, unknown>` 类型，Workspace 自行类型断言。

### 2.2 ExecutionPipeline — 6 阶段标准化管道

固定顺序，不可跳过或重排：

| 阶段 | 说明 | 默认实现 |
|------|------|---------|
| `validate` | 校验请求有效性 | DefaultValidateHandler |
| `plan` | 执行计划生成 | 无（Workspace 注册） |
| `acquire` | 资源获取（锁等） | 无（Workspace 注册） |
| `execute` | 任务执行主体 | DefaultExecuteHandler / ExecutionCapabilityHandler |
| `persist` | 结果持久化 | 无（Workspace 注册） |
| `publish` | 发布完成事件 | 无（Workspace 注册） |

`DefaultExecutionPipeline` 自动包装事件发布：每个阶段的开始/完成都会通过 EventBus 发布事件。

### 2.3 ExecutionEngine — 内核入口

```typescript
// 核心接口
submit(request: ExecutionRequest): Promise<ExecutionTask>;
cancel(taskId: string): Promise<void>;
getStatus(taskId: string): Promise<ExecutionStatus>;
getResult(taskId: string): Promise<ExecutionResult | null>;
```

执行流程：
```
submit(request)
  → 创建 ExecutionTask + ExecutionContext
  → 发布 execution.submitted 事件
  → scheduler.schedule(task)
  → processTask(task)
    → pipeline.execute(context, task)    [6 阶段]
    → 每个阶段发布 execution.stage.* 事件
  → 成功: 发布 execution.completed 事件
  → 失败: handleFailure() → 重试 or 发布 execution.failed 事件
```

### 2.4 ExecutionScheduler — 调度器接口

纯接口，C2 提供 InMemoryScheduler 默认实现：

```typescript
interface ExecutionScheduler {
  schedule(task: ExecutionTask): Promise<void>;
  cancel(taskId: string): Promise<void>;
  pause(taskId: string): Promise<void>;
  resume(taskId: string): Promise<void>;
  retry(taskId: string): Promise<void>;
  getQueueLength(): Promise<number>;
}
```

InMemoryScheduler 特性：FIFO 队列、任务去重、支持取消/暂停/恢复/手动重试。

### 2.5 ExecutionEvents — 8 类事件

所有事件通过 EventBus 发布，组件间无直接调用：

| 事件类型 | 说明 |
|---------|------|
| `execution.submitted` | 任务已提交 |
| `execution.stage.started` | 阶段开始 |
| `execution.stage.completed` | 阶段完成 |
| `execution.completed` | 执行完成 |
| `execution.failed` | 执行失败 |
| `execution.cancelled` | 执行取消 |
| `execution.retrying` | 重试中 |
| `execution.progress` | 进度更新 |

### 2.6 ExecutionLock — 资源锁定

```typescript
interface ExecutionLockManager {
  acquire(resourceId: string, taskId: string, ttl: number): Promise<boolean>;
  release(resourceId: string, taskId: string): Promise<void>;
  isLocked(resourceId: string): Promise<boolean>;
}
```

C2 提供 `InMemoryLockManager`，支持 TTL 自动过期。

### 2.7 ExecutionCapabilityHandler — 桥接 Execution → Capability

Pipeline execute 阶段的可选 handler。从 task payload 提取 CapabilityRequest，通过 CapabilityRuntime 执行，将结果写回 task。**这是 Execution 唯一直面 Capability 的地方。**

---

## 3. Capability Orchestrator

能力编排层是 AI 能力调度的枢纽，提供 Provider-agnostic 的执行接口。

### 3.1 能力契约 (CapabilityContract)

核心接口定义在 `capability/types.ts`：

| 类型 | 说明 |
|------|------|
| `CapabilityId` | 能力标识符（`llm.reasoning` 等） |
| `CapabilityDescriptor` | 能力的完整描述（ID + Provider + Model + Schema） |
| `CapabilityRequest` | 执行请求（Execution 提交） |
| `CapabilityResult` | 执行结果（Provider 返回） |
| `CapabilityProvider` | Provider 接口（execute / health / supports / cost / limits） |
| `CapabilityError` | 标准错误格式（code / message / retryable） |
| `AssetRecord` | 媒体资产记录（为 C2.2 Asset Center 预留） |

### 3.2 CapabilityRegistry — 能力注册表

所有能力通过 `register(descriptor)` 注册，通过 `get(id)` / `list()` / `findByProvider(id)` 查询。Execution 不硬编码 capabilityId，通过此注册表发现。

### 3.3 ProviderRegistry — 提供商注册表

所有 Provider 实现 `CapabilityProvider` 接口后通过 `register(provider)` 注册。新增 Provider 只需实现接口 + 注册，无需修改其他代码。

### 3.4 ModelRegistry — 模型注册表

Provider 和 Model 分离。模型注册包含能力列表、上下文窗口、定价信息、生命周期状态（active / deprecated / sunset）。

### 3.5 PolicyEngine — 策略路由决策器

**纯决策器**，不做任何执行。基于配置驱动的 YAML/JSON 策略：

```typescript
interface Policy {
  id: string;          // 策略 ID
  name: string;        // 可读名称
  workspace: string;   // 所属工作空间
  workflow?: string;   // 可选：特定工作流
  rules: PolicyRule[]; // 路由规则（按 priority 排序）
  fallbacks: PolicyRule[][]; // 多级降级链
}
```

决策流程：
1. 按 workspace (+ workflow) 匹配策略
2. 按 priority 排序规则
3. 跳过 HealthManager 标记为 unavailable 的 Provider
4. 返回第一个健康匹配的 `{providerId, modelId}`

### 3.6 CapabilityRouter — 路由执行器

**纯执行器**，不做决策。流程：
1. 调用 PolicyEngine.resolve() 获取决策
2. 从 ProviderRegistry 查找 Provider
3. 调用 provider.execute(request)
4. 成功 → 记录 HealthManager.recordSuccess()
5. 失败 → 委托 FallbackManager.executeWithFallback()

### 3.7 HealthManager — 健康追踪

多维度健康状态：

| 指标 | 说明 |
|------|------|
| successRate | 成功率 (0-100%) |
| avgLatencyMs | 平均延迟 |
| consecutiveFailures | 连续失败次数 |
| 自动衰减 (Auto-decay) | unavailable → degraded (TTL: 5 分钟) |

健康等级：`healthy` → `degraded` → `unavailable`

### 3.8 CostManager — 成本追踪

**每调用必记录，无 opt-out。** 记录所有调用：workspace、project、provider、capability、token 用量、成本、延迟。提供按时间/维度的聚合查询。

### 3.9 FallbackManager — 多级降级

从 PolicyEngine 获取降级链后，逐级尝试：
1. 跳过已失败的 Provider
2. 跳过 HealthManager 标记为 unavailable 的 Provider
3. 返回第一个成功结果
4. 全部失败 → 抛出异常

---

## 4. Platform Boundaries (平台边界重申)

| 边界 | 规则 |
|------|------|
| Execution → Capability | Kernel 只知 CapabilityRequest，不知 Provider |
| Capability → Execution | Orchestrator 不知 Kernel 内部 |
| Provider → Orchestrator | Provider 只实现 CapabilityProvider 接口 |
| Workspace → Provider | Workspace 只传 capabilityId，不知 Provider 是谁 |

ExecutionCapabilityHandler 是 Execution 中**唯一**引用 Capability 类型的地方，位于 Pipeline 的 execute 阶段。

---

## 5. Module Inventory

| 模块 | Package | 文件数 | 行数 | 状态 |
|------|---------|--------|------|------|
| Execution Kernel | `@studio/platform/execution` | 10 | ~1,817 | **FROZEN** |
| Capability Orchestrator | `@studio/platform/capability` | 14 | ~2,712 | **FROZEN** |
| (Asset Center) | (planned C2.2) | — | — | NOT STARTED |
| (Integration Bus) | (planned C2.3) | — | — | NOT STARTED |

### Execution Kernel 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `execution/types.ts` | 161 | 核心类型定义 |
| `execution/execution-context.ts` | 74 | 单一上下文接口 |
| `execution/execution-pipeline.ts` | 306 | Pipeline + handler 注册 |
| `execution/execution-engine.ts` | 491 | 内核入口 |
| `execution/execution-scheduler.ts` | 63 | 调度器接口 |
| `execution/in-memory-scheduler.ts` | 177 | 默认内存调度器 |
| `execution/execution-events.ts` | 147 | 8 类事件定义 |
| `execution/execution-worker.ts` | 81 | Worker 接口 |
| `execution/execution-lock.ts` | 123 | 锁接口 + InMemoryLockManager |
| `execution/execution-capability-handler.ts` | 127 | 桥接 Execution→Capability |
| `execution/index.ts` | 67 | Barrel export |

### Capability Orchestrator 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `capability/types.ts` | 241 | 能力契约核心接口 |
| `capability/capability-definitions.ts` | 87 | 标准能力 ID 注册 |
| `capability/capability-runtime.ts` | 241 | 基础运行时（简化版） |
| `capability/capability-orchestrator.ts` | 230 | 统一编排入口 |
| `capability/openai-provider.ts` | 483 | OpenAI 提供商实现 |
| `capability/health-manager.ts` | 308 | 健康追踪 |
| `capability/cost-manager.ts` | 219 | 成本记录 |
| `capability/fallback-manager.ts` | 122 | 多级降级 |
| `capability/router/capability-router.ts` | 113 | 路由执行器 |
| `capability/policy/policy-engine.ts` | 309 | 策略路由决策器 |
| `capability/registries/capability-registry.ts` | 73 | 能力注册表 |
| `capability/registries/provider-registry.ts` | 74 | 提供商注册表 |
| `capability/registries/model-registry.ts` | 132 | 模型注册表 |

---

## 6. Changes from v4.0

| 变动项 | 说明 |
|--------|------|
| **New: Execution Kernel** | 10 个文件，~1,800 行 — 实现 Runtime Scheduler |
| **New: Capability Orchestrator** | 11 个文件 + 3 个注册表，~2,700 行 — 实现 Capability Router |
| **New: Capability Definitions** | `llm.reasoning`, `llm.extraction`, `llm.translation`, `llm.summary` |
| **New: AssetRecord** | 在 CapabilityResult 中预留资产记录字段 |
| **Updated: Platform Bootstrap** | 集成 Orchestrator 工厂方法 |
| **Deferred from V4.0 → Now Real** | Runtime Scheduler ✅ | Capability Router ✅ |

---

## 7. ADR Status (v4.1 additions)

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Single Platform Runtime | ✅ Verified (Kernel unified execution) |
| ADR-002 | WorkspaceAdapter Interface | ✅ Verified |
| ADR-003 | Provider→Model→Capability→Workflow | ✅ NOW REAL (Orchestrator) |
| ADR-004 | Repository + ORM Adapter | ✅ Verified |
| ADR-005 (NEW) | Execution Kernel | 🔒 FROZEN — recommend writing ADR |
| ADR-006 (NEW) | Policy-Driven Capability Router | 🔒 FROZEN — recommend writing ADR |

### Recommended ADR-005: Execution Kernel

**Title**: Execution Kernel — Centrally Scheduled Runtime Pipeline

**Proposed content**:
- 为什么 Execution Engine 是平台层而非 Workspace 层
- 为什么 Pipeline 6 阶段固定顺序，而非可编排的 DAG
- 为什么 ExecutionContext 是单一的（ADR-001 的具体化）
- 为什么 Scheduler 是接口而非实现（多调度策略支持）
- 为什么 InMemoryScheduler 是默认实现（Redis/Kafka 为生产选项）
- 为什么锁机制与 Pipeline 分离（可替换的锁实现）

### Recommended ADR-006: Policy-Driven Capability Router

**Title**: Policy-Driven Capability Router — Config-Driven AI Provider Selection

**Proposed content**:
- 为什么 CapabilityRouter 只执行不决策（PolicyEngine 做决策）
- 为什么 Policy 是 YAML/JSON 配置而非代码（非工程师可修改）
- 为什么 ProviderRegistry 和 ModelRegistry 分离（Provider 不变而模型变）
- 为什么 health-aware 路由（自动避开故障 Provider）
- 为什么 `execute` 层（CapabilityProvider）完全不知道路由策略
- 多级 fallback 的设计动机（降级链 vs 水平扩展）

---

## 8. Next: C2.2 Digital Asset Center

C2.2 将实现 Asset Center 数字资产平台，包括资产存储、版本管理、媒体处理等。

---

*KMKI Studio Platform V4.1 — C2 Architecture Report. Execution Kernel + Capability Orchestrator Frozen. 2026-07-17.*
