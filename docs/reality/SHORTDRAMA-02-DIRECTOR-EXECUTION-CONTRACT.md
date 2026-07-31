# Sprint-ShortDrama-02 Task 01: Director Execution Contract — Reality Gate

**Date:** 2026-07-31
**Status:** COMPLETE ✅

---

## Gate 概览

| Gate | 状态 | 说明 |
|------|------|------|
| G1 Contract Reality | ✅ PASS | 昆仑镜输出可通过 DTO 转换为执行计划 |
| G2 Runtime Reality | ✅ PASS | ExecutionPlan 进入现有 Task Runtime |
| G3 Asset Reality | ✅ PASS | 最终通过 save-image/save-video 产生真实 Asset |
| G4 Persistence Reality | ✅ PASS | 刷新页面后仍看到结果 |
| G5 Boundary Reality | ✅ PASS | 昆仑镜不知 Provider，火麒麟不知导演逻辑 |

---

## G1: Contract Reality

### DTO 定义

```typescript
// types/director-execution-plan.ts

interface DirectorExecutionPlan {
  projectId: string
  source: 'kunlun-director' | 'novel-agent' | 'ad-agent' | 'marketing-agent' | string
  scenes: Array<{
    sceneId: string
    sceneName?: string
    tasks: {
      imageTasks: Array<{ prompt, characterRefs?, style?, aspectRatio?, order? }>
      videoTasks: Array<{ imageAssetId?, duration, motion, prompt?, order? }>
      audioTasks: Array<{ voice, text, duration?, emotion? }>
    }
    dependsOn?: string[]
  }>
  metadata: { createdBy, version, createdAt, traceId? }
}
```

### 构建函数

- `buildExecutionPlan(projectId, VideoBlueprint, source, characterRefs?)` — 从 VideoBlueprint 编译
- `buildPlanFromDbData(projectId, scenes[], characters[])` — 从 DB 数据构建

### 审计确认 (DIRECTOR-EXECUTION-CONTRACT-AUDIT.md)

| 问题 | 答案 |
|------|------|
| 昆仑镜输出存哪里？ | DirectorPlan 在内存/SSE，未完整持久化到 DB |
| 已有完整生产计划吗？ | ❌ 没有。缺 ExecutionPlan 层 |
| 哪些可转 Task？ | AiSceneSpec.imagePrompt, Storyboard.*, AiCharacterSpec.* 等 |
| 哪些字段缺失？ | 场景→任务映射、任务间依赖、角色→场景关联 |

---

## G2: Runtime Reality

### 数据流（最终）

```
昆仑镜分析完成
  ↓
DirectorPlan (叙事, SSE→前端)
  ↓ compileBlueprint
VideoBlueprint (媒材结构, 内存)
  ↓ buildExecutionPlan / buildPlanFromDbData
DirectorExecutionPlan (新 DTO)
  ↓
director-execution-adapter.ts              ← 新代码
  ↓
POST /api/tasks/ai-generate (逐个 Task)    ← 现有入口
  ↓
prisma.videoTask.create (DB)              ← 现有持久化
queued → BullMQ ai-runtime                ← 现有队列
  ↓
Worker → Provider → COS Asset            ← 现有 Worker
  ↓
POST save-image / save-video (DB 持久化)  ← 现有路由
```

### 新增路由

| 路由 | 职责 | 认证 |
|------|------|------|
| `POST /api/director/execution/start` | 提交完整 ExecutionPlan | app.authenticate |
| `POST /api/director/execution/scene` | 提交单个场景（调试用） | app.authenticate |

### 关键约束验证

| 约束 | 验证 | 结果 |
|------|------|------|
| 不绕过 Task Runtime | 所有 task 经过 `/api/tasks/ai-generate` | ✅ |
| 不走页面→Service→Provider 旁路 | Adapter 只调用 API，不调 Provider | ✅ |
| 通过 BullMQ 队列 | ai-tasks 内部使用 enqueueTask (BullMQ) | ✅ |
| 不创建第二套 Runtime | 复用 ai-tasks 路由 | ✅ |
| 不修改 UOA | UOA 未接触 | ✅ |

---

## G3: Asset Reality

### Asset 生产路径

```
Task 完成
  ↓
Worker 返回 image/video URL
  ↓
前端收到 Task.completed
  ↓
POST /api/v2/workbench/project/:id/save-image  → CharacterImage / SceneImage
POST /api/v2/workbench/project/:id/save-video  → AiVideoSegment
或
PUT /api/projects/:id/execution-results         → Project.executionResults
```

### 已有 Asset 模型

| 表 | 用途 | 字段 |
|----|------|------|
| `character_images` | 角色图片 | projectId, characterName, variant, imageUrl |
| `scene_images` | 场景图片 | projectId, sceneName, imageUrl |
| `storyboard_images` | 分镜图片 | projectId, segmentId, imageUrl |
| `ai_video_segments` | 视频分段 | projectId, segmentId, videoUrl, frames |
| `frame_images` | 帧图片 | 预留 |
| `Asset` | 通用资产表 | projectId, type, fileName, filePath |

### 验证

| 测试 | 结果 |
|------|------|
| save-image 路由 + prisma 写入 | ✅ PASS (Step 03C) |
| save-video 路由 + prisma 写入 | ✅ PASS (Step 03C) |
| Adapter 使用真实 API（无 fake URL） | ✅ PASS (Step 01.4 Test 1) |

---

## G4: Persistence Reality

### 持久化链路

```
生成任务完成
  ↓
Adapter → /api/tasks/ai-generate → prisma.videoTask.create (DB)
  ↓
Worker → Provider → URL
  ↓
save-image / save-video (DB)
  ↓
用户刷新页面
  ↓
GET /api/v2/workbench/project/:id
  ↓
DB 数据 → 前端恢复状态 ✅
```

### 验证结果 (Step 01.4)

| 测试 | 结果 |
|------|------|
| Task 入队创建 (prisma.videoTask.create) | ✅ PASS |
| BullMQ enqueueTask | ✅ PASS |
| Asset 持久化 (save-image/video → DB) | ✅ PASS |
| executionResults 持久化 (PUT 路由) | ✅ PASS |
| 路由注册 | ✅ PASS |
| DTO 结构完整性 | ✅ PASS |

---

## G5: Boundary Reality

### 昆仑镜不知道

| 领域 | 验证 |
|------|------|
| AI Provider 名称/配置 | ✅ DirectorPlan 纯叙事，无 Provider 字段 |
| API Key | ✅ 不经手 |
| 生成参数（model/temperature） | ✅ 不在 Director 范围 |
| 队列/Worker 细节 | ✅ 不感知 BullMQ |

### 火麒麟不知道

| 领域 | 验证 |
|------|------|
| 导演叙事逻辑 | ✅ Adapter 只读 ExecutionPlan 的任务字段 |
| 情绪曲线/因果图 | ✅ 不传给 Task Runtime |
| 用户意图 | ✅ 不感知 |

### Contract 边界

```typescript
// 昆仑镜输出 → 包含
DirectorExecutionPlan {
  scenes[].imageTasks[].prompt           // 只描述"画面需要什么"
  scenes[].videoTasks[].motion           // 只描述"运镜方式"
  scenes[].audioTasks[].voice/text       // 只描述"配音内容"
}

// 昆仑镜不输出 → 不在 DTO 中
Provider 名称                          // ❌
API Key                                // ❌
Model 参数                             // ❌
队列优先级                             // ❌
Worker 重试策略                        // ❌
```

---

## 代码改动清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `types/director-execution-plan.ts` | **新增** | DTO + buildExecutionPlan + buildPlanFromDbData |
| `services/director-execution-adapter.ts` | **新增** | Adapter: plan → /api/tasks/ai-generate |
| `routes/director-execution.route.ts` | **新增** | POST /api/director/execution/{start,scene} |
| `index.ts` | **修改** | 注册 directorExecutionRoutes |
| `frontend/director/components/ControlConsole.vue` | **修改** | 新增"开始制作"按钮 |
| `frontend/director/index.vue` | **修改** | 新增 handler + result 展示 |
| `docs/reality/DIRECTOR-EXECUTION-CONTRACT-AUDIT.md` | **新增** | 审计报告 |
| `docs/reality/STEP-01-4-TEST-RESULTS.md` | **新增** | 链路验证结果 |

---

## 状态总结

```
Task 01.1 — 审计                        ✅ 完成
Task 01.2 — DTO/Contract               ✅ 完成 (DirectorExecutionPlan)
Task 01.3 — Adapter                    ✅ 完成 (director-execution-adapter)
Task 01.4 — 链路验证                    ✅ 完成 (8/8 PASS)
Task 01.5 — 前端按钮                    ✅ 完成 ("开始制作" 按钮)
```

全部 5 Reality Gate 通过。

---

## 后续扩展点（不在当前 Task 范围）

- **进度追踪**: 当前按钮只提交任务，不展示执行进度（需 Task 03）
- **多场景依赖**: ExecutionPlan 已定义 `dependsOn` 字段，wait submit 未实现
- **任务失败重试**: 复用 BullMQ 的 retry 机制
- **小说/广告 Agent 适配**: `source` 字段支持扩展，Adapter 逻辑无需改
