# KUNLUN-S3.3-SKILL-COMPOSITION-DESIGN-GATE.md

> S3.3 Skill Composition — Design Gate（只设计，不编码）
> 日期: 2026-08-06 05:40 (CST) | 状态: ⏳ 设计草案（待掌柜批准）
> 依据: KUNLUN-S3-SKILL-EXECUTION-FINAL-ARCHIVE.md（F1-F7 冻结）/ AI Employee Runtime Model / H-D
> 定位: **一个 AI Employee + 多个 Skill + 任务编排**如何成立（先冻结决策点，再实施）

---

## 0. 前提（S3 冻结基线，S3.3 不得破坏）

```
F1 能力 SSOT = AgentDefinition.capabilities（禁止 Skill.capabilities）
F2 Lifecycle 只读状态（禁止第二套治理）
F3 授权权威 = EcologyLicense（禁止 SkillLicense）
F4 唯一执行者 = Hermes（禁止 Route 直接执行）
F5 H-D 边界 + deniedTools 冻结
F6 executionReady = 授权通过 + 能力绑定 + 策略可生成
F7 工具策略唯一（H-D + allowedTools）
```

**S3.3 红线**: 不新建 Skill 新表 / 不复制能力定义 / 不绕过 Hermes 原子执行 / 不接真实 AI / 不动 Commerce。

---

## Q1: AI Employee 的 Skill Set 谁拥有？（设计）

```
推荐（复用现有，零新表）:

AI Employee（AgentDefinition）
      │ capabilities（JSON 数组 = Skill 引用列表）
      ▼
Skill Binding = capabilities 内每个能力名 ↔ SkillDefinition 映射（S3.1 已建立）
      │
      ▼
Skill Registry（Catalog 只读视图，S3.1）

原则: 拥有 = 引用，不复制。
```

- AI Employee 实例（Sub-Agent）**不复制 Skill**：运行时只接收 Hermes 下发的执行意图
- Skill Set 的增删 = AgentDefinition.capabilities 变更（新版本，Q4 版本规则沿用 S3.2 设计）
- 反例（禁止）: `Employee.Skills[]` 独立副本表 → Skill 孤岛（Alice/Bob 各持 A 副本）

### Q1 冻结建议

> AI Employee 拥有 Skill Set 的方式 = `AgentDefinition.capabilities` 引用（唯一 SSOT，零新表）。
> 一个 AI Employee 可以绑定多个 Skill；一个 Skill 可被多个 Employee 绑定（多对多，经 capabilities 表达）。

---

## Q2: 多个 Skill 谁调度？（设计）

```
现状: Hermes 每次执行 = 单 Skill 原子执行（Sub-Agent 状态机, S3.2.3）

推荐（三层架构一致）:

Cloud Control Plane
   │
   ▼
Skill Orchestrator（Planner, 云侧新增编排层）
   │ 生成 SkillPlan（步骤序列）
   ▼
Hermes（Runtime Plane, 唯一执行者）
   │ 逐 Skill 原子执行
   ▼
Sub-Agent → Tool → Result → Cloud Audit
```

- **Planner 位置冻结**: Cloud Control Plane（昆仑镜云），非 Hermes 本地、非 Desktop
  - 理由: Control-Runtime-Experience 三层；编排是 Control 职责，执行是 Runtime 职责
  - Hermes 保持"原子执行者"，不内嵌多 Skill 调度（避免 Runtime 膨胀）
- Planner 职责: 拆解任务 → 选 Skill（经 Authorization）→ 生成 SkillPlan → 提交 Hermes 逐段执行 → 汇总
- 每个 Skill 执行前仍走 F3 授权 + F6 executionReady（无绕过）

### Q2 冻结建议

> Planner = Cloud 侧 Skill Orchestrator（新编排层，仅意图生成）；Hermes 保持单 Skill 原子执行者。
> 实施形态（S3.3.1 候选）: `skill-orchestrator.ts`（生成 SkillPlan）+ 复用 execution routes 逐段提交。

---

## Q3: Skill 顺序谁决定？（设计）

```
推荐: 声明式 SkillPlan（DAG）

SkillPlan = {
  planId,
  skillSet: [skillId...],          // 来自 AgentDefinition.capabilities（Q1）
  steps: [{
    stepId, skillId, tool, input,
    dependsOn: [stepId...]         // 拓扑顺序
  }],
  fallback?: { onFailure: 'STOP' | 'SKIP' | 'CONTINUE' }
}
```

招聘示例:

```
ResumeParser → CandidateScoring → InterviewEvaluation
   (resume.parse)   (scoring)         (interview.eval)
   step1              step2            step3
   dependsOn: []      dependsOn: [s1]  dependsOn: [s2]
```

- 顺序由 DAG 拓扑决定（非 Agent 自由发挥）
- SkillPlan 为**执行意图**（运行时产物）：
  - 不落治理表（避免第二套体系）→ 审计入 KernelEvent（Cloud Audit 已权威）
  - 生成与校验 = Planner（Q2）；执行 = Hermes 逐 step 原子执行
- 单 Skill 内部（工具顺序）仍由 Hermes Tool Policy 决定（F7 不变）

### Q3 冻结建议

> Skill 顺序 = Planner 生成 SkillPlan（DAG, dependsOn 拓扑）；Hermes 逐 step 原子执行；
> SkillPlan 不入库，审计入 KernelEvent。禁止 Agent 自由串联多 Skill（必须先经 Planner）。

---

## Q4: 失败恢复谁记录？（设计）

```
Step 状态机（Planner 侧记录）:
  PENDING → RUNNING → COMPLETED | FAILED | SKIPPED

Plan 总体状态:
  COMPLETED（全 step 完成）
  PARTIAL_COMPLETED（部分完成 + 部分失败/跳过）
  FAILED（前置失败且 fallback=STOP）

记录:
  执行结果 → KernelEvent（Cloud Audit, 唯一权威, F5）
  组合状态 → Planner 侧聚合视图（只读计算，不建表）
```

- 失败恢复策略由 SkillPlan.fallback 声明（STOP/SKIP/CONTINUE）
- 每个 step 的审计仍由 Hermes 逐次上报（复用 S2.3.2 audit route）
- 不新建 Execution/Plan 表（KernelEvent payload 承载 planId/stepId）

### Q4 冻结建议

> 组合状态（PARTIAL_COMPLETED 等）= Planner 计算视图，审计权威 = KernelEvent；
> 失败恢复策略在 SkillPlan.fallback 声明，Hermes 原子执行不受组合状态影响。

---

## 实施路线（批准后）

```
S3.3.1 Skill Orchestrator（Planner）: skill-orchestrator.ts + SkillPlan 生成
        Reality Gate: OC1 多 Skill 绑定视图 / OC2 授权逐段生效 / OC3 Hermes 原子性保持
S3.3.2 SkillPlan Execution: 编排 → 逐段 Hermes → 聚合结果 + PARTIAL_COMPLETED
        Reality Gate: PE1 DAG 顺序 / PE2 失败恢复 / PE3 审计完整 / PE4 零新表
每步独立 Reality Gate，先文档后编码
```

---

## Reality Gate 建议（S3.3 总）

| # | 关卡 | 判定标准 |
|---|---|---|
| SC1 | 能力 SSOT 保持 | 无 Skill.capabilities 第二份定义（F1） |
| SC2 | 授权逐段生效 | 每个 Skill 执行前均过 F3（无批量绕过） |
| SC3 | Hermes 原子性 | Hermes 只执行单 Skill 意图，无多 Skill 调度逻辑（F4） |
| SC4 | 失败可见 | PARTIAL_COMPLETED 可表达且入审计 |
| SC5 | 零新表 | migration = 0（SkillPlan 不入库） |
| SC6 | 回归 | S3.2.3 单 Skill 执行链路不变（SE1-SE7 复跑） |

---

## 禁止范围（设计阶段）

- ✅ 未编码 / 未建表 / 未改 Hermes 原子执行 / 未接真实 AI / 未动 Commerce / 未改 F1-F7
- ❌ 不创建 SkillComposition / SkillPlan 表（意图不入库）
- ❌ 不创建 Skill.capabilities

## 冻结声明

```
✅ 本设计为 S3.3 候选（只提交 docs）
⏳ 待掌柜批准 → S3.3.1 Implementation（Planner）
🔒 任何与 F1-F7 冲突的方案需掌柜裁决
```

## 铁律

> Skill 组合 = 编排意图（Cloud Planner 生成，Hermes 原子执行，Audit 权威记录）。
> 不复制能力、不绕过授权、不膨胀 Runtime、不新建治理表。
