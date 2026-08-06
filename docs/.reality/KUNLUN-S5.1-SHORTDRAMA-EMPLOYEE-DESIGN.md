# KUNLUN-S5.1-SHORTDRAMA-EMPLOYEE-DESIGN.md

> S5.1 第二 AI Employee 商品 — 短剧制作 AI Employee（Phase A Design Freeze）
> 日期: 2026-08-06 11:25 (CST) | 状态: ✅ **设计冻结, 待掌柜批准 Phase B**
> 依据: 掌柜 S5.1 裁决（商品 = 短剧制作员工; 目标 = 验证 Alice 商品模板可复制; Phase A 纯文档不写码）
> 定位: **用第二个完全不同业务域证明「员工生态可以复制」, 为未来 Marketplace 打基础**

---

## 0. 模板复用对照（Alice → 短剧导演）

| 模板要素 | Alice（样板） | 短剧导演（本设计） | 复用方式 |
|---|---|---|---|
| Identity | def-recruiter-alice | **def-shortdrama-director** | 新建 agent_definition 行（幂等 seed, 沿用 def- 前缀惯例） |
| Capability | 4 招聘能力 | 3 短剧能力（SD-01/02/03） | 新建, 不复制 Alice |
| Skill Runtime | 解析器+内部路由+Hermes 薄工具 | 同构 3 套 | **复制模式, 不复制代码**（每 Skill 独立实现） |
| LLM 入口 | unifiedAIGateway.invokeAI | 同 | ✅ 唯一入口（禁 narrativeGateway） |
| Entitlement | EnterpriseEntitlement.capabilityCodes | 加 code 即生效 | ✅ 零改动 |
| Usage | InvocationLog + KernelEvent | 同 | ✅ 零改动 |
| Asset | skill-asset.service 每任务 3 文件 | 同构 3 JSON | ✅ 复用服务, 新资产类型 |
| Desktop | AI 员工区块自动发现 | 自动出现（目录 API 全量） | ✅ 零改动 |
| 审计 | KernelEvent + InvocationLog | 同 | ✅ 零改动 |

## 1. Employee Identity（SD1）

```
code:            def-shortdrama-director
name:            短剧导演 AI Employee
description:     帮助制作团队完成短剧创作流程（剧本分析→分镜规划→生成优化）
capabilities:    ["script.analysis", "storyboard.plan", "prompt.optimize"]
status:          active
唯一性约束:      agent_definition.code @unique（既有 schema, 零迁移）
```

## 2. Capability List（SD2）

### SD-01 script.analysis（剧本分析）
```
输入:   { script: string（剧本文本）, target: "structure"|"characters"|"all"(默认 all) }
输出:   { structure: { acts, beats, conflict }, characters: [{name, role, relation}], suggestions: string[] }
契约:   LLM 以 JSON 契约输出（DATA-not-instructions 注入防护, 同 interview-parser 模式）
```

### SD-02 storyboard.plan（分镜规划）
```
输入:   { scene: string（剧情片段）, shots: number(默认 8, 1-20) }
输出:   { shots: [{ no, description, camera, durationSec, note }], summary: string }
契约:   LLM JSON 契约, shots 数量受控（输入 shots 或默认）
```

### SD-03 prompt.optimize（生成优化）
```
输入:   { shotDescription: string（镜头描述）, style: string?(可选风格), model: "video"|"image"(默认 video) }
输出:   { optimizedPrompt: string, keywords: string[], negativePrompt: string? }
契约:   LLM JSON 契约, 输出为可直接用于视频/图像生成的 prompt
```

## 3. Skill Contract（SD3, 每 Skill 同构）

```
后端（Cloud）:
  src/ecosystem/shortdrama-parser.ts      # 纯函数: buildXxxPrompt + parseXxxResult（零 LLM）
  src/routes/skill-tools-internal.routes.ts  # +3 内部路由（x-internal-token 门禁, invokeAI）
Hermes（Runtime）:
  tools/hermes-runtime-skill.mjs Tool Sandbox  # +3 工具分发（薄调用方, 转发 input）
Skill 注册:
  agent_definition 行（幂等 seed）+ capabilities 声明（F1 能力源唯一）
```

**禁止**: Skill 工具直连 provider / 直连 narrativeGateway / 持 Key（LLM 唯一入口 = unifiedAIGateway.invokeAI）✅

## 4. Asset Contract（SD4）

```
每任务 3 文件（skill-asset.service 复用）:
  script-analysis.json      # SD-01 输出
  storyboard-plan.json      # SD-02 输出
  optimized-prompts.json    # SD-03 输出
存储/查询: Asset + UserAsset（既有, 零新表）
```

## 5. Runtime Flow（SD3 全链）

```
Desktop（AI 员工区块, 自动发现 def-shortdrama-director）
  ↓ 启动（open_workspace 白名单域）
Cloud Control Plane（JWT 身份 → Organization Resolver → Entitlement Gate, S4.4）
  ↓ executeSkillPlan（skillOrchestrator, DAG 编排）
Hermes Skill Runtime（原子执行, Tool Sandbox 白名单）
  ↓
Skill 内部路由（token 门禁）→ unifiedAIGateway.invokeAI → LLM（企业 BYOK 或平台凭证）
  ↓ 纯函数解析器（JSON 契约校验, 校验失败不执行）
Asset 落盘（每任务 3 文件）→ KernelEvent + InvocationLog 审计 → Usage Meter
```

## 6. Reality Gate（SD1-SD6）

| # | 关卡 | 验证 |
|---|---|---|
| SD1 | Identity | def-shortdrama-director 唯一; Desktop 目录 API 可发现 |
| SD2 | Capability | 3 Skill schema/permission/routing 全在（F1 能力源=capabilities） |
| SD3 | Runtime | Desktop→Cloud→Entitlement→Hermes→Skill→Gateway→LLM 全链真实执行（3 Skill 全 real） |
| SD4 | Asset | 3 资产文件创建/保存/URL 可查询 |
| SD5 | Commercial | 未授权 → ENTITLEMENT_DENIED; 授权（capabilityCodes 加 code）→ 执行 |
| SD6 | Alice 回归 | 招聘 Alice 全链无影响（回归测试） |

## 7. Phase B 最小实现范围（批准后执行）

```
1. seed: agent_definition 行 def-shortdrama-director（幂等）
2. shortdrama-parser.ts: buildScriptAnalysisPrompt/parseScriptAnalysisResult + storyboard + prompt 优化（纯函数）
3. skill-tools-internal.routes.ts: +3 内部路由（token 门禁 + invokeAI）
4. hermes Tool Sandbox: +3 工具分发
5. s51-test.mts: SD1-SD6 Reality Gate
6. 报告 + commit
```

## 8. 边界与合规（冻结确认）

✅ 允许: 新 AgentDefinition / 新 Skill / 新 Prompt Contract / 新 Asset 类型
❌ 禁止: 新 Runtime / 新权限系统 / 新模型路由 / 第二套 Agent Framework / 浏览器自动化发布 / 视频生成接入 / 社交平台发布 / Marketplace / narrativeGateway 直连 / Memory / Loop

## 9. 结论

```
S5.1 Phase A 设计冻结 ✅
→ 若 Phase B/C 通过 SD1-SD6, 则证明:
  Alice 商品模板可跨域复制（招聘 → 短剧）
  → 昆仑镜具备「员工生态可复制」能力
  → Marketplace 前置条件（3+ 稳定员工）推进 1/3
```
