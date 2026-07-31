# Sprint-HDZNOVEL-REALITY-02-B — 生产飞轮：主动防错生成 — COMPLETE ✅

- **日期**：2026-07-31
- **Gate**：4 Task 全完成 + Reality Gate G1-G5 全通过（掌柜验收 02-A 后指令启动）
- **目标**：从"安全生成"升级为"主动防错生成"——连续写 100 万字仍保持人物、世界、剧情一致

---

## Task 1 — 章节生成前 Context Gate（P0）✅

**原则**：错误产生前拦截，而不是生成后修复。确定性规则，无 LLM 成本。

### verifyBeforeGeneration（加入现有 ConsistencyVerifier 类，不新建文件）

| Gate | 检查 | 失败后果 |
|------|------|----------|
| G1 章节合法性 | 章节号 ≥1、不重复生成（已有正文且非 rewrite 禁止覆盖） | FAIL（拦截） |
| G2 前置审批门 | 前置章未审核 → warn；前置章审核有 critical/major 问题 → FAIL（**已知错误不传播**） | FAIL（拦截） |
| G3 上下文完整性 | StoryContext 可构建且有最小数据（无角色 → FAIL，先规划再写） | FAIL（拦截） |
| G4 时间线单调 | 不跳章（目标 ≤ 最大章节+1） | warn |

输出：gates[] + score（100 - fail×25 - warn×5）+ eventLog（PRE_GENERATION_GATE）

### orchestrator 接入

```
case 'writer':
  └─ mode ≠ rewrite → verifyBeforeGeneration
       ├─ FAIL → 任务标记 blocked + output 存 Gate 原因（不执行 Writer）
       └─ PASS → 放行生成
```

**生产环境真实证据**：部署后任务状态分布出现 `blocked: 1`——Gate 已在真实项目中拦截了第一个不合格任务 ✅

### 验证 8/8 ✅

非法章节号拦截 / 第一章放行 / 前置章 critical → 拦截 / 重复生成拦截 / rewrite 放行覆盖 / 跳章 warn 不阻断 / orchestrator 接入 / 无角色上下文拦截

---

## Task 2 — Rollback 影响自动治理（P0）✅

### 问题发现（比计划多修一个 bug）

计划：rollback 后标记受影响章节。**实测发现** `plan-diff.service.ts` 的 diff 不检测卷 title 变化（只有 chapterRange/theme/mainConflict）→ 卷标题修改不产生 affectedRanges → 影响分析漏报。

### 修复

1. `plan-diff.service.ts`：卷标题变化也触发 volumesChanged → affectedRanges
2. `master-plan.ts` rollback 端点：回滚成功后解析 affectedChapterRanges → 区间内已生成章节 `status='needs_rewrite'`（`全部章节` → 全部标记）
3. `schemas/hdz.ts`：HdzChapterStatus 枚举加 `needs_rewrite`

### 验证 ✅

HTTP 真实回滚：V2→V1 → 卷1 区间 1-50 内章节 1/2/3 全标 needs_rewrite，**范围外（ch51）不误伤**，版本 V3 可再回滚，总纲内容还原（5/5 HTTP + 4/4 静态）

---

## Task 3 — 小说生产任务队列化（P1）✅

**复用不重造**：bullmq（短剧 ai-runtime 同款）+ hdzAgentTask 表（已是 DB 队列）+ orchestrator.executeTask（唯一执行入口）。

### 架构

```
HTTP 触发（同步异步路径，保留）──┐
                                ├─→ hdzAgentTask(queued) ─→ orchestrator.executeTask
DB Sweeper（常驻，10s 兜底）────┘         ▲                          │
   扫 queued → enqueue ──→ hdz-production Queue ──→ Worker(并发2) ──┘
```

- **幂等**：jobId=taskId（重复入队覆盖）；Worker 原子 claim（queued→running，claim 失败跳过）
- **重启恢复**：服务重启后遗留 queued 任务自动被 Sweeper 捞起执行
- **批量入队**：`POST /api/hdz/agent/batch-write { from, to }`（≤200 章）——一次入队 100 章，后台逐个消费，不 HTTP 等待

### 验证 7/7 ✅

入队幂等 / Worker 单例 / Sweeper 启动 / 原子 claim / 重启遗留恢复 / 批量端点 / 服务启动集成

**生产证据**：Worker 已消费遗留任务（432 failed 为无 LLM 配置用户的旧任务，正常失败）

---

## Task 4 — LLM Usage Ledger 统一记账（P1）✅

**复用不重造**：UsageLog 表已存在（userId/projectId/taskId/taskType/provider/tokens/cost/isPlatform）——缺的是 callLLM 没写明细。

### 落地

| 层 | 改动 |
|----|------|
| LLMConfig | +userId/taskType/projectId/taskId 业务元数据 |
| callLLM | 成功路径统一写 UsageLog（provider/tokens/cost/agentType/isPlatform=false） |
| 成本估算 | `estimateLlmCost`：按 provider 单价 × tokens（台账展示，非计费依据） |
| orchestrator | executeTask 时附加 `hdz_${agentType}` + projectId + taskId（writer/reviewer/planner/character/director 全覆盖） |
| reviewer | execute 接收传入 cfg（原本自己重新 get 丢元数据） |
| event-extractor | 独立链路附加 `hdz_event_extractor` 元数据 |
| getUserLLMConfig | 支持 meta 参数（master-plan/screenwriter 等独立调用链自动带元数据） |

### 验证 9/9 ✅

callLLM 写明细 / 成本估算 / 元数据字段 / meta 参数 / orchestrator 附加 / reviewer 传参 / event-extractor / 表读写 / 按 taskType 聚合

---

## Reality Gate

| Gate | 结果 | 证据 |
|------|------|------|
| G1 生成前拦截 | ✅ | Context Gate 4 检查项 + 生产环境真实 blocked:1 |
| G2 版本闭环 | ✅ | rollback → needs_rewrite → 重新生产队列（HTTP 实测 5/5） |
| G3 后台生产 | ✅ | 队列消费不依赖 HTTP；重启恢复；批量入队 100 章 |
| G4 成本可见 | ✅ | 所有 LLM 调用统一记账（9 个 hdz 服务 + 独立链路） |
| G5 复用不重造 | ✅ | bullmq / UsageLog / hdzAgentTask / consistency-verifier 全复用 |

---

## 改动文件（12 个）

| 文件 | 改动 |
|------|------|
| `consistency-verifier.service.ts` | +verifyBeforeGeneration（4 Gate） |
| `orchestrator.service.ts` | writer 分支接入 Gate（blocked）+ Usage Ledger 元数据附加 |
| `plan-diff.service.ts` | 卷 title 变化 → 影响区间（修漏报） |
| `master-plan.ts` | rollback → 受影响章节标 needs_rewrite + 响应 needsRewrite 计数 |
| `schemas/hdz.ts` | HdzChapterStatus + needs_rewrite |
| `production-queue.service.ts` | 新增：hdz-production 队列 + Worker + Sweeper |
| `index.ts` | listen 前启动生产队列 |
| `agent.ts` | +batch-write 批量入队端点 |
| `llm.client.ts` | LLMConfig 元数据 + callLLM 写 UsageLog + estimateLlmCost + getUserLLMConfig meta |
| `reviewer.service.ts` | execute 接收传入 cfg（丢元数据修复） |
| `event-extractor.service.ts` | 独立链路附加元数据 |

**验证脚本**：`scripts/verify-reality-02b-task{1,2,3,4}.ts`（+ task2-http.ts）

---

## 与 02-A 的闭环关系

```
02-A：质量飞轮真实运行（审批真实/版本可回溯/人物有心/剧情有验）
  ↓
02-B：生产飞轮主动防错（生成前拦截/回滚自动治理/后台批量生产/成本全可见）
  ↓
目标：像真正小说作者团队一样，连续写 100 万字仍保持一致
```

*四次跃迁已完成：AI 写作工具 → 小说智能内核 → 质量可控生产系统 → 主动防错生产系统。*
