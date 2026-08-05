# KUNLUN-S3.3.2-SKILL-COMPOSITION-REALITY.md

> S3.3.2 Skill Composition Enhancement — Reality Gate
> 日期: 2026-08-06 06:45 (CST) | 状态: ✅ **SC7-SC11 全 PASS**
> 提交: feat(skill): enhance skill composition runtime
> 依据: S3.3.2 掌柜执行指令 Task 01-05 / 《昆仑镜工程开发宪法》
> 定位: **把 Alice 从 Demo 编排升级为生产级编排**（可靠性 + 并行 + 完整 Audit，不接真实 AI）

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/skill-orchestrator.ts | Task 02-04: timeout/retry/deadline/错误分类 + level 并行 + 依赖失败 + 审计增强 |
| backend/src/routes/skill-orchestrator.routes.ts | 透传 timeoutMs/deadlineMs/retry/maxParallel |
| tools/hermes-runtime-skill.mjs | +mock.flaky / mock.slow（Test Harness 工具，生命周期零改动） |
| backend/scripts/s332-test.mts | Task 05 Reality Test（SC7-SC11） |
| docs/.reality/S3.3.2-PRE-AUDIT.md | Task 01 现状审计 |
| docs/.reality/KUNLUN-S3.3.2-SKILL-COMPOSITION-REALITY.md | 本报告 |

**未修改（红线）**: prisma/schema.prisma / migrations / Commerce / Identity / 真实 AI / Hermes 生命周期（Sub-Agent 状态机）✅

---

## 1. Task 01 — 现状审计（S3.3.2-PRE-AUDIT.md）

三项宪法点确认：
- Planner 仍在 Cloud（hermes 零 orchestrator 引用）✅
- Hermes 无编排逻辑（零 dependsOn/topoSort/fallback 关键字）✅
- SkillPlan 不入库（orchestrator 仅 1 处 prisma 只读 findUnique）✅

## 2. Task 02 — Execution Reliability

```
timeout:   per-step timeoutMs（默认 10s, 可 per-step 覆盖）→ AbortError 精确分类 TIMEOUT
retry:     maxAttempts + backoffMs（线性退避 attempt×backoff）; 仅 transient 错误重试
deadline:  plan 级 deadlineMs（默认 60s）→ 超时 FAILED + failureReason=DEADLINE_EXCEEDED
错误分类:  SKILL_NOT_FOUND / AUTHORIZATION_DENIED / POLICY_REJECTED（deterministic, 不重试）
           TIMEOUT / HERMES_UNREACHABLE / HERMES_ERROR / UNKNOWN（transient, 可重试）
```

## 3. Task 03 — DAG Enhancement

```
level 并行: buildLevels 按拓扑序分层 → 同层独立 step 并发（maxParallel 限流, 默认 8）
依赖失败:   依赖 FAILED/SKIPPED → 依赖者 SKIPPED + errorType=DEPENDENCY_FAILED
失败策略:   STOP（层内失败→终止, 其余 SKIPPED/PLAN_ABORTED）
           SKIP / CONTINUE（继续, 依赖失败级联 SKIPPED）
禁止:       Agent 自由规划（顺序仍由 Planner 生成的 DAG 决定）
```

## 4. Task 04 — Audit Enhancement

KernelEvent 复用（零新表）: plan 级事件 payload 新增
```
steps 明细: { stepId, skillId, tool, status, errorType, failureReason, attempts, durationMs, executionId }
result:    { skillSet, fallback, timeoutMs, deadlineMs, retry, maxParallel, planDurationMs, failureReason }
```

## 5. Reality Test SC7-SC11（实测 22 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| SC7 | retry 生效 | ✅ | mock.flaky 首次 transient 失败 → 重试成功；attempts=2；plan COMPLETED |
| SC8 | timeout 生效 | ✅ | mock.slow 5s > timeoutMs 800ms → FAILED + errorType=TIMEOUT + attempts=1 |
| SC8b | deadline 生效 | ✅ | 2×2s 并行 + deadline 3s → FAILED + DEADLINE_EXCEEDED |
| SC9 | parallel step | ✅ | 2×1.2s 独立 step 并发：耗时 < 2300ms（串行需 2400ms）；buildLevels=[[a,b],[c]] |
| SC10 | dependency failure | ✅ | s1 POLICY_REJECTED → s2 SKIPPED(DEPENDENCY_FAILED) → PARTIAL_COMPLETED |
| SC11 | S3.2.3 regression | ✅ | 单 Skill COMPLETED；payment 越权仍 POLICY_REJECTED |

### API 实测

```
并行编排（2 并行 + 1 依赖汇总）→ COMPLETED 全 step
retry 编排（mock.flaky, runId 隔离）→ COMPLETED, attempts=2
```

## 6. 边界确认

- ✅ Step/Plan 状态机未变（PENDING/RUNNING/COMPLETED/FAILED/SKIPPED; CREATED→…→COMPLETED）
- ✅ Hermes 生命周期零修改（仅工具注册表 +2 测试工具, mock.flaky/mock.slow 无真实业务）
- ✅ 审计零新表（KernelEvent payload 承载, Cloud Authority 不变）
- ✅ 不接真实 AI / 不改 Commerce / Identity / SSOT

## 7. 完成定义

```
Skill Composition ✅ + 生产级失败恢复 ✅ + 完整 Audit ✅ — 不进入真实 AI ✅
```

## 8. 未完成事项（后续阶段）

- [ ] S3.4 Real AI Employee Runtime（真实模型接入, 掌柜指示后续）
- [ ] 重试策略进阶（指数退避/抖动/最大耗时）——当前线性退避已满足
- [ ] 并发 step 的局部重调度（当前依赖失败即 SKIPPED, 无备选分支）

## 9. 结论

```
S3.3.2 Skill Composition Enhancement: ✅ AI 员工「能跑」→「能稳定生产运行」
Alice 编排具备超时/重试/截止/并行/依赖感知/全量审计 —— 但执行权仍在 Hermes, 编排权仍在 Cloud。
```
