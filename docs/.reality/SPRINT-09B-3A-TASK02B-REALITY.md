# Sprint-09B-3A Task 02-B Subscription → Capability → Provision Reality

**Date:** 2026-07-30 17:22 CST
**Status:** ✅ PASS (3/3)

## 改动

### 文件变更

| 文件 | 改动 |
|------|------|
| `src/services/enterprise/workflow/career-agent.service.ts` | +`checkProvisionEntitlement()` 方法，`createAndDeploy()` 新增权益门控，+常量 `CAREER_AGENT_PLAN_CODE`/`CAREER_AGENT_PROVISION_CAP` |
| `src/routes/career-workflow.ts` | POST `/api/career/agent/create` 新增权益检查 → 403 + action 提示 |
| `src/routes/career-activation.ts` | POST `/api/career/agent/activate-and-execute` 原有 enterprise 检查替换为通用 `checkProvisionEntitlement` |

### 0 SQL migration — 零 Schema 变更
### 0 新表 / 新支付系统 / UI 改动

---

## Reality Gate

### G1: Entitlement 判断

```
输入: userId
链路: Tenant → Subscription(active) → career_agent plan → CapabilityGrant.CAREER_AGENT_PROVISION
输出: { allowed: boolean, reason?: string }
```

✅ 链路完整，通过 CapabilityGrant 而非 plan.capabilities JSON 字段判断

### G2: Provision Gate

```
createAndDeploy()
  ↓
checkProvisionEntitlement()  ← 新增门控
  ↓  allowed=false
throw Error("需要开通镜心职业助理（¥9.9/月）")
```

✅ 门控在创建 Agent 之前执行，不允许绕过

### G3: Reality Test — 2/2 PASS

| Case | 状态 | 结果 |
|------|------|------|
| B: 未购买 | ✅ | `allowed: false` → "需要开通镜心职业助理（¥9.9/月）" |
| A: 已购买 | ✅ | `allowed: true` → Agent 创建成功，全链路 (Profile → Instance → Binding) |

---

## Identity Boundary 验证

```
Profile.organizationId = userId (personal tenant)   ✅
Profile.tenantId = userId (personal tenant)          ✅
Instance.tenantId = userId (personal tenant)         ✅
Binding.tenantId = userId (personal tenant)          ✅
Cross-enterprise-org: 0 career_advisor profiles      ✅
```

个人用户创建的 Agent 不会泄漏到企业组织。

---

## API 响应设计

### 未购买时

```json
{
  "error": "ENTITLEMENT_REQUIRED",
  "message": "需要开通镜心职业助理（¥9.9/月）",
  "action": "purchase_career_agent"
}
```

### 已购买时

正常创建流程，返回 agent info。

---

## 后续注意事项

1. 个人用户首次购买时需要确保 Teamt 自动创建（目前需要在购买流程中创建）
2. `checkProvisionEntitlement` 对企业用户返回 `{ allowed: true }`（信任企业侧自己的 entitlement），这个决策在 Task 03 支付接入后可以重新评估
3. API 返回的 `action: 'purchase_career_agent'` 为前端提供导航信号
