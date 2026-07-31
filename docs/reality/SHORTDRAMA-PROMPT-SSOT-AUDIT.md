# SHORTDRAMA-PROMPT-SSOT-AUDIT — Prompt Runtime Reality 收敛审计

- Sprint: ShortDrama-Reality-Recovery-01 / Phase 4
- 日期: 2026-07-31
- 范围: 短剧工作台所有 AI 生成能力的 Prompt 真相源
- 原则: 只审计不删除；迁移前全仓 grep + 运行时调用链确认；不改变真实生产链

---

## 生产链事实（审计基线）

```
script-submit / script-regenerate
  → aigcOrchestrator.generate()          (Business Agent 层)
    → 剧本拆解总导演 (V3 一键) 或 8 Agent 链路
  → narrativeGateway.execute()           (统一 LLM 网关)
  → BullMQ ai-runtime                    (Task Runtime)
  → Worker (processImage/processVideo/processTTS)
  → Provider (aliyun/volcengine/deepseek/...)

/tasks/ai-generate → enqueueTask → 同上 Worker 链（图片/视频/语音执行）
```

Worker 层（image/video/tts）消费上游生成的 prompt（payload.input.prompt），自身不生成 prompt——符合 SSOT 设计。

---

## Task 4.1 — Prompt 全量审计表

### A. DB PromptTemplate（运行时使用 ✅）

| Prompt | 当前来源 | 运行时使用 | 处理 |
|--------|---------|-----------|------|
| 剧本拆解总导演 | DB PromptTemplate (5443字) | ✅ script/submit 全量分析（V3 一键） | 保留（生产链核心） |
| 剧情总指挥 | DB (661字) | ✅ 8 Agent 链路 Phase 0 | 保留 |
| 角色设计师 | DB (1168字) | ✅ 8 Agent 链路 + regenerate(character) | 保留 |
| 场景设计师 | DB (1009字) | ✅ 8 Agent 链路 | 保留 |
| 角色定妆师 | DB (443字) | ✅ 8 Agent 链路 + regenerate(makeup) | 保留 |
| 声音设计师 | DB (443字) | ✅ 8 Agent 链路 + regenerate(voice) | 保留 |
| 画面设计师 | DB (1000字) | ✅ 8 Agent 链路 + regenerate(storyboard/video) | 保留 |
| 道具设计师 | DB (237字) | ✅ regenerate(props) | 保留 |
| 镜头/特效师 | DB (560字) | ✅ 8 Agent 链路 | 保留 |
| 六维数据拆解分析 | DB (3204字) | ✅ /script-breakdown + analyze-v2 + runAnalyzeV2Snapshot | 保留 |
| storyboard-optimizer | DB (71字) | ✅ regenerate(storyboard) 严格读取 | 保留（内容过简，建议后续增强） |
| scene-optimizer | DB (45字) | ✅ regenerate(scene) 严格读取 | 保留（内容过简，建议后续增强） |
| director-of-photography | DB (3846字) | ✅ /ai/optimize-shot-script | 保留 |
| video-prompt-designer | DB (5501字) | ✅ /ai/optimize-video-prompt | 保留 |
| frame-designer | DB (3339字) | ✅ /ai/optimize-frame-prompt | 保留 |
| storyboard-designer | DB (2470字) | ✅ /ai/optimize-storyboard | 保留 |
| render-spec-builder | DB (1513字) | ✅ /ai/optimize-video-prompt (agent) | 保留 |
| video-optimize-user-prompt | DB (534字) | ✅ /ai/optimize-video-prompt (agent) | 保留 |
| image-prompt-designer | DB (254字) | ❌ 未被引用（死 key） | 保留（标记） |
| character-view-prompts / scene-view-prompts | DB | ❌ 未被引用（死 key） | 保留（标记） |
| character-visual-designer / scene-visual-designer / narrative-system-prompt | DB | ❌ 代码 0 引用 | 保留（预留 key） |
| geo-content-* / hdz-* / frame-designer(image) 等 | DB | 其它业务线 | 不在本 Sprint 范围 |

### B. TS 硬编码（迁移完成 ✅）

| Prompt | 位置 | 运行时使用 | 处理 |
|--------|------|-----------|------|
| 图像提示词工程师 | `ai-optimize-image-prompt.ts:36` | ✅ 广告工作台（AdvertisementWorkspace + m/creative） | ✅ 迁移 → DB `image-prompt-optimizer` |
| 影视分镜师 | `storyboards.ts:76` | ❌ 无前端调用（死路由，仅 stageFlow 死配置） | ✅ 迁移 → DB `storyboard-shot-generator` |
| 电影叙事分析师 (NARRATIVE_SYSTEM_PROMPT) | `narrative-llm.ts:70` | ❌ /api/v1/narrative/analyze（前端不调用） | ✅ 迁移 → DB `narrative-analyzer` |
| 角色视觉设计师 | `narrative-llm.ts:627` | ❌ /api/v1/narrative/regen-spec | ✅ 迁移 → DB `character-visual-prompt` |
| 场景设计师 | `narrative-llm.ts:689` | ❌ /api/v1/narrative/regen-spec | ✅ 迁移 → DB `scene-visual-prompt` |
| AI 影视导演 fallback | `studio-create-work.ts:319` | ❌ 路由未注册 | ✅ 删除 fallback，DB 缺失即抛错 |
| 分镜优化默认值 | `aigc-orchestrator.ts` (storyboard section) | ⚠️ 曾被 DB 覆盖 | ✅ 删除默认值 → `loadPromptTemplateStrict` 缺失抛错 |
| 场景优化默认值 | `aigc-orchestrator.ts` (scene section) | ⚠️ 曾被 DB 覆盖 | ✅ 删除默认值 → `loadPromptTemplateStrict` 缺失抛错 |

### C. txt 文件（死文件，未删除 — 待 Phase 5 决策）

| 文件 | 运行时使用 | 处理 |
|------|-----------|------|
| `src/prompts/agents/plot-supervisor.txt` (322B) | ❌ 仅 orchestrator promptFile 元数据引用（无 readFileSync） | 内容已 seed 到 DB `plot-supervisor` |
| `src/prompts/agents/character-designer.txt` 等 7 个 | ❌ 同上 | 内容已在 DB（中文 key） |
| `src/routes/aigc-prompt.txt` (211行) | ❌ 无 readFileSync | 内容已 seed 到 DB `aigc-prompt` |
| `src/routes/aigc-spec-prompt.txt` / `analyze-v2-prompt.txt` | ❌ 0 引用 | 未处理（死文件） |
| `src/prompts/aigc-spec-system.txt` | ❌ 0 引用 | 未处理（死文件） |

### D. deprecated / 旁路（未删除，标记）

| 项 | 运行时使用 | 处理 |
|----|-----------|------|
| `portrait-prompt.agent.ts` FALLBACK_* 硬编码 | ⚠️ director-v2 旁路（/api/v2/director/*），DB image_prompt_templates 优先，硬编码仅 DB 不可用降级 | 标记（旁路遗留，Phase 5 决策） |
| `queue/mock-provider.ts` | ❌ 0 调用 | 标记（死文件） |
| `character.agent.ts`（buildPromptCached('character-agent')） | ❌ 0 调用方（DB 无此 key） | 标记（死代码） |
| `aigc-spec-agent.ts` / `aigc-spec-agent-v2.ts` | ❌ 0 调用方 | 标记（死代码） |
| `workbench-director.ts` | ❌ 未注册 index.ts | 标记（死代码） |
| `storyboards.ts` 路由 | ❌ 前端不调用（/api/projects/:id/storyboards/generate） | 标记（prompt 已迁移，路由保留） |
| `video-critic.ts` CRITIC_SYSTEM_PROMPT | ⚠️ feedback-loop（非主生产链） | 标记（Phase 5 决策） |
| `shotir-compiler.ts` / `production-preparation.service.ts` 硬编码 | ⚠️ P18 dual-render / director-execution 旁路 | 标记（Phase 5 决策） |
| `legal-regulation-fetch.route.ts:91` / `hdz/project.ts:155` 硬编码 | ⚠️ legal/hdz 业务线 | 标记（跨模块，不在本 Sprint 范围） |

---

## Task 4.3 — Prompt Key 补全（seed 完成 ✅）

| key | 缺失前状态 | 处理后 |
|-----|-----------|--------|
| `aigc-prompt` | DB 无 → deep-analyze 抛错 / studio-create-work fallback | ✅ seed（5839字，从 txt 迁移） |
| `plot-supervisor` | DB 无 → director-v2 compileIR/api-surface 抛错 | ✅ seed（131字，从 txt 迁移） |
| `scene-image-prompt-agent` | DB 无 → director-v2 场景优化抛错 | ✅ seed（410字） |
| `image-prompt-optimizer` | DB 无（硬编码） | ✅ seed（148字） |
| `storyboard-shot-generator` | DB 无（硬编码） | ✅ seed（375字，{charInfo} 占位符） |
| `narrative-analyzer` | DB 无（硬编码） | ✅ seed（2167字） |
| `character-visual-prompt` | DB 无（硬编码） | ✅ seed（302字） |
| `scene-visual-prompt` | DB 无（硬编码） | ✅ seed（188字） |

已禁止：
- ❌ 代码 fallback 随机 prompt（studio-create-work getDbPromptSafe 改为抛错）
- ❌ 硬编码默认值兜底（aigc-orchestrator 改为 loadPromptTemplateStrict 抛错）

## Task 4.4 — AI 输出契约检查 ✅

| 生成项 | 契约 | 状态 |
|--------|------|------|
| 角色生成 (regenerate character) | 失败 → success:false + error | ✅ 原有符合 |
| 场景生成 (regenerate scene) | 失败 → success:false + error | ✅ 原有符合 |
| 分镜生成 (regenerate storyboard) | 失败 → success:false + error | ✅ 原有符合 |
| 声音生成 (regenerate voice) | ⚠️ 原失败返回 success:true+空数组 | ✅ 修复 → success:false + errorCode + userMessage |
| 道具生成 (regenerate props) | ⚠️ 原失败返回 success:true+空数组 | ✅ 修复 → success:false + errorCode + userMessage |
| 全量分析 (script/submit) | 总导演失败 → success:false | ✅ 原有符合 |

失败契约统一：
```json
{ "success": false, "errorCode": "角色设计师_GENERATION_FAILED", "error": "...", "userMessage": "角色设计师 生成失败，请重试。（原因）" }
```

---

## Reality Gate（运行时验证）

| Gate | 验证 | 结果 |
|------|------|------|
| P1 Prompt 真相源唯一 | 8 个新 key 经 getPrompt 全部可读（5839/131/410/148/375/2167/302/188 chars） | ✅ |
| P2 生产链不破坏 | script/submit 全量真实 LLM 调用成功（breakdownMaster=true, 1 segment/2 chars/1 scene） | ✅ |
| P3 硬编码清零（短剧+广告链） | 5 个文件迁移 + 2 处默认值删除，grep 无残留中文 systemPrompt 字面量 | ✅ |
| P4 失败契约 | voice/props 不再 success:true+空数组；返回 errorCode+userMessage | ✅ |
| P5 DB 缺失即报错 | storyboard/scene 优化模板缺失 → loadPromptTemplateStrict 抛错（不再静默降级） | ✅ |

## 修改文件列表

| 文件 | 改动 |
|------|------|
| `prisma/seed-prompt-ssot.ts` | **新增** — 8 个 PromptTemplate seed（幂等 upsert） |
| `src/routes/ai-optimize-image-prompt.ts` | 硬编码 → getPrompt('image-prompt-optimizer') |
| `src/routes/storyboards.ts` | 硬编码 → getPrompt('storyboard-shot-generator') + {charInfo} 替换 |
| `src/routes/narrative-llm.ts` | NARRATIVE_SYSTEM_PROMPT → getDbPrompt('narrative-analyzer')；角色/场景硬编码 → DB |
| `src/routes/studio-create-work.ts` | getDbPromptSafe 空 fallback → 抛错（无随机 prompt） |
| `src/agents/aigc-orchestrator.ts` | +loadPromptTemplateStrict；storyboard/scene 默认值删除；voice/props 失败契约修复；返回类型 +errorCode/userMessage |

## 未处理历史文件列表（待 Phase 5 决策，不删除）

1. `src/prompts/agents/*.txt`（8 个死 txt）
2. `src/routes/aigc-spec-prompt.txt` / `analyze-v2-prompt.txt` / `src/prompts/aigc-spec-system.txt`
3. `queue/mock-provider.ts`
4. `character.agent.ts` / `aigc-spec-agent.ts` / `aigc-spec-agent-v2.ts`
5. `workbench-director.ts`
6. `portrait-prompt.agent.ts` FALLBACK 硬编码（director-v2 旁路）
7. `video-critic.ts` / `shotir-compiler.ts` / `production-preparation.service.ts` 硬编码（旁路/辅助）
8. `legal-regulation-fetch.route.ts` / `hdz/project.ts` 硬编码（跨模块业务线）

## 部署状态

- seed 已执行（8 key 入库）
- 后端已重启（health ok，新代码生效）
- 测试数据已清理（Demo Project 恢复 draft 状态）
