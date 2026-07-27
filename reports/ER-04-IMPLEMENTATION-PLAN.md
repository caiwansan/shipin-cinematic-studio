# ER-04 Hermes Agent Runtime Foundation 实施计划

**Date**: 2026-07-17
**Author**: OpenClaw
**Status**: Implementation In Progress

---

## 实施范围

### TASK-01: Hermes Profile Binding (P0)

**目标**: 建立 `Organization ↔ HermesProfile ↔ Employee` 三元绑定

**新数据模型**: `HermesProfileBinding`

```prisma
model HermesProfileBinding {
  id              String   @id @default(cuid())
  organizationId  String
  workspaceId     String?
  hermesProfileId String   // Herme CLI profile name
  runtimeProvider String   @default("hermes")
  status          String   @default("pending") // pending | active | paused | error
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, workspaceId])
  @@index([hermesProfileId])
}
```

**新 API**:
```
POST   /api/enterprise/hermes-profiles/bind      → 创建绑定
GET    /api/enterprise/hermes-profiles/:orgId     → 查询绑定
DELETE /api/enterprise/hermes-profiles/:orgId     → 删除绑定
PUT    /api/enterprise/hermes-profiles/:orgId     → 更新状态
```

### TASK-02: SOUL.md Template Generator (P0)

**目标**: 根据 Employee Profile 自动生成 Hermes SOUL.md

**模板结构**:
```markdown
# {employeeName} — {roleName}

## Identity
- Role: {role}
- Organization: {orgName}
- Workspace: {workspaceId}

## Mission
{goal}

## Capabilities
{capabilities → bullet list}

## Boundaries
- Organization: {orgId} only
- Data scope: {tools} only
- No cross-tenant access
- No administrative actions

## Execution Rules
- Require approval for destructive actions
- Log all operations to audit trail
- Respect tool permission matrix
```

**新 API**:
```
POST /api/enterprise/hermes-profiles/generate-soul  → 生成 SOUL.md
GET  /api/enterprise/hermes-profiles/:orgId/soul     → 获取当前 SOUL
```

### TASK-03: Tool Permission Router (P0)

**目标**: 根据 Employee Capabilities → Hermes Tool Allow List

**映射模型**:
```
capabilities: ["CRM.read", "CRM.analysis"]
    ↓
hermes_tools: ["crm_read", "crm_analysis", "report_generate"]
    ↓
disabled_toolsets: ["admin", "finance", "delete"]
```

**新 API**:
```
POST /api/enterprise/hermes-profiles/sync-tools  → 同步工具权限
GET  /api/enterprise/hermes-profiles/:orgId/tools → 获取当前权限
```

### TASK-04: Memory Namespace Isolation (P1)

**目标**: 确保 Profile 级 Memory 完全隔离

**实现**: 利用 Hermes 原生 Profile 隔离 + 昆仑镜侧校验

### TASK-05: Runtime Health Monitor (P1)

**目标**: 监控 Hermes Sub-Agent 执行状态

**新 API**:
```
GET /api/enterprise/hermes-profiles/:orgId/health  → Runtime 健康状态
```

---

## 文件清单 (预估)

### 新增后端文件 (8)

| 文件 | 用途 |
| --- | --- |
| `backend/src/services/enterprise/hermes-profile.service.ts` | Profile 绑定 CRUD |
| `backend/src/services/enterprise/soul-generator.service.ts` | SOUL.md 模板生成 |
| `backend/src/services/enterprise/tool-permission.service.ts` | 工具权限映射 |
| `backend/src/services/enterprise/hermes-bridge.service.ts` | Hermes CLI 桥接 |
| `backend/src/routes/hermes-profile.ts` | Profile 绑定 API |
| `backend/src/routes/soul-generator.ts` | SOUL 生成 API |
| `backend/src/routes/tool-permission.ts` | 工具权限 API |
| `backend/prisma/migrations/..._add_hermes_profile_binding.sql` | 新表迁移 |

### 新增前端文件 (5)

| 文件 | 用途 |
| --- | --- |
| `components/enterprise/hermes/HermesProfileCard.vue` | Profile 状态卡片 |
| `components/enterprise/hermes/SoulPreview.vue` | SOUL.md 预览 |
| `components/enterprise/hermes/ToolMatrix.vue` | 工具权限矩阵 |
| `components/enterprise/hermes/RuntimeHealth.vue` | Runtime 健康 |
| `components/enterprise/hermes/HermesBindingWizard.vue` | 绑定向导 |

---

## 架构约束

| 约束 | 状态 |
| --- | --- |
| 昆仑镜拥有控制权 | ✅ |
| API Server 不暴露公网 | ✅ |
| 用户不直接操作 Hermes Profile | ✅ |
| 用户不直接修改 SOUL.md | ✅ |
| 跨租户 Memory 禁止 | ✅ |
| OpenClaw 不进生产 Runtime | ✅ |

---

*OpenClaw — ER-04 Implementation*
