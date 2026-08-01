# 短剧工作台 Workflow 深度审计报告

> 审计时间: 2026-07-31
> 审计范围: Frontend (Nuxt) ←→ Backend (Fastify) ←→ Agents ←→ Image Pipeline ←→ COS/Proxy

---

## 一、工作流架构图（文本形式）

```
┌──────────────────────────────────────────────────────────────────┐
│                       前端 (Nuxt)                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  pages/studio/v2.vue                                       │  │
│  │    → StudioWorkspaceLayout                                 │  │
│  │      → PipelineSidebar (stage 导航)                        │  │
│  │      → WorkspaceRenderer (按 stage 切换子页面)             │  │
│  │        ├─ ScriptAnalysisWorkspace   ── 剧本拆解            │  │
│  │        ├─ CharacterWorkspace        ── 角色设计            │  │
│  │        ├─ SceneWorkspace            ── 场景设计            │  │
│  │        ├─ StoryboardWorkspace       ── 分镜导演            │  │
│  │        ├─ VideoGenerationWorkspace  ── 视频合成            │  │
│  │        ├─ DubbingRenderWorkspace    ── 配音制作            │  │
│  │        ├─ MusicGenerationWorkspace  ── 音乐制作            │  │
│  │        └─ FinalRenderWorkspace      ── 最终渲染            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  状态管理 (Pinia):                                                │
│    stores/workbench.ts  → 系统健康/负载/DAG执行                   │
│    stores/project.ts    → 项目 CRUD (调 /api/projects v1)        │
│    studio-v2/stores/useStudioStore.ts → 工作台状态 (调 v2 API)   │
│                                                                   │
│  API 调用路径:                                                     │
│    v1 路径: /api/projects, /api/execution-images/...              │
│    v2 路径: /api/v2/workbench/project, /api/v2/workbench/...      │
│    昆仑镜: /api/workbench/... (director-workspace)                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   后端 (Fastify, port 4002)                       │
│                                                                   │
│  路由层:                                                          │
│    routes/workbench-project.ts   → /api/v2/workbench/project     │
│    routes/workbench-director.ts  → /api/workbench/...             │
│    routes/execution-images.ts    → /execution-images/...          │
│    routes/studio-create-work.ts  → /api/v1/studio/create-work    │
│    routes/director-v2.ts         → /api/v2/director/...          │
│    routes/projects.ts            → /api/projects (v1 旧版)       │
│    routes/aigc-spec-db.ts        → /api/aigc-spec/:pid/save|load │
│    routes/proxy-image.ts         → /api/proxy/image              │
│                                                                   │
│  Agent 层:                                                        │
│    agents/aigc-spec-agent.ts  (已废弃, 用 v2)                    │
│      → narrativeGateway.execute() → LLM                          │
│      → _parseJson() + _validate() + _retryWithCorrection()       │
│                                                                   │
│    agents/orchestrator/UOA.ts  (短剧视频编排)                     │
│      → buildRequest() → submitTask() → 伪实现(placeholder)       │
│      → shadow.simulate() (影子学习, 非阻塞)                      │
│                                                                   │
│  图片 Pipeline (services/image/):                                 │
│    submit-task.ts → executeImageTask()                            │
│      → createSubmitStage()  [HTTP POST 提交任务]                  │
│      → createPollStage()    [轮询等待/每2s]                       │
│      → createPostProcessStage() [COS 上传 + 本地保存]             │
│      → createValidateStage()    [D1 质量校验]                     │
│      → createDecisionStage()    [D2/D3 决策重试]                  │
│        → wrapStagesWithRetry()                                   │
│                                                                   │
│  图片代理:                                                         │
│    proxy-image.ts → /api/proxy/image?url=                         │
│      白名单: *.tos-cn-beijing.volces.com, *.volces.com           │
│    execution-images.ts → /execution-images/proxy?url=             │
│      无白名单, fallback 到 302 redirect                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、各环节发现的问题 (按严重性排序)

### 🔴 严重 2.1 — 项目路由双轨制 (数据不一致)

**问题:**
- `frontend/stores/project.ts` → `projectService.ts` → `fetch('/api/projects')` (v1 路径)
- `frontend/studio-v2/stores/useStudioStore.ts` → `fetch('/api/v2/workbench/project')` (v2 路径)
- 后端有独立的 `routes/projects.ts` (v1) 和 `routes/workbench-project.ts` (v2)
- 两套系统数据模型不同：v1 的 `ProjectService` 有自己的 schema，v2 的 `workbench-project` 用不同字段名 (如 `name` vs `projectName`)
- 前端 `project.ts` store 的 `createProject` 调用 v1 API 返回的 `{ name }` 但 store 期望 `{ id, title, status }`，映射关系脆弱

**影响:** 项目列表可能不同步，用户在不同页面上看到不同数据

**修复:** 统一到 v2 API，废弃 v1 `projects.ts` 路由或将 v1 前端 store 指向 v2 路由

### 🔴 严重 2.2 — UOA Orchestrator `submitTask()` 是占位伪实现

**文件:** `backend/src/agents/orchestrator/UOA.ts` (83-91行)

```typescript
private async submitTask(body: any): Promise<{ taskId?: string; error?: string }> {
    try {
      // This is a placeholder — actual submission goes through
      // the existing task queue which handles provider routing + CTBL + OBS
      return { taskId: `uoa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` }
```

**问题:** 该方法是占位实现，永远返回假的 `taskId`，不执行任何真实的 AI 生成。整个视频生成编排 pipeline 的核心入口是空壳。

**影响:** 所有通过 UOA 编排的视频生成任务都不会真正执行。

### 🔴 严重 2.3 — 前端 projectService 调用 `/api/projects` 但该路由可能缺失 `/api/projects/:id/save-specs` 等端点

**文件:** 前端 `projectService.ts` vs 后端 `routes/projects.ts`

**问题:**
- 前端 `saveExecutionResults()` 调用 `PUT /api/projects/:id/execution-results` 
- 但后端 `routes/projects.ts` 没有实现 `/api/projects/:id/execution-results` 这个 PUT 路由
- 这会导致静默失败: `res.ok` 会返回 false, 但只 `console.warn`

**影响:** 工作流状态的持久化实际上无声失败。

### 🔴 严重 2.4 — 工作台 director 路由与 v2 workbench 路由完全分离

- `workbench-director.ts` 将所有路由挂在 `/api/workbench/...` 下
- 但这些 API 使用了完全不同的系统 (`directorRuntime`, `compileBlueprint`, `RenderExecutor` 等)
- 与 `workbench-project.ts` (v2) 和 `execution-images.ts` 没有任何数据共享
- 前端 `director-workbench/` 目录下的组件调用 `/api/workbench/...` 但无法获取 v2 项目数据

**问题:** 昆仑镜叙事导演和标准工作台(剧本→角色→场景→分镜)是两个完全割裂的系统，数据不能互通。

### 🔴 严重 2.5 — `aigc-spec-agent.ts` 标记已废弃但仍在使用

**文件:** `backend/src/agents/aigc-spec-agent.ts` 第1行注释 `@deprecated`
- 前端 `ScriptAnalysisWorkspace.vue` 仍然通过 `/api/aigc-spec/:projectId/save` 调用
- 但 route `aigc-spec-db.ts` 只负责读写数据库，不触发 agent
- Agent 调用链: 前端灵感页 → `/api/ai/generate-spec` → `aigcSpecAgent`? 需要确认代理是否存在

### 🟡 中等 2.6 — SSRF 白名单不一致 (proxy-image 双实现)

**文件:**
1. `routes/proxy-image.ts`: 白名单 `*.tos-cn-beijing.volces.com`, 有 `127.0.0.1/localhost` 阻断
2. `routes/execution-images.ts` (line 623+): `/execution-images/proxy` — **无任何 SSRF 白名单**, 直接 `fetch(url)` 无检查

**问题:** `/execution-images/proxy` 完全没有 SSRF 防护，可以请求任意内网地址。这是一个安全漏洞。

### 🟡 中等 2.7 — 错误处理安全隐患

**文件:**
- `workbench-project.ts` (多处): `reply.status(500).send({ success: false, error: err.message }` — 直接暴露 error message 给前端
- `execution-images.ts` (多处): 同样直接暴露 err.message
- 可能泄露内部路径、配置信息、API key 等

### 🟡 中等 2.8 — 图片下载 transient 持久化不一致

**文件:** `execution-images.ts`

`downloadAndUpload()` 函数 (line 120-135):
```javascript
cosUrl = localUrl  // COS 上传失败时用本地 URL
```
然后调用方:
```javascript
imageUrl = result.cosUrl.startsWith('/uploads') ? originalUrl : result.cosUrl
```

**问题:** 逻辑复杂且不一致。当 COS 失败时返回 `localUrl` (形如 `/uploads/...`)，但这个 URL 只能通过 Fastify 静态服务访问，如果前端在其他域使用会有 CORS 问题。且 nuxt 端无法直接解析 `/uploads/` 路径。

### 🟡 中等 2.9 — 三视图 faceCropUrl 作用域泄漏

**文件:** `execution-images.ts` (line 295-303)

```typescript
let faceCropUrl = ''
// ... 在 if(tripleView) 块中赋值
// 但在块外引用:
typeof faceCropUrl !== 'undefined'  // 始终 true
```

**问题:** `faceCropUrl` 在 `if(tripleView)` 块内赋值，但被块外代码引用（response 构造部分）。如果 `tripleView=false`，`faceCropUrl` 仍然是空字符串，但被响应中包含。虽然没有功能问题，但响应数据包含误导性字段。

### 🟢 轻微 2.10 — `console.error` 在 `reply.send()` 之后

**文件:** `workbench-project.ts` (line 54)

```typescript
reply.send({ success: true, data: project })
} catch (err: any) {
  reply.status(500).send({ success: false, error: err.message })
        console.error('[workbench-project] GET /:id 错误:', ...)  // ← 已 send 后执行
```

该 `console.error` 在 `reply.send()` 之后执行，虽然不会导致功能问题，但执行顺序反直觉。

### 🟢 轻微 2.11 — execution-images routes 认证缺失

**文件:** `execution-images.ts`

部分路由没有 `preHandler: [fastify.authenticate]`:
- `GET /execution-images/storyboards/all` — ⚠️ 无认证，任何人可获取所有项目的分镜图
- `POST /execution-images/migrate/:projectId` — ⚠️ 无认证，可读取任意项目的 executionResults
- `PUT /execution-images/frames` — ⚠️ 无认证，可写入任意项目的 frame 数据
- `GET /execution-images/frames/:projectId` — ⚠️ 无认证
- `GET /execution-images/videos/:projectId` — ⚠️ 无认证
- `GET /execution-images/proxy` — 代理服务，可以接受（但欠缺 SSRF 防护）
- `GET /execution-images/prop-images/:projectId` — ⚠️ 无认证
- `GET /execution-images/characters/:projectId` — ⚠️ 无认证
- `GET /execution-images/scenes/:projectId` — ⚠️ 无认证
- `GET /execution-images/storyboards/:projectId` — ⚠️ 无认证
- `POST /execution-images/refresh/:projectId` — ⚠️ 无认证

**影响:** 未认证用户可以读取/写入任何项目的媒体资源。

### 🟢 轻微 2.12 — 同步轮询模式 (Polling) 阻塞

**文件:** `execution-images.ts` (多处)

```typescript
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000))
  // 轮询任务状态
}
```

**问题:** 
- 每个图片生成请求会阻塞 Fastify worker 线程高达 60 秒
- 没有异步/回调/WebSocket 机制
- 高并发下会导致 Fastify 线程池耗尽

**建议:** 使用 SSE 或 WebSocket 推送任务完成事件

### 🟢 轻微 2.13 — 前端 workbench store 引用不存在的后端 API

**文件:** `frontend/stores/workbench.ts`

```typescript
async function fetchHealth() {
  const res = await fetch(`${apiBase}/health`)
}
async function executeDAG(dagId, input, seed) {
  const res = await fetch(`${apiBase}/execute`, { ... })
}
async function triggerReplay(executionId, seed) {
  const res = await fetch(`${apiBase}/replay`, { ... })
}
```

**问题:** 这些方法引用的 `/api/execute`, `/api/replay` 等后端路由在项目 routes 中找不到对应实现。它们是"死代码"——永远不会成功。`/api/health` 可能存在但返回格式可能与 store 期望的不匹配。

### 🟢 轻微 2.14 — project store 死代码 + mock 数据

**文件:** `frontend/stores/project.ts`

```typescript
const MOCK_PROJECTS: Project[] = []  // 空数组，永远不会有数据
```

`toggleFavorite`, `deleteProject` 等方法只在本地 `projects` 数组上操作，不会同步到后端。

---

## 三、严重性问题（必须修复）

| # | 问题 | 优先级 | 影响 |
|---|------|--------|------|
| 2.1 | 项目路由双轨制 | P0 | 数据不一致，用户可能在不同页面看到不同项目列表 |
| 2.2 | UOA submitTask 是空壳 | P0 | 视频生成管道核心实际上是空的，不执行任何真实任务 |
| 2.3 | saveExecutionResults 路由不存在 | P0 | 工作流状态根本不能持久化，无声失败 |
| 2.4 | 昆仑镜与工作台数据隔离 | P0 | 两个系统数据不互通，用户无法衔接工作流 |
| 2.6 | `/execution-images/proxy` 无 SSRF 白名单 | P0 | **安全漏洞**: 可代理内网任意地址 |
| 2.11 | 大量 execution-images 路由无认证 | P0 | **安全漏洞**: 可未授权访问所有项目的媒体资源 |

---

## 四、建议的修复方案

### P0 立即修复

#### 修复 2.1/2.3: 统一项目 API

1. 废弃 `routes/projects.ts` (v1)，将所有调用指向 `routes/workbench-project.ts` (v2)
2. 在 `routes/workbench-project.ts` 中增加 `PUT /api/v2/workbench/project/:id/execution-results`
3. 更新 `frontend/services/projectService.ts` 指向 v2 路径
4. 添加请求/响应拦截器统一处理数据格式转换

#### 修复 2.2: 实现真实 UOA submitTask

```typescript
private async submitTask(body: any): Promise<{ taskId?: string; error?: string }> {
  // 调用真实任务队列的 REST API
  const res = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Internal-Auth': process.env.INTERNAL_API_KEY || ''
    },
    body: JSON.stringify({
      projectId: body.projectId,
      taskType: body.taskType,
      input: body.input
    })
  })
  if (!res.ok) return { error: await res.text() }
  const data = await res.json()
  return { taskId: data?.task?.id }
}
```

#### 修复 2.4: 桥接昆仑镜与工作台

添加数据转换层，将昆仑镜生成的 `directorPlan` / `blueprint` 转换为工作台的 `aiVideoSegments` 和 `storyboardImages` 格式。

#### 修复 2.6: 统一 SSRF 白名单

对 `/execution-images/proxy` 添加与 `proxy-image.ts` 相同的白名单检查，或直接废弃并统一到 `/api/proxy/image`。

#### 修复 2.11: 添加认证中间件

为所有缺少 auth 的 `execution-images` 路由添加 `preHandler: [fastify.authenticate]`。

### P1 短期修复

- 将图片生成的同步轮询改为异步推送（SSE）
- 前端 workbench store 中移除死代码（`executeDAG`, `triggerReplay`）
- 统一错误处理：不在 `reply.send()` 后执行代码
- 修复 `faceCropUrl` 作用域问题

### P2 中期优化

- 统一 image proxy 实现，消除两个 `/proxy` 路由
- 统一数据持久化策略（COS vs local fallback）
- 前端 project store 改用 v2 API

---

## 五、链路完整性评估

| 链路 | 状态 | 说明 |
|------|------|------|
| Frontend → Backend (项目 CRUD) | ⚠️ 双轨 | v1 和 v2 两条独立的项目 API 路径 |
| Backend → Agent (剧本分析) | ✅ 完整 | narrativeGateway + aigc-spec-agent (虽有 deprecated 标记但可用) |
| Agent → LLM | ✅ 完整 | 通过 narrativeGateway.execute() |
| Agent → Database | ✅ 完整 | prisma 写入 aiCharacterSpec/aiSceneSpec 等表 |
| Frontend → 图片生成 | ⚠️ 有认证漏洞 | 多路由缺失 auth |
| 图片 Pipeline → COS | ⚠️ 降级不稳定 | COS 失败时 fallback 本地 |
| 图片代理 SSRF | ❌ 部分缺失 | execution-images/proxy 无白名单 |
| UOA 视频编排 | ❌ 空壳 | submitTask 是占位实现 |
| 昆仑镜导演系统 | ⚠️ 被隔离 | 独立路由、独立数据、与 v2 工作台不互通 |
| 状态持久化 (saveExecutionResults) | ❌ 无声失败 | 前端调用的 PUT 路由后端不存在 |

**整体链路易碎点:** 项目路由双轨 → 持久化无声失败 → UOA 空壳 → 认证缺失 → SSRF 漏洞

---

## 六、已知 Bug/代码问题

1. **workbench-project.ts:54** — `console.error` 在 `reply.send()` 之后
2. **execution-images.ts** — `faceCropUrl` 变量作用域泄漏到 `if(tripleView)` 之外
3. **execution-images.ts** — `tripleView` 在 `if` 块外被引用时可能未声明（line 366）
4. **project.ts store** — `createProject` 调用 `projectService.ts` 但该服务没有 error boundary，API 失败时静默 fallback
5. **execution-images.ts** — `downloadAndUpload` 中的 `cosUrl.startsWith('/uploads')` 检查不健壮（会认为本地 fallback URL 是 COS 成功）
6. **execution-images.ts** — `const baseUrl = ...` 在多个 POST handler 中重复定义，应提为公共变量
7. **workbench-director.ts** — `mockJobs` (Map) 无过期策略，服务长时间运行会内存泄漏

---

*报告完毕。如需要针对某个问题的详细修复 PR，请指出。*
