# KUNLUN-S3.4-REAL-AI-EMPLOYEE-DESIGN-GATE.md

> S3.4 Real AI Employee — Design Gate（只设计，不编码）
> 日期: 2026-08-06 07:00 (CST) | 状态: ⏳ 设计草案（待掌柜批准）
> 依据: 掌柜 S3.4 战略指令（Q1-Q4 已冻结）/ 《昆仑镜工程开发宪法》C1-C6 / S3 Final Archive F1-F7
> 定位: **第一个真实 AI Employee 工作闭环证明——Alice Recruitment Employee Reality**

---

## 0. 产品分水岭定位

```
S1-S3 = AI Employee OS Kernel（技能/治理/授权/执行/组合/可靠性 全 ✅）
S3.4  = 第一个 Killer Application:
        企业上传简历 → Alice 完成招聘初筛 → 输出可交付候选人评估报告
市场不为 Runtime 买单，为「员工完成工作」买单。
```

**一句话验收（掌柜冻结）**: 企业上传一个候选人简历，Alice 完成招聘初筛，并输出可交付候选人评估报告。

## 1. 前置侦察结论（只读，2026-08-06 07:00）

| 基础设施 | 现状 | S3.4 利用方式 |
|---|---|---|
| **Unified AI Gateway**（`unified-ai-gateway.ts`） | ✅ 存在；"所有 AI 调用必须走此入口，不可直接调 provider"；流程含 信封校验→模型解析→Key 解密→provider 适配→超时重试→InvocationLog 审计 | **LLM 唯一入口**（Planner 与 Skill 工具共用） |
| **BYOK**（`user-model-resolver-v2`） | schema 存在（llmProvider/llmApiKey/llmModel/llmEnabled），**表未建** | S3.4 走平台 env Key（OPENAI_API_KEY 等已配）；BYOK 建表 = S4 决策 |
| **平台 LLM Key** | .env 含 OPENAI_API_KEY / DEEPSEEK_BASE_URL+MODEL / VOLCENGINE / ALIYUN / BAILIAN | S3.4 用平台默认 Key + 一个稳定模型（不追 benchmark） |
| **真实简历解析** | ✅ `src/agents/job/resume-parser-agent.ts` + `resume.routes.ts` 已存在 | **resume.parse 直接复用**（真实 PDF → 结构化简历） |
| **资产模型** | ✅ `Asset`（projectId/type/fileName/filePath/mimeType/fileSize）+ `UserAsset` + upload routes | candidate-report.pdf + candidate-analysis.json 落 Asset（零新表） |
| **编排/执行/审计** | ✅ S3.3.x 全链路（SkillPlan DAG + Hermes 原子 + KernelEvent） | 不变，作为执行底座 |

**核心结论**: S3.4 **不需要任何新表**——AI 网关、简历解析、资产存储全部已存在，只做接线与真实化。

## 2. 掌柜冻结决策（Q1-Q4）

### Q1 冻结: LLM = Planner Intelligence（Cloud），Hermes = Execution Engine

```
Cloud（Control Plane）:  理解任务 / 生成 SkillPlan / 决策流程 ← LLM 推理
Hermes（Runtime）:       执行 Skill / 调工具 / 返回结果 ← 无自主规划
```

**D1 待掌柜补冻（关键语义澄清）**: 真实 Skill（candidate.score / interview.evaluate）内部需要 LLM 计算时，推荐形态——

```
方案 B（推荐）: LLM 作为 Hermes 沙箱内受控工具 llm.invoke
  - 推理发生在「已批准工具的执行」内，非 Hermes 自主规划
  - 所有 AI 调用仍统一走 Unified AI Gateway（平台宪法不变）
  - Policy 可拒绝、审计完整（InvocationLog + KernelEvent）
方案 A（严格零推理）: Skill 内纯规则引擎（评分=规则加权, 报告=模板）
  - 更纯的分层，但 candidate.score 质量受限，不算「真实 AI 员工」
```

> 建议: 冻结方案 B，同时明确「Hermes 不承担推理」= Hermes 不做**自主规划决策**；工具内的受控 LLM 计算属于执行批准的工具。请掌柜裁决。

### Q2 冻结: 模型接入 = BYOK 架构 + 一个稳定模型

- 不追求模型 benchmark；验收 = 系统闭环真实
- S3.4 用平台 env Key（openai/deepseek/volcengine 择一，**D2 待掌柜指定**）+ `invokeAI(envelope)` 统一入口
- BYOK 用户级配置（UserModelConfigV2 建表）推迟到 S4（新表决策，需掌柜批准）

### Q3 冻结: 真实 Skill 最小集 = 招聘三件套升级（不新增 Skill）

```
resume.parse        mock → 复用 resume-parser-agent（真实 PDF 解析 → 结构化简历）
candidate.score     mock → 真实评分（LLM 结构化输出 或 规则加权, 依 D1）
interview.evaluate  mock → 真实面试评估报告（LLM 生成, 依 D1）
```

- 不增加新 Skill、不改 AgentDefinition.capabilities（F1 保持）
- 输入真实化: 用户上传 PDF 简历（复用现有 upload route）

### Q4 冻结: 完成定义 = 可交付资产（非聊天回复）

```
S3.4 Success Criteria:
  用户上传 PDF 简历
    → Alice 自动执行（Planner 意图 → SkillPlan DAG → Hermes 逐段）
    → 生成 candidate-report.pdf + candidate-analysis.json
    → 落 Asset（Workspace 可查看）
    → KernelEvent 完整审计（intent/plan/skill/execution/tool/result）
```

## 3. 目标链路（S3.4 全图）

```
User Intent（上传简历 + 岗位要求）
   ↓
Cloud Planner（LLM, invokeAI）: 理解任务 → 生成 SkillPlan DAG
   ↓
resume.parse（Hermes 执行, 复用真实解析 Agent）
   ↓
candidate.score（Hermes 执行, 真实评分）
   ↓
interview.evaluate（Hermes 执行, 真实评估报告）
   ↓
Asset Generation（candidate-report.pdf + candidate-analysis.json → Asset 落库）
   ↓
Workspace 可查看 + KernelEvent 可审计
```

## 4. Reality Gate RA1-RA5（冻结定义）

| # | 关卡 | 判定标准 |
|---|---|---|
| RA1 | Intent Understanding | 输入「我要招聘 Java 工程师」+ 简历 PDF → 正确生成招聘任务上下文（岗位/技能/要求） |
| RA2 | Skill Planning | Cloud Planner 生成正确 DAG: resume.parse → candidate.score → interview.evaluate（顺序/依赖正确） |
| RA3 | Real Tool Execution | Hermes 真实输入 → 真实 Skill → 真实结果（简历真实解析、评分真实计算） |
| RA4 | Asset Delivery | 产出文件资产（candidate-report.pdf + candidate-analysis.json）落 Asset，Workspace 可查 |
| RA5 | Audit | KernelEvent 完整: intent/plan/skill/execution/tool/result 全链路可审计 |

## 5. 实施路线（批准后）

```
S3.4.1 Real Skill 真实化（resume.parse 复用解析 Agent; candidate.score/interview.evaluate 接 LLM）
       Reality Gate: RS1 真实 PDF 解析 / RS2 评分输出结构化 / RS3 报告生成
S3.4.2 LLM Planner 接线（意图理解 + SkillPlan 生成, invokeAI 统一入口）
       Reality Gate: RP1 意图→上下文 / RP2 DAG 生成正确 / RP3 授权逐段保持
S3.4.3 Asset Delivery + 全链路闭环（上传→执行→资产→审计）
       Reality Gate: RA1-RA5 全跑（含 S3.3.2 SC7-SC11 回归）
每步独立 Reality Gate，先文档后编码
```

## 6. 待掌柜输入（实施前置）

| 项 | 内容 |
|---|---|
| D1 | LLM 工具内语义: 冻结方案 B（llm.invoke 受控工具）或方案 A（纯规则引擎）？ |
| D2 | 平台 provider 选择: openai / deepseek / volcengine（稳定模型即可）？ |
| D3 | 测试 Key/账户: 用平台 env Key 直测，还是提供专用测试 Key？ |
| D4 | 资产落点: 固定 demo Project 还是每任务新建 Project？ |

## 7. 禁止范围（S3.4）

- ❌ 不建新表（AI 网关/解析/资产全复用；BYOK 建表属 S4）
- ❌ 不改 Hermes 原子执行/生命周期；不改 Skill SSOT（F1）
- ❌ 不接真实招聘系统/ATS；不接真实面试
- ❌ 不动 Desktop UI（S1.2 冻结；产品入口接线属 S4）
- ❌ 不做通用 Agent / 自由聊天 / 多行业员工

## 8. 完成定义

```
✅ Alice 真实工作闭环: 上传简历 → 自动执行 → 可交付报告 + 结构化数据 → Workspace 可见 → 全审计
✅ 商业前提证明: 「一个企业购买一个 AI 员工，并且员工真的完成工作」的第一步成立
⏳ 商业闭环（License ACTIVE → 企业采购）与 Marketplace 属 S4
```

## 9. 冻结声明

```
✅ 本设计为 S3.4 候选（只提交 docs）
⏳ 待掌柜批准（含 D1-D4 裁决）→ S3.4.1 Implementation
🔒 与 F1-F7 / C1-C6 冲突的方案需掌柜裁决
```

## 铁律

> S3.4 = 用已有基础设施造出第一个真实 AI 员工（零新表、不越层、可交付资产、全审计）。
> LLM 是受控智能（Planner + 批准的工具），Hermes 仍是唯一执行者。
