# KUNLUN-S3.4.2-PLANNER-INTELLIGENCE-DESIGN-GATE.md

> S3.4.2 Planner Intelligence — Design Gate（只设计，不编码）
> 日期: 2026-08-06 07:50 (CST) | 状态: ⏳ 设计草案（待掌柜批准）
> 依据: 掌柜 S3.4.2 指令（A/B/C 三小阶段）/ S3.4 Design Gate（D1 三角色冻结）/ S3.4.1.5（Provider Reality 封板）/ F1-F7 / 宪法 C1-C6
> 冻结红线:
> ```
> Planner ≠ Executor（LLM 只生成计划草稿）
> LLM ≠ Authority（校验/授权/执行全在治理链）
> Hermes = 唯一执行者
> ```

---

## 0. 前置现状（Reality 基线, 全部已验证）

```
✅ resume.parse 真实执行（ResumeParserAgent 确定性, S3.4.1）
✅ Asset Delivery（json+pdf → Asset/UserAsset, S3.4.1）
✅ Provider Gateway（deepseek 真实调用 + InvocationLog, S3.4.1.5 封板）
✅ skill-orchestrator（SkillPlan DAG/授权/执行/审计, S3.3.1/3.3.2）
✅ authorizeSkill（逐 Skill 授权, S3.2.2）
缺失: Planner LLM（意图→草稿）/ candidate.score LLM 化 / interview.evaluate LLM 化
```

---

## 1. Planner LLM Boundary Audit

### 现状边界（已冻结的链）

```
User Intent
  → [S3.4.2 新增] Planner LLM（invokeAI, deepseek）→ 计划草稿 DRAFT
  → [已存在] Planner Validator（新增纯函数）→ 校验（F1/F7/DAG）
  → [已存在] executeSkillPlan（每步 authorizeSkill → Hermes 原子执行）
  → [已存在] KernelEvent 审计
```

### Planner LLM 有权/无权清单

| 有权 | 无权 |
|---|---|
| 理解用户意图 → 输出 goal | 直接调用工具 |
| 从**给定** Skill 目录中选择 skill | 修改 Skill 定义 / capabilities |
| 建议 tool（须在 skill allowedTools 内）| 绕过 Capability 绑定（F1） |
| 输出 dependsOn 依赖建议 | 决定权限 / 授权（F3 归 License） |
| — | 决定执行顺序的最终裁决（DAG 校验器裁决）|

### 边界审计结论

- LLM 输出 = **草稿**（DRAFT），非可执行计划；一切治理（绑定/授权/策略）仍由既有代码执行
- 现有 `validatePlan` + `composeExecutionIntent`（F7）已构成校验底座，LLM 输出只新增一层**前置规范化**（planner-validator）
- 不新增调用路径：Planner LLM 走 Unified AI Gateway（S3.4.1.5 已验证）；Skill LLM Tool 走内部网关路由（见 §7）

## 2. SkillPlan Schema（内存对象, 零入库）

```ts
// LLM 草稿契约（planner-validator 输入）
interface PlannerDraft {
  goal: string                    // 任务目标（用户语义）
  skills: PlannerDraftStep[]      // 非空
}
interface PlannerDraftStep {
  skillId: string                 // 必须 ∈ 员工能力集（F1）
  tool?: string | null            // 必须 ∈ 该 skill allowedTools（F7）; null=默认首个
  inputHint?: any                 // 建议入参（透传, 不执行）
  dependsOn?: string[]            // 建议依赖（须引用有效 stepId, DAG 校验）
}

// 校验通过后 → 既有 SkillPlan（skill-orchestrator.ts 已冻结, 不新增字段）
// SkillPlan = 纯内存运行时 DAG（OC-0.2 保持）; 不入库, 审计入 KernelEvent
```

## 3. Planner Prompt Contract

```
SYSTEM:
你是昆仑镜 AI 员工编排器（Planner）。你只负责把用户任务翻译为 Skill 计划草稿。
规则:
1. 只能从「可用 Skill 目录」中选择 skillId, 禁止发明/修改任何 Skill
2. 只能为每个 skill 建议其能力范围内的 tool（见目录中的 tools 字段）
3. 输出必须是合法 JSON: {"goal": string, "skills": [{skillId, tool?, inputHint?, dependsOn?}]}
4. 不执行任何操作, 不调用任何工具, 不讨论权限
5. 若任务无法由可用 Skill 完成 → 输出 {"goal": "...", "skills": []}

USER CONTEXT（运行时填充）:
- 员工: {code, name}
- 可用 Skill 目录: [{id, capabilities, tools, description}]
- 用户意图: {intent}
- 可选上下文: {parsedProfileSummary}（resume.parse 后回填）

参数: temperature=0.2; 输出长度上限 800 tokens; 若 provider 支持 json 模式则开启
```

## 4. LLM 输出校验器设计（planner-validator, 纯函数）

```
validatePlannerDraft(raw, employeeSkillSet, catalogSkills)
  → { ok, errors[], normalizedSteps[] }

步骤:
1. 提取 JSON（容错: 剥离 markdown 围栏/取首个 {...} 块）; 解析失败 → 重试 1 次（重新调用 LLM）→ 仍失败 → PL4 优雅报错
2. Schema: goal 非空字符串; skills 非空数组; 每 step 有 skillId/tool 字符串
3. F1 绑定: skillId ∈ employeeSkillSet（员工能力集）→ 否则 SKILL_NOT_BOUND
4. 目录存在性: skillId ∈ catalogSkills → 否则 SKILL_NOT_FOUND
5. F7 工具: tool ∈ 该 skill allowedTools（capabilities 推导）→ 否则 TOOL_NOT_ALLOWED（可降级为默认工具? 不——直接拒绝, 防越权）
6. 依赖: dependsOn 引用有效 stepId; 自环拒绝
7. DAG: topoSortSteps（环 → 拒绝）
8. 归一化: 补全 stepId（skillId:tool）/ 默认 tool / 空 dependsOn → 喂给既有 validatePlan + executeSkillPlan

任何校验失败 → 不执行（返回错误, 附校验详情）; 绝不带病执行
```

## 5. Reality Gate（RA1-RA5 + PL1-PL4）

| # | 关卡 | 判定标准 |
|---|---|---|
| RA1 | Intent Understanding | 「帮我分析这个候选人的简历」→ goal=candidate_analysis + skills=[resume.parse, candidate.score] |
| RA2 | Skill Planning | DAG 正确（resume.parse→candidate.score→interview.evaluate）且全绑定 Alice（F1） |
| RA3 | Real Tool Execution | resume.parse 真实解析; candidate.score 经 Gateway→DeepSeek 真实评分 |
| RA4 | Asset Delivery | candidate-analysis.json + candidate-report.pdf → Asset/UserAsset 可访问 |
| RA5 | Audit | KernelEvent: intent/plan/skill/execution/tool/result 全链 |
| PL1 | 草稿必须过校验 | 非法 skillId → 拒绝执行（SKILL_NOT_BOUND/NOT_FOUND） |
| PL2 | 工具不越权 | LLM 建议 allowedTools 外工具 → TOOL_NOT_ALLOWED 拒绝（F7） |
| PL3 | Planner 不执行 | planner 模块零工具调用（grep 断言: 无 invoke/fetch 工具执行） |
| PL4 | 失败路径 | LLM 超时/JSON 非法 → 优雅错误（无执行、无部分执行） |
| RG | 回归 | S3.3.2 SC7-SC11 + S3.4.1.5 PR1-PR5 + S3.2.3 SE 复跑 |

## 6. Alice 招聘闭环执行图（S3.4.2-A/B/C 映射）

```
用户: 上传 PDF 简历 + 一句话意图
  ↓
[资产] 简历落 Asset（既有 upload 管道）
  ↓
POST /api/skills/plans/from-intent { intent, employeeDefinitionId, resumeAssetId }   ← S3.4.2-A 新增
  ↓
Planner LLM（invokeAI, deepseek, dev provider）→ PlannerDraft
  ↓
planner-validator（F1/F7/DAG）→ SkillPlan（既有结构）
  ↓
executeSkillPlan（逐 step: authorizeSkill → Hermes 原子执行）  ← S3.4.2-A（沿用既有执行器）
  ├─ step1 resume.parse        ← 已真实（S3.4.1）
  ├─ step2 candidate.score     ← S3.4.2-B 真实化（LLM 评分）
  └─ step3 interview.evaluate  ← S3.4.2-C 真实化（LLM 评估）
  ↓
deliverSkillAssets → candidate-analysis.json + candidate-report.pdf   ← 已真实（S3.4.1）
  ↓
KernelEvent 全审计（intent/plan/steps/result）                        ← 已真实
  ↓
Killer Demo: 招聘员工 Alice 完成「上传→解析→评分→评估→报告」
```

### 小阶段划分（掌柜 A/B/C 冻结）

```
S3.4.2-A: planFromIntent（LLM+校验器+既有执行器）     Gate: PL1-PL4 + RA1/RA2 + RG
S3.4.2-B: candidate.score 真实化（Hermes 工具→内部网关→DeepSeek→score JSON→assets）  Gate: RA3
S3.4.2-C: interview.evaluate 真实化 + 全链冒烟        Gate: RA4/RA5 + Killer Demo
```

## 7. Skill LLM Tool 内部路由（S3.4.2-B/C 设计, 本阶段不实现）

```
Hermes 工具（candidate.score/interview.evaluate）
  → POST /api/internal/ai/gateway（新增, x-internal-token 门禁, 同 skill-tools-internal 模式）
  → invokeAI（同 gateway: 限速/并发/InvocationLog）
  → deepseek → 结构化输出（JSON mode）→ 工具返回
约束: dev 模式下用 dev provider（合成 dev 身份）; S4 起改为解析调用方 BYOK
禁止: Hermes 直连 provider SDK（PR2 保持）
```

## 8. 禁止范围

- ❌ 不编码（本门）; 不建表 / 不改 Skill SSOT / 不改 Hermes 生命周期 / 不绕过 Gateway
- ❌ LLM 不获得工具调用权 / 权限决策权 / Skill 修改权
- ❌ 不做通用 Agent / 自由对话 / 多行业员工

## 9. 完成定义（S3.4.2 全阶段）

```
✅ 用户一句话 → Planner LLM → 校验 → SkillPlan → Hermes 真实执行 → 真实 LLM 评分/评估 → 可交付报告 → 全审计
✅ Alice 招聘闭环 = 第一个 Killer Demo（员工完成岗位任务, 非聊天回复）
⏳ 商业化（License→采购）与 Marketplace 属 S4
```

## 10. 冻结声明

```
✅ 本设计为 S3.4.2 候选（只提交 docs）
⏳ 待掌柜批准 → S3.4.2-A Implementation（Planner 最小闭环）
🔒 与 F1-F7 / D1 / 宪法冲突的方案需掌柜裁决
```

## 铁律

> LLM 是受控智能: 生成草稿, 不触碰治理链。Planner ≠ Executor, LLM ≠ Authority, Hermes = 唯一执行者。
