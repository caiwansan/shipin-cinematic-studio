# SHORTDRAMA-PHASE2-3-REALITY — 前端读取链收敛 & 阶段状态统一

- Sprint: ShortDrama-Reality-Recovery-01 / Phase 2 + Phase 3
- 日期: 2026-07-31
- 状态: ✅ Reality Gates 通过（运行时验证）

---

## Phase 2 — 前端读取链收敛

### 目标
studio-v2 所有页面只能通过 API 获取业务状态；刷新页面数据不丢失。

### 改动清单

| 文件 | 改动 |
|------|------|
| `stores/useStudioStore.ts` saveToServer | `executionResults.segments` → **`executionResults.userEdits.segments`**（SSOT 契约：用户编辑走 userEdits 层） |
| `stores/useStudioStore.ts` loadFromServer | ① beats 构建后**合并 userEdits.segments**（按 id/segmentId 覆盖，AI 基础字段保留）② 从 aiVideoSegments **回填 videoUrl/firstFrameUrl/midFrameUrl/lastFrameUrl** |
| `types/runtime/segment-runtime.ts` | SegmentRuntime 增加 `videoUrl/firstFrameUrl/midFrameUrl/lastFrameUrl` 字段 |
| `video-generation/VideoGenerationWorkspace.vue` saveSegmentEditState | 保存到 `/api/projects/segments/save` 后 **updateSegment 回写 store**（下游 FinalRender 直接可读） |
| `video-generation/VideoGenerationWorkspace.vue` useToken | `access_token` → **`auth_token`**（修复 401） |
| `workspace/WorkspaceRenderer.vue` | **挂载 final-render / dubbing-render 组件**（原占位符） |
| `layout/StudioWorkspaceLayout.vue` | **删除 onMounted 顶部 `return`**（恢复 URL projectId 加载 / last_project_id 恢复 / open-video-editor 监听） |
| `character-design/CharacterWorkspace.vue` | 补 **6 个未声明变量**（voiceResult/voicePreview/voicePlaying/voiceDesigning/voicePrompt/voicePromptExpanded）→ 修复加载后必现 ReferenceError |

### Reality Test（运行时验证 ✅）

**场景 1：用户编辑 → 刷新 → 数据不丢失**
```
PUT /api/v2/workbench/project/:id
  executionResults.userEdits.segments = [{id:'seg_0', title:'用户改写的分镜标题', fullText:'...', emotion:'warm'}]
  ↓
GET /api/v2/workbench/project/:id（刷新加载）
  → userEdits.segments 完整读回 ✅
  → title/fullText/emotion 全部保留 ✅
  → videoStyle/aspectRatio 保留 ✅
```

**场景 2：视频结果 → store 回写 → FinalRender 可读**
- saveSegmentEditState 成功后调用 `updateSegment(segId, {videoUrl, firstFrameUrl, ...})`
- loadFromServer 从 ai_video_segments 表回填 videoUrl → 刷新后 FinalRender 的 `segments.filter(s => s.videoUrl)` 不再恒空 ✅

### Reality Gate

| Gate | 要求 | 状态 |
|------|------|------|
| F2-1 | 保存的段编辑刷新后不丢 | ✅ 实测通过 |
| F2-2 | 阶段页面（final-render）可进入 | ✅ Renderer 已挂载 |
| F2-3 | 布局层项目加载恢复（URL/last_project_id） | ✅ return 已删 |
| F2-4 | 角色页加载不抛 ReferenceError | ✅ 6 变量已声明 |
| F2-5 | 统一 token 键（auth_token） | ✅ useToken 修复 |

---

## Phase 3 — 阶段状态统一

### 目标
PipelineStage SSOT = backend task completion。Worker 完成任务写 stage；前端只读 stage，禁止前端自行维护完成状态。

### 改动清单

| 文件 | 改动 |
|------|------|
| `workbench-project.ts` 创建项目 | stageKeys 改为宪法 SSOT key：`character`→**`character-design`**、`scene`→**`scene-design`**、`voice`→**`voice-generation`** |
| `workbench-project.ts` GET | include **pipelineStages** + legacy key 映射（character→character-design 等） |
| `queue-manager.ts` Worker 完成回调 | 新增 `TASK_TYPE_TO_STAGE` 映射：video→video-generation / image,frame→storyboard / tts→voice-generation / llm→script-analysis / export→final-render；**任务成功 → stage upsert `done`**，**任务失败 → stage upsert `error` + 用户可读错误** |
| `stores/useStudioStore.ts` loadFromServer | 阶段状态恢复：**pipelineStages 表优先**（done/completed→completed, running→running, error→error, 其他→idle），旧项目无表数据时 fallback executionResults.pipelineCompletedStages |
| `script-submit.ts` | 重新分析时**保留 userEdits.segments**（不再无条件 `delete merged.segments` 丢弃用户编辑） |

### Reality Test（运行时验证 ✅）

**场景 1：任务失败 → stage error + 用户语言**
```
POST /api/tasks/ai-generate { taskType:'tts' }（无 API Key 用户）
  → 任务 failed: PROVIDER_AUTH_FAILED
  → pipeline_stages.voice-generation = error
  → error: "AI模型服务授权失败（aliyun），请检查「大模型设置」中的 API Key 是否正确"
  ✅ 前端刷新后显示 error 状态 + 用户可读错误
```

**场景 2：旧项目 stage key 归一化**
```
GET /api/v2/workbench/project/宏荼记
  → 8 个 stages 全部映射为宪法 key：character-design / scene-design / storyboard / voice-generation ...
  ✅ 前端共享 pipeline-definition 的 stage id 能正确匹配
```

### Reality Gate

| Gate | 要求 | 状态 |
|------|------|------|
| F3-1 | Worker 完成任务 → 写 stage（done） | ✅ 代码 + 成功路径验证 |
| F3-2 | Worker 任务失败 → 写 stage（error + 用户语言） | ✅ 实测通过 |
| F3-3 | 前端只读 stage，不自行维护 | ✅ loadFromServer 从表恢复 |
| F3-4 | 旧项目 legacy key 兼容 | ✅ GET 归一化映射 |
| F3-5 | 重新分析不丢用户编辑 | ✅ script-submit 保留 userEdits |

---

## 部署状态

- 前端：`npm run build` 成功，新构建已启动（HTTP 200）
- 后端：tsx 重启完成，新代码生效（health ok）
- 测试数据已清理（userEdits/测试任务已删除，宏荼记状态恢复）

## 下一步

- Phase 4: Prompt 收敛（PromptTemplate DB SSOT）
- Phase 5: 死代码治理（观察窗口标记）
- Phase 6: 安全止血（路径穿越/鉴权/JWT/ownership/quota）

---

*Phase 2 + Phase 3 完成 | 运行时验证通过*
