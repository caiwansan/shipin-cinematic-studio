# KUNLUN-S6.4-BILLING-DESIGN.md

> S6.4 Billing UI Reality — Phase A Design Freeze
> 日期: 2026-08-06 14:40 (CST) | 状态: ✅ **设计冻结, 待掌柜批准 Phase B**
> 依据: 掌柜 S6.4 Phase A 指令（先审计三数据源真实字段, 再产出设计; 禁编码）
> 定位: **Billing UI = 企业价值可视化层, 不是支付系统**

---

## 0. 审计结论（实证）

### governance_subscription_plan（套餐表）
```
真实字段: id/code/name/description/price/currency/billingCycle/capabilities(JSON)/metadata/status
实况: 5+ 计划（recruitment_free/pro/team/enterprise + vip_basic）
⚠️ 关键发现: 该表是【招聘域套餐体系】（capabilities = JOB_CREATE/AI_JD_GENERATE 等招聘能力）
   ❌ 无 AI Employee 席位语义（无 employeeLimit 字段）
→ AI Employee 的 Plan 展示不能直接映射该表, 需组合视图（见 §2）
```

### EnterpriseEntitlement（员工授权）
```
org A 实况: max_agents=1（S4.2 seed 默认值, 未随 3 员工更新）/ capabilityCodes=[3 员工] / status=active
→ 席位语义 = max_agents（上限） + capabilityCodes（实际拥有）
→ 组合视图需以 capabilityCodes 实际数为准（max_agents 作上限参考）
```

### Usage Meter（使用量）
```
getEmployeeUsageMeter 返回: { employeeCode, executions, successful, failed, skills, byCaller, recent }
数据底座: InvocationLog（userId/projectId/executionId/capability/provider/status）+ KernelEvent
→ 直接复用, 零新增
```

## 1. 产品定位（冻结）

```
Billing UI = 企业价值可视化层
展示: 企业购买状态 → 拥有多少 AI Employee → 用了多少 → 产生多少执行活动
禁止: Order / Payment / Invoice / Subscription 创建 / Marketplace 购买 / 自动续费 / 新表 / ROI 承诺
```

## 2. Plan 视图设计（组合视图, 零新表）

```
GET /api/admin/billing/overview 返回的 plan 视图:
{
  plan: {
    name: "Professional",                    # 映射: 按授权员工数推导（1=Basic, 3=Professional, 10=Enterprise）; 有 governance 订阅则取 plan.name 覆盖
    employeeLimit: 3,                        # EnterpriseEntitlement.max_agents（上限）
    employeeCount: 3,                        # capabilityCodes 实际数（真实拥有）
  }
}
Plan Mapping 原则（S4.4 P2 固化延续）:
  Basic(1 员工) / Professional(3) / Enterprise(10) —— 商品级席位, 非招聘域套餐
  governance_subscription_plan 仅在企业有订阅时作为套餐名/等级参考（只读）
```

## 3. 页面冻结

### BL-01 企业概览（Enterprise Center → Billing）
```
当前方案: Professional · AI Employee 3/3
资源: AI Employee / Plugin Enhancement / Usage
```

### BL-02 Employee Usage（逐员工）
```
Alice
Capability（F1, 来自 agent_definition API, 禁手写）:
  resume.parse / profile.extract / candidate.score / interview.evaluate
Usage: Total 123 / Success 118 / Failed 5
```

### BL-03 Value Summary（非财务）
```
AI Workforce Activity
本月执行任务: xxxx | 活跃员工: 3 | 启用增强: 1
（避免过早承诺 ROI）
```

## 4. API 设计（冻结, 唯一新增只读 API）

```
GET /api/admin/billing/overview
鉴权: JWT → getOrganizationIdForUser → isOrgAdmin（S6.3 复用）; 非管理员 403
返回:
{
  plan: { name, employeeLimit, employeeCount },
  employees: [{ code, name, capabilities(F1), usage: {executions, successful, failed, lastUsed} }],
  plugins: [{ code, enhancements: [type...] }],
  activity: { totalExecutions, activeEmployees, enabledEnhancements }
}
内部复用: Organization.ownerId / EnterpriseEntitlement / EcologyLicense / InvocationLog+KernelEvent / agent_definition / governance_subscription_plan(只读参考)
零新表 / 零写操作
```

## 5. Reality Gate（BL1-BL6）

| # | 关卡 | 验证 |
|---|---|---|
| BL1 | Plan Reality | plan 视图来自 entitlement 席位推导（非手写） |
| BL2 | Employee Reality | 三员工授权正确（capabilityCodes） |
| BL3 | Capability Reality | capabilities 来自 agent_definition（F1, 禁手写） |
| BL4 | Usage Reality | overview 的 usage 与 Usage Meter 一致 |
| BL5 | Permission Reality | 非管理员 403; B 用户不可见 A 数据 |
| BL6 | Regression | Alice/短剧/新媒体 全链通过 |

## 6. 边界（冻结确认）

✅ 允许: 只读 overview API / 展示层
❌ 禁止: 新 Billing 表 / 新账户体系 / Payment SDK / Subscription 重构 / 写操作 / ROI 财务承诺

## 7. 结论

```
S6.4 Phase A 设计冻结 ✅
Billing UI = 企业价值可视化（Plan 组合视图 + 员工用量 + 活动摘要）
→ 待掌柜批准 Phase B（只读 API + 展示, 复用 S6.3 admin 鉴权）
```
