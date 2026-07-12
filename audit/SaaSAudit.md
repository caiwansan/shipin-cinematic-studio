# Audit C: SaaS 商业规则审计 (SaaSAudit.md)

## 1. 商业规则概览

### 1.1 权限/配额/订阅 组件

| 组件 | 路径 | 状态 |
|------|------|------|
| Subscription Service | `services/platform/governance/subscription/` | ✅ 已实现 |
| Quota Service | `services/platform/governance/quota/` | ✅ 已实现 |
| Permission Service | `services/platform/governance/authorization/` | ✅ 已实现 |
| Billing Service | `services/platform/governance/billing/` | ✅ 已实现 |
| Usage Tracking | `routes/platform/governance/quota.route.ts` | ✅ 已实现 API |
| DailyUsage Model | `schema.prisma` → `DailyUsage` | ✅ 有 DB 模型 |

### 1.2 会员/订阅 DB 模型

```
Membership — 用户会员
MemberPlan — 套餐定义
Subscription — 订阅记录
SubscriptionPlan — 订阅计划
UserLimit — 用户限制
DailyUsage — 每日用量
Quota — 配额
BillingRecord — 计费记录
CoinLog — 代币日志
RechargeOrder — 充值订单
```

## 2. Guard 覆盖审计

### 2.1 Quota Guard 覆盖率

| AI 调用路径 | Quota Check | 证据 |
|-------------|:-----------:|------|
| Runtime 路径 | ✅ | `runtime/runtime-guard.ts` |
| customer-service | ✅ | `routes/customer-service.ts:205` |
| narrative-llm | ❌ | 直接调 LLM |
| model-adapters 路径 | ❌ | 绕过 Runtime |
| queue/worker 路径 | ❌ | 从 payload 直接读 |
| production-loop | ❌ | 无条件调用 |
| script-breakdown | ❌ | 无 quota check |
| aigc-orchestrator | ❌ | 无 quota check |

### 2.2 Subscription Guard 覆盖率

| 检查点 | 覆盖 | 证据 |
|--------|:----:|------|
| /api/platform/governance/subscriptions | ✅ | `subscription.route.ts` |
| Runtime AI 调用 | ✅ | `runtime/runtime-guard.ts` |
| Frontend 页面 | ⚠️ 部分 | 部分页面有会员判断 |
| API Key 调用 | ❌ | 无 subscription check |
| Queue Worker | ❌ | 无 subscription check |

### 2.3 Permission Guard 覆盖率

| 操作 | 覆盖 | 证据 |
|------|:----:|------|
| Admin 操作 | ⚠️ 部分 | 仅部分 route 有 check |
| Platform API | ✅ | `routes/platform/` 部分有 |
| Asset 操作 | ❌ | 无 permission check |
| Workspace 操作 | ❌ | 无 permission check |

## 3. 具体漏洞

### 🔴 漏洞 C-001: Worker Runtime 无 Quota 检查

**严重等级**: CRITICAL
**位置**: `queue/worker-runtime.ts:177-178`
**调用链**: Route → Queue Manager → BullMQ → Worker Runtime → Provider
**影响**: 用户可通过提交批量任务绕过 quota 限制
**修复**: Worker Runtime 需在执行前检查 tenant/user 的 quota

### 🔴 漏洞 C-002: Model-Adapter 路径无任何 Guard

**严重等级**: CRITICAL
**位置**: `model-adapters/video/aliyun-video.adapter.ts`, `model-adapters/video/volcengine-video.adapter.ts`
**调用链**: Route → Model-Adapter → Provider
**影响**: 完全绕过 subscription/quota/permission
**修复**: 合并到 Runtime 路径

### 🟠 漏洞 C-003: Direct LLM 调用在 customer-service

**严重等级**: HIGH
**位置**: `routes/customer-service.ts:287`
**调用链**: Route → fetch(LLM) → Provider
**影响**: 无 quota 检查，无限调用
**修复**: 通过 runtime-gateway 调用

### 🟠 漏洞 C-004: process.env 直接读取 API Key

**严重等级**: HIGH
**位置**: 多处 routes/services 直接引用 `process.env.XXX_API_KEY`
**影响**: 无法实现多租户 API Key 隔离
**修复**: 统一走 credential 管理

### 🟠 漏洞 C-005: 前端无统一的会员判断组件

**严重等级**: HIGH
**位置**: 各 `pages/*.vue` 文件独立判断会员状态
**影响**: 判断逻辑不一致，可能出现绕过
**修复**: 统一 `useMemberGuard` composable

### 🟡 漏洞 C-006: DailyUsage 记录不完整

**严重等级**: MEDIUM
**位置**: `DailyUsage` 模型只记录部分路径用量
**影响**: 用量统计不准确，无法精确计费
**修复**: 所有 AI 调用必须记录 DailyUsage

### 🟡 漏洞 C-007: Rate Limit 仅全局

**严重等级**: MEDIUM
**位置**: `backend/src/plugins/cors.ts` 等
**影响**: 无按用户/IP 的细粒度流控
**修复**: 集成 `@fastify/rate-limit` 并区分用户级别

## 4. 商业规则修复优先级

| 优先级 | 漏洞 | 估计工作量 | 风险 |
|--------|------|-----------|------|
| P0 | C-001 Worker Runtime Quota | 3d | 收入损失 |
| P0 | C-002 Model-Adapter Guard | 5d | 收入损失 |
| P1 | C-003 消除 Direct LLM | 2d | 滥用风险 |
| P1 | C-004 统一 Credential 管理 | 5d | 安全风险 |
| P2 | C-005 前端会员组件 | 3d | 体验问题 |
| P2 | C-006 DailyUsage 覆盖 | 3d | 数据问题 |
| P3 | C-007 Rate Limit 细粒度 | 2d | 可用性 |

## 5. 建议

1. **单一商业规则 Gate**: 所有 AI 调用必须经过 `runtime/runtime-guard.ts` (quota + subscription + permission)
2. **队列任务预检**: Queue Manager 在入队前检查 quota
3. **API Key 权限**: 所有 API 调用计入账户维度的 quota
4. **前端统一保护**: 使用 Nuxt middleware 统一校验会员状态
5. **审计日志强制**: 所有资源消耗操作计入 AuditLog
