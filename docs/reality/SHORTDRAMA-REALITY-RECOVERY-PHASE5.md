# SHORTDRAMA-REALITY-RECOVERY-PHASE5 — Runtime Boundary Cleanup 交付

- Sprint: ShortDrama-Reality-Recovery-Phase5
- 日期: 2026-07-31
- 目标: 清除所有可能重新污染 SSOT 的旁路（**不删除文件，只治理**）
- 冻结: `/api/tasks/ai-generate` · BullMQ ai-runtime · Worker · Provider Adapter · AiCharacterSpec · AiSceneSpec · AiVideoSegment · pipeline_stages · PromptTemplate Resolver

---

## Task 完成情况

| Task | 内容 | 状态 |
|------|------|------|
| 5.1 | 全仓死路径审计 → `SHORTDRAMA-DEAD-CODE-AUDIT.md` + `HDZ-DIRECT-LLM-USAGE.md` | ✅ |
| 5.2 | Prompt 历史文件治理：13 个 txt → `prompts/archive/*.deprecated` | ✅ |
| 5.3 | deprecated 标记：后端 5 文件 + 前端 8 文件 | ✅ |

### Task 5.1 核心发现

| 候选 | 判定 | 证据 |
|------|------|------|
| UOA.ts | 僵尸初始化 | import=1（index.ts 启动），execute() 全仓 0 调用 |
| workbench-director.ts | 死路由层 | **未注册**；/api/workbench/* 运行时全 404；前端 6 处调用落空 |
| queue/mock-provider.ts | 死文件 | mockProviderCall 全仓 0 引用（Worker 从未调用） |
| aigc-spec-agent.ts / v2 | 死文件 | import=0（v1 已有 deprecated） |
| character.agent.ts | 死文件 | import=0（'character_agent' 仅字符串枚举） |
| prompts/*.txt（13 个） | 死文件 | 0 readFileSync；内容已在 DB PromptTemplate |
| MockRunnerPage.vue | 死组件 | 0 import；调 /api/workbench/* → 404 |
| stores/workbench.ts + pages/workbench/* | 前端孤岛 | 仅旧调试台互用；API 全部 404；**studio-v2 生产链 0 污染** ✅ |
| pages/director/workbench.vue + observatory.vue | 前端孤岛 | 调 /api/workbench/* → 404 |
| **aigc-spec-db.ts** | **活跃（保留）** | 前端 ScriptAnalysis/Storyboard 真实调用 save/load |
| **Advertisement/MusicGeneration workspace** | **活跃（保留）** | WorkspaceRenderer 引用 |
| **geo / hdz 业务线** | **活跃（保留）** | index.ts 注册 / 前端页面调用 |

### Task 5.2 归档清单（git mv 保留历史）

`src/prompts/archive/`（13 个 `.deprecated`）：
- agents 9 个：character-designer / director-of-photography / frame-designer / honglou-microexpression-library / makeup-designer / plot-supervisor / props-designer / scene-designer / sound-designer
- 其他 4 个：aigc-prompt / aigc-spec-prompt / aigc-spec-system / analyze-v2-prompt

归档前复核：全仓 readFileSync 仅 geo 业务线（读 .md，不冲突）；无路径字符串引用 ✅

### Task 5.3 标记清单

统一格式（掌柜指定）：
```ts
/**
 * @deprecated
 * Reality Recovery Phase5
 * Production path unused — ...
 */
```

后端 5：UOA.ts / UOAShadow.ts / workbench-director.ts（补充运行时证据）/ queue/mock-provider.ts / character.agent.ts
前端 8：MockRunnerPage.vue / stores/workbench.ts / pages/workbench/{index,console,dag,health,repair,trace}.vue / pages/director/{workbench,observatory}.vue

---

## Reality Gate

| Gate | 标准 | 结果 |
|------|------|------|
| D1 | Runtime 主链无变化 | ✅ script/submit 真人生成成功（breakdownMaster=true, 1 seg/2 chars/1 scene） |
| D2 | Production API 数量不减少 | ✅ ai-generate 200（任务入队）/ regenerate 200 / script-breakdown 路由命中（400 参数校验=正常）/ v2/workbench 401（认证拦截） |
| D3 | 无新增 mock | ✅ git 变更仅注释 + 归档；无 mock 代码 |
| D4 | Prompt DB 唯一读取 | ✅ 10/10 key 经 getPrompt 可读；txt 归档后不可再被读取 |
| D5 | Studio 页面 build PASS | ✅ `nuxt build` complete（WARN 均为存量：CommunityPostCard/useProjectStore 重复） |
| D6 | 真人生成测试 PASS | ✅ script/submit → 剧本拆解总导演 → narrativeGateway → deepseek 真实 LLM 成功 |

## 变更清单（Phase 5）

```
backend/（修改 5 + 归档 13）
  M  src/agents/orchestrator/UOA.ts
  M  src/agents/orchestrator/shadow/UOAShadow.ts
  M  src/routes/workbench-director.ts
  M  src/queue/mock-provider.ts
  M  src/agents/character.agent.ts
  R  src/prompts/agents/*.txt → src/prompts/archive/*.deprecated (9)
  R  src/prompts/aigc-spec-system.txt → archive
  A  src/prompts/archive/{aigc-prompt,aigc-spec-prompt,analyze-v2-prompt}.txt.deprecated

frontend/（修改 8）
  M  studio-v2/workspace/director-workbench/MockRunnerPage.vue
  M  stores/workbench.ts
  M  pages/workbench/{index,console,dag,health,repair,trace}.vue
  M  pages/director/{workbench,observatory}.vue
```

（注：工作区另有存量未提交变更——frontend enterprise 页面、queue-manager.ts Phase3 SSOT 等——非本次 Phase 5 产物）

## 测试数据清理
- 测试 Project 0000...000（历史残留）已删除；Demo Project（0000...001）保留
- 测试 Task 无残留（TaskQueue/TaskExecution 0 记录）

## 未完成/待决策
- ❌ 不进入 Phase 6（安全修复）
- workbench-director 未来启用 vs 移入 legacy → 待掌柜决策
- hdz direct LLM → 独立 Sprint 评估（见 HDZ-DIRECT-LLM-USAGE.md 方案 B/C）
- pages/workbench 依赖盘古斧 gateway 层（未注册）→ 待平台层激活或前端入口下线
