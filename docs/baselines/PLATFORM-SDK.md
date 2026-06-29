# 昆仑镜 V4 Platform SDK 规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **命名空间**: `@studio/platform` · **用途**: Workspace 与 Platform 的唯一交互渠道

---

## 1. SDK 宗旨

Platform SDK 是 Workspace 层与 Platform 层之间的**唯一合法接口**。

Workspace 开发者**只需要安装一个依赖**：

```bash
npm install @studio/platform
```

然后通过 `PlatformSDK` 入口访问所有平台能力。不需要：
- ❌ 不需要 import prisma
- ❌ 不需要 import fetch/axios
- ❌ 不需要 import 平台内部模块
- ❌ 不需要了解数据库表结构
- ❌ 不需要知道 Provider 配置

---

## 2. 命名空间总览

```
@studio/platform
├── PlatformSDK                    ← 统一入口（单例）
│
├── auth/                          # 认证与鉴权
│   ├── verify(token) → User
│   ├── getCurrentUser() → User
│   └── hasPermission(action) → boolean
│
├── project/                       # 项目管理
│   ├── create(data) → Project
│   ├── getById(id) → Project
│   ├── list(filter) → Project[]
│   └── update(id, data) → Project
│
├── runtime/                       # 运行时
│   ├── execution/                  # 执行运行时
│   ├── workflow/                   # 工作流运行时
│   ├── capability/                 # 能力运行时
│   └── state/                      # 状态运行时
│
├── workflow/                      # 工作流
│   ├── registerDAG(dag) → void
│   ├── trigger(id, input) → Execution
│   ├── getStatus(id) → Status
│   └── cancel(id) → void
│
├── storage/                       # 存储
│   ├── upload(file) → URL
│   ├── download(url) → Buffer
│   ├── delete(url) → void
│   └── list(prefix) → FileInfo[]
│
├── asset/                         # 资产管理
│   ├── create(data) → Asset
│   ├── getById(id) → Asset
│   ├── list(filter) → Asset[]
│   └── delete(id) → void
│
├── repository/                    # 数据访问（Repository 基类）
│   ├── BaseRepository             # 所有 Repository 的基类
│   ├── create<T>(table, data) → T
│   └── ...                        # 由各领域 Repository 扩展
│
├── capability/                    # 能力调用
│   ├── invoke(id, input) → Result
│   ├── registerAgent(agent) → void
│   ├── listAgents() → Agent[]
│   └── health() → Health
│
├── api/                           # HTTP 客户端
│   ├── get(path, params) → Response
│   ├── post(path, body) → Response
│   ├── put(path, body) → Response
│   └── delete(path) → Response
│
├── logger/                        # 日志
│   ├── info(msg, meta)
│   ├── warn(msg, meta)
│   ├── error(msg, meta)
│   └── debug(msg, meta)
│
├── telemetry/                     # 监控
│   ├── metric(name, value, tags)
│   ├── trace(name, fn)
│   └── event(name, data)
│
└── event/                         # 事件总线
    ├── emit(event, data)
    ├── subscribe(event, handler) → unsubscribe
    └── unsubscribe(event, handler)
```

---

## 3. 模块详解与使用示例

### 3.1 入口 — PlatformSDK

```typescript
// 唯一入口 — Workspace 只需要这一个 import
import { PlatformSDK } from '@studio/platform'

// PlatformSDK 是单例，所有模块通过它访问
const { auth, project, runtime, workflow, storage, asset, repository, capability, api, logger, telemetry, event } = PlatformSDK
```

### 3.2 auth — 认证与鉴权

```typescript
import { PlatformSDK } from '@studio/platform'

async function getUserInfo() {
  // 验证 token 并获取当前用户
  const user = await PlatformSDK.auth.verify(token)
  console.log(`用户: ${user.name}, 等级: ${user.membership.tier}`)

  // 检查权限
  const canEdit = await PlatformSDK.auth.hasPermission('project:update')
  if (!canEdit) {
    throw new Error('无编辑权限')
  }

  return user
}
```

### 3.3 project — 项目管理

```typescript
import { PlatformSDK } from '@studio/platform'

async function createGeoProject(name: string) {
  // 创建项目 — 使用 type 枚举区分 Workspace
  const project = await PlatformSDK.project.create({
    name,
    description: 'GEO 品牌分析项目',
    type: 'geo',           // video | novel | ppt | geo | music | image
    metadata: {
      targetUrl: 'https://example.com',
      industry: 'technology'
    }
  })

  return project
}

async function listGeoProjects() {
  // 按 Workspace 类型筛选
  const projects = await PlatformSDK.project.list({
    type: 'geo',
    status: 'active',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 20
  })

  return projects
}
```

### 3.4 runtime — 运行时

```typescript
import { PlatformSDK } from '@studio/platform'

// 执行运行时
async function executeBrandAnalysis(projectId: string) {
  const result = await PlatformSDK.runtime.execution.execute(
    'geo:analyze-brand',
    { projectId, url: 'https://example.com' },
    { timeout: 30000 }
  )
  return result
}

// 工作流运行时
async function triggerWorkflow(projectId: string) {
  const execution = await PlatformSDK.runtime.workflow.trigger(
    'geo.knowledge-quality',
    { projectId, userId: 'current-user-id' }
  )
  return execution
}

// 状态运行时
async function saveDraft(workspaceId: string, draft: object) {
  await PlatformSDK.runtime.state.setState(workspaceId, 'current-draft', draft)
}

async function loadDraft(workspaceId: string) {
  return PlatformSDK.runtime.state.getState(workspaceId, 'current-draft')
}
```

### 3.5 workflow — 工作流 DAG 注册

```typescript
import { PlatformSDK } from '@studio/platform'

// Workspace 注册 DAG（在 Adapter.register 中调用）
async function registerGeoWorkflows() {
  await PlatformSDK.workflow.registerDAG({
    id: 'geo.knowledge-quality',
    name: '知识质量管线',
    description: '从文本中提取 Claims → Evidence → Citations → FAQ → Schema',
    nodes: [
      { id: 'claim', agent: 'knowledge-claim', dependsOn: [] },
      { id: 'evidence', agent: 'knowledge-evidence', dependsOn: ['claim'] },
      { id: 'citation', agent: 'knowledge-citation', dependsOn: ['evidence'] },
      { id: 'faq', agent: 'knowledge-faq', dependsOn: ['claim'] },
      { id: 'schema', agent: 'knowledge-schema', dependsOn: ['faq'] },
    ],
    config: {
      maxRetries: 3,
      timeoutMs: 120000,
      continueOnFailure: false
    }
  })

  // 触发执行
  const execution = await PlatformSDK.workflow.trigger('geo.knowledge-quality', {
    projectId: 'xxx',
    text: '待分析的文本内容...'
  })

  // 轮询状态
  const status = await PlatformSDK.workflow.getStatus(execution.id)
  console.log(`工作流状态: ${status.status}`)
}
```

### 3.6 storage — 存储

```typescript
import { PlatformSDK } from '@studio/platform'

async function handleFileUpload(file: File) {
  // 上传文件
  const url = await PlatformSDK.storage.upload(file, {
    path: `geo/${Date.now()}/${file.name}`,
    public: true
  })

  console.log(`文件已上传: ${url}`)

  // 列出项目文件
  const files = await PlatformSDK.storage.list(`geo/projects/project-id/`)

  return url
}
```

### 3.7 asset — 资产管理

```typescript
import { PlatformSDK } from '@studio/platform'

async function manageBrandAssets(projectId: string) {
  // 创建资产
  const asset = await PlatformSDK.asset.create({
    projectId,
    type: 'brand-logo',
    name: '公司 Logo',
    url: 'https://cdn.example.com/logo.png',
    metadata: {
      width: 200,
      height: 200,
      format: 'png'
    }
  })

  // 获取项目所有资产
  const assets = await PlatformSDK.asset.list({
    projectId,
    types: ['brand-logo', 'screenshot']
  })

  return assets
}
```

### 3.8 repository — 数据访问

```typescript
import { PlatformSDK } from '@studio/platform'

// 通过 Repository 访问数据（不直接 import prisma）
async function findClaims(projectId: string) {
  const claims = await PlatformSDK.repository.findMany('knowledgeClaim', {
    where: { projectId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
  return claims
}

// 使用 BaseRepository 基类（为特定实体创建 Repository）
import { BaseRepository } from '@studio/platform/repository'

interface KnowledgeClaim {
  id: string
  projectId: string
  title: string
  content: string
  status: 'pending' | 'verified' | 'rejected'
  createdAt: Date
}

export class KnowledgeClaimRepository
  extends BaseRepository<KnowledgeClaim, any> {

  protected tableName = 'knowledgeClaim'

  protected mapPrisma(record: any): KnowledgeClaim {
    return {
      id: record.id,
      projectId: record.projectId,
      title: record.title,
      content: record.content,
      status: record.status,
      createdAt: record.createdAt
    }
  }

  protected toCreateInput(data: Partial<KnowledgeClaim>): any {
    return {
      project: { connect: { id: data.projectId } },
      title: data.title,
      content: data.content,
      status: data.status ?? 'pending'
    }
  }

  protected toUpdateInput(data: Partial<KnowledgeClaim>): any {
    return {
      title: data.title,
      content: data.content,
      status: data.status
    }
  }
}

// 使用 Repository
const claimRepo = new KnowledgeClaimRepository()
await claimRepo.create({
  projectId: 'xxx',
  title: '示例声明',
  content: '声明内容...'
})
```

### 3.9 capability — 能力调用

```typescript
import { PlatformSDK } from '@studio/platform'

async function generateContent(prompt: string) {
  // 调用 LLM 能力 — 不必知道用哪个 Provider
  const result = await PlatformSDK.capability.invoke('llm.generate', prompt, {
    temperature: 0.7,
    maxTokens: 2000,
    // 可选：首选 Provider
    preferredProvider: 'doubao'
  })

  if (!result.success) {
    // 自动降级已经尝试过了，这里可以做业务层兜底
    console.error(`LLM 调用失败: ${result.error.message}`)
    return fallbackGenerate(prompt)
  }

  console.log(`使用 Provider: ${result.provider}, 耗时: ${result.durationMs}ms`)
  return result.data
}

// 列出可用 Agent
async function discoverAgents() {
  const agents = await PlatformSDK.capability.listAgents({
    workspace: 'geo',
    tags: ['knowledge']
  })
  console.log(`GEO 知识相关 Agent: ${agents.length} 个`)
  return agents
}
```

### 3.10 api — HTTP 客户端

```typescript
import { PlatformSDK } from '@studio/platform'

async function callGeoApi() {
  // 自动附加 auth header
  const projects = await PlatformSDK.api.get('/geo/projects', {
    params: { status: 'active' }
  })

  const claim = await PlatformSDK.api.post('/geo/claims', {
    projectId: 'xxx',
    title: '新声明'
  })

  const updated = await PlatformSDK.api.put(`/geo/claims/${claim.id}`, {
    status: 'verified'
  })

  await PlatformSDK.api.delete(`/geo/claims/${claim.id}`)

  return { projects, claim, updated }
}
```

### 3.11 logger — 结构化日志

```typescript
import { PlatformSDK } from '@studio/platform'

async function processWithLogging() {
  PlatformSDK.logger.info('开始处理', { workspace: 'geo', action: 'analyze' })

  try {
    const result = await someOperation()
    PlatformSDK.logger.info('处理完成', {
      workspace: 'geo',
      duration: result.durationMs,
      items: result.count
    })
  } catch (error) {
    PlatformSDK.logger.error('处理失败', {
      workspace: 'geo',
      error: error.message,
      stack: error.stack
    })
  }
}
```

### 3.12 telemetry — 监控

```typescript
import { PlatformSDK } from '@studio/platform'

async function monitoredOperation() {
  // 计数指标
  PlatformSDK.telemetry.metric('geo.claim.extracted', 5, {
    projectId: 'xxx',
    status: 'pending'
  })

  // 追踪（自动记录耗时）
  const result = await PlatformSDK.telemetry.trace('geo.quality-check', async () => {
    // 业务逻辑
    return await runQualityCheck()
  })

  // 事件
  PlatformSDK.telemetry.event('geo.workflow.completed', {
    workflowId: 'geo.knowledge-quality',
    duration: 45000
  })
}
```

### 3.13 event — 事件总线

```typescript
import { PlatformSDK } from '@studio/platform'

// 订阅事件
async function setupEventListeners() {
  const unsubscribe = await PlatformSDK.event.subscribe('project:created', (event) => {
    console.log(`新项目创建: ${event.data.name} (类型: ${event.data.type})`)

    // 只处理 GEO 类型的项目
    if (event.data.type === 'geo') {
      PlatformSDK.logger.info('GEO 项目创建事件', { projectId: event.data.id })
    }
  })

  // 记得在 Adapter.dispose 中取消订阅
  return unsubscribe
}

// 发布事件
async function notifyProjectUpdate(projectId: string) {
  await PlatformSDK.event.emit('project:updated', {
    projectId,
    status: 'completed',
    timestamp: new Date().toISOString()
  })
}
```

---

## 4. 禁止绕过 SDK（Bypass Prohibition）

### 4.1 核心原则

**Workspace 层与平台层的所有交互必须通过 `@studio/platform` SDK。**

任何绕过 SDK 直接访问平台内部模块、数据库、网络或存储的行为都是**架构违规**，将在 CI 阶段被拦截。

### 4.2 禁止的操作清单

| 禁止的操作 | 示例 | 风险 |
|-----------|------|------|
| `import prisma` 或任何 Prisma 客户端 | `import { prisma } from '@/lib/prisma'` | 绕过 Repository 封装，ORM 无法替换 |
| `import { PrismaClient }` | `import { PrismaClient } from '@prisma/client'` | 直接数据库访问，无追踪无审计 |
| `fetch()` 直接 HTTP 请求 | `fetch('/api/geo/projects')` | 无法统一错误处理、无 traceId 链路 |
| `axios()` 直接 HTTP 请求 | `axios.get('/api/geo/projects')` | 同上 |
| `axios` 库 import | `import axios from 'axios'` | 同上 |
| `localStorage` / `sessionStorage` 直接访问 | `localStorage.getItem('token')` | 绕过 Platform Auth，无法跨设备同步 |
| `IndexedDB` 直接使用 | `window.indexedDB.open(...)` | 绕过 State Runtime，状态不可恢复 |
| `WebSocket` 直接创建 | `new WebSocket('ws://...')` | 绕过 Event Bus，无法统一管理 |
| 平台内部模块相对路径 import | `import { ... } from '../../../platform/...'` | 破坏模块封装，平台重构受影响 |
| Provider 客户端直接实例化 | `new OpenAI({ apiKey: '...' })` | 绕过 Capability Runtime，无法路由和降级 |

### 4.3 正确做法

```typescript
// ✅ 唯一允许的 import
import { PlatformSDK } from '@studio/platform'

// ✅ 数据访问
const claims = await PlatformSDK.repository.findMany('knowledgeClaim', ...)

// ✅ API 调用
const projects = await PlatformSDK.api.get('/geo/projects')

// ✅ 认证
const user = await PlatformSDK.auth.verify(token)

// ✅ 能力调用
const result = await PlatformSDK.capability.invoke('llm.generate', prompt)

// ✅ 事件
await PlatformSDK.event.publish({ type: 'my:event', payload: {...} })

// ✅ 日志
PlatformSDK.logger.info('操作完成', { duration })
```

### 4.4 CI 检查脚本

以下 CI 脚本用于自动检测 Workspace 代码中的绕过行为：

```bash
#!/bin/bash
# ci/check-bypass.sh — 检测 Workspace 是否绕过 SDK
# 在 CI pipeline 中运行：check-bypass.sh

echo "=== 检查 Workspace 绕过 SDK 行为 ==="
HAS_ERROR=false

# 检查函数：如果匹配则报错
check_pattern() {
  local pattern="$1"
  local message="$2"
  local file_pattern="${3:-*.ts,*.vue,*.tsx}"
  local found=false

  for ext in $(echo "$file_pattern" | tr ',' ' '); do
    if grep -rn "$pattern" workspace/ --include="$ext" 2>/dev/null | grep -v "node_modules" | grep -q .; then
      echo "❌ [违规] $message"
      grep -rn "$pattern" workspace/ --include="$ext" | grep -v "node_modules"
      found=true
    fi
  done

  if [ "$found" = true ]; then
    HAS_ERROR=true
  fi
}

# 1. 禁止 import prisma
check_pattern "from ['\"].*prisma" "禁止 import prisma — 使用 PlatformSDK.repository"

# 2. 禁止 import @prisma/client
check_pattern "from ['\"].*@prisma/client" "禁止 import PrismaClient — 使用 BaseRepository"

# 3. 禁止 import axios
check_pattern "from ['\"].*axios" "禁止 import axios — 使用 PlatformSDK.api"

# 4. 禁止直接 fetch()
check_pattern "[^a-zA-Z]fetch(" "禁止直接 fetch() — 使用 PlatformSDK.api"

# 5. 禁止直接 localStorage
check_pattern "localStorage\." "禁止直接 localStorage 访问 — 使用 PlatformSDK.auth"

# 6. 禁止直接 IndexedDB
check_pattern "indexedDB\." "禁止直接 IndexedDB 使用 — 使用 PlatformSDK.runtime.state"

# 7. 禁止直接 new WebSocket
check_pattern "new WebSocket" "禁止直接创建 WebSocket — 使用 PlatformSDK.event"

# 8. 禁止平台内部路径 import
check_pattern "from ['\"].*\.\./\.\./platform" "禁止平台内部相对路径 import — 使用 @studio/platform"

# 9. 禁止 Provider 客户端直接实例化
check_pattern "new OpenAI\|new Doubao\|new Qwen" "禁止直接实例化 Provider 客户端 — 使用 PlatformSDK.capability"

# 10. 额外检查：AST层面检测 (tsc / eslint)
# 可以使用 @typescript-eslint/no-restricted-imports 规则
echo ""
echo "ESLint 配置建议 (.eslintrc):"
cat << 'ESLINT'
{
  "rules": {
    "@typescript-eslint/no-restricted-imports": ["error", {
      "paths": [
        { "name": "prisma", "message": "请使用 @studio/platform/repository" },
        { "name": "axios", "message": "请使用 PlatformSDK.api" },
        { "name": "@prisma/client", "message": "请使用 BaseRepository" }
      ],
      "patterns": [
        { "group": ["**/platform/**"], "message": "请使用 @studio/platform 替代" }
      ]
    }]
  }
}
ESLINT

if [ "$HAS_ERROR" = true ]; then
  echo ""
  echo "❌ 检测到 SDK 绕过行为，请修复后重新提交"
  echo "   所有 Workspace 代码必须通过 @studio/platform SDK 与平台交互"
  exit 1
else
  echo "✅ 未检测到 SDK 绕过行为"
  exit 0
fi
```

### 4.5 PR 审查要点

```
□ 是否所有 import 都来自 @studio/platform？
□ 是否没有 import prisma / axios / fetch？
□ 是否没有直接访问 localStorage / IndexedDB？
□ 是否没有直接实例化 Provider 客户端？
□ 是否没有使用平台内部相对路径 import？
□ 是否所有网络请求通过 PlatformSDK.api？
□ AST 静态分析是否通过？（tsc + eslint no-restricted-imports）
```

### 4.6 违规响应

| 违规级别 | 对应操作 | CI 动作 | 处理 |
|---------|---------|---------|------|
| 🔴 Critical | import prisma / PrismaClient | 阻止合并 | 必须重构为 Repository 模式 |
| 🔴 Critical | fetch() / axios() | 阻止合并 | 必须替换为 PlatformSDK.api |
| 🔴 Critical | localStorage / IndexedDB 存储敏感数据 | 阻止合并 | 必须替换为 PlatformSDK.auth / StateRuntime |
| 🟡 Major | 平台内部路径 import | 阻止合并 | 必须替换为 @studio/platform |
| 🟡 Major | 直接实例化 Provider 客户端 | 阻止合并 | 必须通过 Capability Runtime |
| 🟢 Minor | 其他直接浏览器 API 调用 | 警告（CI 通过） | 建议替换为 SDK 封装 |



Workspace 层**禁止**以下 import。PR 审查时将自动检查。

| 禁止的 import | 原因 | 替代方案 |
|-------------|------|----------|
| `import { prisma } from '...'` | 绕过 Repository 封装 | `PlatformSDK.repository.*` |
| `import axios from 'axios'` | 无法统一追踪 | `PlatformSDK.api.*` |
| `import fetch from '...'` | 无法统一追踪 | `PlatformSDK.api.*` |
| `import { PrismaClient } from '...'` | 绕过 Repository 封装 | `BaseRepository` |
| `import { authPlugin } from '...'` | Workspace 不处理认证 | `PlatformSDK.auth.*` |
| Provider 直接 import | 绕过 Capability Runtime | `PlatformSDK.capability.*` |
| 平台内部相对路径 import | 破坏封装 | `@studio/platform` |

### CI 检查

```bash
#!/bin/bash
# platform-sdk-compliance.sh

echo "检查 Workspace 是否违规 import..."
HAS_ERROR=false

check_import() {
  local pattern="$1"
  local message="$2"
  if grep -rn "$pattern" workspace/ --include="*.ts" --include="*.vue" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -q .; then
    echo "❌ $message"
    grep -rn "$pattern" workspace/ --include="*.ts" --include="*.vue" --include="*.tsx" | grep -v "node_modules"
    HAS_ERROR=true
  fi
}

check_import "from ['\"].*prisma" "import prisma 被禁止 — 使用 PlatformSDK.repository"
check_import "from ['\"].*axios" "import axios 被禁止 — 使用 PlatformSDK.api"
check_import "fetch(" "直接 fetch() 被禁止 — 使用 PlatformSDK.api"
check_import "from ['\"].*@prisma/client" "import PrismaClient 被禁止 — 使用 BaseRepository"

if [ "$HAS_ERROR" = true ]; then
  echo "❌ Workspace SDK 合规检查失败"
  exit 1
else
  echo "✅ Workspace SDK 合规检查通过"
fi
```

---

## 5. Workspace 使用 SDK 的正确模式

```typescript
// ✅ 正确 — GEO Workspace Service
import { PlatformSDK } from '@studio/platform'

export class GeoService {
  async analyzeBrand(projectId: string, url: string) {
    // 1. 获取项目 — 通过 Platform SDK
    const project = await PlatformSDK.project.getById(projectId)

    // 2. 调用能力 — 通过 Platform SDK
    const analysis = await PlatformSDK.capability.invoke('llm.generate', {
      prompt: `分析品牌 ${url} 的可见性`,
      systemPrompt: '你是品牌分析专家'
    })

    // 3. 保存结果 — 通过 Platform SDK API
    const result = await PlatformSDK.api.post('/geo/brand/analyze', {
      projectId,
      url,
      analysis: analysis.data
    })

    // 4. 记录日志 — 通过 Platform SDK
    PlatformSDK.logger.info('品牌分析完成', {
      projectId,
      url,
      duration: analysis.durationMs
    })

    // 5. 触发事件 — 通过 Platform SDK
    await PlatformSDK.event.emit('geo:brand:analyzed', {
      projectId,
      url,
      resultId: result.id
    })

    return result
  }
}
```

---

*Platform SDK 是 Workspace 与 Platform 之间的防火墙。严格遵守 SDK 规范意味着：*
*- 平台内部重构不影响 Workspace*
*- Provider 切换不影响 Workspace*
*- 数据库变更不影响 Workspace*
*- 认证策略变更不影响 Workspace*
