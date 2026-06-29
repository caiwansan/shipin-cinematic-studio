# 昆仑镜 V4 Workspace 规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **强制范围**: 所有 Workspace（GEO / Video / Novel / PPT / Music / Image）

---

## 1. Workspace 定义

Workspace 是昆仑镜平台上的**一种工作空间类型**，代表一套业务用例的 UI + Adapter + 轻量 Service 组合。

Workspace **不是**：
- 不是独立应用
- 不是运行时载体
- 不是数据拥有者
- 不是 Provider 调用者

Workspace **是**：
- 业务 UI 的载体
- Platform SDK 的消费者
- DAG 配置的提供者
- 领域能力的编排者

---

## 2. 规范目录结构

所有 Workspace 必须遵循以下目录结构，不允许出现自定义顶层目录。

### 2.1 容器目录

```
workspace/
├── geo/           # GEO Workspace（原 brand-geo/ + modules/geo/）
├── video/         # Video Workspace（未来）
├── novel/         # Novel Workspace（未来）
├── ppt/           # PPT Workspace（未来）
├── music/         # Music Workspace（未来）
└── image/         # Image Workspace（未来）
```

### 2.2 Workspace 内部结构

每个 Workspace 的内部结构严格统一：

```
workspace/<name>/
├── adapter/           # WorkspaceAdapter 实现（核心契约）
│   └── <Name>WorkspaceAdapter.ts
│
├── pages/             # 页面级组件（路由对应）
│   ├── DashboardPage.vue
│   ├── ProjectListPage.vue
│   └── ...
│
├── components/        # 通用业务组件（被 pages/ 引用）
│   ├── <Name>Sidebar.vue
│   ├── <Name>Dashboard.vue
│   └── ...
│
├── services/          # 业务服务层（通过 Platform SDK 调用）
│   └── <name>Service.ts
│
├── stores/            # Pinia Store（状态编排，非持久化）
│   └── use<Name>Store.ts
│
├── types/             # 业务类型定义
│   └── index.ts
│
├── README.md          # Workspace 说明
└── workspace.json     # Workspace 元数据（名称、版本、入口）
```

### 2.3 文件命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| 目录名 | 全小写 | `geo`, `video` |
| Adapter 文件 | `<Name>WorkspaceAdapter.ts` | `GEOWorkspaceAdapter.ts` |
| 页面组件 | PascalCase, 无前缀 | `DashboardPage.vue` |
| 通用组件 | PascalCase | `GeoDashboard.vue`, `FlowPipeline.vue` |
| Service 文件 | `<name>Service.ts` | `geoService.ts` |
| Store 文件 | `use<Name>Store.ts` | `useGeoStore.ts` |
| 类型文件 | `index.ts` | `types/index.ts` |

---

## 3. WorkspaceAdapter 接口契约

每个 Workspace 必须实现且**只能实现一个** `WorkspaceAdapter`。这是 Workspace 与 Platform 交互的唯一入口。

```typescript
// @studio/platform/workspace → 平台定义
export interface WorkspaceAdapter {
  /** Workspace 唯一标识 */
  readonly id: string

  /** 注册 Workspace：初始化资源、注册 DAG、注册事件监听 */
  register(ctx: WorkspaceContext): Promise<void>

  /** 执行 Workspace 的业务逻辑入口 */
  execute<TInput = unknown, TOutput = unknown>(
    action: string,
    input: TInput,
    ctx: WorkspaceContext
  ): Promise<TOutput>

  /** 销毁 Workspace：释放资源、注销监听 */
  dispose(): Promise<void>
}
```

### 3.1 Adapter 实现示例

```typescript
// workspace/geo/adapter/GEOWorkspaceAdapter.ts
import { WorkspaceAdapter, WorkspaceContext } from '@studio/platform/workspace'
import { PlatformSDK } from '@studio/platform/sdk'

export class GEOWorkspaceAdapter implements WorkspaceAdapter {
  readonly id = 'geo'

  async register(ctx: WorkspaceContext): Promise<void> {
    // ✅ 正确：通过 Platform SDK 注册 DAG
    await PlatformSDK.workflow.registerDAG({
      id: 'geo.knowledge-quality',
      nodes: [
        { id: 'claim', agent: 'knowledge-claim', dependsOn: [] },
        { id: 'evidence', agent: 'knowledge-evidence', dependsOn: ['claim'] },
        { id: 'citation', agent: 'knowledge-citation', dependsOn: ['evidence'] },
        { id: 'faq', agent: 'knowledge-faq', dependsOn: ['claim'] },
        { id: 'schema', agent: 'knowledge-schema', dependsOn: ['faq'] },
      ]
    })

    // ✅ 正确：通过 Platform SDK 注册事件监听
    await PlatformSDK.event.subscribe('project:created', this.handleProjectCreated)

    console.log('[GEO] Workspace registered')
  }

  async execute<TInput, TOutput>(
    action: string,
    input: TInput,
    ctx: WorkspaceContext
  ): Promise<TOutput> {
    switch (action) {
      case 'analyze-brand':
        return this.analyzeBrand(input as AnalyzeBrandInput, ctx) as TOutput
      case 'run-quality-check':
        return PlatformSDK.workflow.trigger('geo.knowledge-quality', input) as TOutput
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  async dispose(): Promise<void> {
    await PlatformSDK.event.unsubscribe('project:created', this.handleProjectCreated)
    console.log('[GEO] Workspace disposed')
  }

  private async analyzeBrand(input: AnalyzeBrandInput, ctx: WorkspaceContext) {
    // ✅ 正确：通过 Platform SDK 调用 API
    const project = await PlatformSDK.project.getById(input.projectId)
    const result = await PlatformSDK.api.post('/geo/brand/analyze', {
      projectId: project.id,
      url: input.url
    })
    return result
  }
}
```

### 3.2 WorkspaceContext 接口

```typescript
// @studio/platform/workspace
export interface WorkspaceContext {
  userId: string
  projectId?: string
  membership: {
    tier: 'free' | 'pro' | 'enterprise'
    features: string[]
  }
  sessionId: string
  metadata: Record<string, unknown>
}
```

---

## 4. 各目录职责

### 4.1 `adapter/` — WorkspaceAdapter 实现

- **必须包含** 1 个 Adapter 实现文件
- **职责**: 连接 Workspace 业务逻辑与 Platform 层
- **禁止**: 包含 Runtime、Auth、Prisma import、fetch 调用

### 4.2 `pages/` — 页面组件

- **必须**: 与路由系统对应
- **职责**: 布局、组合 components/ 中的组件
- **禁止**: 直接 API 调用、数据持久化逻辑

### 4.3 `components/` — 通用业务组件

- **必须**: 不包含页面级布局逻辑
- **职责**: 可复用的 UI 组件
- **允许**: 调用 services/ 中的方法
- **禁止**: 直接 `fetch()`、`import prisma`

### 4.4 `services/` — 业务服务层

- **必须**: 所有 API 调用通过 `PlatformSDK.api`
- **职责**: 封装业务逻辑、编排 API 调用
- **允许**: 调用 PlatformSDK 各模块
- **禁止**: 直接 `fetch()`, `axios()`, `prisma`

### 4.5 `stores/` — Pinia Store

- **必须**: 仅做前端状态编排
- **禁止**: 数据持久化、直接 API 调用（通过 services/ 间接调用）
- **命名**: `use<Name>Store`

### 4.6 `types/` — 类型定义

- **必须**: 仅包含业务层类型
- **禁止**: 数据库模型类型（由 Platform SDK 提供）
- **允许**: UI 状态类型、DTO 类型、枚举

---

## 5. Workspace 能做 vs 不能做的完全列表

### ✅ 能做

| 操作 | 方式 |
|------|------|
| 定义业务 UI 组件 | Vue SFC 组件 |
| 实现 Adapter 接口 | `extends/implements WorkspaceAdapter` |
| 调用平台 API | `PlatformSDK.api.get/post/put/delete` |
| 定义 DAG 配置 | `PlatformSDK.workflow.registerDAG()` |
| 调用工作流 | `PlatformSDK.workflow.trigger()` |
| 管理项目（业务上下文内） | `PlatformSDK.project.*` |
| 上传/下载资产 | `PlatformSDK.asset.*` |
| 存储业务文件 | `PlatformSDK.storage.*` |
| 发布事件 | `PlatformSDK.event.emit()` |
| 订阅事件 | `PlatformSDK.event.subscribe()` |
| 记录日志 | `PlatformSDK.logger.*` |
| 数据访问（通过 Repository） | `PlatformSDK.repository.*` |
| 调用能力 | `PlatformSDK.capability.invoke()` |

### ❌ 不能做

| 操作 | 原因 | 正确做法 |
|------|------|----------|
| 实现 Runtime | 运行时属于平台 | 实现 WorkspaceAdapter |
| 认证鉴权 | 安全基础设施 | `PlatformSDK.auth.verify()` |
| 直接查询数据库 | 破坏封装 | `PlatformSDK.repository.*` |
| 直接 HTTP 请求 | 无法追踪 | `PlatformSDK.api.*` |
| 自行注册 Agent | 管理混乱 | `PlatformSDK.capability.registerAgent()` |
| 自行实现工作流引擎 | 重复造轮 | `PlatformSDK.workflow.registerDAG()` |
| 独立项目表 | 数据孤岛 | `Project.type = 'geo'` |
| 硬编码 Provider | 无法切换 | 通过 Capability Runtime 调用 |
| 自行实现 mapPrisma | 重复代码 | 使用 `BaseRepository` 基类 |

---

## 6. 过渡规则

### 6.1 遗留 Workspace 重命名映射

| 旧路径 | 新路径 | 操作 |
|--------|--------|------|
| `workspace/brand-geo/` | `workspace/geo/` | **移动目录** |
| `modules/geo/` | 删除（合并至 `workspace/geo/`） | **删除死代码** |
| `studio-v2/workspace/*`（Video） | `workspace/video/` | **后续迁移** |

### 6.2 文件重命名映射

| 旧文件 | 新文件 | 操作 |
|--------|--------|------|
| `BrandGEOWorkspace.vue` | `GEOWorkspace.vue` | 组件重命名 |
| `BrandGEOSidebar.vue` | `components/GEOSidebar.vue` | 组件重命名 |
| `useBrandGEORuntime.ts` | **删除**（迁移到 Adapter） | 删除独立 Runtime |
| `useBrandGeoStore.ts` | `stores/useGeoStore.ts` | Store 重命名 |
| `brandService.ts` | **删除**（合并到 geoService.ts） | 删除独立 Service |
| `citationService.ts` | **删除**（合并到 geoService.ts） | 合并 |
| `projectService.ts` | **删除**（合并到 geoService.ts） | 合并 |
| `visibilityService.ts` | **删除**（合并到 geoService.ts） | 合并 |
| `competitorService.ts` | **删除**（合并到 geoService.ts） | 合并 |
| `geo.runtime.ts` (KMKI) | **删除**（迁移到 Adapter） | 删除独立 Runtime |
| `useGEOStore.ts` (KMKI) | **删除**（被 useGeoStore.ts 替代） | 删除重复 Store |
| `geo.service.ts` (KMKI) | **合并**到 geoService.ts | 合并 |

### 6.3 过渡执行时间表

```
C0 架构冻结: 本规范定稿
  ↓
C1 架构实施:
  1. 创建 workspace/geo/ 目录
  2. 移动 Brand GEO 文件到 workspace/geo/
  3. 创建 GEOWorkspaceAdapter
  4. 重命名组件/Store/Service
  ↓
C2 平台集成:
  1. 合并 KMKI 前端组件到 workspace/geo/
  2. 统一 API 客户端到 geoService.ts
  3. 删除 brand-geo/ 目录
  4. 删除 modules/geo/ 目录
  ↓
C3 工程清理:
  1. 最终目录对齐
  2. 删除废弃文件
  3. 确认所有 Workspace 符合本规范
```

---

## 7. 常见违规场景（及修正方案）

### 场景 1：Service 直接 import prisma

```typescript
// ❌ 违规
import { prisma } from '@/lib/prisma'
const projects = await prisma.geoProject.findMany()

// ✅ 正确
import { PlatformSDK } from '@studio/platform/sdk'
const projects = await PlatformSDK.repository.geoProject.findMany()
```

### 场景 2：页面组件直接 fetch

```vue
<script setup lang="ts">
// ❌ 违规
const res = await fetch('/api/geo/projects')
const data = await res.json()

// ✅ 正确
import { PlatformSDK } from '@studio/platform/sdk'
const data = await PlatformSDK.api.get('/geo/projects')
</script>
```

### 场景 3：Workspace 包含独立 Runtime

```typescript
// ❌ 违规 — 删除此文件
export class GEORuntime {
  executeWorkflow() { ... }
  manageState() { ... }
}

// ✅ 正确 — 实现在 Adapter 中
export class GEOWorkspaceAdapter implements WorkspaceAdapter {
  async execute(action, input, ctx) {
    // 通过 PlatformSDK 调用平台 Runtime
  }
}
```

### 场景 4：使用 Geo* 数据模型名

```typescript
// ❌ 违规
interface GeoClaim { ... }
interface GeoEvidence { ... }

// ✅ 正确
interface KnowledgeClaim { ... }
interface KnowledgeEvidence { ... }
```

---

*本规范由产品架构师（熊大）审定。任何偏差需在架构评审会上提出并获批准。*
*对规范的修改需要: (1) 更新此文档 (2) 更新 CI 检查规则 (3) 通知所有 Workspace 开发者。*
