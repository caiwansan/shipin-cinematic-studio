# Beta-01 Revenue Dashboard Gate Report

## 验收检查

| 检查项 | 状态 |
|--------|------|
| MRR 计算 | ✅ snapshotPrice / cycle 聚合 |
| ARR 计算 | ✅ MRR × 12 |
| 订阅统计 | ✅ active / total / new / churn |
| 套餐分析 | ✅ 按 snapshotName 分组统计 |
| TTFV 统计 | ✅ payment_success → first_outcome 时间差 |
| 转化漏斗 | ✅ 8 阶段事件计数 + 转化率 |
| 流失风险 | ✅ 到期 ≤15 天 + 7 天无活动 |
| 生产部署 | ✅ PM2 api-server-aigc + nuxt-frontend |

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/enterprise/revenue/overview` | MRR/ARR/订阅统计 |
| GET | `/api/admin/enterprise/revenue/plans` | 套餐分布分析 |
| GET | `/api/admin/enterprise/revenue/funnel` | Beta 转化漏斗 |
| GET | `/api/admin/enterprise/revenue/ttfv` | TTFV 统计分析 |
| GET | `/api/admin/enterprise/revenue/churn-risk` | 流失风险预警 |

---

## 前端页面

**路径**: `/admin/enterprise/revenue.vue`

- 收入总览：MRR / ARR / 活跃订阅 / 新增 / 流失
- 转化漏斗：8 阶段可视化条形图
- TTFF 分析：平均/中位数/最快/最慢
- 套餐分析：按套餐分组统计企业数和收入
- 流失风险：高/中/低风险标签
- 关键比率：转化率 / 流失率 / 企业数 / 订阅数

---

## MRR/ARR 计算逻辑

```
MRR = Σ(月度订阅 price) + Σ(年度订阅 price / 12)
ARR = MRR × 12
```

复用 `EnterpriseSubscription.snapshotPrice` + `snapshotCycle`，不新增字段。

---

## 生产验证

```
GET /api/admin/enterprise/revenue/overview    → 200, mrr/arr/subscriptions ✅
GET /api/admin/enterprise/revenue/plans       → 200, [] (无订阅数据) ✅
GET /api/admin/enterprise/revenue/funnel      → 200, 8 stages ✅
GET /api/admin/enterprise/revenue/ttfv        → 200, avg=0 (无数据) ✅
GET /api/admin/enterprise/revenue/churn-risk  → 200, high/medium/low ✅
```

PM2 状态: `api-server-aigc` online, `nuxt-frontend` online

---

## 数据来源

全部复用已有数据模型：
- `EnterpriseSubscription` (snapshotPrice, snapshotCycle, snapshotName, snapshotMaxEmployees)
- `AgentAuditTrail` (enterprise.lifecycle.*, enterprise.employee.*)
- `EnterpriseAgentInstance` (lastActiveAt)
- `Organization`, `EnterprisePlan`

**零新增 Schema，零新增 Runtime 模型。**

---

## 后续

```
✅ Revenue Dashboard PASSED
    ↓
P1 Renewal Reminder (到期提醒 / 自动续费提示)
```

---

## 结论

**Beta-01 Revenue Dashboard — PASSED ✅**

管理员可查看企业数字部门完整商业数据：MRR/ARR、转化漏斗、TTFV、套餐分析、流失风险。

**验证人**: OpenClaw (External Engineering Agent)
**日期**: 2026-07-17
