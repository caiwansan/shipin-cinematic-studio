# 短剧工作台全链路审计 — 总报告（SUMMARY）

- 审计日期：2026-07-31
- 审计方式：运行时验证（主代理）+ 4 路子代理并行深度审计（数据库 / 后端 API / 前端 / AI Prompt）
- 审计范围：`/root/shipin-cinematic-studio`（backend + frontend/studio-v2）
- 原则：只读审计，未修改任何代码；所有问题带 文件:行号 可复核

子报告：
- 01-DATABASE-AUDIT.md（schema/migrations/数据流真相源）
- 02-BACKEND-API-AUDIT.md（13 路由 + agents + services）
- 03-FRONTEND-AUDIT.md（studio-v2 全组件 + store + pipeline）
- 04-AI-PROMPT-AUDIT.md（LLM 组件 + prompt SSOT + 校验）

---

## 0. 一句话结论

> **短剧工作台不存在"统一真相源"：同一份业务数据（角色/场景/分镜段/视频/阶段状态）普遍存在 2~4 个载体并存、4 条互相清空的写入路径、4 套不兼容的读取契约；同时存在可被直接攻击的安全漏洞（路径穿越、全站数据泄露、LLM Key 盗用）。架构演进多轮（单 prompt → 8-Agent → DB PromptTemplate → V3 宪法），新层叠在旧层之上，旧层未清理。**

---

## 1. 🔴 安全漏洞（最高优先，先止血）

| # | 位置 | 问题 | 风险 |
|---|------|------|------|
| S1 | `workbench-project.ts:392-402` | `/api/v2/workbench/local-file/:filename` **无鉴权 + path.join 路径穿越** | 任何人可读服务器任意文件（/etc/passwd） |
| S2 | `projects-v2.ts:144-180` | `/api/v1/projects` **完全无鉴权**，findAll 返回**全站所有用户项目** | 全量隐私泄露，读/改/删/SSE 全裸奔 |
| S3 | `script-submit.ts:19-30` | 手动 base64 解码 JWT **不验签**即信任 userId + 信任 body.userId | 伪造身份 → narrativeGateway 注入**受害者 API Key** → LLM 账单攻击 |
| S4 | 工作台所有 `:id` 端点 | 只验登录、**不验项目归属**（IDOR） | 任意登录用户可读/改/删他人项目（workbench-project / aigc-spec-db / ai-tasks / script-submit / script-breakdown） |
| S5 | `ai-tasks.ts` batch-create | **无配额检查**、无 taskType 白名单 | 无限批量建任务 → 成本滥用 |
| S6 | `script-breakdown.ts` | 无 authenticate，GET 列表返回**全站拆解任务含完整剧本原文** | 剧本内容泄露 |

## 2. 🔴 必然 500 的运行时 bug（一调用就崩）

| # | 位置 | 问题 |
|---|------|------|
| B1 | `aigc-spec-db.ts:198` | `dbEmotionMap` **从未定义** → 带 emotionSpecs 的保存请求必然 ReferenceError，整个事务回滚 |
| B2 | `storyboards.ts:57` | `env` 未导入未定义（@ts-nocheck 掩盖）→ 分镜生成必然 500 |
| B3 | `storyboards.ts:114-123` + `storyboard.service.ts:12-15` | 写入 Storyboard model **不存在的字段**（sceneDescription/cameraAngle/movement/...）+ `...rest` 盲传 → Prisma 校验错误必然 500 |
| B4 | `narrative-llm.ts:371` | catch 分支引用**未定义变量 `fb2Norm`** → analyze-v2 异常路径必然 500 |
| B5 | `CharacterWorkspace.vue:122,306-607` | 6 个**未声明即使用**变量（voiceResult 等）→ loadFromServer 回填 voices 后 watchEffect 必抛 ReferenceError（角色页必现） |
| B6 | `ScriptAnalysisWorkspace.vue:653` | `emptyNarrative()` 未声明 → TS 编译错误/潜在 ReferenceError |
| B7 | `narrative-gateway.ts:448` | 配额检查返回类型不符的 `{success:false}` → 调用方只读 `.content` → 配额超限**静默拿到空串** |

## 3. 🟠 数据一致性（统一真相源缺失）— 根因级

### 3.1 分镜段落 4 处并存（核心矛盾）
- `ai_video_segments`（AI 分析+编辑+videoUrl）／`ai_segment_edits`（编辑状态）／`executionResults.segments`（store 用户态）／`executionResults.videoSegments`（AI 分析 JSON）
- **4 条全量替换写入路径**：aigc-spec-db / artifact-sync / projects.ts / project-hydrate，segmentId 命名互不一致（seg_0 / scene_0 / seg_${i} / UUID）→ 任意两处先后执行**互相清空**
- **重新分析时用户编辑被有意丢弃**：script-submit.ts:137 显式 `delete merged.segments`
- 前端加载：store 优先读 `aiVideoSegments`，保存却写 `executionResults.segments` → **用户编辑刷新后丢失**（运行时验证：宏荼记表 19 段 vs JSONB 13 段内容不一致）

### 3.2 阶段状态真相源断裂
- 前端只看 `executionResults.pipelineCompletedStages` 判断阶段完成；**后端 AI 任务从不写**（全仓 grep 无写入点）；60 个有 executionResults 的项目 0 个有非空值
- `pipeline_stages` 表存在但前端只写不读（死表）
- pipeline stage key 三处不一致：shared 定义 `character-design` vs 后端初始化旧 key `character/scene/voice`（workbench-project.ts:69）vs dag-runtime STAGE_ORDER
- store 的 `updateStageStatus` **全前端零调用** → 流水线状态永不落库
- **宏荼记有完整数据（3角色/3场景/19段/19图）但前端全部显示"未开始"**（运行时实测）

### 3.3 会员等级三源不同步
- `Membership.tier`（声明 SSOT）／`User.memberTier`／JWT 快照
- 部分支付路径只写 Membership → 中间件读 JWT 旧值 → **支付后 VIP 延迟生效直到重登**

### 3.4 其他并存
- 剧本双份：`Project.script` vs `executionResults.rawScript`
- 道具三源：`executionResults.propSpecs` / `prop_images`（混存无图规格）/ `ai_prop_specs`（幽灵表）
- 视频结果三载体：`ai_video_segments.video_url` / `video_task.error`（JSON）/ `Asset.filePath`
- 角色妆造图双约定：worker 写 `characterName=名字_makeup`，store 期待 `variant='makeup'` → 永不匹配 → 幽灵角色

## 4. 🟠 前端断链（工作台无法闭环）

| # | 位置 | 问题 |
|---|------|------|
| F1 | `StudioWorkspaceLayout.vue:113` | `onMounted` 函数体最前方 `return` → URL projectId 加载 / last_project_id 恢复 / open-video-editor 监听**全死代码** |
| F2 | `WorkspaceRenderer.vue:8-29` | 未映射 `final-render`/`dubbing-render`/`director` → 三个组件全局零引用，**合成输出阶段永远渲染占位符** |
| F3 | `VideoGenerationWorkspace.vue:899-955` + `FinalRenderWorkspace.vue:104-110` | 视频结果存独立表 `/api/projects/segments/*`，**从不回写** `store.segments[].videoUrl` → FinalRender 取数恒为空 → 视频→合成数据流断裂 |
| F4 | `AdvertisementWorkspace` / `MusicGenerationWorkspace` | 完全孤岛：不绑 store/项目，广告硬编码 projectId `00000000-...`，音乐 addToProject 是假操作 |
| F5 | `VideoGenerationWorkspace.vue` | 3654 行巨型组件：22 处裸 fetch、`}''` 语法垃圾、`useToken()` 读错 token 键（access_token vs auth_token）、recordVideoAction 把 computed ref 当字符串序列化 |
| F6 | `api.ts` | 零使用；所有组件裸 fetch；token 读取 3+ 套不同来源 |

## 5. 🟠 AI Prompt 体系（无 SSOT + 违宪硬编码）

- **角色设计 9 个版本**、场景设计 8 个版本、剧情统筹 4 个版本（`剧情总指挥` vs `plot-supervisor` vs `剧本拆解总导演`）
- `aigc-spec-prompt.txt` == `aigc-prompt.txt`（逐字节相同，diff 验证），均无运行时引用；`prompts/agents/*.txt` 8 个全死文件
- DB 已 seed 的 `narrative-system-prompt`/`character-visual-designer`/`scene-visual-designer` **从未被使用**，代码反而硬编码 16 处（narrative-llm.ts:70 文件头自称"禁止硬编码"却内联 150 行）
- **运行时依赖的 DB key 无 seed 保障**：`剧本拆解总导演`、`plot-supervisor`、`character-agent`、`storyboard-designer`、`ad-script-designer` 缺失 → 调用即抛错（剧本拆解总导演是 V3 主链关键！）
- JSON 校验仅 2 处严格；角色/声音/道具失败**静默返回空数组 success:true**
- `UOA.ts` submitTask 返回假 taskId，从不真正入队
- 4 套并行 LLM 栈：narrativeGateway（工作台统一 ✅）/ unifiedAIGateway / hdz 直连 fetch（绕过统一层，明文 Key 兼容）/ geo 自建

## 6. 🟡 数据库层面

- **ai_prop_specs 幽灵表**：全 migrations 零命中；raw SQL 漏 `id` 列（Prisma uuid() 是客户端生成，DB 无默认值）→ INSERT 必失败被 try/catch 吞；workbench GET include 它 → 表不存在时**整个项目加载接口 500**
- **迁移漂移严重**：schema 有而 migrations 无的列（ai_character_specs.role/voice_type、ai_scene_specs 六列、ai_video_segments 八列等）；反向死列 timeline_json 等 5 列；生产库若走 migrate 而非 db push，多处写入静默失败
- **video_task.error 双重滥用**（存输入 + 存成功输出）；`progress` 全链路无更新方
- 前端契约缺口：store 读 `storyboardImages.prompt/negativePrompt`、`propImages.character_names`、`aiVideoSegments.imagePrompt`，model 均无
- Storyboard / VideoSegment / CharacterProfile / SceneProfile 遗留死表
- 重复 model 家族：GEO* vs Geo*、P18Pair vs p18_pairs、V3RenderResult vs public_V3RenderResult、Workspace 双体系（9 张）
- 索引缺口：Project.userId 列表查询无索引（全表扫）

## 7. ✅ 值得保留的亮点

- store 为模块级单例，SSOT 读取方向统一；loadFromServer fetch-first-then-commit 防白屏；saveToServer 带保存锁防并发覆盖
- 剧本拆解总导演（V3 宪法）有字段级校验 + 重试——方向正确
- 工作台核心链路已收敛到 narrativeGateway（用户 BYOK + 熔断 + 配额 + tracing 齐备）
- Storyboard RuntimeGraph 非破坏性优化（原版/优化版可切换）设计良好
- 运行时实测：V2 工作台 API、aigc-spec load、HTTPS 公网链路、健康检查全部正常

---

## 8. 修复路线（按优先级）

### P0 — 止血（安全 + 必然故障，1-2 天）
1. S1 local-file 路由：删除或加 authenticate + `path.basename(filename)===filename` 白名单
2. S2 `/api/v1/projects*`：全部补 authenticate + userId 过滤（或直接下线 V1 路由）
3. S3 script-submit：删除 base64 手解 JWT + body.userId 回退，只信 `request.jwtVerify()`，挂 authenticate
4. B1 补 `dbEmotionMap` 定义；B2/B3 修 storyboards（env import + 字段白名单或废弃该路由）；B4 修 fb2Norm
5. B5 CharacterWorkspace 补 6 个声明或删除死功能；B6 修 emptyNarrative
6. ai_prop_specs：从 workbench GET include 移除（推荐删表），道具统一 prop_images + executionResults
7. video_task 拆 input/output 字段（error 只存真错误）

### P1 — 一致性收敛（1 周）
8. 统一分镜段真相源：AI 分析只写 ai_video_segments，用户编辑只写 executionResults.segments，删 fallback 链；修复"编辑刷新丢失"
9. 阶段状态：后端 AI 任务完成时写 pipelineCompletedStages（或前端数据驱动推断）；统一 stage key（shared 为 SSOT，后端加 legacy 映射）；恢复 updateStageStatus 调用
10. 会员单源化：统一双写 + 鉴权改查 DB
11. 所有工作台 `:id` 端点挂项目归属中间件（403）
12. 前端断链修复：删 Layout return、WorkspaceRenderer 补 final-render 映射、视频结果回写 store、角色页声明变量
13. Prompt SSOT：DB PromptTemplate 为唯一权威，归档 txt 死文件，合并剧情统筹 key，**补全运行时依赖 key 的 seed**（剧本拆解总导演等）
14. script-submit 重新分析前备份用户编辑（executionResults.userEdits），不再 delete merged.segments

### P2 — 结构性（本月）
15. 硬编码 prompt 全部迁 DB（16 处）；JSON 校验层统一落地（zod/ajv + 重试 + 禁静默空数组）
16. UOA 落地真实队列或标注 experimental；hdz 直连 fetch 收敛到 gateway
17. 迁移对齐（migrate diff 补齐/删死列）；道具/妆造约定统一；补索引
18. 死代码清理：aigc-spec-agent/deprecated、workbench-director（未注册）、ai-optimize-storyboard（未注册）、备份文件、死文件 txt
19. 前端收敛：api.ts 统一、useTaskPolling 替换 5 处内联轮询、loadFromServer 拆分

---

## 9. 待掌柜决策

1. **/api/v1/projects 旧链路**：下线还是补鉴权？（涉及旧版工作台是否还有用户在用）
2. **分镜段真相源**：确认以 `ai_video_segments`（表）为唯一 AI 分析源 + `executionResults.segments`（用户编辑）的边界划分
3. **storyboards 旧路由 / Storyboard 表 / VideoSegment / CharacterProfile / SceneProfile**：归档删除还是保留兼容？
4. **修复执行方式**：是否启动「短剧工作台现实修复 Sprint」（P0 止血 → P1 收敛 → 验收），沿用之前 Sprint 的 Reality Gate 模式？
