# Phase 3.2 — P0-3-05 Enterprise API Tenant Guard Audit Report

> **日期**: 2026-07-17
> **阶段**: P0-3 Identity Recovery Sprint
> **范围**: `backend/src/routes/` + `backend/src/services/enterprise/`
> **审计规则**: 5 条 CTO 冻结原则

---

## 一、审计总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 **P0** | 6 | 必须立即修复，跨租户数据泄露风险 |
| 🟡 **P1** | 3 | 需要修复，架构一致性问题 |
| 🟢 **P2** | 3 | 治理改进，建议在 RC 后处理 |

### 评分估算

| 维度 | 当前 | 目标 |
|------|------|------|
| Tenant Guard 覆盖率 | ~40% | ≥90% |
| 查询过滤完整性 | ~50% | ≥95% |
| 信任边界合规 | ~30% | 100% |

---

## 二、API 清单

### 2.1 认证路由 (Enterprise)

| API | Route File | Service | Tenant Guard | 评级 |
|-----|-----------|---------|-------------|------|
| `GET /enterprise/:tenantId/dashboard` | `enterprise-dashboard.ts` | `dashboard.service.ts` | ✅ `tenantOwnershipGuard` + `tenantId` filter | ✅ PASS |
| `GET /enterprise/:tenantId/dashboard/agents` | `enterprise-dashboard.ts` | `dashboard.service.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `POST /enterprise/agent-profiles` | `enterprise-agent-profiles.ts` | `enterprise-agent-profile.service.ts` | ❌ **`body.organizationId` 信任用户输入** | 🔴 **P0** |
| `GET /enterprise/agent-profiles` | `enterprise-agent-profiles.ts` | `enterprise-agent-profile.service.ts` | ⚠️ `tenantId` = user.id fallback | 🟡 **P1** |
| `GET /enterprise/agent-profiles/overview` | `enterprise-agent-profiles.ts` | `enterprise-agent-profile.service.ts` | ⚠️ user.id fallback | 🟡 **P1** |
| `PATCH /enterprise/agent-profiles/:id` | `enterprise-agent-profiles.ts` | `enterprise-agent-profile.service.ts` | ✅ `where: { id, tenantId }` | ✅ PASS |
| `POST /enterprise/agent-profiles/:id/toggle` | `enterprise-agent-profiles.ts` | `enterprise-agent-profile.service.ts` | ✅ `tenantId` filter | ✅ PASS |
| `POST /provider-management/credentials` | `provider-management.ts` | `provider-credential.service.ts` | ✅ `providerAuthGuard` + `x-organization-id` 验证 | ✅ PASS |
| `GET /provider-management/credentials` | `provider-management.ts` | `provider-credential.service.ts` | ✅ `providerAuthGuard` | ✅ PASS |
| `POST /provider-management/bindings` | `provider-management.ts` | `provider-credential.service.ts` | ✅ `providerAuthGuard` | ✅ PASS |
| `POST /agent-runtime/agents` | `agent-runtime.ts` | agent-runtime module | ✅ `tenantGuard` + `x-organization-id` | ✅ PASS |
| `POST /agent-runtime/agents/:id/deploy` | `agent-runtime.ts` | agent-runtime module | ✅ `tenantGuard` | ✅ PASS |
| `POST /agent-runtime/agents/:id/execute` | `agent-runtime.ts` | agent-runtime module | ✅ `tenantGuard` | ✅ PASS |

### 2.2 核心业务路由

| API | Route File | Tenant Guard | 评级 |
|-----|-----------|-------------|------|
| `GET /enterprise/foundation/*` | `enterprise-foundation.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `GET /enterprise/channel/*` | `enterprise-channel.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `GET /enterprise/intelligence/*` | `enterprise-intelligence.ts` | ✅ `tenantOwnershipGuard` + `tenantOnly()` | ✅ PASS |
| `GET /enterprise/leads/*` | `enterprise-leads.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `GET /enterprise/roi/*` | `enterprise-roi.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `GET /enterprise/sales/*` | `enterprise-sales.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `GET /enterprise/billing/*` | `enterprise-billing.ts` | ✅ `tenantOwnershipGuard` | ✅ PASS |
| `GET /enterprise/knowledge/*` | `enterprise-knowledge.ts` | ✅ `tenantOwnershipGuard` + `tenant_id` filter | ✅ PASS |

---

## 三、P0 问题详情（必须立即修复）

### P0-1: `enterprise-agent-profiles.ts` POST 信任用户输入 organizationId

**位置**: `routes/enterprise-agent-profiles.ts:57`

```ts
// ❌ 当前代码
const organizationId = body.organizationId || tenantId;
```

**风险**: 用户可在 body 中传入任意 `organizationId`，跨组织创建 Agent。

**修复方案**:
```ts
// ✅ 正确：从 JWT 解析，不信任 body
const organizationId = await getOrganizationIdForUser(user.id);
if (!organizationId) {
  return reply.status(400).send({ code: 400, message: '用户未关联组织' });
}
```

### P0-2: `enterprise-agent-profiles.ts` tenantId 来源错误

**位置**: `routes/enterprise-agent-profiles.ts:25,48,85,107,133,173,203`

```ts
// ❌ 当前代码
const tenantId = user?.tenantId || user?.id;
```

**风险**: 当 JWT `tenantId` 为 null 时，回退到 `user.id`，导致查询无结果或误操作。

**修复方案**: 统一通过 `getOrganizationIdForUser(user.id)` 获取组织 ID。

### P0-3: `identity-bootstrap.service.ts` 写入已冻结表

**位置**: `services/enterprise/organization/identity-bootstrap.service.ts:54,64`

```ts
// ❌ 写入已冻结的 Organization 和 OrgMember 表
prisma.organization.create(...)
prisma.orgMember.create(...)
```

**修复方案**: 重写为 `governance_organization` + `govUser` 模式。

### P0-4: `enterprise-agent.service.ts` 无组织过滤

**位置**: `services/enterprise/enterprise-agent.service.ts:72`

```ts
// ❌ 仅按 id 查询
const agent = await prisma.enterpriseAgentProfile.findUnique({ where: { id } })
```

**修复方案**: 
```ts
prisma.enterpriseAgentProfile.findFirst({ where: { id, organization_id: orgId } })
```

### P0-5: `outcome.service.ts` 无组织过滤

**位置**: `services/enterprise/intelligence/outcome.service.ts:72,81`

```ts
// ❌ 仅按 actionId 或 id 查询
prisma.enterpriseOutcome.findUnique({ where: { actionId } })
prisma.enterpriseOutcome.findUnique({ where: { id } })
```

**修复方案**: 添加组织上下文参数并过滤。

### P0-6: `channel-account.service.ts` 无组织过滤

**位置**: `services/enterprise/channel/channel-account.service.ts:165,232`

```ts
// ❌ 仅按 id 查询
prisma.enterpriseChannelAccount.findUnique({ where: { id } })
```

**修复方案**: 添加 `organization_id` 过滤。

---

## 四、P1 问题详情

### P1-1: Agent Profile Service 参数名不一致

`listAgents(tenantId)` 实际用于过滤 `tenant_id` 列，但 CTO 冻结原则要求用 `organization_id`。

**修复**: 统一参数名为 `organizationId`，查询 `where: { organization_id: organizationId }`。

### P1-2: enterprise-agent-profiles GET /overview 回退到 user.id

同 P0-2，但此端点仅返回概览数据，风险稍低。

### P1-3: agent-schedule.service.ts 无组织过滤

`prisma.agentGoal.findUnique({ where: { agentId_goalDate_goalType } })` — 无 `organization_id`。

---

## 五、P2 治理改进

### P2-1: 统一 TenantContext 模式

当前_services_用三种方式：
1. `tenantId` parameter + `tenantOnly()` helper ✅
2. `x-organization-id` header + `providerAuthGuard` ✅  
3. 直接 `tenantId` from JWT (without `tenantOnly()`) ⚠️

**修复**: 统一为 `OrgContext` 模式：

```ts
interface OrgContext {
  organizationId: string;
  tenantId: string;
  userId: string;
  role: string;
}

// 在 route 层解析一次，传给所有 service
const ctx = await resolveOrgContext(request);
```

### P2-2: 规范化 Repository Layer

`outcome.service.ts`、`channel-account.service.ts` 直接调 `prisma.*`，缺少 Repository 抽象。

### P2-3: 统一 identify-bootstrap 写入目标

当前写入 `Organization` (deprecated)。统一改为 `governance_organization`。

---

## 六、已验证的正确模式

### ✅ agent-runtime.ts — 标准 TenantGuard

```ts
async function tenantGuard(request, reply) {
  await request.jwtVerify();
  const targetOrgId = request.headers['x-organization-id'];
  const userOrgId = await getOrganizationIdForUser(decoded.id);
  if (userOrgId !== targetOrgId) reply.status(403)...
}
```

### ✅ provider-management.ts — Header 验证同上

### ✅ enterprise-dashboard.ts — URL 验证 + tenantOnly

```ts
app.addHook('preHandler', tenantOwnershipGuard)
// → validateTenantOwnership(urlTenantId, jwtTenantId, userId)
// → prisma.findMany({ where: { tenantId } })
```

### ✅ demo-boundary.ts — 完整的 helper 库

```ts
tenantOnly(tenantId) → { tenantId }
validateTenantOwnership() → { valid, resolvedTenantId }
```

---

## 七、信任边界分析

### 当前信任链

```
用户请求
  ↓
JWT (认证) ✅ 可信
  ↓
tenantId from JWT ✅ 可信
  ↓
URL tenantId ⚠️ 需 tenantOwnershipGuard 验证
  ↓
body.organizationId ❌ 不可信（P0-1）
  ↓
header x-organization-id ⚠️ 需 tenantGuard 验证
```

### 修复后信任链

```
用户请求
  ↓
JWT (认证) ✅
  ↓
getOrganizationIdForUser(jwt.id) ✅ 从 DB 获取
  ↓
所有 Service 调用使用 organizationId ✅
  ↓
所有 Prisma 查询 where: { organization_id } ✅
```

---

## 八、修复计划

### Phase A: P0 立即修复 (1-2 小时)

| Step | 文件 | 修复内容 |
|------|------|---------|
| A1 | `enterprise-agent-profiles.ts` | 新建 `organizationId` 解析，不信任 body |
| A2 | `enterprise-agent-profiles.ts` | 移除 `user.id` fallback |
| A3 | `identity-bootstrap.service.ts` | 停止写入 Organization，改用 governance |
| A4 | `enterprise-agent.service.ts` | `findUnique` → `findFirst` + org filter |
| A5 | `outcome.service.ts` | 添加组织过滤 |
| A6 | `channel-account.service.ts` | `findUnique` → `findFirst` + org filter |

### Phase B: P1 修复 (2-3 小时)

| Step | 文件 | 修复内容 |
|------|------|---------|
| B1 | `enterprise-agent-profile.service.ts` | `tenantId` → `organizationId` |
| B2 | `enterprise-agent-profiles.ts` | 所有端点统一 |
| B3 | `agent-schedule.service.ts` | 添加组织过滤 |

### Phase C: P2 治理 (1 天)

| Step | 操作 |
|------|------|
| C1 | 实现统一 `OrgContext` 接口 |
| C2 | 所有 Enterprise Service 强制接 `OrgContext` |
| C3 | 实现 Repository Layer 抽象 |

---

## 九、验收标准

### P0 修复 Verify

- [ ] POST agent-profiles 不再信任 body.organizationId
- [ ] 所有 tenantId = user?.id fallback 已移除
- [ ] identity-bootstrap 不再写 Organization 表
- [ ] findUnique → findFirst + organization_id filter

### Re-Audit 目标

| 指标 | 当前 | 目标 |
|------|------|------|
| Tenant Guard 覆盖 | ~40% | ≥90% |
| P0 数量 | 6 | 0 |
| 评分 | 68/100 | ≥75/100 |

---

## 十、附录：完整扫描结果

### findMany/findFirst/findUnique 统计

- **总查询数**: ~120+
- **有 tenantId 过滤**: ~60 (50%)
- **有 organization_id 过滤**: ~5 (4%)
- **有 tenantOnly() helper**: ~15 (12%)
- **无过滤 (仅 by ID)**: ~25 (21%)
- **有 tenantGuard 验证**: ~8 个路由

### 路由层认证统计

- **有 preHandler authenticate**: 100% ✅
- **有 tenantOwnershipGuard**: ~15 个路由 ✅
- **有 tenantGuard (header)**: 2 个路由 ✅
- **无额外 Guard**: ~5 个路由 ⚠️
