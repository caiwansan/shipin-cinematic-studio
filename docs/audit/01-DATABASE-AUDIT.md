# 01-DATABASE-AUDIT — 短剧工作台（studio/v2）数据库审计报告

- **审计对象**: `/root/shipin-cinematic-studio/backend/prisma/schema.prisma`（430 model / 9015 行）
- **审计范围**: 短剧工作台全流程 model（Project → 角色 → 场景 → 分镜 → 视频 → 用户订阅）
- **对照代码**:
  - 后端: `src/routes/workbench-project.ts`、`src/routes/aigc-spec-db.ts`、`src/routes/project-segment-state.ts`、`src/routes/script-submit.ts`、`src/routes/storyboards.ts`、`src/routes/ai-tasks.ts`、`src/queue/queue-manager.ts`、`src/queue/worker-runtime.ts`、`src/services/artifact-sync.service.ts`、`src/services/storyboard.service.ts`、`src/services/storyboard/storyboard-display-adapter.ts`、`src/services/project-hydrate.service.ts`、`src/utils/membership-tier.ts`、`src/middleware/require-member-tier.ts`、`src/payment/services/index.ts`、`src/payment/controllers/index.ts`
  - 前端: `frontend/studio-v2/stores/useStudioStore.ts`、`frontend/studio-v2/types/runtime/*`、`workspace/script-analysis/ScriptAnalysisWorkspace.vue`、`workspace/storyboard/StoryboardWorkspace.vue`、`workspace/video-generation/VideoGenerationWorkspace.vue`
- **审计方式**: 只读静态审计（未改任何文件）。生产库无法直连（`prisma/dev.db` 为 0 字节空文件），DB 列以 `schema.prisma` + `prisma/migrations/*` 为准，两者不一致处已标注为**迁移漂移风险**。

---

## 1. 结论速览

| Model | 结论 | 一句话说明 |
|---|---|---|
| Project | ⚠️ | 字段冗余多（`executionResults` 巨型 JSON 承担了半个业务），`script`/`executionResults.rawScript` 双份剧本 |
| AiCharacterSpec | ⚠️ | 是 executionResults 的镜像表；迁移缺 `role`/`voice_type` 列 |
| AiSceneSpec | ⚠️ | 是 executionResults 的镜像表；迁移缺 `type/time_of_day/lighting/mood/color_tone/environment` 列 |
| AiVideoSegment | ⚠️ | 分镜段落三处并存的源头之一；迁移缺 `full_text/first_frame_*/mid_frame_*/last_frame_*/narrative` 列；迁移多出 schema 没有的 `timeline_json` 等死列 |
| AiSegmentEdit | ⚠️ | 与 `executionResults.segments` 并存同一份「段编辑状态」，两条持久化通道互不感知 |
| AiFrameDesign | ⚠️ | 只有 aigc-spec save 一个写入方；artifact-sync 明确"暂不写入"；前端只读第一条 |
| AiVideoProduction | ✅ | 1:1 upsert，写入方 2 个（artifact-sync / aigc-spec save），语义清晰 |
| AiEffectSpec | ⚠️ | 写入走 raw SQL（camelCase 列名），表列命名与其他 ai_* 表（snake_case）不一致 |
| AiActionSpec / AiCameraSpec / AiEmotionSpec | ⚠️ | 无 artifact-sync 写入方；只在 aigc-spec save 写、aigc-spec load 读；v2 前端 store 完全不用 |
| AiPropSpec | ❌ | **全库无任何 migration**；写入走 raw SQL 且**漏掉必填 id 列**（Prisma `@default(uuid())` 是客户端生成，DB 无默认值），写入必然失败被 try/catch 吞掉；workbench GET include 了它，表不存在时整个加载接口 500 |
| Storyboard | ❌ | 遗留死表：唯一写入口 `storyboards.ts` 传的字段（sceneDescription/cameraAngle/movement/lens/dialogue/notes/prompt）**在 model 中全部不存在**，运行时必抛 Prisma 校验错误；v2 实际用 AiVideoSegment 当分镜 |
| VideoTask | ⚠️ | `error` 字段被滥用作输入暂存 + 成功输出容器；`progress` 无更新方；`storyboardId` 外键在 v2 流程从不写入 |
| VideoSegment | ❌ | 孤儿表：全后端只有 mock-worker 写入，v2 视频结果落在 `ai_video_segments.video_url` + `Asset` |
| User / Membership | ⚠️ | 会员等级双真相源：`User.memberTier` 与 `Membership.tier`；部分支付路径只写其一，中间件读 JWT 旧值 |
| CharacterProfile / SceneProfile | ⚠️ | 遗留表（老版工作台），v2 全流程不再读写，与 Ai* 表并存同语义数据 |
| Character / Scene / 叙事系（World/Observer/Event…） | ⚠️ | 遗留叙事系统，v2 工作台不消费 |

> 结论: **短剧工作台不存在"统一真相源"。** 同一份业务数据（角色/场景/分镜段/道具/视频结果）普遍存在 2~4 个载体，写路径分散、读路径靠前端 fallback 链兜底，是本次审计最核心的问题（详见 §3、§4）。

---

## 2. 数据流真相源分析

### 2.1 剧本分析链路（谁写谁读）

```
用户提交剧本
   │
   ▼
POST /api/script/submit (script-submit.ts:88)
   ├─▶ aigcOrchestrator.generate()  ──▶ 结果写 Project.executionResults (JSON)   【① 主真相源】
   └─▶ syncArtifactsFromExecution() (artifact-sync.service.ts)
          ├─▶ ai_character_specs     【② 镜像】deleteMany + recreate
          ├─▶ ai_scene_specs         【② 镜像】deleteMany + recreate
          ├─▶ ai_voice_configs       【② 镜像】deleteMany + recreate
          ├─▶ ai_video_segments      【② 镜像】deleteMany + recreate（逐条 create）
          ├─▶ ai_prop_specs          【❌ 幽灵表】raw SQL 缺 id 列 → 静默失败
          ├─▶ ai_effect_specs        【② 镜像】raw SQL（camelCase 列）
          └─▶ ai_video_productions   【② 镜像】upsert
   （ai_action/ai_camera/ai_emotion/ai_frame_design: artifact-sync 不写！）

前端 ScriptAnalysisWorkspace.vue:532 另调 POST /api/aigc-spec/:projectId/save (aigc-spec-db.ts)
   └─▶ 事务内 deleteMany 全部 ai_* 表 + createMany 重写
          ├─▶ character/scene/voice/videoSegment/frameDesign/videoProduction
          ├─▶ effect/action/camera/emotion
          └─▶ propSpecs/props/propImages ──▶ 全部写入 prop_images 表（规格无图也进图片表！）
```

**读取链**:
- `GET /api/v2/workbench/project/:id`（workbench-project.ts:107）→ include 11 张表（**缺 aiSegmentEdits / aiActionSpecs / aiCameraSpecs / aiEmotionSpecs / aiVideoProduction / ttsRecords**）
- 前端 `loadFromServer`（useStudioStore.ts）→ 依次取 `aiCharacterSpecs` → fallback `executionResults.characters`；`aiSceneSpecs` → fallback `executionResults.sceneSpecs`；`aiVideoSegments` → fallback `executionResults.videoSegments` / `plotBlueprint.segments`；段编辑最终被 `executionResults.segments` **整体覆盖**
- 分镜页 `StoryboardWorkspace.vue:646` → `GET /api/aigc-spec/:projectId/load`（StoryboardDisplayAdapter: `AiVideoSegment > AiSceneSpec > StoryboardImage > empty`）

### 2.2 视频生成链路

```
VideoGenerationWorkspace.vue:738  GET /api/projects/segments/:projectId ──▶ ai_video_segments + ai_segment_edits
VideoGenerationWorkspace.vue:795  POST /api/projects/segments/save    ──▶ ai_video_segments（帧URL/描述/videoUrl）+ ai_segment_edits（编辑内容/参考图）
        │
        ▼
POST /api/tasks/ai-generate (ai-tasks.ts:84) ──▶ video_task（input 存进 error 字段）
        ▼
queue-manager.ts:204 / worker-runtime.ts:1069 视频完成
   ├─▶ ai_video_segments.video_url = 本地下载 URL        【③ 视频结果载体 A】
   ├─▶ video_task.error = {output:{url}}                 【③ 载体 B（成功输出塞进"error"字段）】
   └─▶ （Asset 表另有 /api/projects/:id/assets 渠道）      【③ 载体 C】
```

### 2.3 同一份数据的三处/多处并存（核心矛盾）

| 业务数据 | 载体 1（主） | 载体 2 | 载体 3 | 载体 4 |
|---|---|---|---|---|
| 剧本原文 | `Project.script` | `Project.executionResults.rawScript` | — | — |
| 角色 | `executionResults.characterSpecs` | `ai_character_specs`（镜像） | `CharacterProfile`（遗留） | `Character`（遗留叙事） |
| 场景 | `executionResults.sceneSpecs` | `ai_scene_specs`（镜像） | `SceneProfile`（遗留） | `Scene`（遗留叙事） |
| 分镜段落 | `executionResults.segments`（用户编辑） | `ai_video_segments`（AI 分析+编辑+videoUrl） | `executionResults.videoSegments`（AI 分析） | `Storyboard`（遗留/破损） |
| 段编辑状态 | `executionResults.segments`（workbench PUT） | `ai_segment_edits`（segments/save） | — | — |
| 道具 | `executionResults.propSpecs` | `prop_images`（含无图规格） | `ai_prop_specs`（幽灵表） | `PropLibrary`（静态库） |
| 特效 | `executionResults.effectSpecs` | `ai_effect_specs`（镜像） | — | — |
| 视频结果 | `ai_video_segments.video_url` | `video_task.error`（JSON） | `Asset.filePath` | — |
| 会员等级 | `Membership.tier`（SSOT 声明） | `User.memberTier`（遗留兼容） | JWT 内 memberTier（登录时快照） | — |

**写方矩阵（谁写）**:

| 表 | script-submit→artifact-sync | aigc-spec save | workbench PUT | segments/save | 队列/worker | save-image/save-video |
|---|---|---|---|---|---|---|
| executionResults | ✅ 写 | ❌ | ✅ 写 | ❌ | ❌ | ❌ |
| ai_character_specs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ai_scene_specs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ai_voice_configs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ai_video_segments | ✅ | ✅ | ❌ | ✅ | ✅ videoUrl | ✅ videoUrl |
| ai_segment_edits | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| ai_frame_designs | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ai_prop_specs | ✅(失败) | ❌ | ❌ | ❌ | ❌ | ❌ |
| ai_effect/action/camera/emotion | 仅 effect | ✅ | ❌ | ❌ | ❌ | ❌ |
| ai_video_productions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| character/scene/storyboard/prop_images | ❌ | ✅(含 prop) | ❌ | ❌ | ✅ character/scene/storyboard | ✅ character/scene/storyboard/prop |
| storyboard（旧表） | ❌ | ❌ | ❌ | ❌ | mock-worker 读 | ❌ |
| video_task | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

> 结论：**任何一张 ai_* 表都不是唯一写入方**；同一批 AI 分析结果会先后被 artifact-sync 和 aigc-spec save 两个通道各写一遍（互不感知、字段口径不同、均为 deleteMany+重建）。任何一次"重新分析"都会**清空**对应表，而 `executionResults.segments`（用户导演编辑）会被 script-submit 显式 `delete merged.segments`（script-submit.ts:137）——**用户编辑在重新分析时被有意丢弃**，属设计决策但风险极高。

---

## 3. 各 Model 审计结论明细

### 3.1 Project（schema.prisma:111）
- ✅ 主键/外键：`userId` 必填级联、`tenantId`/`ownerId`/`workspaceId` 可选关系齐全。
- ⚠️ **巨型 JSON 反模式**：`executionResults` 一个字段承载角色/场景/分镜段/道具/特效/对白/情绪/风格/流水线状态 ≈ 半个业务库，与 8 张 ai_* 表内容重叠（见 §2.3），是"多表并存"的根源。
- ⚠️ **剧本双份**：`script` 与 `executionResults.rawScript` 并存，workbench GET 前端 `p.script || p.executionResults?.rawScript` 兜底，无一致性保证。
- ⚠️ 冗余/孤儿字段：`plotBlueprint`/`continuationFrom`/`runtimeCheckpoint`/`failureEvents`/`executionJournal` 只有旧管线读写；`mergedVideoUrl`/`mergeStatus` 由 video-merge 写，但**migrations 中无对应列**（见 §4-9）。
- ✅ 无 `@@index([userId])`，但按 userId 查项目走的是 `userId` 无索引列（`workbench-project.ts` projects 列表按 `userId` 过滤）——数据量大时全表扫。

### 3.2 AiCharacterSpec（schema.prisma:185）
- ✅ `@@unique([projectId, characterName, variant])` 覆盖按 projectId 前缀查询。
- ⚠️ 与 `executionResults.characterSpecs` 双源（前端 loadFromServer 先读表、空则读 JSON）。
- ⚠️ 迁移漂移：baseline migration（20260531）无 `role`、`voiceType(voice_type)` 列；若生产库走 migrate 而非 db push，artifact-sync 写角色会整段失败（外层 catch 吞掉）。

### 3.3 AiSceneSpec（schema.prisma:226）
- ✅ `@@index([projectId])`。
- ⚠️ 与 `executionResults.sceneSpecs` / `executionResults.workspaceScenes`（用户编辑）双源并存。
- ⚠️ 迁移漂移：baseline 无 `type/time_of_day/lighting/mood/color_tone/environment` 六列（全部 @map snake_case），artifact-sync 与 StoryboardDisplayAdapter 都依赖这些列。
- ⚠️ 写路径语义不一致：artifact-sync 与 downgradeSync 对 `sceneId` 处理不同（前者逐条 create、后者 upsert），且 `aspectRatio` 被硬编码 `'9:16'`（schema 默认 `'16:9'`，artifact-sync.service.ts:78/435 写死 9:16，与 3.5 节 AiVideoProduction 默认 1920x1080 的 16:9 冲突）。

### 3.4 AiVideoSegment（schema.prisma:288）
- ✅ `@@unique([projectId, segmentId])` 兼作 projectId 前缀索引。
- ❌ **分镜段三源并存的核心**：AI 分析（artifact-sync/aigc-spec）、段编辑状态（segments/save）、视频结果（worker/queue-manager）三路写同一张表，外加 `executionResults.segments`/`videoSegments` 两个 JSON 平行宇宙（见 §2.3）。
- ⚠️ 迁移漂移（双向）：migrations 无 `full_text/first_frame_url/mid_frame_url/last_frame_url/first_frame_desc/mid_frame_desc/last_frame_desc/narrative` 列；反而 migrations（20260528）有 `timeline_json/characters_json/scenes_json/graph_hints_json/continuity_json` 五列在 schema 中**不存在**且后端已无任何写入方（死列，旧版本段运行时数据）。
- ⚠️ 前端契约缺口：store 读 `seg.imagePrompt/negativePrompt`（useStudioStore.ts:613-614），**model 无这两个字段**（仅 segment 0 用 aiFrameDesigns 兜底）。
- ⚠️ `segmentId` 命名不统一：`seg_3` / `3` / `scene_0` / UUID 混用，queue-manager 靠 `!startsWith('seg_')` 字符串补前缀兜底（queue-manager.ts:226），脆弱。

### 3.5 AiSegmentEdit（schema.prisma:318）
- ✅ `@@unique([projectId, segmentId])`。
- ⚠️ **与 `executionResults.segments` 完全重复**：video-generation 页读写 aiSegmentEdit（project-segment-state.ts），store 读写 executionResults.segments（workbench PUT），两条通道互不感知。workbench GET 也不 include 它——全量加载契约缺这张表。
- ⚠️ 参考图字段 `charImageUrls/sceneImageUrls/propImageUrls` 用 String 存 JSON（序列化开销 + 无约束），与 AiPropSpec 的 Json 字段风格不一致。

### 3.6 AiFrameDesign（schema.prisma:345）
- ✅ `@@index([projectId])`。
- ⚠️ 写入方仅 aigc-spec save（且只写 first/last 帧，mid 帧字段缺失——model 无 midFrame*）；artifact-sync 注释明确"暂不写入 frames"；前端仅读 `aiFrameDesigns[0].firstFramePrompt` 兜底（useStudioStore.ts:601）。
- ⚠️ `segmentId` 无外键、无唯一约束，同一段可多条 frameDesign（save 里 deleteMany+重建可接受，但语义上是 1:1 却建成 1:N）。

### 3.7 AiVideoProduction（schema.prisma:365）
- ✅ `projectId @unique` 1:1，写入方 2 个（artifact-sync upsert / aigc-spec save create-after-delete），语义清晰。
- ⚠️ 前端 v2 store 从不读取该表（风格从 `executionResults.videoStyle/aspectRatio` 恢复），表实际只在 aigc-spec load 被消费——又一个"写了没人读"的镜像。

### 3.8 AiEffectSpec / AiActionSpec / AiCameraSpec / AiEmotionSpec（schema.prisma:382/403/442/461）
- ✅ 均有 `@@index([projectId])`。
- ⚠️ 写入用 **raw SQL + 引号 camelCase 列名**（artifact-sync.service.ts:181-190、464-478），而 AiPropSpec 用 snake_case——同属 ai_* 系列，列命名风格分裂，且 raw SQL 绕过了 Prisma 类型校验。
- ⚠️ Action/Camera/Emotion 无 artifact-sync 写入方；v2 store 完全不读这三张表（只读 executionResults）。Camera 按 `segmentId` 建 Map 去重（aigc-spec-db.ts:77），同段多机位时后写覆盖。
- ⚠️ AiEmotionSpec 无任何唯一/复合约束，aigc-spec save 每次 deleteMany+重建，可接受但无兜底。

### 3.9 AiPropSpec（schema.prisma:423）
- ❌ **全 migrations 无此表**（`grep -r "ai_prop_specs" migrations/` = 0 命中）；代码注释自认"表可能未创建"（artifact-sync.service.ts:157-158）。
- ❌ artifact-sync 写入 SQL 漏 `id` 列（artifact-sync.service.ts:167）：Prisma `@default(uuid())` 为客户端生成、DB 无默认值 → INSERT 必报 NOT NULL 违例 → 被 try/catch 吞掉（"不影响主流程"）→ **道具从未通过 artifact-sync 落库**。
- ❌ workbench GET include `aiPropSpecs`（workbench-project.ts:113）无 try/catch：表不存在时整个 `GET /api/v2/workbench/project/:id` 抛 P2021 → **项目加载接口 500**（依赖 db push 或手工建表才能跑通）。
- ⚠️ 与 `prop_images` 语义重叠：aigc-spec save 把"无图的规格"也写进 prop_images（aigc-spec-db.ts:253-280），图片表混存规格数据。

### 3.10 Storyboard（schema.prisma:482）
- ❌ **字段契约断裂**：`routes/storyboards.ts` 的 generate 接口产出/回传 `sceneDescription/cameraAngle/movement/lens/dialogue/notes/prompt`（storyboards.ts:61-63、121-126），Storyboard model **一个都没有**；`storyboard.service.ts:13-15` 无脑 `...rest` 展开 → `prisma.storyboard.create` 必抛 PrismaClientValidationError。该接口只要被调用就 500。
- ⚠️ v2 工作台不用此表（分镜展示走 StoryboardDisplayAdapter 的 AiVideoSegment 链）；唯一生产读者是 mock-worker 与 knowledge-hub story.provider。**实质上是死表**，建议与 AiVideoSegment 合并或归档。
- ✅ `@@index([projectId])` 存在。

### 3.11 VideoTask（schema.prisma:512）
- ✅ `@@index([projectId])`、`idempotencyKey @unique`。
- ⚠️ **`error` 字段语义滥用**：ai-tasks.ts:84 用 `error` 暂存任务输入；queue-manager.ts:204-213 用 `error` 存 `{output: result}`（成功输出）；语义完全错位，任何按 error 排查问题的操作都会被误导。
- ⚠️ `progress` 字段在队列/worker 全链路**无更新方**（仅初始 0），前端轮询只能看到 queued/running/completed/failed，进度条永远 0。
- ⚠️ `storyboardId` 外键在 v2 流程从不写入（任务靠 `payload.input.segmentId` 关联，无 DB 级关联）；`VideoSegment` 子表实际无人写（只有 mock-worker）。

### 3.12 User / Membership（schema.prisma:24 / 680）
- ⚠️ **会员等级双真相源**：`User.memberTier/memberExpiresAt` 与 `Membership.tier/expiresAt` 并存。`membership-tier.ts` 声明 Membership.tier 为 SSOT、User.memberTier 为遗留兼容，但：
  - 支付宝回调（payment/controllers/index.ts:42-51）双写 ✅；
  - 微信/订阅支付（payment/services/index.ts:190-225 `activateSubscriptionOrder`）**只写 Membership**，User.memberTier 过期；
  - `require-member-tier.ts:45` 等中间件读 `request.user.memberTier`（**JWT 登录时快照**）→ 支付后 JWT 未刷新，VIP 路由仍拒绝，直到重新登录；
  - `plugins/auth.ts:128-133` 又用 getEffectiveTier 合并两者——**同一次请求鉴权逻辑前后不一致**。
- ⚠️ `Membership.parentId` 自关联指向 `userId` 而非 `Membership.id`（命名误导，但约束合法）。
- ⚠️ `CoinLog`/`UserAsset`/`RechargeOrder` 通过 `userId` 关联 Membership（map 外键名），用非主键列做关联，可读性差、易错。

### 3.13 其余工作台相关 model
- `CharacterProfile/SceneProfile`（schema.prisma:569/592）：遗留，v2 无读写方。
- `Character/Scene/World/Observer/Event/…`（schema.prisma:2317-2598）：遗留叙事系统，与 Ai* 系语义重叠。
- `StoryboardImage`（schema.prisma:2521）：✅ 结构正常，但前端 store 期望 `prompt/negativePrompt`（useStudioStore.ts:652-653）**model 没有**；`@@unique([projectId, segmentId])` 导致同段多图（如多种风格）互相覆盖。
- `PropImage`（schema.prisma:2535）：✅ 结构正常；⚠️ 前端 mergeProps 读 `pi.character_names`（useStudioStore.ts:484-485），model 无此列（aigc-spec save 也丢弃前端传的 character/scene/segment 关联）。
- `CharacterImage`（schema.prisma:2494）：⚠️ worker 写 makeup 图时把 `characterName` 拼成 `名字_makeup`（worker-runtime.ts:376-390）而不用 `variant` 字段；store 的 `variantPriority['makeup']` 分支永远不触发（useStudioStore.ts:563），妆造图在素材库变成"幽灵角色"。
- 重复/镜像 model：`GEOProject`(3889) vs `GeoProject`(4308)、`GEOBrand`(3840) vs `GeoBrandProfile`(4329)、`P18Pair`(3302) vs `p18_pairs`(3365) 与 `V3RenderResult`(3323) vs `public_V3RenderResult`(3344)（raw SQL 镜像表）、`Workspace`(3010) vs `WorkspaceRuntime/Snapshot/Version/Draft/Operation/Asset/Conversation/Checkpoint/Execution`(4917-5050)（两套工作区体系，`Project.workspaceId` 指向前者、store 的 workspace 概念对应后者，互不连通）。

---

## 4. 问题清单（含定位）

| # | 严重度 | 问题 | 位置 |
|---|---|---|---|
| 1 | ❌ | **ai_prop_specs 表无任何 migration**；workbench GET include 它 → 表不存在则加载接口 500 | schema.prisma:423；workbench-project.ts:113；migrations/（0 命中） |
| 2 | ❌ | **ai_prop_specs raw SQL 漏 id 列**（Prisma uuid() 为客户端生成，DB 无默认值）→ INSERT 必失败被吞 | artifact-sync.service.ts:164-176、440-458 |
| 3 | ❌ | **Storyboard 路由字段与 model 完全脱节**（sceneDescription/cameraAngle/movement/lens/dialogue/notes/prompt 不存在）→ generate 接口必 500 | routes/storyboards.ts:61-63、121-126；services/storyboard.service.ts:13-15；schema.prisma:482-511 |
| 4 | ❌ | **分镜段落三处/四处并存**：ai_video_segments + ai_segment_edits + executionResults.segments + executionResults.videoSegments，读路径靠 fallback 链，写路径互不感知 | schema.prisma:288/318；project-segment-state.ts:95-175；workbench-project.ts:150-190；useStudioStore.ts:590-660 |
| 5 | ❌ | **video_task.error 字段双重滥用**（存输入 + 存成功输出） | ai-tasks.ts:84；queue-manager.ts:204-213、268；worker-runtime.ts:1083 |
| 6 | ⚠️ | **会员等级三源并存且不同步**（Membership.tier / User.memberTier / JWT）——部分支付路径只写 Membership，中间件读 JWT 旧值 | payment/services/index.ts:190-225；require-member-tier.ts:45；plugins/auth.ts:128-133；membership-tier.ts |
| 7 | ⚠️ | **迁移漂移**：schema 有而 migrations 无的列——ai_character_specs.role/voice_type、ai_scene_specs 六列、ai_video_segments 八列（full_text/first_frame_*/mid_frame_*/last_frame_*/narrative）、ai_voice_configs.voice_id、Project.merged_video_url/merge_status | migrations/20260531_runtime_baseline + 20260525/20260528；schema.prisma:185/226/288/267/111 |
| 8 | ⚠️ | **迁移死列**：ai_video_segments.timeline_json/characters_json/scenes_json/graph_hints_json/continuity_json 有列无 model 无写方 | migrations/20260528_add_segment_json_fields/migration.sql:2-6 |
| 9 | ⚠️ | **workbench GET 全量加载缺 6 张表**（aiSegmentEdits/aiActionSpecs/aiCameraSpecs/aiEmotionSpecs/aiVideoProduction/ttsRecords），前端拿不到段编辑状态 | workbench-project.ts:108-119 |
| 10 | ⚠️ | **前端契约缺口**：storyboardImages.prompt/negativePrompt、propImages.character_names、aiVideoSegments.imagePrompt/negativePrompt 前端读、model 无 | useStudioStore.ts:484/613/652；schema.prisma:2521/2535/288 |
| 11 | ⚠️ | **角色妆造图双约定**：worker 写 `characterName=名字_makeup`，store 期待 `variant='makeup'` | worker-runtime.ts:376-390；useStudioStore.ts:563 |
| 12 | ⚠️ | **PropImage 混存无图规格**：aigc-spec save 把设计规格（propSpecs）也写入图片表，且丢弃 character/scene/segment 关联 | aigc-spec-db.ts:253-280；schema.prisma:2535 |
| 13 | ⚠️ | **重新分析清空用户数据**：script-submit 显式 `delete merged.segments`；artifact-sync 全表 deleteMany+重建 | script-submit.ts:137；artifact-sync.service.ts:24-200 |
| 14 | ⚠️ | **raw SQL 列命名分裂**：ai_effect_specs 用 camelCase 引号列、ai_prop_specs 用 snake_case | artifact-sync.service.ts:167/184/443/467 |
| 15 | ⚠️ | **剧本双份**：Project.script vs executionResults.rawScript | schema.prisma:151/156；useStudioStore.ts:317 |
| 16 | ⚠️ | **VideoTask.progress 无更新方**；storyboardId 外键从不写入 | queue-manager.ts；ai-tasks.ts:84；schema.prisma:512-537 |
| 17 | ⚠️ | **VideoSegment 孤儿表**（仅 mock-worker 写） | schema.prisma:538；mock-worker.ts:222 |
| 18 | ⚠️ | **重复 model 家族**：GEO* vs Geo*、P18Pair vs p18_pairs、V3RenderResult vs public_V3RenderResult、Workspace vs WorkspaceRuntime 系 | schema.prisma:3302-3386、3840-4330、3010/4917-5050 |
| 19 | ⚠️ | **索引缺口**：Project 按 userId 列表查询无索引（workbench-project.ts:75 `where:{userId}`）；Membership.parentId 无索引（代理树查询）；TTSRecord 已建（✅） | schema.prisma:111、680 |
| 20 | ⚠️ | **aspectRatio 语义冲突**：AiSceneSpec 默认 '16:9' 但 artifact-sync 写死 '9:16'；AiVideoProduction 默认 1920x1080(16:9) | schema.prisma:239；artifact-sync.service.ts:78/435 |

---

## 5. 修复建议（按优先级）

### P0（阻断性，先修）
1. **ai_prop_specs**：二选一——(a) 删除 model + 从 workbench GET include 中移除，道具统一走 `prop_images` + `executionResults.propSpecs`；(b) 补 migration（含 `id UUID DEFAULT gen_random_uuid()` 等 DB 默认值）+ 修正 raw SQL 补全列。推荐 (a)，少一张镜像表。
2. **Storyboard 路由**：删除 `POST /api/projects/:projectId/storyboards/generate`（v2 已不用），或重写为写 `ai_video_segments`；同时给 `storyboard.service.create` 加字段白名单，杜绝 `...rest` 盲传。
3. **video_task.error**：新增 `input Json?` / `output Json?` 字段（migration），替换 error 字段双重用途；error 只存真错误。
4. **workbench GET include aiPropSpecs 加保护**：表缺失时降级返回空数组（或按 P0-1 移除）。

### P1（一致性）
5. **统一分镜段真相源**：确立 `executionResults.segments`（用户态）与 `ai_video_segments`（AI 分析态）的边界——建议：AI 分析结果只写 ai_video_segments，用户编辑只写 executionResults.segments + ai_segment_edits 二选一（推荐前者），删除 fallback 链改为单源读取；`ai_segment_edits` 与 `executionResults.segments` 合并为一张。
6. **会员单源化**：所有支付/开通路径统一双写（Membership.tier 为 SSOT + 同步 User.memberTier），并在鉴权中间件里改为查 DB（getEffectiveTier）而非 JWT 快照；或支付后强制 tokenVersion++ 踢下线重登。
7. **script-submit 清空策略**：重新分析前把用户编辑快照（segments/workspaceScenes）备份到独立字段（如 `executionResults.userEdits`）再合并，而不是 `delete merged.segments` 直接丢。
8. **迁移对齐**：用 `prisma migrate diff` 生成增量 migration，补齐 schema 有而 DB 无的列（ai_character_specs.role/voice_type、ai_scene_specs 六列、ai_video_segments 八列、ai_voice_configs.voice_id、Project.merged_video_url/merge_status）；删除死列 timeline_json 等（先确认无历史读写）。

### P2（结构性）
9. **道具数据合并**：prop_images 只存"有图"记录，无图规格回退到 executionResults.propSpecs；save-image 增加 character/scene 关联列。
10. **妆造图约定统一**：worker 改回用 `variant='makeup'`，或 store 适配 `_makeup` 后缀解析，二选一。
11. **Storyboard/VideoSegment/CharacterProfile/SceneProfile 归档**：标注 deprecated 并停止读写，避免新代码误用。
12. **命名统一**：ai_* 系列表列名全部 snake_case（或全部 camelCase），raw SQL 改 Prisma 客户端调用。
13. **补索引**：Project.userId、Membership.parentId。
14. **重复 model 清理**：GEO* 系、P18/V3RenderResult 镜像、Workspace 双体系，各保留一套，另一套迁移或标注 deprecated。

### 前端契约补丁（配合后端）
15. storyboardImages/propImages/aiVideoSegments 补充前端已读字段（prompt/negativePrompt/character_names/imagePrompt），或在 store 中删除这些读取并改用现成字段。

---

## 6. 附：关键引用行号

- schema.prisma: AiCharacterSpec=185, AiSceneSpec=226, AiVoiceConfig=267, AiVideoSegment=288, AiSegmentEdit=318, AiFrameDesign=345, AiVideoProduction=365, AiEffectSpec=382, AiActionSpec=403, AiPropSpec=423, AiCameraSpec=442, AiEmotionSpec=461, Storyboard=482, VideoTask=512, VideoSegment=538, Membership=680
- artifact-sync.service.ts: props raw SQL=164-176（缺 id）; effects raw SQL=181-190; frames 不写=99-103; aspectRatio 写死 9:16=78/435
- workbench-project.ts: GET include=108-119; PUT 只写 executionResults=150-190; save-image=197-280; delete=306-345
- aigc-spec-db.ts: save 事务=86-260; propSpecs→propImage=253-280; load=270-310
- project-segment-state.ts: save=95-175
- script-submit.ts: delete merged.segments=137; artifact sync 触发=168-174
- storyboards.ts: mock shots=61-63; AI shots=121-126
- storyboard.service.ts: create `...rest`=12-15
- useStudioStore.ts: 段编辑覆盖 er.segments=618-631; storyboardImages.prompt=652-653; variantPriority=563; propImages.character_names=484-485
- queue-manager.ts: error 存输出=204-213; videoUrl 回写=231-240
- worker-runtime.ts: makeup `_makeup`=376-390; videoUrl 回写=1069-1076
- ai-tasks.ts: error 存输入=84-90

---

*审计完成时间: 2026-07-31 | 只读审计，未修改任何文件*
