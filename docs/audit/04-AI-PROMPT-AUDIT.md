# 04 — AI 组件 & Prompt 审计报告

- 审计日期：2026-07-31
- 审计范围：`backend/src/` 下短剧工作台所有 AI 组件与 prompt（只读审计，未修改任何文件）
- 审计人：AI Agent + Prompt 审计专家（subagent）

---

## 1. 执行摘要

短剧工作台已经历多轮架构演进（单 prompt → 8-Agent 编排 → DB PromptTemplate → V3 宪法拆解），
形成 **「DB-first + 统一 NarrativeGateway」** 的现行架构，方向正确，但存在严重的历史遗留问题：

1. **Prompt 无单一事实源（SSOT）**：角色/场景/剧情统筹等任务各有 4~9 个互不兼容的 prompt 版本散落
   在 DB 模板、死文件 txt、硬编码字符串三处，改一处漏一处。
2. **硬编码 prompt 违宪**：代码内大量内联 prompt 字符串，部分文件自己声明「禁止硬编码」却违反。
3. **存在 4 套并行 LLM 调用栈**：narrativeGateway（工作台统一 ✅）、unifiedAIGateway（企业/职业域）、
   hdz/llm.client.ts 直连 fetch（小说域，绕过一切统一层）、geo 自建栈。
4. **JSON schema 校验缺失严重**：仅 2 处严格校验，其余靠宽松 JSON.parse + 静默降级。
5. **死文件/死代码多**：`aigc-spec-prompt.txt`（与 aigc-prompt.txt 完全相同）、`analyze-v2-prompt.txt`、
   `prompts/agents/*.txt`（8 个）均无运行时引用，却极易被误认为权威源。

---

## 2. AI 组件全景表

### 2.1 短剧工作台核心 AI 组件（统一走 narrativeGateway）

| 组件 | 职责 | 输入 | 输出 | model | prompt 来源 |
|---|---|---|---|---|---|
| 剧本拆解总导演 `agents/script-breakdown-master.ts` | V3 宪法拆解（一键 Agent，Segment 唯一真相源） | storyText, title, genre, visualStyle, userId | NarrativeConstitutionV3（字段级校验 + 1 次重试） | 用户 BYOK（ExecutionGraph 决定） | `PromptRegistry.getPrompt('剧本拆解总导演')`（DB，含 `{字数量}`/`{段数}` 占位符） |
| AigcSpecOrchestrator `agents/aigc-orchestrator.ts` | 8-Agent 编排（总指挥→角色/场景/定妆→声音/画面/道具/镜头）；优先调剧本拆解总导演，无则回退 8-Agent | text, title, aspectRatio, genre, visualStyle, section, existingSpec | AigcSpecOutput（11+ 个数组） | 用户 BYOK | DB PromptTemplate 中文名 key（剧情总指挥/角色设计师/场景设计师/角色定妆师/声音设计师/画面设计师/道具设计师/镜头特效师） |
| AigcSpecAgent `agents/aigc-spec-agent.ts`（deprecated） | 单 prompt 生成完整 AIGC 规格表 + 校验修复重试 + 单 section 重生成 | text, title, aspectRatio, targetDuration | AigcSpec（含新四表 effect/action/camera/emotionSpecs） | 用户 BYOK | `buildPromptCached('aigc-prompt')`（DB） |
| AigcSpecAgentV2 `agents/aigc-spec-agent-v2.ts`（deprecated） | schema filler（确定性编译），校验失败仅 warn | ScriptBreakdownInput | 结构化拆解 JSON | 用户 BYOK | `buildPromptCached('aigc-spec-agent-v2')`（DB，要求 output_schema 字段） |
| CharacterAgent `agents/character.agent.ts` | 角色提取（含 identityLock 视觉锁定） | script | `{ characters: CharacterProfile[] }` | 用户 BYOK | `buildPromptCached('character-agent')`（DB） |
| SceneImagePromptAgent `agents/scene-image-prompt.agent.ts` | 场景图优化 prompt 生成 | script, atmosphereScenes[] | SceneImagePromptOutput[]（失败返回空数组） | 用户 BYOK | `buildPromptCached('scene-image-prompt-agent')`（DB） |
| PortraitPromptAgent `agents/portrait-prompt.agent.ts` | 角色肖像 prompt 模板合成 + 质量门禁 + LLM refine | CharacterProfile, script, tripleView | 单视图/三视图 prompt | 用户 BYOK | `imagePromptTemplates` 表（portrait/*）+ 5 个 FALLBACK_* 硬编码降级 |
| UOA `agents/orchestrator/UOA.ts` | 视频生成统一编排入口（v1） | VideoJobContext | VideoJobResult（status/segments） | —（无 LLM） | 无；`submitTask()` 返回**假 taskId 占位**，从不真正入队 |
| DirectorV2 ConstitutionCompiler `director-v2/constitution-compiler.ts` | 导演宪法 JSON 生成（enrichment） | 剧本 + 结构骨架 | 导演宪法（visualDoctrine 等） | 用户 BYOK | **硬编码 `ENRICH_SYSTEM_PROMPT`**（:75） |
| DirectorV2 api-surface `director-v2/runtime/api-surface.ts` | 剧情总指挥统筹（director-v2 版） | script, projectId | plotBlueprint 六维 | 用户 BYOK | DB key **`'plot-supervisor'`**（与 aigc-orchestrator 的 `'剧情总指挥'` 是两把 key） |

### 2.2 路由级 LLM 端点（narrativeGateway）

| 路由 | 接口 | prompt 来源 |
|---|---|---|
| `routes/narrative-llm.ts` | POST /narrative/analyze | **硬编码 NARRATIVE_SYSTEM_PROMPT**（:70，约 150 行） |
| 〃 | POST /narrative/analyze-v2 | DB `六维数据拆解分析`（:248）+ heuristic fallback |
| 〃 | POST /narrative/deep-analyze | DB `aigc-prompt`（:409-413）+ 大量兼容转换逻辑 |
| 〃 | POST /narrative/regen-spec (character) | **硬编码**「角色视觉设计师」prompt（:627） |
| 〃 | POST /narrative/regen-spec (scene) | **硬编码**「场景设计师」prompt（:689） |
| `routes/script-breakdown.ts` | /api/v1/script-breakdown | DB `六维数据拆解分析`（快照进 fixedSystemPrompt） |
| `routes/script-submit.ts` | /api/script/submit、/regen-spec | aigcOrchestrator + DB `道具设计师`（:308）+ DB `六维数据拆解分析`（:567） |
| `routes/studio-create-work.ts` | /api/v1/studio/create-work | DB `aigc-prompt`（:309，getDbPromptSafe 有兜底文案） |
| `routes/ai-optimize-video-prompt.ts` | /api/ai/optimize-video-prompt | DB `video-prompt-designer`（seed 有） |
| `routes/ai-optimize-storyboard.ts` | /api/ai/optimize-storyboard | DB `storyboard-designer`（**seed 无此记录**，getPrompt 会抛错） |
| `routes/ai-optimize-shot.ts` | /api/ai/optimize-shot-script | DB `director-of-photography`（seed 有，缺失即抛错） |
| `routes/ai-optimize-ad-script.ts` | /api/ai/optimize-ad-script | DB `ad-script-designer` + **大段硬编码 fallback**（:22） |
| `routes/ai-optimize-image-prompt.ts` | /api/ai/optimize-image-prompt | **硬编码内联 prompt**（:36） |
| `routes/storyboards.ts` | /api/storyboards/ai-generate | **硬编码**「影视分镜师」prompt（:76） |
| `routes/ai-optimize-frame-prompt.ts` | /api/ai/optimize-frame-prompt | DB（:22 读取） |
| `agent-runtime/execution/step-executor.service.ts` | 报告生成 | **硬编码**「报告生成专家」prompt（:91） |

### 2.3 服务层 LLM 组件（工作台周边/其他域）

| 组件 | 职责 | LLM 通道 | prompt 来源 |
|---|---|---|---|
| `services/director/production-preparation.service.ts` | 分镜/角色视觉描述补全 | narrativeGateway（构造注入） | **硬编码**（:195 分镜、:243 角色） |
| `services/storyboard-quality-gate.ts` | 分镜质量门禁 + LLM 补全 | narrativeGateway | **硬编码**（:263 分镜、:310 角色） |
| `services/fight-director.service.ts` | 打斗分镜图谱 | 自带 LLM 调用（:209） | **硬编码**（:186 动作片导演） |
| `services/unified-ai-gateway.ts` + `ai-router.service.ts` + `ai-invocation-envelope.ts` | 第二套统一 AI 网关（adapter 模式：aliyun/volcengine/deepseek/openai） | 自有 invokeAI（限流/并发/重试） | 调用方自行传入（信封模式） |
| `services/hdz/*`（11 个 service + 8 个 route） | 混沌珠小说创作域（planner/writer/character/director/reviewer…） | **自建 `llm.client.ts` 直连 fetch**（绕过 narrativeGateway，无熔断/无 fallback/无统一 tracing） | 混用：DB `hdz-*` prompt（getAgentPrompt）+ **大量内联硬编码**（见 §5 清单） |
| `services/geo/*` | 地理知识域（独立 provider-resolver + llm-client + markdown prompts） | 自建栈 | services/geo/provider/prompts/**（本报告范围外，单列） |
| `services/career|enterprise|matching|legal/*` | 招聘/企业/法务域 | 各自封装 | 范围外 |

### 2.4 Prompt 文件现状

| 文件 | 大小 | 运行时引用 | 结论 |
|---|---|---|---|
| `prompts/aigc-spec-system.txt` | 140B | 仅 `scripts/regen-bp3.ts`（一次性脚本，直连阿里云 qwen-max） | 近似死文件；内容（一句话）与 DB `aigc-prompt` 完全不同 |
| `prompts/agents/character-designer.txt` 等 8 个 | 82~869B | **无**（仅 snapshots 旧代码） | 死文件；与 DB 同名模板内容已漂移 |
| `prompts/agents/honglou-microexpression-library.txt` | 82B | 无（注释称已内联进 DB 剧情总指挥） | 死文件 |
| `routes/aigc-prompt.txt` | 9289B | 是（历史源，DB `aigc-prompt` 内容与之相同） | **文件末尾嵌了已废弃的 `app.post('/api/v1/narrative/aigc-spec')` 路由源码**（死代码）；该路由当前未注册 |
| `routes/aigc-spec-prompt.txt` | 9289B | **无** | 与 aigc-prompt.txt 逐字节相同（diff 验证 IDENTICAL）——纯重复死文件 |
| `routes/analyze-v2-prompt.txt` | 2552B | **无**（实际用 DB `六维数据拆解分析`） | 死文件，schema 与 DB 版不同 |
| 备份文件 `narrative-llm.ts.analyze-v2-bak`、`narrative-llm.ts.preboundary-fix`、`routes/execution-images.js` | — | 无 | 含旧 prompt 副本，易误导 |

---

## 3. Prompt 一致性对比表（重复/多版本清单）

> 同色同职责 = 多版本并存。**结论：所有核心任务均无 SSOT。**

### 3.1 角色设计 —— 至少 9 个版本

| # | 位置 | key/名称 | 输出字段（差异点） |
|---|---|---|---|
| 1 | DB `aigc-prompt`（aigc-spec-agent / deep-analyze 用） | aigc-prompt | characterSpecs: characterName/gender/age/physicalDescription/clothing/imagePrompt/negativePrompt |
| 2 | DB `角色设计师`（8-Agent 链路） | 角色设计师 | name(英文)/alias/category/age/gender/appearance{height,build,...}/personality/background/arc/relationships |
| 3 | `prompts/agents/character-designer.txt`（死文件） | character-designer.txt | 无 schema（只有严格 JSON 规则） |
| 4 | DB `character-agent`（character.agent.ts） | character-agent | characterId/name/role/appearance{...}/identityLock{faceSignature,...}/personality/plotContext |
| 5 | DB `character-visual-designer`（seed 有，无人用） | character-visual-designer | 英文纯文本视觉描述 |
| 6 | aigc-spec-agent.ts `regenerateType('character')` 内嵌 schema | — | characterName/.../personality/props/表格化 imagePrompt（与 #1 不同！） |
| 7 | narrative-llm.ts:627 硬编码「角色视觉设计师」 | — | { imagePrompt, negativePrompt } 中文 100-200 字 |
| 8 | production-preparation.service.ts:243 硬编码 | — | { imagePrompt, negativePrompt } 中文 80-150 字 |
| 9 | storyboard-quality-gate.ts:310 硬编码 | — | { imagePrompt } 中文 80-150 字 |

### 3.2 场景设计 —— 至少 8 个版本

| # | 位置 | 差异点 |
|---|---|---|
| 1 | DB `aigc-prompt` sceneSpecs | sceneId/sceneName/description/imagePrompt/negativePrompt/aspectRatio |
| 2 | DB `场景设计师` | name(英文)/alias/category/environment{...}/mood/colorPalette/lighting/props |
| 3 | `prompts/agents/scene-designer.txt`（死文件） | sceneSpecs: sceneName/description/imagePrompt/mood/lighting/colorPalette/environment（无 negativePrompt） |
| 4 | DB `scene-image-prompt-agent`（scene-image-prompt.agent.ts） | { sceneId, scenePrompt, negativePrompt }（字段名又不同！） |
| 5 | DB `scene-visual-designer`（seed 有，无人用） | 英文纯文本 |
| 6 | DB `scene-optimizer`（seed-optimizer-templates.ts） | sceneSpecs: imagePrompt ≥120 字，禁止人物 |
| 7 | narrative-llm.ts:689 硬编码「场景设计师」 | { imagePrompt, negativePrompt } |
| 8 | aigc-orchestrator.ts scene section fallback 内联（:564） | 与 DB scene-optimizer 内容不同 |

### 3.3 剧情统筹 —— 4 个版本

| key | 使用方 | 输出 |
|---|---|---|
| DB `剧情总指挥` | aigc-orchestrator 8-Agent Phase 0 | plotBlueprint（title/genre/threeActStructure...） |
| DB `plot-supervisor` | director-v2 api-surface:290、compileIR.ts:57 | 六维拆解（与上不兼容）——**且 seed 无此记录** |
| DB `剧本拆解总导演` | script-breakdown-master（V3 宪法） | NarrativeConstitutionV3 ——**seed 亦无此记录**（靠运维/admin 手工录入） |
| `prompts/agents/plot-supervisor.txt`（死文件） | — | 无 schema |

### 3.4 摄影/镜头 —— 3 个版本

- DB `director-of-photography`（ai-optimize-shot 用，摄影参数建议）
- DB `镜头/特效师`（aigc-orchestrator AGENTS[7]，outputKey=effectSpecs，特效规范）——**同名职责错位**
- `prompts/agents/director-of-photography.txt`（死文件，严格 JSON 规则，无 schema）

### 3.5 叙事分析 —— 2 个版本

- DB `narrative-system-prompt`（seed-prompts.ts:354 已 seed，**从未被引用**）
- narrative-llm.ts:70 硬编码 `NARRATIVE_SYSTEM_PROMPT`（实际使用，内容完全不同）

### 3.6 AIGC 规格表 —— 3 个版本

- `routes/aigc-prompt.txt` == `routes/aigc-spec-prompt.txt`（逐字节相同，9289B）
- DB `aigc-prompt`（运行时唯一权威）
- `prompts/aigc-spec-system.txt`（140B，仅脚本用）

### 3.7 分镜 —— 3 个版本

- storyboards.ts:76 硬编码「影视分镜师」
- DB `storyboard-designer`（ai-optimize-storyboard 用，**seed 无记录**）
- DB `storyboard-optimizer`（aigc-orchestrator storyboard section 用，seed 有）

---

## 4. LLM 调用边界

```
┌─ 工作台核心链路（✅ 统一）─────────────────────────────┐
│ agents/*、narrative-llm、script-submit、studio-create-work、│
│ ai-optimize-*、director-v2、storyboards → narrativeGateway  │
│   → ExecutionGraph(v2) 用户配置 → BYOK 注入 → provider.call  │
│   （熔断/超时 tier/配额/async degrade/tracing 齐备）          │
└──────────────────────────────────────────────────────────┘
┌─ 并行第二网关（⚠️ 并存）──────────────────────────────┐
│ services/unified-ai-gateway.ts（invokeAI）→ 自建 adapters    │
│   （aliyun/volcengine/deepseek/openai），限流/并发/重试自有    │
└──────────────────────────────────────────────────────────┘
┌─ 直连 fetch（❌ 绕过统一层）───────────────────────────┐
│ services/hdz/llm.client.ts callLLM/deepseekChat            │
│   → 直接 fetch /chat/completions                            │
│   → 无熔断、无 provider fallback、无 gateway tracing         │
│   → 仅手动 incrementDailyUsage                              │
│   → 明文 API Key 兼容分支（警告但放行）                     │
└──────────────────────────────────────────────────────────┘
┌─ 自建栈（范围外）──────────────────────────────────────┐
│ services/geo（provider-resolver + llm-client + md prompts）  │
│ services/career|enterprise|matching|legal（各域自封装）      │
└──────────────────────────────────────────────────────────┘
```

**边界结论**：短剧工作台核心链路已收敛到 narrativeGateway（符合统一配置纪律），但：
- 全仓存在 4 套 LLM 栈，工作台之外的调用点无法保证使用同一配置/模型/配额；
- 各域默认模型不一致（hdz 默认 doubao-seed-2-1-pro-260628；unified-ai-gateway deepseek 默认 deepseek-v4-flash；volcengine 默认 doubao-seed-2-0-plus-260428）；
- `routes/narrative-llm.ts` 的 `/analyze` 与 `director-v2` 的 constitution-compiler 等虽走 gateway，但 prompt 是硬编码，绕过 DB 管理。

---

## 5. 问题列表（文件:行号 + 描述 + 严重级别）

> 级别：🔴 高（P1 阻断/合规）｜🟠 中（P2 漂移/隐患）｜🟡 低（P3 清理/体验）

### 5.1 Prompt 硬编码（违宪）

| 级别 | 位置 | 描述 |
|---|---|---|
| 🔴 | `routes/narrative-llm.ts:70` | `NARRATIVE_SYSTEM_PROMPT`（约 150 行）硬编码，且文件头部注释宣称「禁止硬编码 prompt，必须从 DB 读取」；DB 已 seed `narrative-system-prompt`（seed-prompts.ts:354）却未使用 |
| 🔴 | `routes/narrative-llm.ts:627` | regen-spec character 系统提示硬编码；DB `character-visual-designer` 模板闲置 |
| 🔴 | `routes/narrative-llm.ts:689` | regen-spec scene 系统提示硬编码；DB `scene-visual-designer` 模板闲置 |
| 🟠 | `director-v2/constitution-compiler.ts:75` | `ENRICH_SYSTEM_PROMPT`（导演宪法）整体硬编码（含完整 JSON schema） |
| 🟠 | `routes/storyboards.ts:76` | 分镜师 prompt 硬编码（与 DB storyboard-designer 并存） |
| 🟠 | `routes/ai-optimize-image-prompt.ts:36` | 图片优化 prompt 硬编码 |
| 🟠 | `routes/ai-optimize-ad-script.ts:22` | `ad-script-designer` 缺失时的大段硬编码 fallback（含示例、schema），与 DB 内容双份维护 |
| 🟠 | `agents/aigc-orchestrator.ts:517` | storyboard section fallback prompt 硬编码（`'你是一个 AI 分镜提示词优化专家...'`） |
| 🟠 | `agents/aigc-orchestrator.ts:564` | scene section fallback prompt 硬编码（`'你是一个专业的AI场景图提示词优化专家...'`） |
| 🟠 | `services/director/production-preparation.service.ts:195,243` | 分镜/角色视觉补全 prompt 硬编码 |
| 🟠 | `services/storyboard-quality-gate.ts:263,310` | 分镜/角色质量补全 prompt 硬编码 |
| 🟠 | `services/fight-director.service.ts:186` | 打斗分镜 prompt 硬编码 |
| 🟠 | `agent-runtime/execution/step-executor.service.ts:91` | 报告生成 prompt 硬编码 |
| 🟠 | `agents/portrait-prompt.agent.ts:39,59,66,72,84` | 5 个 `FALLBACK_*` 硬编码（注释自认是 DB 降级方案；与 imagePromptTemplates 表双源） |
| 🟠 | `services/hdz/llm.client.ts:327` | `STYLE_ANALYSIS_SYSTEM_PROMPT` 硬编码 |
| 🟡 | `routes/hdz/library-reader.ts:37-79`、`master-plan.ts:19`、`novel-reference.ts:128`、`project.ts:155`、`story-event.ts:100`、`chat.ts:257`、`services/hdz/character.service.ts:69`、`director.service.ts:91`、`character-state-evolution.service.ts:123` | HDZ 域大量内联系统提示（部分与 DB hdz-* 模板并存） |

### 5.2 Prompt 一致性 / SSOT 缺失

| 级别 | 位置 | 描述 |
|---|---|---|
| 🔴 | DB key 全局 | 角色/场景/统筹任务 4~9 个版本并存（见 §3），无 SSOT；`剧情总指挥` vs `plot-supervisor` vs `剧本拆解总导演` 三把 key 对应同一职责 |
| 🔴 | `routes/aigc-spec-prompt.txt` | 与 `aigc-prompt.txt` 逐字节重复（diff IDENTICAL），且无人引用；文件末尾嵌入已废弃路由源码 `app.post('/api/v1/narrative/aigc-spec')`（该路由当前未注册，属死代码） |
| 🔴 | `routes/analyze-v2-prompt.txt` | 无人引用（实际用 DB `六维数据拆解分析`），schema 与 DB 不一致，易误导 |
| 🟠 | `prompts/agents/*.txt`（8 个） | 无运行时引用（仅 snapshots），内容与 DB 同名模板已漂移（txt 无 schema，DB 有 schema）；`AGENTS[].promptFile` 字段指向这些 txt 但实际从 DB 读，字段名误导 |
| 🟠 | `prompts/aigc-spec-system.txt` | 仅 140B 一句话，且只被一次性脚本 regen-bp3.ts 使用；与 DB aigc-prompt 内容完全不同 |
| 🟠 | `director-v2/runtime/api-surface.ts:290`、`director-v2/narrative-ir/compileIR.ts:57` | 依赖 DB key `plot-supervisor`，该 key **未出现在任何 seed 中**；DB 无记录时直接抛错，依赖人工录入 |
| 🟠 | `agents/aigc-orchestrator.ts:396-433` | 依赖 DB key `剧本拆解总导演`，同样无 seed 保障（`scripts/seed-prompts.ts` 未覆盖），DB 缺失时静默回退 8-Agent 链路，两链路输出 schema 完全不同但对外返回同一 AigcSpecOutput |
| 🟡 | `routes/script-breakdown.ts` | 将 `六维数据拆解分析` 快照进每条任务的 `fixedSystemPrompt`——prompt 更新后旧任务不可重放新 prompt（设计取舍，需知晓） |

### 5.3 JSON 校验 & 失败处理

| 级别 | 位置 | 描述 |
|---|---|---|
| 🔴 | `agents/character.agent.ts:58-66` | 仅 JSON.parse + 查 `characters` 数组存在性，无字段级校验；解析失败直接 throw |
| 🔴 | `agents/aigc-orchestrator.ts`（8-Agent 链路） | 无 schema 校验，仅宽松 key 提取 + 别名映射；`声音设计师`/`道具设计师` 失败被宽容为**空数组返回 success:true**（:585 附近），用户无感知拿到空音色/道具 |
| 🟠 | `agents/scene-image-prompt.agent.ts:88-108` | 解析失败**静默返回空 prompt 数组**（catch 空吞），前端拿到 8 个空场景 prompt 无提示 |
| 🟠 | `routes/storyboards.ts:76-95` | JSON.parse 失败无处理（直接异常冒泡） |
| 🟠 | `routes/narrative-llm.ts` deep-analyze（:437-448） | JSON.parse 失败仅 console.warn 后返回 rawContent，narrative=null，无 schema 校验 |
| 🟠 | `routes/narrative-llm.ts` regen-spec（:660-697） | 解析失败回退 `gatewayResponse.content.trim().slice(0,500)` 当 imagePrompt——可能把 JSON 原样当 prompt |
| 🟠 | `agents/aigc-spec-agent.ts:466-500` | `_validate` 只查数组存在性 + cameraAngle 枚举；重试 1 次后即使仍残缺也 `success:true` 返回「清洗后 spec」 |
| 🟡 | `agents/aigc-spec-agent-v2.ts:112-140` | `validateBreakdown` 校验失败仅 console.warn，不重试不抛错——与注释宣称的「strict type enforcer」不符 |
| ✅ | `agents/script-breakdown-master.ts:214-330` | **唯一严格字段级校验**（SchemaValidationError + 1 次重试 + 宽松解析兜底） |

### 5.4 LLM 调用边界 / 运行时缺陷

| 级别 | 位置 | 描述 |
|---|---|---|
| 🔴 | `services/hdz/llm.client.ts:56-100` | 直连 fetch 绕过 narrativeGateway：无熔断、无 provider fallback、无统一 tracing、超时写死 120s；`getUserLLMConfig` 兼容**明文 API Key**（:40-48 警告放行） |
| 🟠 | `runtime/narrative-gateway.ts:448-456` | 配额检查分支返回 `{success:false, content:'', error, tokenUsage:null}`——与 GatewayResponse 类型不符，所有调用方只读 `.content`/`.ok`，配额超限时**静默得到空字符串**而非明确报错，错误信息被下游误报为「JSON 解析失败」 |
| 🟠 | `routes/narrative-llm.ts:369-382` | analyze-v2 最外层 catch 引用**未定义变量 `fb2Norm`**（声明的是 `fb2`）→ 走到该分支必然 ReferenceError → 500 |
| 🟠 | `agents/orchestrator/UOA.ts:120-125` | `submitTask()` 返回假 taskId（`uoa-${Date.now()}`），从不真正提交队列——「视频生成编排」为占位实现，上层可能误以为已入队 |
| 🟠 | `services/unified-ai-gateway.ts` vs `runtime/narrative-gateway.ts` | 两套「统一网关」并存，各自维护 adapter/限流/重试，用户模型配置解析路径不同（userModelResolver vs llm-execution-graph-v2），存在配置漂移风险 |
| 🟡 | `runtime/narrative-gateway.ts:378` | `(this as any)._lastUserProvider` 从未被赋值（恒 undefined），相关分支是死逻辑 |

### 5.5 幻觉风险（要求 AI 编造数据）

| 级别 | 位置 | 描述 |
|---|---|---|
| 🟠 | `prompts/agents/props-designer.txt`（死文件，但 seed 的 DB `道具设计师` 同规则） | 明确要求「如果故事中没有明确提到道具，也要根据故事场景推测……至少输出 1 个」——**主动编造**，用于演示可接受，但生产链路上无「推测内容需标注」的约束 |
| 🟠 | `routes/narrative-llm.ts` NARRATIVE_SYSTEM_PROMPT 等多数 prompt | 未声明「禁止虚构故事中不存在的信息/用户数据」；少数 prompt（aigc-spec-agent `_buildTypePrompt` 规则 3）有该约束——约束不统一 |
| 🟠 | `agents/aigc-spec-agent.ts:380-450` regenerateType | 把前端传入的 `currentData`（JSON.stringify 后）回填给 LLM 作参考，且无「只改指定字段、其余原样」的强约束——有把旧数据当真的风险 |
| 🟡 | `routes/narrative-llm.ts:300-330` deep-analyze | `if (!narrative.props || narrative.props.length === 0)` 时从 `characterSpecs.clothing` 硬造 props（`${角色名}的服装`）——确定性编造，但会污染下游数据 |

### 5.6 死代码 / 清理项

| 级别 | 位置 | 描述 |
|---|---|---|
| 🟡 | `routes/narrative-llm.ts.analyze-v2-bak`、`routes/narrative-llm.ts.preboundary-fix` | 备份文件含旧 prompt 副本，易被误读为权威 |
| 🟡 | `routes/execution-images.js`（81KB） | 旧版 JS 路由与 execution-images.ts 并存 |
| 🟡 | `agents/aigc-spec-agent.ts` / `aigc-spec-agent-v2.ts` | 已 deprecated 但仍被引用？——实际**无任何调用方**（grep 仅定义处），可归档 |
| 🟡 | `agents/aigc-orchestrator.ts:154-158` | `if (def.promptFile === 'plot-supervisor.txt')` 分支内 finalPrompt=systemPrompt，无实际作用（微表情库已内联 DB） |

---

## 6. 修复建议

### P0 优先（一周内）
1. **确立 SSOT 并收敛 key 命名**
   - 以 DB `PromptTemplate` 表为唯一权威，删除/归档所有 `*.txt` prompt 文件（含 aigc-spec-prompt.txt、analyze-v2-prompt.txt、prompts/agents/*.txt）。
   - 统一角色/场景/统筹的 DB key：`剧情总指挥`/`plot-supervisor` 合并为一个 key（建议英文 snake_case 如 `plot-supervisor`），8-Agent 链路与 director-v2 共用。
   - 为 `剧本拆解总导演`、`character-agent`、`scene-image-prompt-agent`、`aigc-spec-agent-v2`、`plot-supervisor` 等运行时依赖的 key 补 seed（当前 seed-prompts.ts 未覆盖，DB 缺失即运行时抛错）。
2. **消灭工作台硬编码 prompt**：narrative-llm.ts:70/627/689、storyboards.ts:76、ai-optimize-image-prompt.ts:36、director-v2 constitution-compiler.ts:75、production-preparation/storyboard-quality-gate/fight-director 全部改为 DB 读取（DB 缺失 → 启动时校验告警而非运行时静默 fallback 双份维护）。
3. **修复 narrative-gateway.ts:448 配额返回**：返回统一 GatewayResponse 结构（ok:false + 可读 error），或 throw 可识别错误码；所有调用方增加 `!result.ok` 短路。
4. **修复 narrative-llm.ts:371 `fb2Norm` 未定义**（改为使用 `fb2`），并为 analyze-v2 外层 catch 补 heuristic 结果归一化。

### P1（本月）
5. **统一 JSON schema 校验层**：为每个 DB prompt 的 `output_schema` 建立运行时 zod/ajv 校验（PromptRegistry 已支持 `schema` 字段，尚未落地校验）；校验失败统一走「重试 1 次（带错误反馈）→ 记录 telemetry → 明确报错/降级」，禁止静默空数组（scene-image-prompt.agent.ts:88、aigc-orchestrator 声音/道具宽容逻辑）。
6. **收敛 LLM 通道**：短剧域全部走 narrativeGateway；评估将 hdz 的 `llm.client.ts` 迁移到 gateway（或至少补熔断/重试/统一 quota）；明文 API Key 分支改为强制加密。
7. **UOA.ts 落地真实队列提交**（对接 queue-manager），或标注为 experimental 并阻止生产误用；删除假 taskId 占位。
8. **幻觉约束模板化**：给所有「提取/拆解」类 prompt 追加统一约束块（「仅基于输入文本，不得虚构故事外信息；推测内容须标注『推测』」）；props 类「推测」需求改为可配置开关。
9. **删除 deprecated 文件**：aigc-spec-agent.ts、aigc-spec-agent-v2.ts（确认无调用后归档）、备份文件、execution-images.js。

### P2（季度）
10. 建立 Prompt 变更纪律：`seed-prompts.ts` / `seed-optimizer-templates.ts` / `admin-global-config` / `admin-prompt-runtime`（PromptVersionGraph 版本化）多入口写 DB，建议统一到 PromptRegistry + version graph，杜绝四处 seed 冲突。
11. `script-breakdown.ts` 的 fixedSystemPrompt 快照机制：改为存 prompt 版本号而非全文，支持重放。
12. 8-Agent 链路与 V3 拆解总导演输出 schema 对齐（都映射到 AigcSpecOutput 的不同字段，前端需兼容两套字段名——建议输出层统一归一化，如 buildV3SpecOutput 已做，8-Agent 链路同样处理）。

---

## 7. 附：审计方法

- 全量 grep：`narrativeGateway` / `getPrompt` / `buildPromptCached` / `callLLM` / `systemPrompt` / `llm.generate` / `.chat(` / `provider.call` / `getProvider(`，覆盖 src 全部 100+ 目录。
- 逐文件阅读：prompts 全部 11 个 txt、agents 全部 10 个文件、orchestrator/UOA、routes 3 个 txt、narrative-llm.ts、script-submit.ts、script-breakdown.ts、studio-create-work.ts、aigc-orchestrator.ts 全文、prompt-service.ts、PromptRegistry.ts、narrative-gateway.ts、unified-ai-gateway.ts、hdz/llm.client.ts、director-v2 关键文件、seed-prompts.ts、seed-optimizer-templates.ts。
- diff 验证：aigc-prompt.txt vs aigc-spec-prompt.txt（IDENTICAL）。
- 范围说明：services/geo、career、enterprise、matching、legal 为其他业务域，仅标注存在独立 LLM 栈，未深入。
