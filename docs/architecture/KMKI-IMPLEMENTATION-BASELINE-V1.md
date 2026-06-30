# KMKI Implementation Baseline v1.0

> **冻结日期**: 2025-07-16  
> **状态**: 已冻结  
> **适用范围**: 所有 `shipin-cinematic-studio` 代码提交  
> **执行检查**: `bash scripts/architecture-linter.sh`  
> **违反后果**: PR 不合并，直到修复

---

## 目录

- [1. 总则](#1-总则)
- [2. 目录结构规范](#2-目录结构规范)
- [3. 命名规范](#3-命名规范)
- [4. Backend Service 规范](#4-backend-service-规范)
- [5. Backend Repository 规范](#5-backend-repository-规范)
- [6. Backend Route 规范](#6-backend-route-规范)
- [7. Frontend Store 规范](#7-frontend-store-规范)
- [8. Frontend Component 规范](#8-frontend-component-规范)
- [9. Frontend Page 规范](#9-frontend-page-规范)
- [10. Workspace 规范](#10-workspace-规范)
- [11. Registry 模板](#11-registry-模板)
- [12. 测试规范](#12-测试规范)
- [13. Prisma 数据模型规范](#13-prisma-数据模型规范)
- [14. 实施检查清单](#14-实施检查清单)

---

## 1. 总则

1. **Baseline 是 Constitution + Blueprint 的工程落地补充**，不新增原则，只定义"代码应该怎么写"。
2. **现有代码风格优先**。本 Baseline 已根据项目实际代码（2025-07-16 扫描）调整，新代码须与此一致。如 Baseline 与已有代码冲突，以已有代码为准并更新 Baseline。
3. **一切以可执行为目标**，所有规则必须有自动化检查或可人工逐条检查。
4. **各模板为强制性最低标准**，可扩展不可缩减。

---

## 2. 目录结构规范

### 2.1 Frontend

```
frontend/
  pages/                    ← Nuxt 页面路由（仅入口，不写业务逻辑）
    workspace/
      geo.vue               ← 仅 <WorkspaceComponent />
    studio/
      index.vue              ← 仅入口组件
    admin/
    user/
    ...
  layouts/                  ← 平台 Layout
    platform-layout.vue      ← 唯一布局（其余废弃）
    default.vue              ← 标准布局
  components/
    kmki-ui/                 ← Design System 组件（每个组件一个目录）
      Badge/
        index.vue
        README.md
      Card/
        index.vue
      ...
    workspace/               ← 跨 WorkSpace 可复用组件
    [workspace]/             ← 工作台特有组件（如 geo/, studio/）
  modules/                   ← 功能模块（可独立路由）
    [module]/
      components/
      pages/
      composables/
      stores/
      index.ts
  composables/               ← 跨模块共享逻辑
    use[Name].ts
  stores/                    ← Pinia Store
    auth.ts
    projectStore.ts
    geoStore.ts
    [workspace].ts
  utils/                     ← 工具函数
    token-cache.ts
    auth-fetch.ts
    featureFlags.ts
    ...
  types/                     ← 全局类型定义
  plugins/                   ← Nuxt 插件
  middleware/                ← Nuxt 中间件
  server/                    ← 同构 API 调用（如需要）
```

### 2.2 Backend

```
backend/
  src/
    platform/                 ← 平台层（Repository / EventBus / StateMachine / Version Registry）
    capabilities/             ← Capability OS（每个 Capability 一个目录）
    services/                 ← 服务层
      [domain]/               ← 每个服务一个目录
        routes/               ← Route（只做验证和委派）
          [name].route.ts
          index.ts
        repositories/         ← Repository（数据访问层）
          [name].repository.ts
          index.ts
        service.ts            ← 业务逻辑（导出函数）
        types.ts              ← 领域类型定义
        index.ts              ← 导出
    plugins/                  ← Fastify 插件
      auth.ts
      cors.ts
      runtime-context.ts
    utils/                    ← 工具函数
    types/                    ← 全局类型定义
    events/                   ← 事件定义
  prisma/
    schema.prisma             ← 数据模型
  test/                       ← 测试（与 src/ 同构）
  __tests__/                  ← 集成测试（各模块内）
```

> **重要**: 现有代码中 Repository 位于 `services/[domain]/repositories/` 目录，而非 `services/[domain]/repository.ts` 单文件。Route 位于 `services/[domain]/routes/` 目录。

---

## 3. 命名规范

| 类别 | 规范 | 示例 |
|---|---|---|
| 文件 | kebab-case | `workspace-registry.ts`, `geo-brand.route.ts` |
| 目录 | kebab-case | `repositories/`, `kmki-ui/` |
| 类 | PascalCase | `WorkspaceRegistry`, `ExecutionEngine` |
| 接口/类型 | PascalCase | `ScoreExplainability`, `ProjectCharacter`, `ReviewState` |
| 枚举 | PascalCase（值用 kebab-case） | `ReviewState { Draft = 'draft' }` |
| 变量 | camelCase | `projectId`, `brandProfiles` |
| 函数 | camelCase | `calculateScore()`, `makeDetail()` |
| 常量 | UPPER_SNAKE_CASE | `PROJECT_TYPE_LABELS`, `MAX_RETRY_COUNT` |
| Vue 组件 | PascalCase | `GeoWorkspace.vue`, `Badge.vue` |
| 组件 Props | camelCase | `workspaceId`, `modelValue` |
| 组件 Events | kebab-case | `'update:modelValue'`, `'workspace-change'` |
| Store | `use[Name]Store` | `useAuthStore`, `useProjectStore` |
| Composable | `use[Name]` | `useTheme`, `useSSEStream` |
| API Routes | kebab-case | `/api/geo/brand-analysis` |
| Prisma Model | PascalCase | `Project`, `GeoBrandProfile` |
| Prisma Column | camelCase | `projectId`, `createdAt`, `memberTier` |
| Prisma `@@map` | snake_case | `@@map("geo_brand_profile")` |

> **注意**: 现有代码中 `interfaces` 不使用 `I` 前缀（如 `ScoreExplainability` 而非 `IScoreExplainability`），新代码保持一致。Store 文件命名允许 `projectStore.ts`（为保持与项目现有一致）或 `geo.ts`，但推荐现有 `[name]Store.ts` 风格。

---

## 4. Backend Service 规范

### 4.1 结构

Service 导出**独立的函数**（非类方法），与现有 `recommendation-score.service.ts` 风格一致：

```typescript
// backend/src/services/[domain]/service.ts
// ============================================================
// [Service Name] — [Sprint/Version]
// ============================================================

import { prisma } from '../../../utils/index.js'

// ── Types ──

export interface ServiceResult {
  id: string
  // ...
}

// ── Public Functions ──

export async function findById(id: string): Promise<ServiceResult | null> {
  const record = await prisma.someModel.findUnique({ where: { id } })
  if (!record) return null
  return toDTO(record)
}

export async function create(data: CreateInput): Promise<ServiceResult> {
  const record = await prisma.someModel.create({ data })
  return toDTO(record)
}

// ── Internal Helpers ──

function toDTO(record: any): ServiceResult {
  return {
    id: record.id,
    // 字段映射
  }
}
```

### 4.2 规则

1. **导出独立函数**，不要导出类（除非有明确的实例化需求，如 Registry）
2. **所有数据访问必须通过 Repository**，不得直接引用 `prisma` — 见第 5 节
3. **每个 Service 文件不超过 400 行**，超过时按领域拆分子模块
4. **禁止在 Service 中处理 HTTP 响应**（那属于 Route 层的职责）
5. **DTO 转换函数统一命名为 `toDTO`**，保持私有
6. **文件头必须有 Sprint/Version 注释**

### 4.3 现有参考

```typescript
// 当前项目实际风格（recommendation-score.service.ts）：
export async function calculateScore(
  projectId: string,
  virtual?: ScoreVirtualOverrides
): Promise<ScoreExplainability> {
  const [brandProfiles, knowledgeCount, entities, scans, settings] = await Promise.all([
    prisma.geoBrandProfile.count({ where: { projectId } }),
    // ...
  ])
  // ...
}
```

---

## 5. Backend Repository 规范

### 5.1 结构

Repository 导出**对象字面量**（非类），与现有 `geo-claim.repository.ts` 风格一致：

```typescript
// backend/src/services/[domain]/repositories/[name].repository.ts
// ============================================================
// [Name] Repository — [Sprint]
// ============================================================

import { prisma } from '../../../utils/index'
import type { DomainType } from '../types'

function toDTO(c: any): DomainType {
  return {
    id: c.id,
    // 字段映射 + 类型转换
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    // JSON 字段处理
    metadata: typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata,
  }
}

export const [name]Repository = {
  async create(data: CreateInput): Promise<DomainType> {
    const record = await prisma.someModel.create({ data })
    return toDTO(record)
  },

  async findById(id: string): Promise<DomainType | null> {
    const record = await prisma.someModel.findUnique({ where: { id } })
    if (!record) return null
    return toDTO(record)
  },

  async findMany(filter?: Partial<FilterType>): Promise<DomainType[]> {
    const records = await prisma.someModel.findMany({ where: filter })
    return records.map(toDTO)
  },

  async update(id: string, data: UpdateInput): Promise<DomainType> {
    const record = await prisma.someModel.update({ where: { id }, data })
    return toDTO(record)
  },

  async delete(id: string): Promise<void> {
    await prisma.someModel.delete({ where: { id } })
  },
}
```

### 5.2 规则

1. **所有数据访问必须通过 Repository** — Service 层不得直接引用 `prisma`
2. **`toDTO` 负责所有类型转换**（Date→ISO string, JSON parse, 默认值）
3. **Repository 不处理业务逻辑**，只做 CRUD + 简单过滤
4. **Repository 不抛出业务异常**，返回 `null` 表示不存在
5. **每个 Model 对应一个 Repository 文件**，以 domain 聚合而非 Model 粒度

### 5.3 现有参考

```typescript
// 当前项目实际风格（geo-claim.repository.ts）：
export const geoClaimRepository = {
  async create(data: { entityId: string; text: string; /* ... */ }): Promise<Claim> {
    const record = await prisma.geoClaim.create({ data })
    return mapPrismaClaim(record)
  },
  // ...
}
```

---

## 6. Backend Route 规范

### 6.1 结构

Route 导出**函数**，使用 `FastifyInstance` 注册路由：

```typescript
// backend/src/services/[domain]/routes/[name].route.ts
// ============================================================
// [Name] Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import * as service from '../service.js'

// ── Request Types ──

interface CreateBody {
  name: string
  // ...
}

// ── Route Registration ──

export async function [name]Routes(app: FastifyInstance) {
  // GET /api/[domain]/:id
  app.get('/api/[domain]/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await service.findById(id)
    if (!result) return reply.code(404).send({ error: 'Not found' })
    return { data: result }
  })

  // POST /api/[domain]
  app.post('/api/[domain]', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const data = request.body as CreateBody
    const result = await service.create(data)
    return reply.code(201).send({ data: result })
  })
}
```

### 6.2 规则

1. **Route 零业务逻辑** — 只做：参数验证 → 调用 Service → 返回响应
2. **所有请求体类型定义为 `interface`**，放在 Route 文件顶部
3. **认证通过 `app.authenticate` preHandler 统一处理**
4. **响应格式统一为 `{ data: ... }`**，错误格式统一为 `{ error: '...' }`
5. **404 在 Route 层处理**（Service 返回 null 时），业务异常由全局 error handler 处理
6. **每个 `/api/[domain]` 资源对应一个 Route 文件**，方法按 HTTP 动词区分

> **警告**: 当前项目部分 Route 文件中存在内联业务逻辑（如 `geo-brand.route.ts` 中包含 `getUserMembership` 和 `getBrandQuotaLimit`），新代码必须严格将业务逻辑移至 Service 层。已有代码逐步重构，不在此 Baseline 强制范围。

---

## 7. Frontend Store 规范

### 7.1 双风格并存

现有代码中存在两种 Store 风格，**新代码优先采用 Composition API 风格**，但 Options API 风格仍允许（用于与现有代码保持一致）：

#### 风格 A：Composition API（推荐）

```typescript
// frontend/stores/[name].ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const use[Name]Store = defineStore('[name]', () => {
  // ── State ──
  const loading = ref(false)
  const error = ref<string | null>(null)
  const items = ref<any[]>([])

  // ── Getters ──
  const isEmpty = computed(() => items.value.length === 0)
  const hasError = computed(() => error.value !== null)

  // ── Actions ──
  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const response = await fetch('/api/some')
      items.value = await response.json()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { loading, error, items, isEmpty, hasError, fetch }
})
```

#### 风格 B：Options API（与现有 `auth.ts` 保持一致）

```typescript
// frontend/stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    user: null as null | { id: string; username: string; email: string },
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    userName: (state) => state.user?.username || '用户',
  },
  actions: {
    async login(email: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || err.message || '登录失败')
      }
      const data = await res.json()
      this.token = data.accessToken || data.token
      this.user = data.user || null
    },
  },
})
```

### 7.2 规则

1. **每个 Workspace 一个 Store**，命名 `use[Workspace]Store`
2. **Store 职责单一** — 一个 Store 对应一个领域聚合，不要跨领域混合
3. **所有异步操作必须有 try/catch**，错误设置到 `error` 状态
4. **Getters 只做派生计算**，不要有副作用
5. **Store 中的业务逻辑保持最薄** — 复杂计算应抽取到 utils 或 composables

---

## 8. Frontend Component 规范

### 8.1 结构

使用 `<script setup>` + TypeScript，与现有 Badge 组件风格一致：

```vue
<!-- frontend/components/kmki-ui/ComponentName/index.vue -->
<script setup lang="ts">
interface Props {
  // 组件 Props
  modelValue?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'click': [event: MouseEvent]
}>()

// 现有项目风格：使用 computed 映射 className
const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'bg-blue-500 text-white',
    secondary: 'bg-gray-100 text-gray-700',
    ghost: 'bg-transparent text-gray-500',
  }
  return map[props.variant]
})
</script>

<template>
  <button
    class="kmki-component-name inline-flex items-center justify-center rounded-lg font-medium transition-colors"
    :class="[variantClass, { 'opacity-50 cursor-not-allowed': disabled }]"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
```

### 8.2 规则

1. **每个组件一个目录**（`ComponentName/index.vue`），含类型导出可在 `index.ts`
2. **Props 使用 `interface Props`** 声明，使用 `withDefaults(defineProps<Props>(), {...})` 设置默认值
3. **Emits 使用泛型 `defineEmits<{...}>()`**，不要使用字面量数组形式
4. **Tailwind 类名优先**，仅在需要动态绑定时使用 computed 映射
5. **Design Token 变量**（如 `--kmki-spacing-4`）在平台级样式使用，组件内优先 Tailwind
6. **暗色主题**通过 `class` 绑定实现（不需要显式 `isDark` prop）
7. **SSR 安全** — 客户端特定逻辑放在 `onMounted` 中

### 8.3 现有参考

```typescript
// 当前项目实际风格（Badge/index.vue）：
const props = withDefaults(defineProps<{
  label: string
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'
  size?: 'sm' | 'md'
}>(), {
  color: 'gray',
  size: 'sm',
})

const classMap: Record<string, Record<string, string>> = {
  sm: { green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200', /* ... */ },
  md: { /* ... */ },
}
const sizeClass = computed(() => props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm')
```

---

## 9. Frontend Page 规范

### 9.1 结构

Page 只做两件事：加载 Store + 渲染组件，不写业务逻辑：

```vue
<!-- frontend/pages/[workspace]/[page].vue -->
<script setup lang="ts">
import { useWorkspaceStore } from '~/stores/workspaceStore'

const store = useWorkspaceStore()

// 页面只做初始化，不写逻辑
onMounted(() => {
  store.fetch()
})
</script>

<template>
  <WorkspaceComponent />
</template>
```

### 9.2 规则

1. **Page 文件不超过 50 行** — 超过说明有业务逻辑侵入
2. **不直接在 Page 中写 API 调用** — 全部委派给 Store
3. **不直接在 Page 中写样式** — 全部在组件中
4. **Page 仅作为路由入口**，布局和内容全部由组件承载

---

## 10. Workspace 规范

### 10.1 目录结构

新工作台的目录结构（基于 Blueprint Ch11）：

```
workspaces/[workspace-id]/
  workspace.json              ← Manifest（元数据 + 导航 + Capabilities）
  components/                 ← 工作台特有组件
  composables/                ← 工作台 Composable（use[Name].ts）
  stores/                     ← 工作台 Store（use[Name]Store.ts）
  pages/                      ← 工作台页面（可选，如无需独立路由可省略）
  types.ts                    ← 工作台类型定义
  index.ts                    ← 导出
```

### 10.2 Workspace Manifest

```json
{
  "id": "workspace-id",
  "name": "Workspace 中文名",
  "icon": "icon-name",
  "version": "1.0.0",
  "description": "Workspace 功能描述",

  "navigation": [
    {
      "tier": "consumer",
      "items": [
        {
          "id": "dashboard",
          "label": "工作台",
          "icon": "dashboard",
          "route": "/[id]/dashboard"
        }
      ]
    },
    {
      "tier": "professional",
      "items": [
        {
          "id": "analytics",
          "label": "数据分析",
          "icon": "analytics",
          "route": "/[id]/analytics"
        }
      ]
    }
  ],

  "capabilities": [
    {
      "capabilityId": "capability.id",
      "required": true
    }
  ],

  "routes": [
    {
      "path": "/[id]/dashboard",
      "name": "Dashboard",
      "component": "DashboardView"
    }
  ],

  "events": [],
  "services": [],
  "dependencies": []
}
```

### 10.3 规则

1. **每个 Workspace 必须包含 `workspace.json`** — 缺少该文件不被平台识别
2. **`navigation` 按 `tier` 分组** — `consumer`（消费端）/ `professional`（专业端）/ `admin`（管理端）
3. **`capabilities` 声明所需 Capability** — `required: true` 表示必须可用才能加载
4. **组件和 Store 优先放在 Workspace 内部**，仅在需要跨 Workspace 共享时提升到 `frontend/components/workspace/` 和 `frontend/composables/`

---

## 11. Registry 模板

### 11.1 结构

Registry 导出**类实例**（与独立函数风格的 Service 不同，Registry 需要维护内部状态）：

```typescript
// ── Registry 模板 ──
// 用于管理可注册实体的生命周期（Capability, Provider, Plugin 等）

import type { RegistryEntry } from '@kmki/platform'

export class MyRegistry<T extends RegistryEntry> {
  private entries = new Map<string, T>()
  private listeners = new Map<string, Set<Function>>()

  register(entry: T): void {
    if (this.entries.has(entry.id)) {
      throw new Error(`Registry conflict: ${entry.id} already registered`)
    }
    this.entries.set(entry.id, entry)
    this.emit('register', entry)
  }

  unregister(id: string): void {
    const entry = this.entries.get(id)
    if (entry) {
      this.entries.delete(id)
      this.emit('unregister', entry)
    }
  }

  get(id: string): T | undefined {
    return this.entries.get(id)
  }

  list(filter?: Partial<T>): T[] {
    if (!filter) return Array.from(this.entries.values())
    return Array.from(this.entries.values()).filter(entry =>
      Object.entries(filter).every(([key, value]) => entry[key as keyof T] === value)
    )
  }

  find(predicate: (entry: T) => boolean): T | undefined {
    return Array.from(this.entries.values()).find(predicate)
  }

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler)
  }

  get size(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
    this.listeners.clear()
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(handler => handler(data))
  }
}
```

### 11.2 规则

1. **Registry 使用 Class**（与独立函数风格的 Service 区分）— 因为需要维护 Map 和 Listener 状态
2. **必须抛出明确的异常**（`Registry conflict: ${entry.id} already registered`）
3. **必须提供事件机制**（`on`/`off`）以便其他模块监听注册/注销
4. **`list()` 支持按字段过滤**，`find()` 支持自定义谓词

---

## 12. 测试规范

### 12.1 结构

现有测试风格为**直接导出的 async 函数**（`learning.test.ts`）和 **vitest `describe/it`** 两种共存。新代码**推荐 vitest 风格**，但与现有测试文件风格冲突时以现存风格为准。

#### 风格 A：vitest（推荐）

```typescript
// backend/src/services/[domain]/__tests__/[name].test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import * as service from '../service.js'

describe('[ServiceName]', () => {
  it('should find by id', async () => {
    const result = await service.findById('test-id')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('test-id')
  })

  it('should return null for non-existent id', async () => {
    const result = await service.findById('non-existent')
    expect(result).toBeNull()
  })

  it('should create new record', async () => {
    const result = await service.create({ name: 'test' })
    expect(result.name).toBe('test')
    expect(result.id).toBeDefined()
  })
})
```

#### 风格 B：独立 async 函数（与现有 `learning.test.ts` 一致）

```typescript
// backend/src/services/[domain]/__tests__/[name].test.ts
import * as service from '../service.js'

async function testFindById() {
  const result = await service.findById('test-id')
  console.assert(result !== null, 'should find by id')
  console.assert(result!.id === 'test-id', 'id should match')
  console.log('  ✅ findById: PASS')
}

async function testCreate() {
  const result = await service.create({ name: 'test' })
  console.assert(result.name === 'test', 'name should match')
  console.assert(result.id, 'id should be defined')
  console.log('  ✅ create: PASS')
}

// Main runner
async function main() {
  console.log(`\n🧪 Testing [ServiceName]...`)
  await testFindById()
  await testCreate()
  console.log(`✅ [ServiceName] test PASS`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

### 12.2 规则

1. **测试文件放在 `__tests__/` 目录**，位于被测试模块旁
2. **测试覆盖所有公共函数**（每个 export function 至少一个 happy path + 一个 error case）
3. **Service 测试必须 Mock Prisma**，不得连接真实数据库
4. **Route 测试使用 Fastify `inject()`** 方法，不启动真实 HTTP 服务
5. **Repository 测试可连接测试数据库**（使用 `test/` 目录下的独立 schema）

---

## 13. Prisma 数据模型规范

### 13.1 结构

与现有 `schema.prisma` 风格一致：

```prisma
model Project {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  status      String   @default("draft")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  profiles    GeoBrandProfile[]

  @@map("projects")
}

model GeoBrandProfile {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @map("project_id")
  project     Project  @relation(fields: [projectId], references: [id])
  brandName   String   @map("brand_name")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("geo_brand_profiles")
}
```

### 13.2 规则

1. **所有 Model 使用 `@@map` 映射到 snake_case 表名**
2. **所有字段使用 `@map` 映射到 snake_case 列名**（Prisma 字段保持 camelCase）
3. **所有 ID 字段使用 `@id @default(uuid()) @db.Uuid`**
4. **时间戳字段统一为 `createdAt` / `updatedAt`**
5. **外键显式声明 `@map` + `@relation`**
6. **JSON 字段使用 `Json` 类型**（Prisma 原生支持），前台类型转换在 Repository 的 `toDTO` 处理

---

## 14. 实施检查清单

每次 Sprint 完成后的强制性检查项：

```
[ ] tsc 编译零错误（tsc --noEmit）
[ ] 无 PrismaClient 直接引用（全部通过 Repository）
[ ] Route 零业务逻辑（全部委派 Service）
[ ] Service 使用独立函数导出（非 class，除非 Registry）
[ ] Repository 使用对象字面量导出
[ ] Workspace 包含 workspace.json Manifest
[ ] 组件符合 Component 模板规范
[ ] Store 符合 Store 模板规范
[ ] 测试覆盖率 >= 80%（仅统计新增代码）
[ ] PM2 部署验证通过
[ ] Arch Linter 通过（bash scripts/architecture-linter.sh）
[ ] 无 TODO/FIXME 遗留（允许但不合入主分支）
```

---

## 附录 A：规范冲突处理

| 场景 | 处理方式 |
|---|---|
| Baseline 与现有代码不一致 | 以现有代码为准，记录偏差，后续迭代更新 Baseline |
| Baseline 与 Constitution 不一致 | 以 Constitution 为准，更新 Baseline |
| Baseline 与 Blueprint 不一致 | 以 Baseline 为准（Blueprint 是方向，Baseline 是落地） |
| 新代码风格与旧代码不一致 | 以 Baseline 为准（新代码必须符合 Baseline） |

## 附录 B：快速参考

```
Backend Service:    export async function [verb][Noun]()    (独立函数)
Backend Repository: export const [name]Repository = { ... }  (对象字面量)
Backend Route:      export async function [name]Routes()    (Fastify 注册函数)
Frontend Store:     export const use[Name]Store = defineStore()  (Composition优先)
Frontend Component: <script setup> + withDefaults(defineProps<...>())
Registry:           export class [Name]Registry extends ...  (Class)
Tests:              vitest describe/it 或 独立 async 函数
Prisma Model:       @@map snake_case, @map snake_case, @id @default(uuid()) @db.Uuid
```

---

*本 Baseline 由 Architecture Freeze V4.0 派生，经 2025-07-16 代码扫描校准。*
*违反 Baseline 的 PR 将不被合并。*
