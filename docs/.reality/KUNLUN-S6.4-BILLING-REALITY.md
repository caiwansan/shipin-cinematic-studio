# KUNLUN-S6.4-BILLING-REALITY.md

> S6.4 Billing UI Reality — Phase B/C（Reality）
> 日期: 2026-08-06 15:00 (CST) | 状态: ✅ **BL1-BL6 全 PASS**
> 依据: 掌柜 S6.4 Phase B 指令（overview API + 展示; capabilities 必须来自 F1; 不修 max_agents; 禁 ROI 承诺）
> 定位: **Billing UI = 企业价值可视化层（非支付）**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/routes/enterprise-admin.routes.ts | +GET /api/admin/billing/overview（只读, 席位推导, F1 capabilities） |
| desktop/ui/index.html | +企业概览区块（BL-01/03, 管理员可见, Cloud 只读; 非管理员自动隐藏） |
| backend/scripts/s64-test.mts | BL1-BL6 Reality Gate |
| docs/.reality/KUNLUN-S6.4-BILLING-REALITY.md | 本报告 |

**未触碰（边界）**: max_agents 零修改（历史 seed 状态, 展示现实; 对齐属未来 Billing/Subscription 正式化）; 零新表 / 零写操作 / 无支付 ✅

## 1. Billing Overview API（B1/B2 冻结落地）

```
GET /api/admin/billing/overview
鉴权: JWT → orgId → isOrgAdmin（S6.3 复用）; 非管理员 403; 零 organizationId/tenantId 参数
返回:
  plan:       { tier: Professional, employeeLimit: 3, employeeCount: 3, source: "derived" }
              # 席位推导（产品视图）: 1=Basic / 3=Professional / 10=Enterprise; 不读/不修 max_agents
  employees:  [{ code, name, capabilities(F1, agent_definition 唯能力源), usage: {executions, successful, failed} }]
  plugins:    [{ code, enhancements: [type] }]
  activity:   { totalExecutions, activeEmployees, enabledEnhancements }
```

## 2. Desktop 展示（B3）

```
企业概览区块（apps 页）:
  当前方案: Professional · AI Employee 3/3
  本周期活动: 执行 N 次 · 活跃员工 N · 增强包 N
  逐员工卡片: 名称 + 执行/成功 + capabilities（F1 直接展示）
铁律: Desktop 零计算套餐 / 零判断权限 / 零读 License; 非管理员（403）→ 区块自动隐藏
```

## 3. Reality Gate 结果（实测 14 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| BL1 | Plan Reality | ✅ | plan 视图 derived + 席位推导 Professional(3) 正确 |
| BL2 | Employee Reality | ✅ | 三员工授权展示（capabilityCodes） |
| BL3 | Capability Reality | ✅ | Alice capabilities 与 agent_definition F1 完全一致（4 能力, 零手写） |
| BL4 | Usage Reality | ✅ | overview usage = Usage Meter; activity.totalExecutions = 员工 Meter 求和 |
| BL5 | Permission Reality | ✅ | B 用户 403; 无 token 401 |
| BL6 | Regression | ✅ | owner 还原; Alice/短剧/新媒体 全 COMPLETED |

## 4. 完成标准对照

```
企业价值可视化成立:
  套餐视图（derived, 不碰 max_agents）✅
  员工授权 + F1 能力 + 用量 ✅
  活动摘要（非财务, 零 ROI 承诺）✅
  权限隔离（管理员专属, 普通用户隐藏）✅
→ Billing 数据底座（License/Entitlement/Usage/Plan Mapping）全部可视化
→ 商业化最后拼图（管理视角）完成; S7 Marketplace 仍冻结
```

## 5. 未完成项

- [ ] max_agents 对齐（未来 Billing/Subscription 正式化阶段; 掌柜明确不属 S6.4）
- [ ] Billing 独立管理页（当前内嵌 apps 页区块; 完整 Enterprise Center 待 S6.5+）
- [ ] Windows 实机发布（待开发机, S6.2 已就绪）
- [ ] Marketplace / 支付 / 订单（S7, 继续冻结）

## 6. 结论

```
S6.4 Phase B/C ✅ 通过 —— Billing UI 价值可视化成立（零新表/零支付/零数据迁移）
→ 昆仑镜商业闭环: Employee + Plugin + Desktop + Admin + Billing 可视化 全齐
→ 下一阶段待掌柜裁决（S6.5 Enterprise Center 完善 / Windows 实机 / S7 Marketplace）
```
