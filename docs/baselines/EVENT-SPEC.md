# 昆仑镜 V4 事件总线规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **范围**: 事件总线是 Platform 层能力，Workspace 层不得独立实现

---

## 1. 事件总线所有权声明

**事件总线属于 Platform 层，且仅属于 Platform 层。**

Workspace 层没有自己的事件系统。没有独立的事件通道、没有独立的事件存储、没有独立的事件订阅管理。

Workspace 只能通过 `PlatformSDK.event.*` 发布和订阅事件。所有事件的传递、路由、持久化、重放均由 Platform 层的事件总线负责。

---

## 2. Event / Command / Query 边界分离

事件总线严格区分三种消息类型：

| 类型 | 用途 | 是否有响应 | 是否持久化 | 是否期待处理 |
|------|------|-----------|-----------|------------|
| **Event** (事件) | 通知已发生的事实 | 否（fire-and-forget） | 是 | 可能有 0 或多个订阅者 |
| **Command** (命令) | 请求执行某个操作 | 是（返回结果） | 是（通过工作流） | 恰好 1 个处理器 |
| **Query** (查询) | 请求获取数据 | 是（返回数据） | 否 | 恰好 1 个查询器 |

### 2.1 事件（Event）— 已发生的事实

```typescript
// Event：通知发生了什么，不期待响应
interface EventPayload {
  type: string
  payload: unknown
  metadata: Record<string, unknown>
  timestamp: string       // ISO 8601
  traceId: string
}

// 示例：项目已创建
{
  type: 'project:created',
  payload: {
    projectId: 'abc-123',
    name: '品牌分析项目',
    type: 'geo'
  },
  metadata: {
    workspace: 'geo',
    userId: 'user-456'
  },
  timestamp: '2026-07-18T10:00:00.000Z',
  traceId: 'trace-789'
}
```

### 2.2 命令（Command）— 请求执行操作

命令不走事件总线，而是通过 **Workflow Runtime** 或 **Execution Runtime** 执行：

```typescript
// Command：请求执行，期待结果
interface Command<TInput, TOutput> {
  id: string
  action: string
  input: TInput
  ctx: RuntimeContext
}

// 通过 Execution Runtime 执行命令
const result = await PlatformSDK.runtime.execution.execute(
  'geo:analyze-brand',
  { projectId: 'abc-123' },
  ctx
)
```

### 2.3 查询（Query）— 请求获取数据

查询不走事件总线，而是通过 **Platform SDK API** 或 **Repository** 执行：

```typescript
// Query：请求数据，期待结果
const projects = await PlatformSDK.api.get('/geo/projects', {
  params: { status: 'active' }
})

// 或通过 Repository
const claims = await PlatformSDK.repository.findMany('knowledgeClaim', {
  where: { projectId: 'abc-123' }
})
```

---

## 3. 事件类型与Schema

### 3.1 全局事件 Schema

所有事件遵循统一的 `StudioEvent` 接口：

```typescript
// @studio/platform/event
export interface StudioEvent<T = unknown> {
  /** 事件类型，采用 `domain:action` 命名格式 */
  type: string

  /** 事件负载 */
  payload: T

  /** 事件元数据（自动附加） */
  metadata: EventMetadata

  /** 事件发生时间（ISO 8601） */
  timestamp: string

  /** 分布式追踪 ID，用于串联整个请求链路 */
  traceId: string

  /** 事件 ID（全局唯一，用于去重） */
  eventId: string

  /** 事件版本号，用于 schema 演化 */
  version: number
}

export interface EventMetadata {
  /** 来源 Workspace */
  source: string
  /** 触发事件的用户 */
  userId?: string
  /** 关联项目 */
  projectId?: string
  /** 关联会话 */
  sessionId?: string
  /** 相关事件 traceId 链 */
  parentTraceId?: string
  /** 自定义标签 */
  tags?: string[]
}
```

### 3.2 内置事件类型枚举

```typescript
// @studio/platform/event/types
export const EventTypes = {
  // 项目事件
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_ARCHIVED: 'project:archived',
  PROJECT_DELETED: 'project:deleted',

  // 资产事件
  ASSET_IMPORTED: 'asset:imported',
  ASSET_DELETED: 'asset:deleted',
  ASSET_PROCESSED: 'asset:processed',

  // 工作流事件
  WORKFLOW_STARTED: 'workflow:started',
  WORKFLOW_NODE_COMPLETED: 'workflow:node:completed',
  WORKFLOW_NODE_FAILED: 'workflow:node:failed',
  WORKFLOW_FINISHED: 'workflow:finished',
  WORKFLOW_FAILED: 'workflow:failed',
  WORKFLOW_CANCELLED: 'workflow:cancelled',

  // 知识事件
  CITATION_GENERATED: 'citation:generated',
  KNOWLEDGE_UPDATED: 'knowledge:updated',
  KNOWLEDGE_QUALITY_CHECKED: 'knowledge:quality:checked',

  // 能力事件
  CAPABILITY_INVOKED: 'capability:invoked',
  CAPABILITY_FAILED: 'capability:failed',
  CAPABILITY_FALLBACK: 'capability:fallback',

  // 工作空间事件
  WORKSPACE_REGISTERED: 'workspace:registered',
  WORKSPACE_DISPOSED: 'workspace:disposed',
} as const
```

---

## 4. 事件总线接口

```typescript
// @studio/platform/event
export interface EventBus {
  /** 发布事件（fire-and-forget） */
  publish<T>(event: StudioEvent<T>): Promise<void>

  /** 订阅事件 */
  subscribe<T>(
    type: string,
    handler: EventHandler<T>,
    options?: SubscribeOptions
  ): Promise<UnsubscribeFn>

  /** 取消订阅 */
  unsubscribe<T>(
    type: string,
    handler: EventHandler<T>
  ): Promise<void>

  /** 注册错误处理器 */
  onError(handler: ErrorHandler): void

  /** 获取事件总线健康状态 */
  health(): Promise<EventBusHealth>
}

// 类型定义
export type EventHandler<T = unknown> = (
  event: StudioEvent<T>
) => Promise<void> | void

export type UnsubscribeFn = () => Promise<void>

export type ErrorHandler = (
  error: Error,
  event: StudioEvent
) => void

export interface SubscribeOptions {
  /** 是否只订阅一次 */
  once?: boolean
  /** 过滤器：根据 payload 条件过滤 */
  filter?: (event: StudioEvent) => boolean
  /** 优先级：数字越小优先级越高 */
  priority?: number
}

export interface EventBusHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  subscribersCount: number
  pendingEvents: number
  lastError?: string
}
```

### 4.1 发布事件示例

```typescript
import { PlatformSDK } from '@studio/platform'

// Workspace 发布事件
await PlatformSDK.event.publish({
  type: 'asset:imported',
  payload: {
    assetId: 'asset-123',
    projectId: 'proj-456',
    type: 'brand-logo',
    url: 'https://cdn.example.com/logo.png'
  },
  metadata: {
    source: 'geo',
    userId: 'user-789',
    projectId: 'proj-456',
    tags: ['brand', 'import']
  },
  timestamp: new Date().toISOString(),
  traceId: 'trace-abc',
  eventId: 'evt-001',
  version: 1
})
```

### 4.2 订阅事件示例

```typescript
import { PlatformSDK } from '@studio/platform'

// 在 GEOWorkspaceAdapter 中订阅事件
export class GEOWorkspaceAdapter implements WorkspaceAdapter {
  private unsubscribers: (() => Promise<void>)[] = []

  async register(ctx: WorkspaceContext): Promise<void> {
    // 订阅项目创建事件
    const unsub1 = await PlatformSDK.event.subscribe(
      'project:created',
      this.handleProjectCreated.bind(this),
      { filter: (event) => event.payload.type === 'geo' }
    )
    this.unsubscribers.push(unsub1)

    // 订阅资产导入事件（只处理一次）
    const unsub2 = await PlatformSDK.event.subscribe(
      'asset:imported',
      this.handleAssetImported.bind(this),
      { once: true }
    )
    this.unsubscribers.push(unsub2)
  }

  async dispose(): Promise<void> {
    // 清理所有订阅
    for (const unsub of this.unsubscribers) {
      await unsub()
    }
  }

  private async handleProjectCreated(event: StudioEvent<ProjectPayload>) {
    PlatformSDK.logger.info('[GEO] 新项目创建，启动知识质量分析', {
      projectId: event.payload.projectId
    })

    // 触发工作流
    await PlatformSDK.runtime.workflow.trigger(
      'geo.knowledge-quality',
      { projectId: event.payload.projectId }
    )
  }

  private async handleAssetImported(event: StudioEvent<AssetPayload>) {
    PlatformSDK.logger.info('[GEO] 资产导入完成', {
      assetId: event.payload.assetId
    })
  }
}
```

---

## 5. 事件流示例

### 5.1 典型事件链：项目创建 → 知识生成

```
ProjectCreated → AssetImported → WorkflowStarted → WorkflowFinished → CitationGenerated → KnowledgeUpdated

时间线:
│
├─ [T+0s]  ProjectCreated(projectId: "proj-1", type: "geo")
│         └─ GEO Adapter 收到事件 → 触发知识质量工作流
│
├─ [T+1s]  AssetImported(assetId: "asset-1", projectId: "proj-1")
│         └─ 知识 Agent 收到通知 → 纳入引用源
│
├─ [T+2s]  WorkflowStarted(workflowId: "geo.knowledge-quality", executionId: "exec-1")
│
├─ [T+10s] WorkflowNodeCompleted(node: "claim", executionId: "exec-1")
│         └─ 中间进度通知
│
├─ [T+30s] WorkflowFinished(workflowId: "geo.knowledge-quality", executionId: "exec-1")
│         └─ 工作流完成
│
├─ [T+31s] CitationGenerated(projectId: "proj-1", count: 24)
│         └─ 引用生成事件
│
└─ [T+32s] KnowledgeUpdated(projectId: "proj-1", domains: ["claim","evidence","citation"])
          └─ 知识库更新完成
```

### 5.2 跨 Workspace 事件通信

Video Workspace 可以响应 GEO 事件，GEO 也可以响应 Video 事件：

```typescript
// Video Workspace Adapter 订阅 GEO 事件
export class VideoWorkspaceAdapter implements WorkspaceAdapter {
  async register(ctx: WorkspaceContext): Promise<void> {
    // Video 关心引用生成事件——用于视频引用标注
    await PlatformSDK.event.subscribe(
      'citation:generated',
      this.handleCitationForVideo.bind(this)
    )

    // Video 关心知识更新事件——用于更新视频描述中的知识内容
    await PlatformSDK.event.subscribe(
      'knowledge:updated',
      this.handleKnowledgeUpdateForVideo.bind(this)
    )
  }

  private async handleCitationForVideo(
    event: StudioEvent<{ projectId: string; count: number }>
  ) {
    PlatformSDK.logger.info('[Video] 收到 GEO 引用事件，更新视频引用信息', {
      projectId: event.payload.projectId,
      citationsCount: event.payload.count
    })

    // 检查关联项目：如果 Video 项目引用了 GEO 项目的知识
    const linkedProjects = await PlatformSDK.project.list({
      metadata: { geoProjectId: event.payload.projectId }
    })

    for (const project of linkedProjects) {
      await PlatformSDK.api.post(`/video/${project.id}/sync-citations`, {
        geoProjectId: event.payload.projectId
      })
    }
  }

  private async handleKnowledgeUpdateForVideo(
    event: StudioEvent<{ projectId: string; domains: string[] }>
  ) {
    // 知识更新后，自动更新关联 Video 项目的知识面板
    // ...
  }
}
```

**跨 Workspace 事件规则：**
1. Workspace A 发布事件后，Workspace B 可以订阅并响应
2. 不允许循环依赖：A → B → A → ... 需要 event loop detection
3. 跨 Workspace 事件必须有明确的 `metadata.source` 标记
4. 跨 Workspace 事件不直接传递业务负载（传递引用 ID，不传递完整数据）

---

## 6. 事件排序保证

| 保证级别 | 说明 | 实现方式 |
|---------|------|----------|
| **At-Least-Once** | 事件至少被投递一次 | 持久化事件存储 + 确认重试机制 |
| **顺序保证** | 同一 partition（projectId）内的事件有序 | 按 partition key 分片，单 partition 顺序投递 |
| **去重** | 同一 eventId 不会被处理两次 | 幂等处理器 + 事件存储去重 |

```typescript
// @studio/platform/event
export interface EventBusConfig {
  /** 分区键字段（默认按 projectId 分区） */
  partitionKey?: (event: StudioEvent) => string

  /** 最大重试次数 */
  maxRetries: number

  /** 重试间隔（ms） */
  retryDelayMs: number

  /** 死信队列配置 */
  deadLetterQueue: {
    enabled: boolean
    maxRetries: number
  }

  /** 排序模式 */
  ordering: 'per-partition' | 'global' | 'none'
}
```

**默认排序策略：**
- 全局使用 `per-partition` 排序，按 `projectId` 分区
- 同一 project 内的事件按发布顺序投递
- 不同 project 的事件可以并行处理
- `global` 模式仅在必要时使用（如系统级事件）

---

## 7. 事件 Schema 演化规则

### 7.1 向后兼容的变更（允许）

| 变更类型 | 说明 |
|---------|------|
| 新增可选字段 | payload 新增 `optionalField?: string` |
| 扩展枚举值 | EventTypes 新增值（不影响已有订阅者） |
| 放宽字段约束 | `string` → `string | null` |
| 新增事件类型 | 不影响已有订阅者 |

### 7.2 不向后兼容的变更（禁止）

| 变更类型 | 说明 |
|---------|------|
| 删除字段 | payload 中删除已有字段 |
| 重命名字段 | fieldName 改名 |
| 改变字段类型 | `string` → `number` |
| 添加必填字段 | 已有 payload 格式中没有新必填字段 |
| 修改事件 type | 修改 `project:created` 为 `project:created:v2`（应创建新事件类型） |

### 7.3 版本化策略

```typescript
// 事件版本管理
interface StudioEvent<T = unknown> {
  version: number  // 当前版本号，从 1 开始
  // ...
}

// 版本升级示例：v1 → v2
// v1: { name: string }
// v2: { name: string; description?: string } ← ✅ 向后兼容

// 如果必须做不兼容变更：
// 1. 创建新事件类型: project:created-v2
// 2. 同时保留旧事件: project:created
// 3. 逐步迁移订阅者
// 4. 待所有订阅者迁移完成后废弃旧事件
```

---

## 8. 错误处理与死信队列

```typescript
// @studio/platform/event
export class EventBusImpl implements EventBus {
  private deadLetterQueue: StudioEvent[] = []
  private errorHandlers: ErrorHandler[] = []

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler)
  }

  private async deliver<T>(
    event: StudioEvent<T>,
    handler: EventHandler<T>,
    retries: number
  ): Promise<void> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await handler(event)
        return
      } catch (error) {
        if (attempt < retries) {
          await delay(this.config.retryDelayMs * Math.pow(2, attempt))
          continue
        }
        // 所有重试失败，进入死信队列
        this.deadLetterQueue.push(event as StudioEvent)
        for (const errorHandler of this.errorHandlers) {
          errorHandler(error as Error, event)
        }
      }
    }
  }
}
```

---

## 9. 验证规则

```
□ Workspace 是否通过 PlatformSDK.event.* 使用事件总线？
□ 是否没有独立的事件通道实现？
□ 事件是否使用 StudioEvent 统一格式？
□ 事件 type 是否遵循 `domain:action` 命名规范？
□ Event / Command / Query 是否正确分离？
□ 跨 Workspace 事件是否有 metadata.source 标记？
□ 事件订阅是否在 Adapter.dispose 中取消？
□ 事件处理是否幂等？（at-least-once 语义需要）
□ 事件 schema 变更是否向后兼容？
```

---

*事件总线是昆仑镜平台实现 Workspace 解耦和异步协作的核心基础设施。正确使用事件总线意味着 Workspace 之间通过事件间接通信，而非直接 API 调用。*
*任何绕过事件总线的跨 Workspace 通信都是架构违规。*
