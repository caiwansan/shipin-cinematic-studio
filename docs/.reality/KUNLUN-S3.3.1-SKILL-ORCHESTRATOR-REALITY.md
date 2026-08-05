# KUNLUN-S3.3.1-SKILL-ORCHESTRATOR-REALITY.md

> S3.3.1 Skill Orchestrator（Cloud Planner）— Reality Gate
> 日期: 2026-08-06 06:00 (CST) | 状态: ✅ **OC1-OC3 + SC1-SC6 全 PASS**
> 提交: feat(skill): skill orchestrator (S3.3.1)
> 依据: KUNLUN-S3.3-SKILL-COMPOSITION-DESIGN-GATE.md（掌柜 APPROVED）+ S3 Final Archive F1-F7
> 定位: **一个 AI Employee + 多个 Skill + DAG 编排**成立（Planner=Cloud / SkillPlan=运行时 DAG / Hermes=原子执行者）

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/skill-orchestrator.ts | Cloud Planner（SkillPlan 生成/校验/拓扑/逐段执行/聚合/审计） |
| backend/src/routes/skill-orchestrator.routes.ts | GET /employees/:code/skills + POST /plans/execute |
| backend/src/index.ts | 注册（skill-execution 之后，1 行） |
| tools/hermes-runtime-skill.mjs | +candidate.score/interview.evaluate 工具；**T1 更名 Reference Implementation** |
| backend/scripts/s331-seed.mts | 种子（def-candidate-scorer / def-interview-evaluator / def-recruiter-alice, 幂等） |
| backend/scripts/s331-test.mts | Reality Gate（OC1-OC3 + SC1-SC6） |
| docs/.reality/KUNLUN-S3.3.1-SKILL-ORCHESTRATOR-REALITY.md | 本报告 |

**未修改（禁止范围）**: prisma/schema.prisma / migrations / Commerce / Registry / Hermes 原子执行语义 ✅

---

## 1. S3.3 宪法落实（5 条）

```
Planner = Cloud        → skill-orchestrator.ts 位于 backend/src/ecosystem（云服务层），
                          hermes runtime 零 orchestrator 引用（OC-0.1 ✅）
SkillPlan = Runtime DAG → 纯内存对象，零 prisma 调用，零入库（OC-0.2 ✅）
Hermes = Atomic Executor→ 每 step 独立 /invocations 调用，Sub-Agent 状态机不变（OC3 ✅）
Skill = Authorized Capability → 每 step 执行前 prepareSkillExecution 独立授权（OC2/OC-0.3 ✅）
KernelEvent = Audit Authority → planId/steps/status 入审计，不建表（Q3 ✅）
```

## 2. 状态机（Q4 掌柜冻结）

```
CREATED → PLANNING → RUNNING → COMPLETED
                              ↘ PARTIAL_COMPLETED（部分失败, fallback SKIP/CONTINUE）
                              ↘ FAILED（fallback STOP）
Step: PENDING → RUNNING → COMPLETED | FAILED | SKIPPED
```

## 3. Reality Gate 结果（实测 19 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| OC1 | 多 Skill 绑定视图 | ✅ | Alice → 3 Skills（def-resume-parser/candidate-scorer/interview-evaluator），能力来自 AgentDefinition.capabilities（F1） |
| OC2 | 授权逐段生效 | ✅ | 3 个 Skill 各自 prepareSkillExecution → 全 AUTHORIZED（无批量绕过） |
| OC3 | Hermes 原子性保持 | ✅ | 3 次独立原子调用全 COMPLETED + result；runtime 无编排逻辑 |
| SC1 | 能力 SSOT 保持 | ✅ | 无 Skill.capabilities 第二份定义；未绑定 Skill → SKILL_NOT_BOUND 拒绝 |
| SC2 | 授权逐段生效 | ✅ | 同 OC2（每 step 独立授权） |
| SC3 | Hermes 原子性 | ✅ | 同 OC3 |
| SC4 | 失败可见 | ✅ | fallback=SKIP → PARTIAL_COMPLETED（step2 POLICY_REJECTED, step3 继续）；STOP → FAILED + 后续 SKIPPED |
| SC5 | 零新表 | ✅ | orchestrator 无 prisma 调用；prisma/ 零改动 |
| SC6 | S3.2.3 回归 | ✅ | 单 Skill 编排仍 COMPLETED；SE1-SE7 链路不受影响 |

### 附加验证

- DAG 拓扑: ResumeParser → CandidateScoring → InterviewEvaluation 顺序正确（Q3 招聘示例）
- DAG 环 → 拒绝（topoSort null）
- 审计: planId 落 KernelEvent（含 steps/status），SkillPlan 本体不入库

### API 实测

```
GET  /api/skills/employees/def-recruiter-alice/skills → 3 skills（OC1 API OK）
POST /api/skills/plans/execute（3-step DAG）→ COMPLETED, 全 step COMPLETED
POST（越权 step + fallback SKIP）→ PARTIAL_COMPLETED, step2 FAILED(POLICY_REJECTED)
```

## 4. 边界确认

- ✅ 编排只生成意图 + 逐段提交 Hermes；无 Route 直接执行 AI（F4）
- ✅ 每 Skill 独立授权，员工授权 ≠ 全部 Skill 自动通过（OC-0.3）
- ✅ SkillPlan 请求内即弃（Intent → Planner → 生成 → 执行 → 审计 → Discard, Q3）
- ✅ Hermes 工具新增仅 mock（candidate.score/interview.evaluate），无真实业务
- ❌ 未接真实 AI / 未做多轮对话 / 未动 Commerce / 未建表

## 5. 完成定义核对

```
S3.3.1 Skill Orchestrator ✅
  Planner = Cloud ✅ / SkillPlan = Runtime DAG ✅ / Hermes = Atomic Executor ✅
  Skill = Authorized Capability ✅ / KernelEvent = Audit Authority ✅
```

## 6. 未完成事项（后续阶段）

- [ ] S3.3.2 组合执行增强（重试/超时/并发 step/条件分支——当前顺序 DAG + 3 种 fallback）
- [ ] S3.4 真实 AI 模型接入（当前 mock 工具 + mock 结果）
- [ ] S4 Developer Skill 生态（Entitlement 建表 + 开发者提交）
- [ ] 商业 Skill 组合真实链路（插件 capabilities 填充 → License → 编排）

## 7. 结论

```
S3.3.1 Skill Orchestrator: ✅ 一个 AI Employee 可绑定多个 Skill 并按 DAG 编排执行
Alice 不再需要复制技能包——capabilities 引用 3 个共享 Skill 定义，逐段授权、逐段执行、全程审计。
```
