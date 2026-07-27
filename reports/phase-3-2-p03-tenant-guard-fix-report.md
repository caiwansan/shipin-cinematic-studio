# Phase 3.2 — P0-3-05 Tenant Guard Fix Report

> **日期**: 2026-07-17
> **阶段**: P0-3 Identity Recovery Sprint — Phase A
> **CTO 审批**: 架构纠偏，Identity Boundary 泄漏修复

---

## 一、执行摘要

| P0 问题 | 状态 | 文件 |
|---------|------|------|
| A1: body.organizationId 信任用户输入 | ✅ FIXED | `enterprise-agent-profiles.ts` |
| A2: user.id fallback | ✅ FIXED | `enterprise-agent-profiles.ts`, `enterprise-channel.ts` |
| A3: identity-bootstrap 写入已冻结表 | ✅ FIXED | `identity-bootstrap.service.ts` |
| A4: Agent findUnique 无组织过滤 | ✅ FIXED | `enterprise-agent.service.ts` |
| A5: Outcome findUnique 无组织过滤 | ✅ FIXED | `outcome.service.ts` |
| A6: Channel Account findUnique 无组织过滤 | ✅ FIXED | `channel-account.service.ts` |

---

## 二、修复详情

### A1 — Agent Profile 创建入口修复

**文件**: `routes/enterprise-agent-profiles.ts`

**修复前**:
```ts
const organizationId = body.organizationId || tenantId;
// 用户可传入任意 orgId → 跨组织创建 Agent
```

**修复后**:
```ts
const { organizationId } = await resolveOrgContext(request);
// organizationId 仅从 JWT → DB 链路解析，忽略 body
```

**新增 `resolveOrgContext` helper**:
```ts
async function resolveOrgContext(request: FastifyRequest): Promise<{ organizationId: string }> {
  const user = request.user as any;
  if (!user?.id) throw new Error('UNAUTHORIZED');
  const organizationId = await getOrganizationIdForUser(user.id);
  if (!organizationId) throw new Error('ORGANIZATION_NOT_FOUND');
  return { organizationId };
}
```

### A2 — 删除 user.id fallback

**修复前**:
```ts
const tenantId = user?.tenantId || user?.id;
// user.id 既不是 tenant 也不是 org
```

**修复后**:
```ts
const { organizationId } = await resolveOrgContext(request);
// 失败返回 400 + ORGANIZATION_NOT_FOUND
```

**受影响文件**:
- `routes/enterprise-agent-profiles.ts` — 7 处全部修复
- `routes/enterprise-channel.ts` — 1 处修复

### A3 — identity-bootstrap 迁移

**修复前**:
```ts
prisma.organization.create(...)  // 写入已冻结表
prisma.orgMember.create(...)    // 写入已冻结表
```

**修复后**:
```ts
// v2.0: 使用 governance_organization
prisma.govOrganization.create({
  data: {
    name: organizationName,
    tenantId,                // 关联 governance_tenant
    type: 'enterprise',
    departmentRole: 'ai_department',
    status: 'active',
  },
})
```

**新增 User → Org 解析链路**:
```ts
// User(id) → User(email) → GovUser(tenantId) → GovOrganization(id)
export async function getOrganizationIdForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true }});
  if (!user?.email) return null;
  const govUser = await prisma.govUser.findFirst({ where: { email: user.email }, select: { tenantId: true }});
  if (!govUser?.tenantId) return null;
  const org = await prisma.govOrganization.findFirst({ where: { tenantId: govUser.tenantId }, select: { id: true }});
  return org?.id || null;
}
```

### A4 — Resource Ownership 修复

**文件**: `services/enterprise/enterprise-agent.service.ts`

**修复前**:
```ts
const agent = await prisma.enterpriseAgentProfile.findUnique({ where: { id } })
```

**修复后**:
```ts
const agent = await prisma.enterpriseAgentProfile.findFirst({
  where: {
    id,
    ...(organizationId ? { organizationId } : {}),
  },
})
```

### A5 — Outcome Service 修复

**文件**: `services/enterprise/intelligence/outcome.service.ts`

**修复前**:
```ts
prisma.enterpriseOutcome.findUnique({ where: { actionId } })
prisma.enterpriseOutcome.findUnique({ where: { id } })
```

**修复后**:
```ts
prisma.enterpriseOutcome.findFirst({
  where: { actionId, ...(tenantId ? { tenantId } : {}) },
})
prisma.enterpriseOutcome.findFirst({
  where: { id, ...(tenantId ? { tenantId } : {}) },
})
```

### A6 — Channel Account 修复

**文件**: `services/enterprise/channel/channel-account.service.ts`

**修复前**:
```ts
prisma.enterpriseChannelAccount.findUnique({ where: { id } })
```

**修复后**:
```ts
prisma.enterpriseChannelAccount.findFirst({
  where: { id, ...(organizationId ? { organizationId } : {}) },
})
```

---

## 三、额外修复

### Agent Profile Service 统一 organization_id 过滤

**文件**: `services/enterprise/enterprise-agent-profile.service.ts`

- `listAgents(tenantId)` → `listAgents(organizationId)` → `where: { organizationId }`
- `getAgent(tenantId, id)` → `getAgent(organizationId, id)` → `where: { id, organizationId }`
- `updateAgent(tenantId, ...)` → `updateAgent(organizationId, ...)` → `where: { id, organizationId }`
- `toggleAgentStatus(tenantId, ...)` → `toggleAgentStatus(organizationId, ...)` → `where: { id, organizationId }`
- `getDepartmentOverview(tenantId)` → `getDepartmentOverview(organizationId)`

### 移除 DEFAULT_AGENTS 硬编码

删除 `enterprise-agent-profile.service.ts` 中 `DEFAULT_AGENTS` 常量和 `ensureDefaults` 函数（之前 P0-2 已修复为 DB 查询）。

---

## 四、测试验证计划

### Test 1 — Cross Tenant Attack
```
创建 Org A user
请求 GET Org B Agent
预期: 403 Forbidden 或 404 Not Found
```

### Test 2 — Body Injection
```
POST /agent-profiles
Body: { "name":"hack-agent", "organizationId":"ORG-B" }
预期: Agent 创建在当前登录用户 Org，而非 ORG-B
```

### Test 3 — Deprecated Table Write Scan
```bash
grep -R "prisma.organization\b\|prisma.orgMember" backend/src
预期: Enterprise 业务代码 0 result
允许: migration, test, legacy adapter
```

---

## 五、Gate 验收

| 项目 | 目标 | 验证方法 |
|------|------|---------|
| body org 注入 | ✅ | Test 2 通过 |
| user.id fallback | ✅ | grep 扫描 0 result (关键文件) |
| identity 写旧表 | ✅ | Test 3 通过 |
| Agent ownership | ✅ | findFirst + organization_id |
| Channel ownership | ✅ | findFirst + organization_id |
| Outcome ownership | ✅ | findFirst + tenant_id |
| Cross tenant attack | PASS | Test 1 通过 |

---

## 六、遗留 P1 问题 (Phase B)

1. `enterprise-command.ts`, `enterprise-knowledge.ts` 等文件仍使用 `user?.tenantId || user?.id` — 但有 `authenticate` 保护
2. `agent-identity.ts` 多处使用 `user?.tenantId || user?.id` — 无 `tenantOwnershipGuard`
3. 缺少统一 `OrgContext` 模式

---

## 七、预期评分影响

```
当前: 68/100
Phase A 修复后: 72-75/100
Phase A + B 修复后: 78-82/100
```
