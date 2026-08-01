# 03-FRONTEND-AUDIT — 短剧工作台（studio-v2）前端架构审计报告

- 审计时间：2026-07-31
- 审计范围：`frontend/studio-v2/`（stores / workspace / layout / pipeline / api / pages）
- 对照后端：`backend/src/routes/workbench-project.ts`、`script-submit.ts`、`pipeline.ts`、`dag-runtime.ts`、`shared/pipeline-definition.ts`
- 审计方式：只读静态审计，未修改任何文件

---

## 0. TL;DR（总体结论）

整体架构方向正确（模块级单例 store + reactive 状态 + Runtime composable 包装），但存在 **4 个 P0 级断链问题**，导致当前工作台在关键路径上**无法闭环**：

1. **`StudioWorkspaceLayout.vue` 的 `onMounted` 在第 113 行 `return` 提前退出** —— 布局层的项目加载（URL projectId / last_project_id 恢复）与 `open-video-editor` 事件监听全部成为死代码。项目加载只靠 ScriptAnalysisWorkspace 自己兜底。
2. **`WorkspaceRenderer.vue` 没有映射 `final-render`（及 dubbing-render / director）** —— `FinalRenderWorkspace.vue`（382 行）、`DubbingRenderWorkspace.vue`、`DirectorWorkspace.vue` 从未被任何地方 import，界面永远渲染占位符。「合成输出」阶段不可达。
3. **视频生成结果从不回写 store** —— `VideoGenerationWorkspace` 把帧图/视频 URL/编辑状态持久化到独立表（`/api/projects/segments/*`），`store.workspace.segments` 上没有 `videoUrl` 字段。`FinalRenderWorkspace` 用 `segments.filter(s => s.videoUrl)` 取数，恒为空 → 「视频 → 合成」数据流断裂。
4. **流水线 stage key 前后端不一致 + 阶段状态同步是死代码** —— 前端用 `character-design / scene-design / voice-generation`（shared/pipeline-definition），后端建项目时初始化的是旧 DAG key `character / scene / voice`（workbench-project.ts:69），`pipeline.ts` PUT 不做 key 映射，直接 upsert 出孤儿行；且 store 的 `updateStageStatus` **全前端零调用**。

另外：`AdvertisementWorkspace` / `MusicGenerationWorkspace` 是完全脱离 store 与项目的「孤岛」；`CharacterWorkspace.vue` 有 6 个**未声明即使用**的响应式变量（加载项目后必抛 ReferenceError）；轮询逻辑重复 5 处；`api.ts` 是零使用者死文件。

---

## 1. 组件级审计结论

| 组件 | 文件 | 结论 | 一句话结论 |
|---|---|---|---|
| 全局 Store | `stores/useStudioStore.ts` (1182 行) | ⚠️ | 模块级单例、fetch-first-commit 模式正确；但体积失控（loadFromServer ~700 行含大量重复恢复逻辑）、`updateStageStatus` 无人调用、`saveToServer` 静默失败 |
| API Client | `api.ts` (81 行) | ❌ | 没有任何 workspace 组件使用；组件全部裸 fetch，token 来源还不一致 |
| 入口页 | `pages/studio-v2.vue` | ✅ | 薄壳，正常 |
| 布局/加载 | `layout/StudioWorkspaceLayout.vue` | ❌ | `onMounted` 第 113 行 `return` 使项目加载/编辑器事件全部失效 |
| 流水线 | `pipeline/studio-pipeline.ts` | ⚠️ | 正确从 shared/pipeline-definition 读取；但该定义本身与后端初始化的 key 不一致 |
| 工作台渲染器 | `workspace/WorkspaceRenderer.vue` | ❌ | 未映射 final-render / dubbing-render / director |
| 剧本分析 | `workspace/script-analysis/` | ⚠️ | 主流程可用（saveToServer→/api/script/submit→loadFromServer 闭环）；但 ~200 行死代码、`emptyNarrative` 未定义引用、绕过 store 直写 `/api/aigc-spec` |
| 角色设计 | `workspace/character-design/` | ❌ | **6 个未声明变量**（voiceResult 等）→ 项目加载后 watchEffect 必抛 ReferenceError；prompt 本地态不持久化 |
| 场景设计 | `workspace/scene-design/` | ⚠️ | 读写走 store（比角色页好）；localImagePrompt 存 store 但参考图本地态丢失；优化失败静默 |
| 分镜设计 | `workspace/storyboard/` | ⚠️ | 双数据源（store + 独立 fetch fallback）；轮询内联；结果直改 store 数组（绕过 API） |
| 视频生成 | `workspace/video-generation/` (3654 行) | ❌ | 巨型组件 + 第二条持久化通道（/api/projects/segments），与 store 双轨；`}''` 语法垃圾、token 键不一致、ref 当 string 序列化等 bug |
| 音乐生成 | `workspace/music-generation/` | ❌ | 完全孤岛：无 store、无项目绑定、`addToProject` 是假操作、history 刷新即丢 |
| 广告创作 | `workspace/advertisement/` | ❌ | 完全孤岛：无 store、硬编码 projectId `00000000-0000-0000-0000-000000000000` |
| 合成输出 | `workspace/final-render/` | ❌ | 从未被渲染（Renderer 未映射）；且取数依赖 store.segments.videoUrl（永远为空） |
| 配音合成 | `workspace/dubbing-render/` | ❌ | 纯占位 + 未挂载 |
| AI 导演 | `workspace/director/` | ⚠️ | 逻辑走 store/runtime 正确；但组件从未被 Renderer 挂载，`open-video-editor` 事件监听又已死 → 整页不可达 |
| 视频编辑器 | `workspace/video-editor/` | ⚠️ | 独立单例状态、无后端持久化（刷新即空）；仅能通过 PipelineSidebar 的按钮进入 |
| director-workbench / brand-geo / brand-geo-v2 | `workspace/director-workbench/` 等 | ⚠️ | 自成体系（独立 store / client），与主 store 无冲突但也无联动；不属于短剧主流水线，本次仅记录不深审 |

---

## 2. 前端数据流图（谁写谁读）

```
                     ┌────────────────────────────────────────────┐
                     │  useStudioStore（模块级单例 reactive state） │
                     │  pipeline / workspace{narrative,characters, │
                     │  scenes,segments,storyboardImages} / assets │
                     └───────┬──────────────────▲─────────────────┘
      读: 全部 workspace 组件   │                  │ 写: setNarrative/updateNarrative
      (经 use*Runtime 包装)    │                  │     setCharacters/updateCharacter
                             │                  │     setScenes/updateScene
                             │                  │     setSegments/updateSegment
                             │                  │     setAssets/addAsset
                             │                  │     saveToServer / loadFromServer
        ┌────────────────────┴──────────────┐   │
        ▼                                   ▼   │
  ScriptAnalysisWorkspace            ScriptAnalysisWorkspace
  CharacterWorkspace                （submitBreakdownTask: saveToServer
  SceneWorkspace                       → POST /api/script/submit
  StoryboardWorkspace (store 优先)      → loadFromServer 回填）
  VideoGenerationWorkspace (部分)
                                        ⚠️ 绕过 store 的直写点：
                                        - ScriptAnalysis: POST /api/aigc-spec/:pid/save
                                        - VideoGen: GET/POST /api/projects/segments/*
                                          PUT /api/executions/:pid
                                        - Storyboard: PUT /api/execution-images/storyboards
                                        - Character/Scene: POST /api/execution-images/*
                                        - 全部组件: POST /api/tasks/ai-generate（轮询）
```

**读路径**：所有主流水线组件都从 `useStudioStore()` 读数据（经 `useCharacterRuntime/useSceneRuntime/useSegmentRuntime/useNarrativeRuntime` 包装）——SSOT 读取方向基本统一 ✅。

**写路径**：写操作分裂为三类——
1. 走 store API（✅ 正确）：`updateCharacter/updateScene/updateSegment/addAsset/updateNarrative` 等。
2. 直改 store 内部对象（⚠️ 可工作但绕过 API，无类型保障）：`state.workspace.narrative.optimizedResults = ...`（video-gen）、`state.workspace.storyboardImages.push(...)`（storyboard）、`storeState.workspace.segments = []`（script-analysis）。
3. 完全绕开 store 的独立持久化通道（❌ 双轨制）：`/api/projects/segments/*`（视频生成状态）、`/api/executions/:pid`、`/api/aigc-spec/:pid/save`、`/api/execution-images/*`。

**孤岛**：`AdvertisementWorkspace` / `MusicGenerationWorkspace` 与 store 零交互（不读也不写），连 projectId 都没有。

---

## 3. 问题列表（文件:行号 + 描述 + 严重级别）

### P0 — 阻断级

| # | 位置 | 问题 |
|---|---|---|
| F-01 | `layout/StudioWorkspaceLayout.vue:113` | `onMounted(async () => { ... return ... })` 在函数体最前方 `return`，其后的 URL projectId 加载（:129-141）、`last_project_id` 恢复（:143-150）、`open-video-editor` 事件监听（:126-128）**全部永不执行**。项目只能靠 ScriptAnalysisWorkspace 自己加载；Director 发送的打开编辑器事件无人响应。 |
| F-02 | `workspace/WorkspaceRenderer.vue:8-29` | 未映射 `final-render` / `dubbing-render` / `director`。`FinalRenderWorkspace.vue`、`DubbingRenderWorkspace.vue`、`DirectorWorkspace.vue` 三个组件**全局零引用**（grep 确认），点击「合成输出」只显示通用占位符。 |
| F-03 | `workspace/video-generation/VideoGenerationWorkspace.vue:899-955` + `workspace/final-render/FinalRenderWorkspace.vue:104-110` | 视频结果存在独立表 `/api/projects/segments/*`（saveSegmentEditState/loadSegmentEditState），从不写入 `store.workspace.segments[].videoUrl`；FinalRender 的 `videoSegments = state.workspace.segments.filter(s => s.videoUrl)` 恒为 `[]` → 合成阶段永远「暂无视频」。跨阶段数据流断裂。 |
| F-04 | `shared/pipeline-definition.ts:70,81,125` vs `backend/src/routes/workbench-project.ts:69` vs `backend/src/services/dag-runtime.ts:25-28` | **stage key 三处不一致**：宪法 SSOT 规定 `character-design/scene-design/voice-generation`，但后端建项目初始化 `stageKeys = ['script-analysis','character','scene','storyboard','voice','video-generation','music-generation','final-render']`（旧 DAG key），`pipeline.ts` PUT 直接用 URL 里的 key upsert（无 legacy 映射）→ `character-design` 等 key 会创建**孤儿行**，DAG（STAGE_ORDER 用旧 key）永远看不到前端的状态更新。 |
| F-05 | `stores/useStudioStore.ts:73-114`（updateStageStatus） | 阶段状态同步函数定义完整（含 3 次重试），但**整个前端无任何调用点**（grep 确认）→ 流水线状态永不落库，与 F-04 叠加使 pipeline_stages 表形同虚设。 |
| F-06 | `workspace/character-design/CharacterWorkspace.vue:122,306-307,608-683` | `voiceResult / voicePreview / voicePlaying / voiceDesigning / voicePrompt / voicePromptExpanded` 6 个变量**使用但从未声明**。`watchEffect`（:300-312）在 `narrative.voices` 非空时立即执行 `voiceResult[cId]` → ReferenceError（**loadFromServer 回填 voices 后必现**）；`designVoice/playVoice/toggleVoicePrompt` 一调用即崩；模板 `:disabled="voiceDesigning"` 恒为 undefined。 |

### P1 — 高危

| # | 位置 | 问题 |
|---|---|---|
| F-07 | `workspace/advertisement/AdvertisementWorkspace.vue:1-299,299-697` | 完全独立孤岛：不 import store、不绑定 project；`uploadVideoFile`（:62）与 `generateAdImage`（:714, 757）硬编码 projectId `00000000-0000-0000-0000-000000000000`；生成结果不落任何项目。 |
| F-08 | `workspace/music-generation/MusicGenerationWorkspace.vue` | 孤岛同上：`history` 纯本地 ref 刷新即丢；`addToProject()`（:600-602）只弹 toast，**实际不写入任何项目资源库**（假操作）。 |
| F-09 | `workspace/video-generation/VideoGenerationWorkspace.vue:2068` | `recordVideoAction` 发送 `projectId: projectId || state?.projectId` —— 此处 `projectId` 是 store 解构出的 **computed ref 对象**，JSON.stringify 序列化的是 ref 结构而非字符串（应 `.value`）。 |
| F-10 | `workspace/video-generation/VideoGenerationWorkspace.vue:2136` | `}''`：if 块闭合后残留空字符串表达式语句（死代码/语法噪声）。 |
| F-11 | `workspace/video-generation/VideoGenerationWorkspace.vue:2434-2457` | `useToken()` 读 `localStorage.getItem('access_token')`，与全项目统一的 `auth_token` 不一致 → merge 相关请求可能未带 token（401）。 |
| F-12 | `workspace/video-generation/VideoGenerationWorkspace.vue`（全局） | 巨型组件（3654 行）：22 处裸 fetch、~15 个本地 reactive 状态、第二条持久化通道（/api/projects/segments + /api/executions/:pid）与 store 双轨；`handleOptimize` 直写 `state.workspace.narrative.optimizedResults/executionResults`（绕过 store API，字段也不在 NarrativeRuntime 类型中）。 |
| F-13 | `workspace/storyboard/StoryboardWorkspace.vue:576-680,722-760` | 双数据源：store 优先 + 独立 fetch fallback（`/api/aigc-spec/:pid/load`、`/api/execution-images/storyboards/*`）；`prompts/negativePrompts/results/selectedRefs` 全为本地态，刷新即丢（仅 storyboardImages 持久化）；生成结果 `state.workspace.storyboardImages.push(...)`（:912-918）绕过 store API 直改。 |
| F-14 | `workspace/script-analysis/ScriptAnalysisWorkspace.vue:653` | `emptyNarrative()` 使用但未 import/声明（narrative-types 的 createEmptyNarrative 未被引用）→ TS 编译错误 + 潜在 ReferenceError（当前被恒真的 narrative 短路掩盖）。 |
| F-15 | `workspace/script-analysis/ScriptAnalysisWorkspace.vue:265` | `useNarrativeRuntime` import 后从未使用（unused import）。 |
| F-16 | `workspace/script-analysis/ScriptAnalysisWorkspace.vue:340-570,777-930` | 死代码 ~250 行：`totalBeats/totalDuration/runDeepAnalyze/goToNextStage/analyzeProps/analyzeVoices/analyzeScenes` 定义后零调用（模板按钮走 `goToCharacterDesign`）。 |
| F-17 | `workspace/script-analysis/v2-result-handler.ts`（全文） | 模块全局零引用（grep 确认）；内部引用 `scriptTitle/projectNameInput/analyzing/persistNarrative` 等外部作用域变量，一旦被 import 即崩溃。 |
| F-18 | `composables/useTaskPolling.ts`（存在但零使用） | 5+ 处内联手写轮询循环（storyboard :819-848、frame :1821-1852、threeFrames :2075-2110、video :2311-2360、ad :570-640、merge :2524-2558），间隔/超时/错误处理各不相同，无法统一治理。 |
| F-19 | `workspace/character-design/CharacterWorkspace.vue:222-224,254-262` | `localImagePrompt/localNegativePrompt` 为组件本地态（注释承认 store 无字段，实际 store 有 imagePrompt），生成时仅写 `imageUrl`，**用户编辑的 prompt 不落 store** → 切角色/刷新即丢；`refImageUrls`（参考图）同样不持久化。与 SceneWorkspace（localImagePrompt 写 store）行为不一致。 |
| F-20 | `api.ts:1-81` + `composables/useStyleLock.ts:34` + `stores/useStudioStore.ts:21-32` | 三套 token 读取逻辑：api.ts 用 `frontend/utils/token-cache.getToken()`、store 用 `__NUXT__.token` + localStorage `auth_token`、useStyleLock 直接 fetch 不带 token；组件内还有 `getAuthToken()` 的 5+ 份拷贝（每份都查 `auth_token`），广告/音乐组件又各写一份。token 治理缺失。 |

### P2 — 中危

| # | 位置 | 问题 |
|---|---|---|
| F-21 | `stores/useStudioStore.ts:148-800` | `loadFromServer` 单函数 ~650 行，内部重复恢复逻辑：`pipelineCompletedStages` 恢复两遍（:668-674 与 :1023-1030）、`videoStyle/aspectRatio/styleLocked` 恢复三遍（:669-671、:1025-1030、:974-977）、`segments` 恢复两遍（:640-667 与 :990-1000）。可维护性差且顺序敏感。 |
| F-22 | `layout/StudioWorkspaceLayout.vue:68-83` | `deleteAsset` 直接 fetch DELETE `/api/execution-images/characters|scenes/:id`，`.catch(() => {})` 静默失败，无任何用户反馈；且只删 character/scene 两类，video/prop/storyboard 资产的 dbId 删除被忽略。 |
| F-23 | `stores/useStudioStore.ts:344-395` | `saveToServer` 失败仅 `console.error` + 返回 null；调用方（ScriptAnalysisWorkspace.selectVoice:286、submitBreakdownTask:635）多数不检查返回值 → 保存静默失败。 |
| F-24 | `workspace/scene-design/SceneWorkspace.vue:250-283` | `localOptimizeScenePrompt` 失败/无数据只 `console.warn`，用户无感知（静默失败）；`generateSingleScene` 内嵌二次 LLM 优化调用（:329-355）与 `localOptimizeScenePrompt` 逻辑重复。 |
| F-25 | `stores/useStudioStore.ts:69` + `types/runtime/index.ts` | 默认风格不一致：`createEmptyNarrative` 设 `videoStyle: 'realistic'`，但 store getter 与所有调用点 fallback 都是 `'3d'`（store:170、ScriptAnalysis:622、Character:233 等）→ 新项目默认风格随读取路径漂移。 |
| F-26 | `workspace/final-render/FinalRenderWorkspace.vue:159-164` | `projectName` 显示硬编码 `项目 ${pid.slice(0,8)}`，从不读 store 的项目名。 |
| F-27 | `workspace/video-generation/` 目录 | 源码树残留 `VideoGenerationWorkspace.vue.overwrite`、`.frame-backup`、`.bak.fre2`、`refactor-plan.md` 等备份/规划文件，易被误打包/误读。 |
| F-28 | 全工作台 | 错误提示不统一：大量 `alert()`（video-gen 8+ 处、scene 2 处、ad 8+ 处）+ toast 混用；无 loading 骨架统一组件（brand-geo 有 GeoLoadingSkeleton，主流水线没有）。 |
| F-29 | `workspace/video-editor/useVideoEditor.ts:1-424` | 编辑器状态为独立模块级单例，**无任何后端持久化**（undo/export 均内存态），刷新即全部丢失；与 store.segments 无双向同步。 |
| F-30 | `workspace/script-analysis/ScriptAnalysisWorkspace.vue:521` | `goToNextStage` 使用 `(window as any).__PROJECT_ID__` 全局变量兜底 projectId —— 该变量全代码库无人写入（grep 确认），属无效兜底。 |

### P3 — 低危 / 代码质量

| # | 位置 | 问题 |
|---|---|---|
| F-31 | `backend/src/routes/workbench-project.ts:56-57` | create 接口 catch 里 `reply.send` 之后还有 `console.error`（顺序颠倒，正常路径也会打出错误日志的错觉）。 |
| F-32 | `workspace/WorkspaceRenderer.vue:74-76` | `workspaceIdToStr(id){ return id }` 与 `eslint-disable` 注释：为消错而写的无意义函数。 |
| F-33 | `layout/StudioWorkspaceLayout.vue:57-65` | `getToken()` 重复实现（store 已有），与 store 的 getAuthToken 逻辑重复。 |
| F-34 | `workspace/director-workbench/`、`workspace/brand-geo/`、`workspace/brand-geo-v2/` | 三套平行体系（各自 store/client/composable），与主 store 零联动；代码量巨大（director-workbench ~20 文件、brand-geo ~90 文件），需确认是否应纳入主流水线治理。 |
| F-35 | `workspace/music-generation/MusicGenerationWorkspace.vue:1-259` 模板 | 模板 + script 分离正常，但 `@apply` Tailwind 指令与项目其他组件的纯 CSS 风格不一致（样式体系分裂）。 |

---

## 4. 与后端结构对齐核对表（数据流一致性）

| 数据 | 前端写入方 | 后端字段 | 对齐情况 |
|---|---|---|---|
| 剧本/名称/描述 | store.saveToServer → `PUT /api/v2/workbench/project/:id` | `project.script/name/description` | ✅ |
| executionResults.segments/workspaceScenes/videoStyle/aspectRatio/styleLocked/pipelineCompletedStages | store.saveToServer | `project.executionResults`（merge） | ✅ 字段名一致 |
| 六维分析结果 | `POST /api/script/submit` → loadFromServer 回填 | `executionResults.*` + aiCharacterSpecs/aiSceneSpecs/aiVideoSegments 等 artifact 表 | ✅ 主链路一致 |
| 角色图/场景图 | `POST /api/execution-images/characters|scenes` | `characterImage/sceneImage` 表 | ✅ |
| 分镜图 | `PUT /api/execution-images/storyboards` | `storyboardImage` 表 | ✅ |
| 帧图/视频/段落编辑态 | `POST /api/projects/segments/save` | `project_segment_state`（独立通道） | ⚠️ **与 workbench-project 双轨**，loadFromServer 不读它 |
| 优化结果 | `PUT /api/executions/:pid` | `project.executionResults.optimizedResults` | ⚠️ 绕过 store.saveToServer 的合并逻辑，可能覆盖他人字段 |
| aigc-spec | `POST /api/aigc-spec/:pid/save` | aigc_spec 相关表 | ⚠️ 与 script-submit 的 artifact sync 功能重叠 |
| 流水线阶段状态 | （无人调用） | `pipelineStage` 表 | ❌ 前端不写；且 key 体系不一致（F-04/F-05） |
| 视频 URL | 仅存 project_segment_state | `aiVideoSegment.videoUrl`（save-video 端点可写，但前端未调用） | ❌ 前端从不调用 `/save-video`，aiVideoSegment.videoUrl 恒空；FinalRender 无数据源 |

---

## 5. 修复建议（按优先级）

### 第一优先（闭环阻断项）
1. **删除 `StudioWorkspaceLayout.vue:113` 的 `return`**，恢复布局层项目加载 + `open-video-editor` 监听；同时把「URL projectId 加载」从 ScriptAnalysisWorkspace 收敛到布局层（消除重复加载逻辑）。
2. **`WorkspaceRenderer.vue` 补上 `final-render` 映射**（顺带决定 dubbing-render / director 的挂载策略——挂载或删除）。
3. **统一段落状态持久化**：把 `project_segment_state`（帧图/视频/编辑态）并入 `executionResults` 或 store 加载链路——最简方案：`saveSegmentEditState` 同时 `updateSegment(idx, { videoUrl, firstFrameUrl... })` 写回 store，`loadFromServer` 从 aiVideoSegment 回填 `videoUrl`，并让 FinalRender 读 `state.workspace.segments` 的同一份数据。
4. **统一 pipeline stage key**：以 `shared/pipeline-definition.ts` 为唯一真相源；改 `workbench-project.ts:69` 的 stageKeys 为定义中的 id；`pipeline.ts` PUT 增加 legacy key → 新 id 映射（复用 dag-runtime 的 STAGE_LEGACY_MAP）；恢复 `updateStageStatus` 的调用点（在 goToStage / 各阶段完成时调用）。
5. **修复 CharacterWorkspace 未声明变量**：补 `const voiceResult = reactive<Record<string,string>>({})`、`voicePreview`、`voicePlaying`、`voiceDesigning = ref(false)`、`voicePrompt = ref('')`、`voicePromptExpanded = ref(false)`（或直接删除这三组死功能：模板中 AI 音色设计 UI 已不存在，仅 32 内置音色网格在用）。

### 第二优先（双轨制收敛）
6. 让所有组件走 `api.ts`（或升级 api.ts 覆盖全部端点），删掉每组件一份的 `getAuthToken/authHeaders` 拷贝；统一 token 读取（`frontend/utils/token-cache` 或 store 导出一个）。
7. 删除 script-analysis 死代码（F-16/F-17）、v2-result-handler、`}''`（F-10）、`useToken()` 改用统一 token（F-11）、修复 recordVideoAction 的 ref 序列化（F-09）。
8. 用 `useTaskPolling` 替换 5+ 处内联轮询。
9. 给 Advertisement/Music 孤岛补 projectId 与 store 回写（或明确它们不属于短剧流水线，从 Renderer 中摘除 `voice-generation → AdvertisementWorkspace` 的映射）。

### 第三优先（健壮性）
10. `loadFromServer` 拆分（parse 各 artifact → 各自小函数），消除三重复位逻辑（F-21）。
11. `saveToServer` 返回错误信息而非 null；调用方统一处理失败提示。
12. 角色页 prompt 写 store（与场景页对齐）；参考图 URL 持久化。
13. 清理备份文件（F-27）；统一 alert/toast；统一默认 videoStyle（F-25）。

---

## 6. 亮点（值得保持）

- **store 为模块级单例**，`useStudioStore()` 多次调用共享同一 state —— SSOT 读取方向正确。
- **loadFromServer 采用 fetch-first-then-commit**，避免清空后加载失败的白屏；404 时只清 projectId 不毁当前工作区 —— 好模式。
- **saveToServer 带保存锁 + 排队**，防止并发写覆盖。
- `useCharacterRuntime` 做角色名去重；`studio-pipeline.ts` 遵守宪法从 shared 读取 stage 定义（虽然 shared 本身与后端脱节）。
- Storyboard 的 RuntimeGraph 非破坏性优化（原版/优化版可切换）设计良好。
