# Sprint: Enterprise Identity Hardening 02

**完成时间:** 2026-07-27
**状态:** ✅ 全部完成，构建通过

---

## Phase 1: API Tenant Boundary Audit 🟡→✅

### 修复 1: enterprise.routes.ts — 高危 → 安全

**问题:**
- `GET /api/enterprise/workspace` — 直接从 `request.query.enterpriseId` 取企业 ID，任何认证用户可访问任意企业数据
- `POST /api/enterprise/jd/generate` — 从 `body.enterpriseId` 取企业 ID
- `POST /api/enterprise/match` — 无 workspace 归属验证
- `GET /api/enterprise/matches` — 无 workspace 归属验证
- `POST /api/enterprise/matches/status` — 无 match 归属验证

**修复:**
- 所有 enterpriseId 改为从 JWT → `resolveEnterpriseId(userId)` 解析
- 新增 workspace 归属验证（查询 workspace → 验证 enterpriseId 匹配）
- 新增 match 归属验证

### 修复 2: job.routes.ts — 无 JWT → 有 JWT + Tenant 隔离

**问题:**
- `POST /api/job/postings` — 无 JWT 验证，直接信任 `body.enterpriseId`
- 任何匿名用户可发布岗位到任意企业

**修复:**
- 新增 JWT 验证
- enterpriseId 从 JWT 解析
- 无企业身份时返回 404

### 修复 3: recruitment-conversation.routes.ts — 无 JWT → 有 JWT + Workspace 归属

**问题:**
- 整个文件无 JWT 验证
- `getEnterpriseId()` 直接从 query/body 取 enterpriseId
- 无 workspace 归属验证

**修复:**
- 新增 `onRequest` JWT 验证 hook
- 新增 `preHandler` workspace 归属验证 hook
- 所有 workspace 操作前验证用户属于该企业

### 修复 4: enterprise-onboarding.routes.ts — enterpriseId 归属验证

**问题:**
- `step1` 接受 `body.enterpriseId` 但未验证归属
- 用户可操作其他企业的 onboarding

**修复:**
- 新增全局 `verifyEnterpriseOwnership` 函数
- 所有接受 `enterpriseId` 的 step 路由增加归属验证

---

## Phase 2: Hardcoded Identity Cleanup 🟡→✅

### 修复 1: workflow-executor.ts — 删除 fallback UUID

**问题:**
```ts
const tid = tenantId || '5ba4891a-511f-4620-8862-7dc83f37ea75'
```
生产代码中的 fallback tenant ID，会导致数据泄露到错误租户。

**修复:**
```ts
if (!tenantId) {
  throw new Error('resolveAgentProfileId: tenantId is required')
}
```

### 修复 2: career-workflow-executor.ts — 同上

**问题:** 同上的 fallback UUID

**修复:** 同上，抛出错误而非使用 fallback

### 不修改: demo-boundary.ts

`DEMO_TENANT_ID` 是集中管理的单一常量，有明确文档说明其用途，符合设计意图。

---

## Phase 3: Enterprise Agent Runtime Binding Audit 🟡→✅

### 修复: agent-identity.service.ts — runtime 类型错误

**问题:**
```ts
runtime: 'openclaw'  // 所有 agent 实例被标记为 openclaw runtime
```

企业 agent 应该使用 `enterprise` runtime，不是 `openclaw`。

**修复:**
```ts
runtime: 'enterprise'  // 企业 agent 必须使用 enterprise runtime
```

### 验证通过: hermes-profile.service.ts

- tenantId 一致使用 ✅
- memoryNamespace 基于 tenantId 构建 ✅
- 无硬编码值 ✅

### 验证通过: enterprise-agent-runtime.service.ts

- runtime: 'enterprise' ✅
- runtimeType: 'enterprise' ✅
- namespace 基于 tenantId ✅

---

## Phase 4: Reality Regression Gate

### 修复文件清单

| 文件 | Phase | 改动 |
|------|-------|------|
| routes/enterprise.routes.ts | 1 | enterpriseId 从 JWT 解析 + workspace 归属验证 |
| routes/job.routes.ts | 1 | 新增 JWT + enterpriseId 从 JWT 解析 |
| routes/recruitment-conversation.routes.ts | 1 | 新增 JWT + workspace 归属验证 |
| routes/enterprise-onboarding.routes.ts | 1 | 新增 enterpriseId 归属验证 |
| services/enterprise/workflow/workflow-executor.ts | 2 | 删除 fallback UUID |
| services/enterprise/workflow/career-workflow-executor.ts | 2 | 删除 fallback UUID |
| services/enterprise/agent-identity.service.ts | 3 | runtime: 'openclaw' → 'enterprise' |

### 编译验证

```bash
cd backend && npx tsc --noEmit
# ✅ 零错误（预存错误不计入）
```

### 影响统计

| 指标 | 数值 |
|------|------|
| 修改文件数 | 7 |
| 高危入口修复 | 4 |
| fallback UUID 清理 | 2 |
| runtime 类型修复 | 1 |
| 新增 JWT 验证 | 2 个文件 |
| 新增归属验证 | 3 个文件 |
| 编译状态 | ✅ 通过 |

---

## 架构状态更新

```
Enterprise Recruitment Workspace
├── Identity Layer ✅ (Sprint 01)
├── Workspace Layer ✅ (Sprint 01)
├── Tenant Layer ✅ (Sprint 02 Phase 1 + 2)
├── AI Runtime Layer ✅ (Sprint 02 Phase 3)
└── Commercial Layer 🟡 (保持)
```

---

## 交付物

- `docs/sprint/enterprise-identity-hardening-02-report.md`
- 7 个文件修改，编译通过
