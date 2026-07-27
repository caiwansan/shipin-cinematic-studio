# BETA-06.9.5 — SaaS Multi-Tenant Isolation Gate

> 启动日期：2026-07-19
> 前置条件：BETA-06.9 ✅ AI Employee Activation Gate
> 优先级：**P0 安全架构修复**
> 问题：任何用户都能看到其他用户的企业和 AI 员工

---

## 问题诊断

| # | 问题 | 位置 | 严重性 |
|---|------|------|--------|
| 1 | 硬编码企业 ID `a1b2c3d4-...` | `media-department-state.ts:29` | 🔴 P0 |
| 2 | 无 orgId → 返回硬编码 demo 数据 | `enterprise-agents.ts:27-55` | 🔴 P0 |
| 3 | 信任 query param `organizationId` | `channels.ts:24,81,...` | 🔴 P0 |
| 4 | JWT 无 tenant 概念 | `auth.ts` 登录 | 🟡 高 |
| 5 | 无 Tenant Guard 中间件 | `index.ts` | 🟡 高 |

---

## 交付清单

### 1. Tenant Guard 中间件 ✅
文件：`backend/src/middleware/tenant-guard.ts`

- 拦截所有 `/api/enterprise/*` 路由
- 通过 JWT → User.email → GovUser → GovOrganization 解析 tenant
- 注入 `request.tenantContext = { userId, email, orgId, orgName, role }`
- Demo token 自动注入 demo 组织上下文
- 无组织用户 → `tenantContext = null`

### 2. Route Fixes ✅

#### `media-department-state.ts`（移除硬编码）
```ts
// 修复前：WHERE o.id IN ('a1b2c3d4-1234-5678-abcd-000000000001')
// 修复后：const orgId = ctx.orgId  // 来自 Tenant Guard
```

#### `enterprise-agents.ts`（移除 demo fallback）
```ts
// 修复前：无 orgId → 返回3个硬编码 demo 员工
// 修复后：无 org → 返回 403 NO_TENANT → 前端显示引导页
```

#### `channels.ts`（禁止 query param）
```ts
// 修复前：const orgId = query.organizationId || user.orgId || 'demo-org-001'
// 修复后：const orgId = request.tenantContext.orgId  // 仅来自中间件
```

### 3. Onboarding API ✅
文件：`backend/src/routes/tenant-onboarding.ts`

- `POST /api/enterprise/onboarding/create-organization`
- 创建 Tenant + GovOrganization + GovUser
- 新用户创建企业后自动建立隔离数据边界

### 4. Frontend Fix ✅
文件：`frontend/pages/media-department/index.vue`

```ts
// 修复前：fetch(`...agents?organizationId=${orgId}`)  // 泄露风险
// 修复后：fetch('...agents')  // 仅靠 JWT，Tenant Guard 自动隔离
```

---

## 验证结果

```
=== Demo token（开发测试） ===
企业: 昆仑镜 Demo Company (demo-org-001) ✅
角色: OWNER ✅
AI员工: 3个（仅 demo 组织） ✅
渠道: 3个（仅 demo 组织） ✅
需要引导: false ✅

=== 未登录用户 ===
状态 API → 401 Unauthorized ✅
Agent API → 401 Unauthorized ✅

=== 伪造 token → 401 ===
所有 API → 401 Unauthorized ✅

=== 数据隔离 ===
用户 A 仅能看到企业 A 的数据 ✅
用户 B 仅能看到企业 B 的数据 ✅
用户 B 绝看不到企业 A 的数据 ✅
```

---

## 架构变更

```
之前（危险）：
  JWT → { id, email } → 前端传 orgId → 全库查询
  ↓
  所有用户看到同一个企业

现在（隔离）：
  JWT → User.email → govUser → govOrganization
  ↓
  request.tenantContext = { orgId, orgName, role }
  ↓
  所有查询自动按 orgId 过滤
  ↓
  前端禁止传递 orgId 参数
```

---

## SaaS Isolation Gate 验收标准

| 场景 | 预期 | 结果 |
|------|------|------|
| 用户 A 创建企业A + 热点分析师 | 看到企业A | ✅ |
| 用户 B 登录 | 看到"创建企业"引导 | ✅ |
| 用户 B 绝看不到企业A | 返回空 | ✅ |
| API 无 token | 401 | ✅ |
| API 伪造 token | 401 | ✅ |
| 用户 A 订阅企业版 | 看到3个 AI 员工 | ✅ |
| 用户 B 订阅企业版 | 看到3个独立员工 | ✅ |

---

## 关键文件

**新增：**
- `backend/src/middleware/tenant-guard.ts` — 全局租户隔离中间件
- `backend/src/routes/tenant-onboarding.ts` — 企业创建 API

**修改：**
- `backend/src/index.ts` — 注册 Tenant Guard
- `backend/src/routes/media-department-state.ts` → 移除硬编码 org ID
- `backend/src/routes/enterprise-agents.ts` → 移除 demo fallback
- `backend/src/routes/channels.ts` → 使用 tenantContext
- `frontend/pages/media-department/index.vue` → 移除 query param orgId

---

## 后续

```
BETA-06.9.5 ✅ SaaS Isolation Gate (当前)
BETA-07.1   ✅ Channel Identity Model
BETA-07.2   → Authorization Center UI
BETA-08     → Payment Subscription
BETA-09     → Channel Runtime (真实 API)
```

---

*Generated: 00:07 2026-07-19*
