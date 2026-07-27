# GA-03 Enterprise Billing UX — Audit & Plan

**Phase**: Productization — Enterprise Billing UX
**Date**: 2026-07-17
**Author**: OpenClaw (AI CTO Office)

---

## 目标

把已有支付基础设施包装成用户可购买产品：

```
进入企业数字部门 → 看到套餐 → 选择套餐 → 支付 → 自动激活 → 获得 AI 员工额度
```

---

## 现有基础设施审计

### 后端 ✅ 已有

| 模型/路由 | 用途 | 状态 |
|---|---|---|
| `EnterprisePlan` | 企业套餐模型 | ✅ |
| `EnterpriseSubscription` | 企业订阅关系 | ✅ |
| `PaymentOrder` | 支付订单 | ✅ |
| `PaymentConfig` | 支付方式配置 | ✅ |
| `PaymentSecret` | 支付密钥 | ✅ |
| `admin-enterprise-plans.ts` | 套餐管理 API | ✅ |
| `payment.ts` | 支付核心 API | ✅ |

### 前端 ⏳ 需产品化

| 页面 | 状态 | 说明 |
|---|---|---|
| 套餐展示页 | ⏳ | `/enterprise/pricing` |
| 支付页面 | ⏳ | 选择套餐 → 支付 |
| 支付成功页 | ⏳ | 跳转 Onboarding |
| Subscription Guard | ⏳ | 订阅状态检查 |
| 员工额度控制 | ⏳ | 基于 plan 限制 |

---

## GA-03 任务拆分

### TASK-01: 套餐展示页

**页面**: `/enterprise/pricing`

**内容**:
- 套餐列表 (从 API 获取)
- 价格 / 员工数量 / 渠道数量 / Memory / Runtime
- 选择套餐按钮

### TASK-02: Subscription Guard

**逻辑**:
```
用户访问 /enterprise
  ↓
检查 EnterpriseSubscription
  ↓
有订阅 → Workspace
无订阅 → Pricing 页面
```

### TASK-03: AI 员工额度控制

**逻辑**:
```
EnterprisePlan.maxEmployees
  ↓
当前 AI 员工数 >= maxEmployees
  ↓
提示升级套餐
```

### TASK-04: 支付闭环

**流程**:
```
Select Plan → PaymentOrder → Payment Gateway → Callback → Subscription ACTIVE → Workspace Unlock
```

### TASK-05: 管理后台完善

**已有**: `admin-enterprise-plans.ts`
**需完善**: 套餐列表 UI + 创建/编辑表单

---

## 商业规则冻结

| 规则 | 说明 |
|---|---|
| VIP ≠ Enterprise Subscription | 用户 VIP 等级与企业订阅独立 |
| BYOK | 用户自带 LLM API Key，昆仑镜不承担模型费用 |
| 员工额度 | 基础版 3 / 专业版 10 / 企业版不限 |
| 管理员配置 | 价格/员工数/渠道数后台动态配置，不写死代码 |

---

*OpenClaw — Enterprise Engineering*
*GA-03 Enterprise Billing UX — Audit & Plan*
