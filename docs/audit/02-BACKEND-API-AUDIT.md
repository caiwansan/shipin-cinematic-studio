# 后端 API 审计报告 — 短剧工作台（studio/v2）

- **审计日期**: 2026-07-31
- **范围**: `backend/src/routes/` 下工作台相关路由 + `agents/` + `services/storyboard*`
- **方式**: 只读静态审计（未修改任何文件）
- **数据库 Schema 参照**: `backend/prisma/schema.prisma`

---

## 0. 审计结论摘要

| 维度 | 结论 |
|---|---|
| API 完整性 | ⚠️ 存在 2 个必然 500 的端点（storyboards generate、aigc-spec save 含 emotionSpecs 时）、1 个未注册的死路由（ai-optimize-storyboard） |
| 数据一致性 | ❌ ai_video_segments / ai_scene_specs 等表有 ≥4 条全量替换写入路径，字段与 schema 多处漂移；Storyboard 表 CRUD 写入不存在的字段 |
| 统一真相源 | ❌ 同一「分镜」数据存在 4 种结构：`executionResults.videoSegments`（JSON）、`ai_video_segments` 行、`loadStoryboardDisplay` 适配器结构、`Storyboard` 表；前端不同页面读到的字段名不一致 |
| 鉴权与越权 | ❌ `/api/v1/projects*` 完全无鉴权（可列出全站项目）；工作台所有项目级端点只验证登录、不验证归属；`/api/script/*` 可伪造 userId 盗用他人 LLM Key |
| 错误处理 | ⚠️ 大量路由无 try/catch（异常 → 默认 500 裸错误）；部分错误被静默吞掉（COS 失败降级、sync 失败仅 warn） |
| prompt 硬编码 | ⚠️ 6 处内联 prompt 与「禁止硬编码」政策冲突；2 个 prompt 名称未在 seed 中（运行即 500/失败） |

---

## 1. 端点审计明细

### 1.1 `routes/workbench-project.ts`（V2 工作台核心）⚠️

| 端点 | 鉴权 | 归属校验 | 结论 |
|---|---|---|---|
| POST `/api/v2/workbench/project` | ✅ authenticate | 创建自己项目，OK | ✅ 正常；`userId = user?.id \|\| 'default'` 兜底（L32）有数据污染隐患 |
| GET `/api/v2/workbench/projects` | ✅ | ✅ 按 userId 过滤 | ✅ |
| GET `/api/v2/workbench/project/:id` | ✅ | ❌ 任意登录用户可读任意项目 | ⚠️ |
| PUT `/api/v2/workbench/project/:id` | ✅ | ❌ 可改任意项目（含 executionResults 合并） | ⚠️ |
| POST `.../save-image` | ✅ | ❌ | ⚠️（propImage 每次新增不查重，重复保存会堆积重复道具图） |
| POST `.../save-video` | ✅ | ❌ | ⚠️（updateMany 未命中 segmentId 时静默成功） |
| DELETE `.../project/:id` | ✅ | ❌ 可删任意项目 | ⚠️ |
| POST `.../upload-reference` | ✅ | — | ✅ |
| POST `.../clear-analysis` | ✅ | ❌ | ⚠️ |
| GET `/api/v2/workbench/local-file/:filename` | ❌ 无鉴权 | — | ❌ **路径穿越**（见问题 #1） |

- 加载链路返回 **raw Prisma 行**（aiCharacterSpecs/aiVideoSegments 等），与 `/api/aigc-spec/:id/load` 的适配器结构不同 → 前端两处读到的分镜结构不一致。

### 1.2 `routes/projects-v2.ts`（文件名 v2，路由却挂在 /api/v1/*）❌

| 端点 | 鉴权 | 结论 |
|---|---|---|
| POST `/api/v1/projects` | ❌ 无 | ❌ |
| GET `/api/v1/projects` | ❌ 无 | ❌ **返回全站所有用户的项目**，仅当 query.userId 传参时才在内存过滤（L154-156）；`projectService.findAll()` 全表查 |
| GET `/api/v1/projects/:id` | ❌ 无 | ❌ |
| GET `/api/v1/projects/:id/stream` | ❌ 无 | ❌ SSE 为**模拟进度**（假数据），且 setTimeout 在客户端断开后仍会执行（仅 broadcast 到空集合，泄漏较轻） |
| PUT / DELETE / DELETE `:id/clear` | ❌ 无 | ❌ 任何人可改/删任意项目 |

> 该文件是 V1 遗留（`/api/v1/projects`），但仍在 `index.ts:325` 注册，是当前最严重的越权/数据泄露面。`/api/v1/projects` 不在 authPlugin 的全局拦截前缀列表中，也不在 GEO 强制认证列表。

### 1.3 `routes/aigc-spec-db.ts`（spec 存取）⚠️

- ✅ projectId UUID 格式校验（L20-26，防 `[object Object]`）
- ❌ **`dbEmotionMap` 未定义**（L198）：保存请求含 `emotionSpecs` 时抛 ReferenceError，整个事务回滚 → 500。定义处只有 `dbSceneMap/dbSegMap/dbCharMap/dbEffectMap/dbActionMap/dbCameraMap/dbPropMap`（L65-71）
- ⚠️ 无归属校验：任意登录用户可 save/load 任意项目
- ⚠️ saveHandler/loadHandler 均无 try/catch；body 为空时 `request.body` 解构抛 TypeError → 500
- ⚠️ 全量 deleteMany+createMany 替换式写入：并发保存互相覆盖（读取 DB fallback 只缓解单字段丢失，不解决并发）
- ⚠️ `aiVideoSegment` 唯一键 `[projectId, segmentId]`：前端传重复 segmentId 会唯一键冲突 → 500
- ❌ **读写的真相源断裂**：save 写 `ai_video_segments`，load 却返回 `loadStoryboardDisplay()` 的适配器结构（visualDescription/source/raw），保存的 `associatedScenes/duration/narrativePurpose/fullText/backgroundMusic` 等字段 load 时不再原样返回
- ⚠️ load 返回 `propSpecs`（ai_prop_specs 表）但 save **从不写** ai_prop_specs（只写 prop_image）→ 该字段永远返回旧值/空
- ⚠️ 副作用：save 时把 pipeline_stages `script-analysis` upsert 为 done

### 1.4 `routes/storyboards.ts`（旧分镜 CRUD）❌

- ❌ **L57 `env` 未定义**：文件无 `import { env }`，全项目也无 `globalThis.env` 注入 → `env.DEEPSEEK_API_KEY` 抛 ReferenceError，`/api/projects/:projectId/storyboards/generate` **必然 500**（`// @ts-nocheck` 掩盖了编译错误）
- ❌ **写入字段与 schema 不符**：generate 写 `sceneDescription/cameraAngle/movement/dialogue/notes/prompt`（L114-123），但 `Storyboard` 模型（schema L482-511）只有 `shotType/subject/action/expression/cameraMovement/lens/...`，`storyboardService.create` 透传 rest → Prisma 校验错误 → 500（mock 分支 L31-36 同样中招）
- ⚠️ 所有 CRUD 无归属校验
- ⚠️ 返回裸 Prisma 数组（无 `{success,data}` 信封），与其他路由风格不一致
- ⚠️ L76-91 内联硬编码分镜师 system prompt

### 1.5 `routes/scenes.ts` ⚠️

- CRUD 操作的是 **SceneProfile** 表（不是 V2 工作台的 aiSceneSpec）→ 并行场景数据源
- 无归属校验；`findById` 未命中返回 null（200），不返回 404

### 1.6 `routes/script-submit.ts`（剧本提交/拆解）❌

| 端点 | 鉴权 | 结论 |
|---|---|---|
| POST `/api/script/submit` | ❌ 无 authenticate | ❌ userId 可伪造（见下） |
| POST `/api/v1/script/parse` | ❌ | ❌ 同上 |
| POST `/api/script/regenerate` | ❌ | ❌ 同上 |

- ❌ **resolveUserId 伪造链**（L11-42）：① 无 authenticate 时手动 base64 解码 JWT payload **不验签**（L19-30）→ 任何人可自造 `header.payload.任意签名` 冒充任意 userId；② 直接信任 body.userId（L33）；③ projectId 反查。该 userId 会传给 `narrativeGateway.execute` → **注入受害者 UserModelConfigV2 的 API Key 消耗他人额度**（narrative-gateway.ts L389-416 injectUserApiKey 按 userId 取 key）
- ❌ `saveProject`（L45-73）按 body.projectId 直接 update，**无归属校验** → 可覆盖他人项目的 script/executionResults
- ✅ 优点：schemaGuard 校验（422）、P18 双轨渲染 fire-and-forget、executionResults 合并保留 key
- ⚠️ 内联 prompt 组装（L319 读 DB 模板 ✅；L557 六维快照 user prompt 内联，heuristic fallback 内联 L596-637）

### 1.7 `routes/script-breakdown.ts` ⚠️

- ❌ 所有端点无 authenticate：GET 列表返回**全站所有拆解任务含完整剧本原文**（L90-104）
- ⚠️ userId 从 body/`x-user-id` 头读取（L125-127）→ 可伪造；submit 时用该 userId 调 gateway → 盗用他人 key
- ⚠️ 无归属校验：GET /:id、submit 任意任务
- ⚠️ L230-236 用 `project.name === record.title` 模糊匹配项目 → 同名项目会写错项目
- ⚠️ 并发 submit 无状态锁（两个请求同时读到 status 0 → 都跑 LLM）
- ⚠️ `getAnalyzeV2Prompt()` 抛错时无 try/catch → 500（POST create L106-107）
- ✅ prompt 从 DB PromptTemplate 读取，禁止硬编码 ✅

### 1.8 `routes/ai-tasks.ts` ⚠️

| 端点 | 结论 |
|---|---|
| POST `/api/tasks/ai-generate` | ⚠️ authenticate ✅ + 每日配额 ✅；但 projectId 未校验归属（可对他人项目建任务/写 videoTask）；projectId 不存在时自动建临时项目（L74-92）；输入参数序列化存进 `error` 字段（L95-103，字段滥用） |
| GET `/api/tasks/:id/status` | ⚠️ **无任务归属校验**：任意登录用户按 id 读他人任务的 error（内含完整 input prompt）与结果 |
| GET `/api/tasks/:id/result` | ⚠️ 同上 |
| POST `/api/tasks/batch-create` | ❌ **无配额检查**、无 provider 解析、可无限批量建任务 → 成本滥用 |
| POST `/api/provider-cache/cleanup` | ✅ |

### 1.9 `routes/ai-optimize-*.ts`（优化接口族）

| 文件 | prompt 来源 | 配额/会员 | 注册 | 结论 |
|---|---|---|---|---|
| ai-optimize-shot.ts | DB `director-of-photography`（seed ✅） | ❌ 无 | ✅ | ✅ 无状态，userId 验签 ✅ |
| ai-optimize-storyboard.ts | `getPrompt('storyboard-designer')`（**未在 seed**） | ❌ 无 | ❌ **未注册（index.ts 无引用）** | ❌ 死路由 |
| ai-optimize-frame-prompt.ts | DB `frame-designer`（seed ✅） | ❌ 无 | ✅ | ✅ |
| ai-optimize-video-prompt.ts | DB `video-prompt-designer`（seed ✅） | ✅ 配额+会员 | ✅ | ✅ 但配额检查失败时**放行**（L71-78 fail-open） |
| ai-optimize-ad-script.ts | DB `ad-script-designer`（**未在 seed**）→ **内联兜底大 prompt**（L22-55） | ✅ 会员、无配额 | ✅ | ⚠️ 违背禁硬编码政策 |
| ai-optimize-image-prompt.ts | **整段 systemPrompt 内联硬编码**（L36） | ✅ 会员、无配额 | ✅ | ⚠️ 唯一完全内联的优化接口 |

- 各优化接口均无 DB 写操作、无归属问题；成本控制（配额）在 6 个接口中只有 1 个做了，明显不一致。

### 1.10 `agents/`

| 文件 | 结论 |
|---|---|
| aigc-spec-agent.ts（deprecated） | ⚠️ `_buildTypePrompt`（L288-421）内联 5 套完整 JSON Schema 提示词 + variant 规则（L462-480）；**duration 约束 5-8 秒**（L353）与 v2 的 8-10 秒（v2 L114）矛盾；当前无人调用（仅导出单例） |
| aigc-spec-agent-v2.ts（deprecated） | ✅ prompt 走 buildPromptCached（DB）；校验仅 warn 不阻断（L113-121）——「严格 type enforcer」名不副实 |
| script-breakdown-master.ts | ❌ `getPrompt('剧本拆解总导演')`（L46-52）**未在 seed**（seed 只有「剧情总指挥」）→ 调用必失败；`promptTemplate.replace('{剧本内容}', storyText)`（L58）占位符缺失时静默丢剧本 |

### 1.11 `services/`

| 文件 | 结论 |
|---|---|
| storyboard.service.ts | ❌ L11-12 `...rest` 透传任意字段 → 与 Storyboard schema 不符即 Prisma 抛错（storyboards generate 500 的根因） |
| storyboard-quality-gate.ts（deprecated） | ⚠️ L263/L310 两段内联 prompt；无归属无配额（LLM 补全成本可被滥用） |
| storyboard/storyboard-display-adapter.ts | ⚠️ 展示链 AiVideoSegment > AiSceneSpec > StoryboardImage；`buildDescriptionFromSegment` 读 `s.dialogue` 但 AiVideoSegment 无该字段（dialogue 在 AiSegmentEdit）——漂移痕迹；「唯一 SSOT」实际是派生视图 |
| artifact-sync.service.ts | ⚠️ ai_* 表全量替换写（deleteMany+createMany）；props/effects 用 `$executeRawUnsafe`（参数化 ✅ 无注入）；**无事务**，中途失败留下半新半旧数据；逐条 create 循环 N+1；与 aigc-spec-db/workbench/projects.ts/project-hydrate 构成 4 条并发替换写路径 |

### 1.12 其它发现

- `routes/workbench-director.ts`（911 行）：**未在 index.ts 注册**（死代码）。若启用：多数端点无 authenticate；`requireMemberTierByPolicy` 依赖 `request.user` 但自己不验签 → 会员拦截永远 401，无拦截端点则完全公开。
- authPlugin 全局钩子只覆盖 GEO 前缀 + AI 白名单前缀（plugins/auth.ts L11-24），工作台系列依赖各路由自行挂 `authenticate`，漏挂即裸奔。

---

## 2. 数据写入路径图

```
┌─ 剧本提交 ──────────────────────────────────────────────────────────┐
│ /api/script/submit ──► Project.executionResults(JSON)              │
│        └─► artifact-sync ──► ai_character_specs / ai_scene_specs   │
│            (analyzeV2Data.normalized)   ai_voice_configs           │
│                                         ai_video_segments          │
│                                         ai_prop_specs(raw SQL)     │
│                                         ai_effect_specs(raw SQL)   │
│                                         ai_video_productions       │
├─ 剧本拆解(旧) ──────────────────────────────────────────────────────┤
│ /api/v1/script-breakdown/:id/submit ──► script_breakdown(表)       │
│        └─► PipelineMaterializer ──► pipeline_stages + project      │
├─ 规格表保存(灵感页) ─────────────────────────────────────────────────┤
│ /api/aigc-spec/:projectId/save ──► 全量 delete+create：            │
│   ai_character_specs ai_scene_specs ai_voice_configs               │
│   ai_video_segments ai_frame_designs ai_video_productions          │
│   ai_effect_specs ai_action_specs ai_camera_specs ai_emotion_specs │
│   prop_images + pipeline_stages(script-analysis=done)              │
├─ 工作台图片/视频 ────────────────────────────────────────────────────┤
│ /api/v2/workbench/project/:id/save-image ──► character_images      │
│                                  scene_images / storyboard_images  │
│                                  prop_images（每存一条新记录）        │
│ /api/v2/workbench/project/:id/save-video ──► ai_video_segments.    │
│                                              videoUrl(updateMany)  │
├─ 执行图(旧) ────────────────────────────────────────────────────────┤
│ /api/execution-images/storyboards ──► storyboard_images(upsert)    │
│ /api/projects(旧 V1 拆解) ──► ai_character_specs / ai_scene_specs  │
│                                ai_video_segments                   │
│ project-hydrate ──► 同上三表                                        │
├─ 任务队列 ──────────────────────────────────────────────────────────┤
│ /api/tasks/ai-generate / batch-create ──► video_tasks + task_queue │
│                                          + task_logs               │
└────────────────────────────────────────────────────────────────────┘

读取侧（前端真相源矛盾）：
  workbench GET /:id        ──► raw ai_* 行（Prisma include）
  aigc-spec GET /load       ──► loadStoryboardDisplay 适配器结构
  storyboards GET           ──► Storyboard 表（legacy，已坏）
  scenes GET                ──► SceneProfile 表（与 aiSceneSpec 平行）
  executionResults          ──► script-submit 写入的 JSON 快照
```

**关键矛盾**：同一「分镜/段落」数据被 4 处全量替换写入（aigc-spec-db / artifact-sync / projects.ts / project-hydrate），segmentId 命名各不一致（`seg_0`、`scene_0`、`seg_${i}`、UUID），任意两处先后执行即互相清空。前端保存→加载读到的字段结构也不一致。

---

## 3. 问题列表（按严重级别）

### 🔴 Critical

| # | 位置 | 问题 |
|---|---|---|
| 1 | `routes/workbench-project.ts:392-402` | `/api/v2/workbench/local-file/:filename` 无鉴权 + `path.join(uploadsDir, filename)` 路径穿越：`/api/v2/workbench/local-file/..%2F..%2F..%2F..%2Fetc%2Fpasswd` 可读取服务器任意文件 |
| 2 | `routes/projects-v2.ts:144-180` | `/api/v1/projects` 无鉴权且返回**全站所有用户**项目列表（findAll + 内存过滤），全量隐私泄露 |
| 3 | `routes/projects-v2.ts`（全部端点） | `/api/v1/projects*` 无任何鉴权：可读/改/删任意用户项目，SSE 可被任意触发 |
| 4 | `routes/script-submit.ts:19-30` | JWT payload base64 解码**不验签**即信任 userId；配合 body.userId（L33）→ 伪造身份 → narrativeGateway 按 userId 注入受害者 API Key（narrative-gateway.ts:389-416）→ **LLM Key 盗用/账单攻击** |
| 5 | `routes/aigc-spec-db.ts:198` | `dbEmotionMap` 未定义：任何带 emotionSpecs 的保存请求抛 ReferenceError → 整个事务回滚 → 500，且事务内所有表已被 deleteMany（回滚后无残留，但功能完全不可用） |
| 6 | `routes/storyboards.ts:57` | `env` 未定义（无 import、无全局注入）→ `/api/projects/:projectId/storyboards/generate` 必然 ReferenceError 500 |
| 7 | `routes/storyboards.ts:114-123` + `services/storyboard.service.ts:11-12` | 写入 `sceneDescription/cameraAngle/movement/dialogue/notes/prompt` 等 **Storyboard 模型不存在**的字段 → Prisma 校验错误 500；该表 CRUD 实际不可用 |

### 🟠 High

| # | 位置 | 问题 |
|---|---|---|
| 8 | `workbench-project.ts` GET/PUT/DELETE/save-image/save-video/clear-analysis | 全部只验登录、不验项目归属：任意登录用户可读/改/删任意项目（IDOR） |
| 9 | `aigc-spec-db.ts` save/load | 同上：任意登录用户可读写任意项目 spec（含覆盖 ai_video_segments 等） |
| 10 | `script-breakdown.ts:90-104` | 无鉴权列表返回全站拆解任务（含完整剧本原文） |
| 11 | `script-breakdown.ts:125-127` | userId 接受 body/`x-user-id` 头 → 伪造 userId → 用他人 key 跑 LLM；submit 时项目按 title 模糊匹配（L230-236）可能写错项目 |
| 12 | `ai-tasks.ts:74-92` | ai-generate 对已存在项目不校验归属；projectId 无效时自动创建「临时项目」——攻击面 + 脏数据 |
| 13 | `ai-tasks.ts:132-217` | GET status/result 无任务归属校验 → 读他人任务的 input prompt（存在 error 字段）与生成结果 |
| 14 | `ai-tasks.ts:219-256` | batch-create 无配额/无 provider 校验、无限批量 → 成本滥用 + 绕过日配额 |
| 15 | `artifact-sync.service.ts` | ai_* 全量替换写无事务 + 与 aigc-spec-db 等并发替换 → 数据互相清空（经典 last-writer-wins 竞态）；props/effects raw SQL 列名与 @map 混合（props 用 snake_case、effects 用 camelCase 引号）脆弱易碎 |
| 16 | `script-submit.ts:45-73` | saveProject 按 body.projectId 无归属 update → 覆盖他人项目 script/executionResults |
| 17 | `aigc-spec-db.ts` loadHandler | 返回 `propSpecs`(ai_prop_specs) 但 save 从不写该表 → 前端读到的道具规格永远陈旧/空 |
| 18 | `agents/script-breakdown-master.ts:46-52` | `getPrompt('剧本拆解总导演')` 未在 seed（seed 中只有「剧情总指挥」）→ 调用必失败，orchestrator（aigc-orchestrator.ts:403-405）调用链断裂 |

### 🟡 Medium

| # | 位置 | 问题 |
|---|---|---|
| 19 | `aigc-spec-db.ts` saveHandler/loadHandler | 无 try/catch；body 缺失解构 TypeError → 500；重复 segmentId 唯一键冲突 → 500 |
| 20 | `ai-optimize-*.ts` | 配额控制仅 video-prompt 有；且 video-prompt 配额检查异常时 fail-open（L71-78） |
| 21 | `ai-optimize-image-prompt.ts:36` | systemPrompt 整段内联硬编码（政策禁止）；ad-script 兜底大 prompt 内联（L22-55） |
| 22 | `ai-optimize-storyboard.ts` | 未在 index.ts 注册（死路由）；prompt 名 `storyboard-designer` 未 seed |
| 23 | `aigc-spec-agent.ts:288-480` | deprecated 但内联 5 套类型 prompt + variant 规则；duration 5-8s 与 v2 的 8-10s 矛盾（两代 agent 并存约束漂移） |
| 24 | `storyboards.ts:29-30, 76-91` | 返回裸数组无信封；内联分镜师 prompt |
| 25 | `workbench-project.ts:207-221` | propImage 保存不查重，重复保存产生重复道具记录 |
| 26 | `workbench-project.ts:65-66` | POST create 的 catch 日志误写为「GET /:id 错误」（复制粘贴错误） |
| 27 | `workbench-project.ts:31-33` | `userId \|\| 'default'` 兜底：若鉴权被绕过/降级，全部请求写入同一 'default' 用户 |
| 28 | `scenes.ts` | SceneProfile 与 aiSceneSpec 平行双写；findById 未命中返回 200 null |
| 29 | `ai-tasks.ts:95-103` | 任务输入序列化存入 `error` 字段（字段语义滥用，且被 status 接口原样返回） |
| 30 | `storyboard-quality-gate.ts:263,310` | deprecated 但内联 prompt 仍在；LLM 补全无配额控制 |
| 31 | `script-breakdown.ts` | 并发 submit 无状态锁；create 时 PromptTemplate 缺失抛错无捕获 → 500 |

### 🔵 Low

- `storyboard-display-adapter.ts` 读 `s.dialogue`（AiVideoSegment 无此字段，实际在 AiSegmentEdit）——类型漂移。
- `aigc-spec-agent-v2.ts` 校验只 warn 不阻断（宣称「strict enforcer」实际不 enforce）。
- `projects-v2.ts` SSE 模拟进度 + 客户端断开后 setTimeout 仍调度。
- 文件名与路由不一致：`projects-v2.ts` 实际提供 `/api/v1/*`；`storyboards.ts`/`scenes.ts` 标 `@phase4-owner` 但已无主。

---

## 4. 修复建议（按优先级）

**P0 — 止血（安全/必然故障）**
1. local-file 路由：删掉或加 `authenticate` + 白名单校验 `path.basename(filename) === filename`，禁止路径穿越。
2. `/api/v1/projects*`：全部补 `authenticate`，列表按 `request.user.id` 过滤，读写删校验 `project.userId === userId`（或直接下线该 V1 路由）。
3. `resolveUserId`：只信任 `request.jwtVerify()` 结果，删除 base64 手解与 body.userId 回退；所有 /api/script/* 挂 `authenticate`。
4. `aigc-spec-db.ts`：补 `dbEmotionMap` 定义（`new Map(dbEmotions.map(e => [e.characterName + ':' + e.emotionType, e]))`）；saveHandler/loadHandler 包 try/catch。
5. `storyboards.ts`：`import { env } from '../config/env.js'`；`storyboardService.create` 改为显式字段映射（或直接废弃该 legacy 路由，由 aigc-spec 链路替代）。

**P1 — 越权收敛**
6. 工作台所有 `:id` 端点统一挂「项目归属中间件」：`findUnique(project)` + `project.userId === user.id`，否则 403。批量替换 workbench-project / aigc-spec-db / ai-tasks / script-submit / script-breakdown 中的裸 id 操作。
7. ai-tasks status/result 校验 `task.userId === user.id`（userId 需从 task.error JSON 或新字段取）。
8. batch-create 补配额检查与 taskType 白名单。

**P2 — 数据一致性（统一真相源）**
9. 收敛 ai_video_segments 写入路径：只保留 **一条** 规范化写入服务（如 artifact-sync v2），aigc-spec-db save 改为「写 executionResults + 调用该服务」，删掉 projects.ts / project-hydrate 的替换写。
10. 统一 segmentId 生成规则（如 `seg_<index>` 或 UUID 二选一），所有写路径一致；`StoryboardImage.segmentId` 必须与 `AiVideoSegment.segmentId` 对齐。
11. 明确 load 契约：`/api/aigc-spec/:id/load` 与 `workbench GET /:id` 返回同一结构（建议都返回 `loadStoryboardDisplay` 适配器结构，或都返回 raw 行），并在前端只读一个端点。
12. 道具统一：prop_image（图）与 ai_prop_specs（规格）合并或明确映射关系；save 时同时写两表或 load 时从 prop_image 派生 propSpecs。
13. artifact-sync 加事务（$transaction），props/effects raw SQL 统一列名风格。

**P3 — 治理**
14. prompt 全部收敛到 PromptRegistry：`ai-optimize-image-prompt` 内联 prompt 迁到 DB；ad-script 删除内联兜底（改为启动时校验缺失并告警）；`storyboard-designer`/`剧本拆解总导演`/`ad-script-designer` 补 seed；统一 prompt 命名风格（中文名 vs 英文名二选一）。
15. 优化接口族统一配额/会员中间件（参照 video-prompt），配额检查失败默认拒绝而非放行。
16. 清理死代码：ai-optimize-storyboard（未注册）、workbench-director（未注册）、deprecated 的 aigc-spec-agent / storyboard-quality-gate，或补注册并修鉴权。
17. 统一 API 信封（{success, data, error}）与错误码（404/422），禁止裸数组/裸 500 透传 err.message。

---

## 5. 附：审计未覆盖项

- 前端实际调用哪些端点（建议下一步对前端 fetch/axios 调用做反向映射，确认死路由与前端是否仍依赖）。
- `routes/pipeline.ts`、`routes/projects.ts` 全量审查（仅抽查了写入路径）。
- 数据库实际数据抽样验证（如 prop_image 重复堆积量、ai_prop_specs 是否恒空）。
