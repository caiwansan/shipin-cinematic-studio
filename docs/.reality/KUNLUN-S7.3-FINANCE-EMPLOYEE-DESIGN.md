# KUNLUN-S7.3-FINANCE-EMPLOYEE-DESIGN.md

> S7.3 第五 AI Employee — 财务经营分析（Phase A Design Freeze）
> 日期: 2026-08-06 17:30 (CST) | 状态: ✅ **审计完成 + 设计冻结, 待掌柜批准 Phase B**
> 依据: 掌柜 S7.3 指令（五部门闭环; 财务域更谨慎: 定位 = 企业经营分析助手, 非财务顾问/投资建议/自动记账）
> 定位: **补全 人力/内容/营销/风险/财务 五部门矩阵**

---

## 0. 审计结论（实证）

| 项 | 现状 |
|---|---|
| 财务工作台 | ❌ 无独立 finance 工作台页面（不影响: 员工商品化不依赖工作台, 启动映射可用 /workspace 通用入口） |
| 后端财务路由 | wallet.ts / admin-wallet.ts / enterprise-billing.ts / enterprise-subscription.ts 等 —— ⚠️ **平台计费域（钱包/订阅/账单）, 非企业经营分析域** |
| 财务数据模型 | AssetTransaction / CreatorWallet —— **平台钱包域, 非经营分析数据** |
| ⚠️ 关键合规边界 | **员工 Skill 禁触碰平台计费体系**（wallet/billing/subscription 路由与表）——财务员工是「企业经营分析」, 与平台自身计费完全隔离 |
| 旧 LLM 通道 | ✅ 财务域 0 narrativeGateway（无污染） |
| 旧 agent | ✅ 无 |
| 合规先例 | ✅ 法务「reference only」提示模式可复制 |

## 1. Employee Identity

```
code:            def-finance-analyst
name:            财务经营分析 AI Employee
定位:            企业经营分析助手（非财务顾问/非投资建议/非自动记账）
capabilities:    ["financial.report", "expense.analysis", "business.insight"]
组件 Skill def:
  def-financial-reporter   [financial.report]
  def-expense-analyst      [expense.analysis]
  def-business-insighter   [business.insight]
```

## 2. Capability 契约（掌柜冻结）

### FA-01 financial.report（经营摘要）
```
输入: { reportText: string(财务报表/业务数据摘要), period?: string }
输出: { summary: string, trends: [{item, direction, note}], anomalies: [{item, description}] }
治理: trends/anomalies ≤10; 输出 = 经营参考非财务意见
```

### FA-02 expense.analysis（费用分析）
```
输入: { expenseText: string(费用明细文本) }
输出: { categories: [{name, amount, share}], anomalies: [{item, description}], suggestions: string[] }
治理: categories ≤10 / anomalies ≤10 / suggestions ≤5
```

### FA-03 business.insight（经营洞察）
```
输入: { metricsText: string(经营指标), question?: string }
输出: { insights: string[], riskFlags: [{item, level, note}], suggestions: string[] }
治理: insights ≤10 / riskFlags ≤10 / suggestions ≤5
```

## 3. 合规边界（冻结, 高于法务标准）

```
✅ 允许: 用户提供的报表/费用/指标文本分析（纯输入）
❌ 禁止: 读平台财务表（AssetTransaction/CreatorWallet/wallet/billing/subscription）; 自动记账; 投资建议; 税务结论
Prompt 固化: 「本分析仅供经营参考, 不构成财务、税务或投资建议」（同法务 reference-only 模式）
数据隔离: 员工 Skill 零平台计费域依赖（0 wallet / 0 billing / 0 subscription 引用, LG3 式扫描）
```

## 4. Runtime / Asset（同模板, 零新基础设施）

```
Runtime: finance-parser.ts 纯函数 + 3 内部路由（token 门禁 + unifiedAIGateway）+ hermes 3 薄工具
Asset:   deliverFinanceAssets → financial-report.json + expense-analysis.json + business-insight.json
         （复用 Asset+UserAsset, 零新表）
Commercial: EnterpriseEntitlement capabilityCodes 加 code; Desktop/Marketplace 自动出现（分类: 财务）
```

## 5. Reality Gate（FA1-FA6, 待 Phase B）

| # | 关卡 | 验证 |
|---|---|---|
| FA1 | Identity | def-finance-analyst 唯一 + Marketplace 可发现（分类=财务） |
| FA2 | Skill Boundary | 3 组件 Skill 授权 + 路由门禁 + Parser 单测 |
| FA3 | Runtime | 全链真实执行（unifiedAIGateway; **0 narrativeGateway / 0 wallet / 0 billing / 0 subscription 引用扫描**） |
| FA4 | Asset | 3 JSON 创建 + Asset/UserAsset + URL |
| FA5 | Commercial | 未授权拒 / 授权执行（五员工共存） |
| FA6 | 五员工回归 | Alice/短剧/新媒体/法务/财务 全链无影响 |

## 6. 边界（冻结确认）

✅ 允许: 新 AgentDefinition / 新 Skill / 新 Prompt Contract / 新 Asset 类型
❌ 禁止: 平台计费域依赖 / 自动记账 / 投资建议 / 税务结论 / 新 Runtime / 新权限体系 / Payment / Marketplace 交易 / Memory / Loop

## 7. 结论

```
第五员工（财务经营分析）商品化可行 ✅
→ 五部门矩阵: 人力(Alice) + 内容(短剧) + 营销(新媒体) + 风险(法务) + 财务(经营分析)
→ Marketplace 商品故事完整: 昆仑镜 = 企业 AI 员工操作系统
→ 待掌柜批准 Phase B 实施（同 S5.1/S7.0 模板）
```
