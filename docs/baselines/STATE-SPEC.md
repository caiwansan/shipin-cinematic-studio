# 昆仑镜 V4 状态规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **范围**: 所有状态由 Platform 层 State Runtime 统一管理

---

## 1. 状态所有权声明

**状态管理属于 Platform 层，且仅属于 Platform 层。**

Workspace 层没有全局状态管理。Workspace 不能管理持久化状态、不能管理跨组件共享的领域状态、不能管理会话状态。

Workspace 只能通过 `PlatformSDK.runtime.state.*` 读取平台管理的状态。对于短暂的 UI 交互状态，可以使用 Pinia Store，但**不能**用于领域数据持久化。

---

## 2. 状态类型分类

昆仑镜平台定义五种状态类型：

| 状态类型 | 作用域 | 持久化 | 说明 |
|---------|--------|--------|------|
| **WorkspaceState** | Workspace 级别 | 是 | Workspace 配置、功能开关、偏好设置 |
| **RuntimeState** | 运行时级别 | 是 | 执行上下文、会话信息 |
| **WorkflowState** | 工作流执行级别 | 是 | DAG 执行进度、节点中间结果 |
| **TaskState** | 任务级别 | 是 | 单个任务的状态（pending/running/completed/failed） |
| **UIState** | 组件级别 | 否（内存） | 弹窗状态、表单输入、滚动位置 |

### 2.1 WorkspaceState

每个 Workspace 的全局配置和运行时偏好：

```typescript
// @studio/platform/runtime/state
export interface WorkspaceState {
  /** Workspace 唯一标识 */
  workspaceId: string

  /** 功能开关 */
  features: Record<string, boolean>

  /** 用户偏好 */
  preferences: {
    theme?: 'light' | 'dark' | 'system'
    language?: string
    notifications?: boolean
    [key: string]: unknown
  }

  /** 上次活跃时间 */
  lastActiveAt: string

  /** Workspace 专属配置 */
  config: Record<string, unknown>
}
```

### 2.2 RuntimeState

当前运行时的上下文信息：

```typescript
export interface RuntimeState {
  /** 运行时实例 ID */
  instanceId: string

  /** 当前用户 */
  currentUserId: string

  /** 当前项目 */
  currentProjectId?: string

  /** 会话列表 */
  activeSessions: Map<string, SessionInfo>

  /** 运行时版本 */
  version: string
}

export interface SessionInfo {
  sessionId: string
  userId: string
  startedAt: string
  lastActivityAt: string
  metadata: Record<string, unknown>
}
```

### 2.3 WorkflowState

工作流执行过程中的中间状态：

```typescript
export interface WorkflowState {
  /** 工作流执行 ID */
  executionId: string

  /** 工作流定义 ID */
  workflowId: string

  /** 当前状态 */
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

  /** 节点执行状态 */
  nodeStates: Map<string, NodeState>

  /** 节点间传递的数据 */
  sharedData: Map<string, unknown>

  /** 重试次数 */
  retryCount: number

  /** 开始/结束时间 */
  startedAt?: string
  completedAt?: string
}

export interface NodeState {
  nodeId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input?: unknown
  output?: unknown
  error?: string
  startedAt?: string
  completedAt?: string
  retries: number
}
```

### 2.4 TaskState

单个任务的执行状态（用于异步操作追踪）：

```typescript
export interface TaskState {
  /** 任务 ID */
  taskId: string

  /** 任务类型 */
  type: string

  /** 关联项目 */
  projectId?: string

  /** 关联工作流执行 */
  executionId?: string

  /** 状态 */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

  /** 进度（0-100） */
  progress: number

  /** 错误信息 */
  error?: {
    code: string
    message: string
    details?: unknown
  }

  /** 开始/结束时间 */
  startedAt?: string
  completedAt?: string

  /** 预计剩余时间（ms） */
  etaMs?: number
}
```

### 2.5 UIState（Workspace 可管理的唯一状态）

```typescript
// 仅用于 Workspace 本地 UI 状态——不会被持久化
export interface UIState {
  /** 当前打开的弹窗 */
  activeModal?: string

  /** 侧边栏折叠状态 */
  sidebarCollapsed: boolean

  /** 当前选中的 tab */
  activeTab?: string

  /** 表单草稿（非持久化） */
  formDraft?: Record<string, unknown>

  /** 列表滚动位置 */
  scrollPosition?: number

  /** 搜索关键词（非持久化，用户关闭页面即丢失） */
  searchQuery?: string
}
```

---

## 3. 状态运行时接口

```typescript
// @studio/platform/runtime/state
export interface StateRuntime {
  // ============ 通用状态操作 ============

  /** 读取状态 */
  getState<T>(
    scope: StateScope,
    key: string
  ): Promise<T | null>

  /** 写入状态 */
  setState<T>(
    scope: StateScope,
    key: string,
    value: T,
    options?: SetStateOptions
  ): Promise<void>

  /** 删除状态 */
  deleteState(
    scope: StateScope,
    key: string
  ): Promise<void>

  /** 监听状态变更 */
  subscribe<T>(
    scope: StateScope,
    key: string,
    callback: (value: T | null, oldValue: T | null) => void
  ): UnsubscribeFn

  // ============ 工作流状态操作 ============

  /** 获取工作流节点状态 */
  getNodeState<T>(
    executionId: string,
    nodeId: string
  ): Promise<NodeState | null>

  /** 更新工作流节点状态 */
  setNodeState(
    executionId: string,
    nodeId: string,
    state: Partial<NodeState>
  ): Promise<void>

  /** 获取工作流共享数据 */
  getSharedData<T>(
    executionId: string,
    key: string
  ): Promise<T | null>

  /** 设置工作流共享数据 */
  setSharedData<T>(
    executionId: string,
    key: string,
    value: T
  ): Promise<void>

  // ============ 任务状态操作 ============

  /** 创建任务 */
  createTask(task: Omit<TaskState, 'startedAt'>): Promise<TaskState>

  /** 更新任务进度 */
  updateTaskProgress(
    taskId: string,
    progress: number,
    meta?: Partial<TaskState>
  ): Promise<void>

  /** 完成任务 */
  completeTask(
    taskId: string,
    result?: unknown
  ): Promise<void>

  /** 标记任务失败 */
  failTask(
    taskId: string,
    error: { code: string; message: string }
  ): Promise<void>
}

// 辅助类型
export type StateScope =
  | { type: 'workspace'; workspaceId: string }
  | { type: 'runtime'; instanceId: string }
  | { type: 'workflow'; executionId: string }
  | { type: 'task'; taskId: string }
  | { type: 'global' }

export interface SetStateOptions {
  /** 状态过期时间 */
  ttlMs?: number

  /** 乐观锁版本号 */
  expectedVersion?: number

  /** 是否广播变更事件 */
  broadcast?: boolean
}

export type UnsubscribeFn = () => void
```

---

## 4. 核心规则：状态由事件派生

**状态不是数据源。事件才是。**

```
┌──────────────┐    发布事件    ┌──────────────┐    投影    ┌──────────────┐
│  业务操作     │ ───────────→  │   Event Bus   │ ────────→ │   State      │
│              │               │               │           │              │
│ 创建项目      │               │ project:created│           │ ProjectState  │
│ 导入资产      │               │ asset:imported │           │ AssetState   │
│ 完成工作流    │               │ workflow:finished│          │ WorkflowState│
└──────────────┘               └──────────────┘           └──────────────┘
```

### 4.1 事件投影规则

```typescript
// 状态由事件投影（projection）生成
// 示例：Project State 由 project:created 和 project:updated 事件投影而来

// 1. 项目创建事件
{
  type: 'project:created',
  payload: { projectId: 'proj-1', name: '项目A', type: 'geo' },
  eventId: 'evt-001',
  version: 1
}

// 2. 事件投影到状态
// StateRuntime 自动维护投影:
// project:proj-1 = {
//   name: '项目A',
//   type: 'geo',
//   status: 'active',
//   createdAt: '2026-07-18T10:00:00Z',
//   version: 1
// }

// 3. 项目更新事件
{
  type: 'project:updated',
  payload: { projectId: 'proj-1', name: '项目A-更新版' },
  eventId: 'evt-002',
  version: 1
}

// 4. 投影更新:
// project:proj-1 = {
//   name: '项目A-更新版',
//   type: 'geo',
//   status: 'active',
//   createdAt: '2026-07-18T10:00:00Z',
//   updatedAt: '2026-07-18T11:00:00Z',
//   version: 1
// }
```

### 4.2 为什么状态必须由事件派生？

| 原因 | 说明 |
|------|------|
| **可追溯性** | 每次状态变更都可以追溯到触发事件 |
| **时间旅行** | 可以通过重放事件重建任意时间点的状态 |
| **一致性** | 所有状态消费方看到的是同一个事实版本 |
| **恢复能力** | 崩溃后重放事件即可恢复状态 |
| **审计** | 完整的变更日志 |

### 4.3 禁止直接修改状态

```typescript
// ❌ 违规：直接修改状态
await PlatformSDK.runtime.state.setState(
  { type: 'workspace', workspaceId: 'geo' },
  'project:proj-1',
  { name: '新名称' }
)

// ✅ 正确：通过发布事件来改变状态
await PlatformSDK.event.publish({
  type: 'project:updated',
  payload: { projectId: 'proj-1', name: '新名称' },
  metadata: { source: 'geo' },
  timestamp: new Date().toISOString(),
  traceId: 'trace-xxx',
  eventId: 'evt-003',
  version: 1
})
// 事件总线自动触发投影更新 State
```

---

## 5. 状态持久化与恢复

### 5.1 持久化策略

| 状态类型 | 存储后端 | TTL | 说明 |
|---------|---------|-----|------|
| WorkspaceState | Redis + DB | 永久 | 配置变更即时持久化 |
| RuntimeState | Redis | 24h | 会话过期自动清理 |
| WorkflowState | Redis + DB | 7 天 | 工作流完成后保留 7 天 |
| TaskState | Redis | 48h | 任务完成后保留 48 小时 |
| UIState | 内存 | 页面生命周期 | 页面关闭即丢失 |

### 5.2 崩溃恢复流程

```typescript
// @studio/platform/runtime/state/recovery
export class StateRecovery {
  async recoverAfterCrash(): Promise<void> {
    // 1. 从持久化存储加载 checkpoint
    const checkpoint = await this.loadLastCheckpoint()

    // 2. 从 checkpoint 之后的事件开始重放
    const eventsSinceCheckpoint = await this.eventStore.getEventsSince(
      checkpoint.lastEventId
    )

    // 3. 重建状态
    for (const event of eventsSinceCheckpoint) {
      await this.applyEventToState(event)
    }

    // 4. 检查不一致性
    const inconsistencies = await this.findInconsistencies()
    if (inconsistencies.length > 0) {
      await this.repairInconsistencies(inconsistencies)
    }

    // 5. 标记恢复完成
    await this.markRecoveryComplete()
  }

  private async applyEventToState(event: StudioEvent): Promise<void> {
    // 根据事件类型更新对应的状态投影
    switch (event.type) {
      case 'project:created':
        await this.stateRuntime.setState(
          { type: 'workspace', workspaceId: event.payload.type },
          `project:${event.payload.projectId}`,
          {
            ...event.payload,
            createdAt: event.timestamp,
            version: event.version
          }
        )
        break
      // ... 其他事件类型
    }
  }
}
```

---

## 6. Workspace 访问状态

Workspace 只读状态，从不管理全局状态：

```typescript
// workspace/geo/adapter/GEOWorkspaceAdapter.ts
import { PlatformSDK } from '@studio/platform'

export class GEOWorkspaceAdapter implements WorkspaceAdapter {
  async execute(action: string, input: unknown, ctx: WorkspaceContext) {
    // ✅ 正确：通过 Platform SDK 读取状态
    const projectState = await PlatformSDK.runtime.state.getState(
      { type: 'workspace', workspaceId: 'geo' },
      `project:${ctx.projectId}`
    )

    // ✅ 正确：通过 Platform SDK 读取工作流状态
    const workflowState = await PlatformSDK.runtime.state.getState(
      { type: 'workflow', executionId: input.executionId },
      'progress'
    )

    // 业务逻辑...
  }
}
```

---

## 7. Pinia/Vuex 使用限制

### 7.1 允许的 Pinia Store（仅限 UI 编排状态）

```typescript
// ✅ 正确：Pinia Store 仅用于临时 UI 状态
// workspace/geo/stores/useGeoStore.ts
import { defineStore } from 'pinia'
import { PlatformSDK } from '@studio/platform'

interface GeoUIState {
  // ✅ UI 状态：不持久化，不影响业务逻辑
  activeModal: string | null
  sidebarCollapsed: boolean
  searchQuery: string
  currentTab: string

  // ✅ 缓存数据（从 PlatformSDK 读取，Store 只是本地绑定的缓存）
  cachedProjectList: ProjectBrief[]
  lastFetchAt: number | null
}

export const useGeoStore = defineStore('geo', {
  state: (): GeoUIState => ({
    activeModal: null,
    sidebarCollapsed: false,
    searchQuery: '',
    currentTab: 'dashboard',
    cachedProjectList: [],
    lastFetchAt: null
  }),

  actions: {
    async refreshProjects() {
      // ✅ 正确：通过 Platform SDK 获取数据，而不是直接 fetch
      const projects = await PlatformSDK.api.get('/geo/projects')
      this.cachedProjectList = projects.data
      this.lastFetchAt = Date.now()
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    }
  }
})
```

### 7.2 禁止的 Pinia Store 模式

```typescript
// ❌ 违规：Pinia Store 用于持久化领域状态
export const useProjectStore = defineStore('project', {
  state: () => ({
    // ❌ 领域数据不应该在 Pinia 中持久化
    projects: [] as Project[],
    currentProject: null as Project | null,
    claims: [] as KnowledgeClaim[],
    evidences: [] as KnowledgeEvidence[]
  }),

  actions: {
    // ❌ 违规：Store 直接调用 API
    async fetchProjects() {
      const res = await fetch('/api/geo/projects')  // ❌ 直接 fetch
      this.projects = await res.json()
    },

    // ❌ 违规：Store 保存领域状态（应该从 StateRuntime 读取）
    async saveClaim(claim: KnowledgeClaim) {
      this.claims.push(claim)  // ❌ 状态应该在服务端持久化
    }
  }
})
```

### 7.3 Pinia 限制清单

| 禁止 | 原因 | 替代方案 |
|------|------|----------|
| 在 Pinia 中持久化领域数据 | 状态应在 Platform State Runtime 管理 | 通过 `PlatformSDK.runtime.state.*` 读取 |
| Pinia 中直接 fetch/axios | 违反 SDK 规范 | 在 Service 中通过 `PlatformSDK.api.*` 调用 |
| Pinia 状态作为数据源 | 事件才是数据源 | 从 StateRuntime 读取，Pinia 仅做本地缓存 |
| 跨组件共享领域状态 | 全局状态应由 StateRuntime 管理 | 订阅 StateRuntime 变更事件 |
| Pinia 中有复杂的业务逻辑 | 业务逻辑应在 Service 层 | 在 Service 中封装，Store 仅调用 |

---

## 8. 验证规则

```
□ 状态是否遵循"事件派生状态"原则？
□ 状态是否通过 PlatformSDK.runtime.state 访问？
□ Workspace 是否只读状态，不管理全局状态？
□ Pinia Store 是否仅用于 UI 编排状态？
□ Pinia Store 是否不包含领域数据的持久化？
□ 是否没有独立的状态管理实现？
□ 崩溃后状态是否能通过事件重放恢复？
□ 状态变更是否都对应一个事件？
```

---

*状态规范确保昆仑镜平台的数据一致性。状态由事件派生意味着每次状态变更都是可追溯、可审计、可恢复的。*
*任何绕过 State Runtime 直接管理状态的行为都是架构违规。*
