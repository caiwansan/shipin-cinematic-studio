# 火麒麟 AI导演控制台 — 当前工作流链路审计

> 审计时间: 2026-07-31 09:00 CST
> Sprint: KIRIN-REALITY-01 / Step 01

---

## 一、当前架构总览

### 用户入口

```
/pages/studio/v2.vue             ← 火麒麟标准工作台（剧本→角色→场景→分镜→视频→配音→发布）
/pages/director/workbench.vue    ← 昆仑镜叙事导演（五支柱镜头分析）
/pages/workbench/*.vue           ← 工作台后台调试面板（health/dag/repair/trace）
```

用户实际工作入口是 `/pages/studio/v2.vue`，渲染 `StudioWorkspaceLayout`，通过 `WorkspaceRenderer` 按 stage 切换子页面。

### 双轨项目 API 体系

| 系统 | 路由 | 前端 Store | 状态 |
|------|------|-----------|------|
| v1 项目 | `/api/projects` | `stores/project.ts` + `projectService.ts` | ✅ 真实 |
| v2 工作台 | `/api/v2/workbench/project` | `useStudioStore.ts` | ✅ 真实 |

**已确认：** 两个系统都是真实的，但数据模型不同（字段名不同），不是同一个数据库表的读写。

---

## 二、完整调用链路追踪

### 2.1 创建项目

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户动作 | 首页点击「创作新的项目」 | 选择项目类型 (SHORT_DRAMA/SHORT_VIDEO/MV/MUSIC/AD) |
| 前端 | `useStudioStore.createV2Project()` | line 339 |
| API 调用 | `POST /api/v2/workbench/project` | |
| 后端 | `routes/workbench-project.ts` | Prisma write → DB `Project` 表 |
| DB | `Project` 表 | `type` 字段标识项目类型 |
| 结果 | 前端收到 `{ projectId, name, type, stages }` | ✅ 真实 |

> **Alternate path:** `stores/project.ts` → `projectService.createProject()` → `POST /api/projects` → `routes/projects.ts`
> 两者都写 `Project` 表，但字段映射不同。

### 2.2 加载项目

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户动作 | 进入工作台 `/studio/v2?projectId=xxx` 或 dashboard 点击项目 |
| 前端 | `useStudioStore.fetchV2Project()` | line 376, 316 |
| API 调用 | `GET /api/v2/workbench/project/${projectId}` | |
| 后端 | `routes/workbench-project.ts` | 返回 `{ project, stages }` |
| DB | `Project` 表 + stage 子表 | ✅ 真实 |
| 结果 | 前端填充 PipelineRuntime | ✅ |

> **Alternate path:** `projectService.hydrateProject()` → `GET /api/projects/:id/hydrate`
> v1 返回 `{ project, executionResults, characters, scenes, ... }` 聚合数据

### 2.3 剧本拆解（Script Analysis）

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户动作 | 在工作台输入剧本 → 点击「分析」 |
| 前端 | `useStudioStore` → `POST /api/ai/generate-spec` (通过 inspiration 模块) |
| API 调用 | 前端 inspiration 模块 → `/api/ai/generate-spec` → `aigcSpecAgent` |
| 后端 | `narrativeGateway.execute()` → LLM 调用 |
| Agent | `aigc-spec-agent.ts` (标记 @deprecated 但真实可用) |
| DB | 写入 `aiCharacterSpec`, `aiSceneSpec`, `aiSegmentSpec` 等表 | ✅ 真实 |
| 状态查询 | `GET /api/pipeline/stage/${projectId}/script-analysis` → `routes/pipeline.ts` | ✅ 真实 |
| 结果 | 前端收到角色列表、场景列表、分镜片段 | ✅ |

### 2.4 图片生成（Image Generation）

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户动作 | 在角色/场景/分镜页面点击「生成图片」 |
| 前端 | `execution-images.ts` 的 `startGeneration()` |
| API 调用 | `POST /api/tasks/ai-generate` → `routes/ai-tasks.ts` |
| Queue | `enqueueTask()` → **BullMQ Queue `ai-runtime`** | ✅ 真实 |
| Worker | BullMQ Worker → AI Provider (豆包/火山) |
| Pipeline | `services/image/submit-task.ts` (submit → poll → postprocess→COS → validate → decision) |
| COS | 图片上传到 COS (火山 TOS) |
| 状态 | `GET /api/tasks/ai-generate/:id` 轮询 | ✅ 真实 |
| 结果 | 前端收到 COS URL → `/api/proxy/image?url=` 展示 | ✅ |

> **验证:** 代码中存在 `services/image/pipeline/` 完整 5-stage pipeline， BullMQ 集成，COS 上传，D1/D2/D3质量校验。**图片生成链路完全真实。**

### 2.5 视频生成（Video Generation）

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户动作 | 在视频生成页面点击「生成视频」 |
| 前端 | `images.ts` (前端 route `/videos/generate`) |
| API 调用 | `POST /videos/generate` → internal inject to `/api/tasks/ai-generate` |
| Queue | `enqueueTask()` → BullMQ `ai-runtime` | ✅ 真实 |
| Worker | BullMQ Worker → AI Video Provider |
| 结果 | Asset URL 返回 | ✅ 真实 |
| Save | `POST /api/v2/workbench/project/:id/save-video` → `routes/workbench-project.ts` | ✅ 真实 |

> **验证:** `/videos/generate` 路由调用 `server.inject` 转发到 `/api/tasks/ai-generate`，使用真实的 BullMQ Queue。**视频生成链路真实。**

### 2.6 TTS 配音

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户动作 | 在配音页面选择角色和剧本 → 点击「生成配音」 |
| API 调用 | `POST /api/tts/generate` → 代理到 `POST /api/tasks/ai-generate` |
| Queue | BullMQ `ai-runtime` | ✅ 真实 |
| 结果 | TTS 音频文件 → COS/本地 | ✅ 真实 |

### 2.7 状态持久化（Execution Results）

| 环节 | 文件 | 说明 |
|------|------|------|
| 前端调用 | `projectService.saveExecutionResults()` | line 51-61 |
| API 调用 | `PUT /api/projects/:id/execution-results` | |
| 后端 | `routes/projects.ts` line 151-185 | ✅ 真实存在 |
| 实现 | `Project.resultsJson` / `Project.executionResults` 字段 JSON 存储 |
| 支持 `_merge` 模式 | 增量合并，不覆盖 | ✅ |

> **审计修正:** 初始报告声称"后端路由不存在"，实际已经存在。`PUT /api/projects/:id/execution-results` 在 `projects.ts` line 153 完成实现。需要确认前端是否调用了正确的 v1 或 v2 路径。

### 2.8 昆仑镜叙事导演（Director Workbench）

| 环节 | 文件 | 说明 |
|------|------|------|
| 用户入口 | `/pages/director/workbench.vue` → `DirectorWorkbenchPage.vue` |
| 交互 | 用户输入镜头描述 → 点击「导演分析」 |
| 前端 API | `useRuntimeBinding().analyzeShots()` |
| 5 pillar endpoints | `POST /api/workbench/compile-shot` |
|  | `POST /api/workbench/temporal-analyze` |
|  | `POST /api/workbench/persistence-analyze` |
|  | `POST /api/workbench/grammar-analyze` |
|  | `POST /api/workbench/motion-plan` |
| 后端 handler | 每个 endpoint import 对应的 `*-api-handler.js` |
| 结果映射 | `director-runtime-store` → UI 五支柱可视化 |

> **分析层真实，渲染层 mock：** 5 个分析 endpoint 都是真实的（分析自然语言 → 输出结构数据），但后续的 `/api/workbench/render` 使用 `LocalMockRenderer` + `mockJobs`（内存 Map，无持久化）。

---

## 三、关键 Reality 判断

### ✅ 真实链路

| 链路 | 证据 |
|------|------|
| 创建项目 → v2 API → Prisma | `POST /api/v2/workbench/project` → `prisma.project.create()` |
| 剧本拆解 → Agent → LLM → DB | `narrativeGateway.execute()` → `aiCharacterSpec/*` tables |
| 图片生成 → BullMQ → COS | `services/image/pipeline/` 5-stage pipeline |
| 视频生成 → BullMQ → Asset | `/videos/generate` → `/api/tasks/ai-generate` → BullMQ |
| TTS 配音 → BullMQ → Asset | `/api/tts/generate` → `/api/tasks/ai-generate` |
| Execution Results 持久化 | `PUT /api/projects/:id/execution-results` ✅ 存在 |
| 昆仑镜 5 pillar 分析 | 5 个 `/api/workbench/*` endpoint，各有 handler |

### ⚠️ 部分真实

| 链路 | 情况 |
|------|------|
| 昆仑镜 render 层 | `LocalMockRenderer` 返回 `mock.video` URL，非真实 |
| 昆仑镜 render 持久化 | `mockJobs` 是内存 Map，非 DB |
| `POST /api/workbench/auto-direct` | 调用 `handleAutoDirect()` 但渲染仍走 mock |

### ❌ 已确认的假链路

| 链路 | 证据 |
|------|------|
| **UOA Orchestrator** | `submitTask()` 返回 fake taskId，从未被任何 route 调用 |
| **MockRunnerPage** | 未在任何地方 import，死代码 |
| **`/api/workbench/observatory`** | 需要验证是否真实 |

---

## 四、双轨 API 详细对比

### v1: `/api/projects`

| 文件 | 位置 |
|------|------|
| 前端 store | `stores/project.ts` |
| 前端 service | `services/projectService.ts` |
| 后端 route | `routes/projects.ts` (281 lines) |
| 前缀注册 | `index.ts` line ~900: `await app.register(projectRoutes)` |

### v2: `/api/v2/workbench/project`

| 文件 | 位置 |
|------|------|
| 前端 store | `studio-v2/stores/useStudioStore.ts` |
| 后端 route | `routes/workbench-project.ts` (457 lines) |
| 前缀注册 | `index.ts` line ~1020: `await app.register(workbenchProjectRoutes)` |

### 差异

| 方面 | v1 | v2 |
|------|----|----|
| 使用场景 | dashboard 列表、旧版project store | Studio v2 工作台 |
| 返回格式 | `{ data: { project, executionResults } }` | `{ project: { id, name, type, stages } }` |
| 额外字段 | `executionResults`, `characters`, `scenes` | `stages`, `pipelineStatus` |
| 创建返回 | `{ id, name, ... }` | `{ projectId, name, type, stages }` |
| 当前活跃用户 | 部分旧页面/组件 | **主要用户入口 (studio/v2)** |
| SSOT 候选 | ❌ v2 是当前工作台真实入口 | ✅ 建议保留 |

### 数据模型映射

两个系统都写 `Project` 表，但字段映射不同：
- v1 使用 `executionResults` (JSON) 存储工作流状态
- v2 使用 `stages` (JSON 数组) + pipeline status
- 前端 v2 store 不使用 `executionResults`，用独立的 stage 状态管理

---

## 五、昆仑镜与火麒麟关系

### 昆仑镜 (`/api/workbench/*`)

```
功能: 叙事导演分析工具
目标用户: 导演/编剧
入口: /director/workbench
核心API: 5 pillar analysis endpoints
数据模型: 无 DB 持久化 (前端 store + 内存)
渲染层: LocalMockRenderer (mock)
资产产生: ❌ 当前不产生可下载的媒体资产
```

### 火麒麟 (`/api/v2/workbench/project` + `/api/tasks/ai-generate`)

```
功能: 短剧 AI 导演工作台
目标用户: 内容创作者
入口: /studio/v2
核心API: project CRUD + ai-generate (BullMQ)
数据模型: Project 表 + ai*Spec 表 + executionResults
渲染层: BullMQ Worker → AI Provider (真实)
资产产生: ✅ 图片/视频/TTS 真实产出
```

### 数据隔离

昆仑镜和火麒麟目前是**完全独立的两套系统**：
- 昆仑镜项目 ≠ 火麒麟项目
- 昆仑镜分析数据 ≠ 火麒麟工作台数据
- 无数据映射层

---

## 六、UOA 状态确认

```
UOA Orchestrator 评估
═══════════════════
初始化: ✅ index.ts 执行 new OrchestratorAgent()
调用者:   ❌ 全项目搜索 0 次调用 uoa.execute()
submitTask: ❌ 占位实现，返回假 taskId
当前角色: 未接入的"未来层"骨架
建议:     保持不动，不参与本轮 Reality 收敛
```

已记录到 MEMORY.md: `UOA 当前不是生产执行层，不参与短剧工作流 Reality 收敛。`

---

## 七、安全审计初步

| 路由 | 认证 | SSRF 防护 |
|------|------|-----------|
| `/api/projects/*` | ✅ `preHandler: authenticate` | N/A |
| `/api/v2/workbench/project/*` | ✅ `preHandler: authenticate` | N/A |
| `/execution-images/*` | ⚠️ 多个路由缺少 auth | ⚠️ proxy 无白名单 |
| `/api/workbench/*` (昆仑镜) | ⚠️ 部分路由无 auth | N/A |
| `/api/proxy/image` | N/A (代理服务) | ✅ .volces.com 白名单 |
| `/videos/generate` | ❌ 无认证 | N/A |

---

## 八、未被生产前端引用的死代码

| 文件 | 说明 |
|------|------|
| `MockRunnerPage.vue` | 未在任何 store/page import |
| `stores/workbench.ts` | 引用的 `/api/execute`, `/api/replay`, `/api/health` 路由不存在 |
| `stores/project.ts` | MOCK_PROJECTS 空数组，toggleFavorite 等仅本地操作 |
| `backend/src/agents/orchestrator/UOA.ts` | 初始化但从不调用 |

---

## 九、结论

### 整体评估

火麒麟 AI导演控制台（标准工作流）**核心链路真实可运行**：

```
创建项目 ✅ → 剧本拆解 ✅ → 角色/场景/分镜图片生成 ✅ → 视频生成 ✅ → TTS ✅ → 持久化 ✅
```

### 待处理的 Reality Gap

| Gap | 严重度 | 说明 |
|-----|--------|------|
| 昆仑镜渲染 mock | 🔴 | render 层使用 LocalMockRenderer + 内存 mockJobs |
| 昆仑镜无 DB 持久化 | 🔴 | 所有分析结果仅在前端 store，刷新丢失 |
| 昆仑镜 ↔ 火麒麟隔离 | 🔴 | 两套独立系统，数据不互通 |
| execution-images 安全 | 🔴 | 10+ 路由缺少 auth + SSRF 白名单 |
| 项目 API 双轨 | 🟡 | v1/v2 两套，数据模型不兼容 |
| UOA 空壳 | 🟢 | 未接入生产，无影响 |
