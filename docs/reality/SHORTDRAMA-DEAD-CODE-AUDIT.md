# SHORTDRAMA-DEAD-CODE-AUDIT — Runtime Dead Path Audit

- Sprint: ShortDrama-Reality-Recovery-Phase5 / Runtime Boundary Cleanup
- 日期: 2026-07-31
- 原则: **只审计，不删除**。每个候选必须证明：import / route / service call / frontend reference 四维度
- 验证方式: 全仓 grep + **运行时 HTTP 实测**（404 判定）

---

## 生产 SSOT 冻结清单（本次审计不触碰）

```
/api/tasks/ai-generate  ·  BullMQ ai-runtime  ·  Worker  ·  Provider Adapter
AiCharacterSpec  ·  AiSceneSpec  ·  AiVideoSegment  ·  pipeline_stages
PromptTemplate Resolver  ·  script-submit / script-regenerate / script-breakdown
```

---

## 审计结果总表

| 候选 | import | route 注册 | service call | frontend 引用 | 运行时实测 | 判定 |
|------|--------|-----------|--------------|---------------|-----------|------|
| `agents/orchestrator/UOA.ts` | 1（index.ts 启动 init） | 0 | 0 | 0 | 仅启动日志，execute() 从未被调 | **僵尸初始化**（有 import 无执行） |
| `agents/orchestrator/shadow/UOAShadow.ts` | 1（仅 UOA.ts 内部） | 0 | 0 | 0 | 随 UOA 失活 | **死文件链** |
| `routes/workbench-director.ts` | 0 | **0（index.ts 未注册）** | 0 | 6 处前端调用 | **/api/workbench/* 全部 404** | **死路由层** |
| `queue/mock-provider.ts` | **0** | 0 | 0 | 0 | — | **死文件**（Worker 从未引用） |
| `agents/aigc-spec-agent.ts` | **0** | 0 | 0 | 0 | — | **死文件**（自身已标 deprecated） |
| `agents/aigc-spec-agent-v2.ts` | **0** | 0 | 0 | 0 | — | **死文件** |
| `agents/character.agent.ts` | **0**（'character_agent' 仅为字符串枚举） | 0 | 0 | 0 | — | **死文件** |
| `prompts/agents/*.txt`（9 个） | 0 readFileSync（仅 orchestrator 元数据引用） | — | 0 | 0 | 内容已在 DB PromptTemplate | **死文件**（历史审计价值保留） |
| `prompts/aigc-spec-system.txt` / `routes/aigc-spec-prompt.txt` / `routes/analyze-v2-prompt.txt` | 0 | — | 0 | 0 | 内容已在 DB | **死文件** |
| `routes/aigc-spec-db.ts` | ✅ 已注册 (index.ts:104) | ✅ | ✅ | ✅ 前端 save/load 调用 | ✅ 活跃 | **保留（活跃）** |
| 前端 `MockRunnerPage.vue` | **0** | — | — | 0（无人 import） | 调 /api/workbench/* → 404 | **死组件** |
| 前端 `stores/workbench.ts` | 仅旧页面链 | — | — | layouts/workbench.vue + pages/workbench/* + useSSEStream | 旧页面 API 404 | **孤岛 store**（studio-v2 生产链 0 污染 ✅） |
| 前端 `pages/workbench/*`（console/dag/health/repair/trace/index） | Nuxt 自动路由可达 | — | — | layouts/workbench.vue | 调 /api/repair、/api/trace/:id、/api/replay → **全部 404**（gateway 层未注册） | **前端孤岛** |
| 前端 `pages/director/workbench.vue` + `observatory.vue` | Nuxt 自动路由可达 | — | — | — | 调 /api/workbench/* → 404 | **前端孤岛** |
| 前端 `studio-v2/workspace/director-workbench/`（含 director-ir/causal-graph/observatory/stores） | 仅被上述孤岛页面引用 | — | — | pages/director/* | 后端 404 | **前端孤岛**（未完成未来层） |

---

## 关键证据

### 1. UOA — 僵尸初始化
```ts
// index.ts:1365 仅启动时 import，无任何业务调用
const { uoa } = await import('./agents/orchestrator/UOA.js')
console.log('[UOA] ✅ Orchestrator Agent online')
// uoa.execute() 全仓 0 调用
```

### 2. workbench-director — 死路由层（运行时 404 实测）
```bash
POST /api/workbench/generate-director  → 404
GET  /api/workbench/jobs               → 404
GET  /api/v2/workbench/projects        → 401（对照：已注册路由需认证，正常）
```
index.ts 仅注册 `workbenchProjectRoutes`（workbench-project.ts），**未注册 workbench-director.ts**。前端 6 处调用全部落空：
- `MockRunnerPage.vue`（/api/workbench/generate-director, compile-blueprint, render, jobs/:id）
- `director-replay-store.ts`（/api/workbench/replay/stream/:traceId）
- `useRuntimeBinding.ts`（/api/workbench）
- `unified-client.ts`（/api/workbench/director-ir/compile）
- `pages/director/observatory.vue`（/api/workbench/jobs, observatory/:id）

### 3. queue/mock-provider — 0 引用
`mockProviderCall` 函数全仓 grep = 0（Worker 未引用，注释声称"Worker 内部 Mock Provider"但实际无人调用）。

### 4. Agent 死文件三件套
`character.agent.ts` / `aigc-spec-agent.ts` / `aigc-spec-agent-v2.ts`：import = 0。`'character_agent'` 字符串出现在 ai-invocation-envelope / invocation-log / optimization-engine / async-pipeline 仅是 agentType 枚举类型，非代码引用。

### 5. 前端孤岛链
```
stores/workbench.ts ← layouts/workbench.vue ← pages/workbench/*（盘古斧 AI OS 调试台）
                                                    ↓ 调 /api/repair /api/trace/:id /api/replay
                                                    ↓ gateway/routes.ts 未注册 → 404
```
`useSSEStream` 仅被 pages/workbench/* 使用；**studio-v2/workspace/* 生产链 0 引用 workbench store** ✅

### 6. 活跃对照项（保留）
- `routes/aigc-spec-db.ts`：前端 ScriptAnalysisWorkspace / StoryboardWorkspace 真实调用 save/load ✅
- `studio-v2/workspace/advertisement` + `music-generation`：被 WorkspaceRenderer 引用，活跃工作台 ✅
- `services/geo/*`：index.ts 注册（geo 业务线活跃）✅

---

## 处理动作（Phase 5.2 / 5.3 执行）

| 动作 | 对象 |
|------|------|
| 📄 归档（不删除） | `prompts/agents/*.txt`（9）+ `prompts/aigc-spec-system.txt` + `routes/aigc-spec-prompt.txt` + `routes/analyze-v2-prompt.txt` → `prompts/archive/*.deprecated` |
| 🏷️ deprecated 标记 | `UOA.ts`、`UOAShadow.ts`、`workbench-director.ts`、`queue/mock-provider.ts`、`aigc-spec-agent.ts`（已有）、`aigc-spec-agent-v2.ts`、`character.agent.ts` |
| 🏷️ 前端 deprecated 注释 | `MockRunnerPage.vue`、`stores/workbench.ts`、`pages/workbench/*`（文件头注释） |
| ❌ 不处理 | geo 业务线（活跃）、hdz 业务线（活跃，见 HDZ-DIRECT-LLM-USAGE.md）、Advertisement/MusicGeneration workspace（活跃）、aigc-spec-db（活跃） |

## 后续建议（Phase 5 外，待掌柜决策）
- workbench-director 若未来启用 director 能力 → 需注册路由 + 前端对齐；否则建议整体移入 `legacy/`
- pages/workbench 调试台依赖盘古斧 gateway 层 → 该层未注册，建议前端入口下线或等待平台层激活
