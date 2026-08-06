# KUNLUN-S7.0-LEGAL-EMPLOYEE-DESIGN.md

> S7.0 第四 AI Employee — 法务合同审查（Phase A Design Freeze）
> 日期: 2026-08-06 16:00 (CST) | 状态: ✅ **审计完成 + 设计冻结, 待掌柜批准 Phase B**
> 依据: 掌柜 S7.0 指令（第四员工先审计后设计; 定位 = 企业合同分析助手, 非 AI 律师; P0 Windows RG 并行）
> 定位: **Employee Portfolio 扩张（人力/内容/营销/法务 四部门覆盖）**

---

## 0. 审计结论（实证）

### 现有法律工作台（frontend/pages/workspace/legal）
```
11 页: index/adviser/analysis/cases/cases-db/contracts/dashboard/documents/evidence/case/
API: /api/legal/agent/chat, /api/legal/agent/upload, /api/legal/cases, /api/legal/case-templates
```

### 数据模型（零新表可复用）
```
LegalCase / LegalContractTemplate / LegalDocumentTemplate / LegalKnowledge（均已有表）
```

### ⚠️ 合规关键发现
```
legal 域现有 LLM 通道 = narrativeGateway（旧体系, legal-regulation-fetch/legal-regulation 直连）
→ S7.0 Phase B 红线: 新员工 Skill 工具必须走 unifiedAIGateway.invokeAI
→ 不改造旧工作台; 商品化员工 Skill 独立走新通道（与短剧/新媒体同模式）
→ 现有 legal chat agent 不属于员工体系（旧 Agent, 不入商品目录）
```

## 1. Employee Identity

```
code:            def-legal-advisor
name:            法务合同审查 AI Employee
定位:            企业合同分析助手（非 AI 律师）
capabilities:    ["contract.review", "risk.analysis", "clause.optimize"]
组件 Skill def:
  def-contract-reviewer    [contract.review]
  def-risk-analyst         [risk.analysis]
  def-clause-optimizer     [clause.optimize]
```

## 2. Capability 契约

### LG-01 contract.review（合同审查）
```
输入: { contractText: string(合同文本), contractType?: string }
输出: { summary: string, keyClauses: [{title, content}], risks: [{level, description}] }
治理: keyClauses ≤10; 禁法律结论承诺（输出为分析, 非法律意见）
```

### LG-02 risk.analysis（风险分析）
```
输入: { contractText: string, focus?: string }
输出: { riskLevel: "low"|"medium"|"high", riskPoints: [{risk, impact, suggestion}], overallNote: string }
治理: riskPoints ≤10; 修改建议为参考, 禁替代律师
```

### LG-03 clause.optimize（条款优化）
```
输入: { clauseText: string(原条款), goal: string(优化目标) }
输出: { optimizedClause: string, reason: string, tradeoffs: string[] }
治理: 纯文本条款优化; 禁自动签署/自动发送
```

## 3. Runtime / Asset（同模板, 零新基础设施）

```
Runtime: parser + 内部路由(token 门禁) + hermes 薄工具 + unifiedAIGateway（禁 narrativeGateway 直连 ✅）
Asset:   deliverLegalAssets → contract-review.json + risk-analysis.json + clause-optimization.json
         （复用 Asset+UserAsset, 零新表）
Commercial: EnterpriseEntitlement capabilityCodes 加 code; Desktop 自动发现
```

## 4. 商业边界（高风险领域冻结）

```
✅ 允许: 合同文本分析 / 风险提示 / 条款优化建议（分析助手）
❌ 禁止: 自动签署 / 法律结论承诺 / 替代律师 / 自动发送合同 / 法律意见书
定位声明: 输出必须含「仅供参考, 非法律意见」性质提示（Prompt 契约内固化）
```

## 5. Reality Gate（LG1-LG6, 待 Phase B）

| # | 关卡 | 验证 |
|---|---|---|
| LG1 | Identity | def-legal-advisor 唯一 + Desktop 可发现 |
| LG2 | Skill Boundary | 3 组件 Skill 授权 + 路由门禁 + Parser 单测 |
| LG3 | Runtime | 全链真实执行（3 Skill source=real; **unifiedAIGateway, 0 narrativeGateway**） |
| LG4 | Asset | 3 JSON 创建 + Asset/UserAsset + URL |
| LG5 | Commercial | 未授权拒 / 授权执行（多员工共存） |
| LG6 | 四员工回归 | Alice/短剧/新媒体/法务 全链无影响 |

## 6. 边界（冻结确认）

✅ 允许: 新 AgentDefinition / 新 Skill / 新 Prompt Contract / 新 Asset 类型
❌ 禁止: narrativeGateway 直连 / 自动签署 / 法律结论承诺 / 替代律师 / 自动发送 / 新 Runtime / 新权限体系 / Marketplace / Memory / Loop

## 7. 结论

```
第四员工（法务合同审查）商品化可行 ✅
→ 商品矩阵: 人力(Alice) + 内容(短剧) + 营销(新媒体) + 风险(法务) = 企业核心部门覆盖
→ 4 Employee + Plugin + Desktop + Enterprise Center → Marketplace 前置条件成熟
→ 待掌柜批准 Phase B 实施（同 S5.1/S5.2 模板）
```
