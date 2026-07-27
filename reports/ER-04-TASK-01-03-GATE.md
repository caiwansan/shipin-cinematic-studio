# ER-04-TASK-01/02/03 Gate Report — Hermes Runtime Foundation

**CTO Review**: ER-04 Implementation Phase
**Status**: ✅ PASSED
**Date**: 2026-07-17
**Author**: OpenClaw (AI CTO Office)

---

## 验收矩阵

| 检查项 | 状态 |
| --- | --- |
| HermesProfileBinding 数据模型 | ✅ |
| Profile Binding CRUD API | ✅ |
| SOUL.md 模板生成器 | ✅ |
| SOUL.md 预览 + 保存 API | ✅ |
| Tool Permission Matrix 生成 | ✅ |
| Tool Allow List 同步 API | ✅ |
| 组织隔离 (organizationId 全链路) | ✅ |
| Identity Boundary 保持 | ✅ |
| 无 Runtime 越权 | ✅ |
| Prisma 模型生成 | ✅ |
| 路由注册 | ✅ |

---

## 1. 文件清单

### 新增后端文件 (6)

| 文件 | 行数 | 用途 |
| --- | --- | --- |
| `services/enterprise/hermes-profile.service.ts` | ~200 | Profile Binding CRUD |
| `services/enterprise/soul-generator.service.ts` | ~230 | SOUL.md 模板生成 |
| `services/enterprise/tool-permission.service.ts` | ~190 | Tool 权限映射 |
| `routes/hermes-profile.ts` | ~180 | Binding API |
| `routes/soul-generator.ts` | ~120 | SOUL 生成 API |
| `routes/tool-permission.ts` | ~100 | Tool 权限 API |

### 修改文件 (2)

| 文件 | 修改内容 |
| --- | --- |
| `prisma/schema.prisma` | 新增 HermesProfileBinding 模型 |
| `src/index.ts` | 注册 3 个新路由 |

---

## 2. 新增 API

### Hermes Profile Binding

```
POST   /api/enterprise/hermes-profiles/bind      → 创建绑定
GET    /api/enterprise/hermes-profiles/:orgId     → 查询绑定
GET    /api/enterprise/hermes-profiles/:orgId/list → 列出绑定
PUT    /api/enterprise/hermes-profiles/:orgId     → 更新状态/SOUL/Tools
DELETE /api/enterprise/hermes-profiles/:orgId     → 删除绑定
```

### SOUL.md Generator

```
POST /api/enterprise/soul-generator/generate  → 生成 + 保存
GET  /api/enterprise/soul-generator/:agentId  → 获取已保存
POST /api/enterprise/soul-generator/preview   → 仅预览
```

### Tool Permission

```
POST /api/enterprise/tool-permissions/generate  → 生成矩阵
POST /api/enterprise/tool-permissions/sync      → 同步到 Binding
GET  /api/enterprise/tool-permissions/:orgId    → 获取权限
```

---

## 3. HermesProfileBinding 数据模型

```prisma
model HermesProfileBinding {
  id              String   @id
  organizationId  String   // 组织隔离
  workspaceId     String?  // 可选工作区
  hermesProfileId String   // Hermes CLI profile name
  runtimeProvider String   @default("hermes")
  status          String   @default("pending")
  soulMdContent   String?  // 生成的 SOUL.md
  toolAllowList   String   // JSON array
  metadata        String   // JSON
  createdAt       DateTime
  updatedAt       DateTime

  @@unique([organizationId, workspaceId])
  @@index([hermesProfileId])
  @@map("hermes_profile_binding")
}
```

---

## 4. SOUL.md 模板示例

```markdown
# 销售增长官 — 增长总监 @ 企业A

## Identity
- Role: 增长总监
- Organization: 企业A
- Agent ID: agent_xxx

## Mission
负责企业收入增长

## Responsibilities
- 分析销售数据，发现增长机会
- 预测客户行为，识别高价值客户
- 根据客户需求自动生成报价方案

## Capabilities
- 销售分析
- 客户预测
- 自动报价
- CRM 数据读写

## Boundaries
- Organization: org_xxx only
- No cross-tenant data access
- No cross-organization memory sharing
- No unauthorized data export
- No administrative actions
- No system configuration changes
- Require approval for destructive actions
- Log all operations to audit trail
- Respect tool permission matrix

## Execution Rules
- Verify organization context before any action
- Require CEO approval for data deletion
- Rate limit: max 100 API calls per hour
- Escalate failures after 3 retries
- Maintain audit trail for all operations
- Report outcome to KunLunJing after completion

## Persona
- Personality: 战略思维、结果导向
- Communication Style: 专业、简洁、数据驱动
- Language: 中文为主
```

---

## 5. Tool Permission Matrix 示例

```json
{
  "agentId": "agent_xxx",
  "capabilities": ["销售分析", "客户预测", "自动报价"],
  "tools": ["CRM读写", "客户分析", "方案生成"],
  "hermesToolAllowList": [
    "crm_read", "analytics_query", "report_generate",
    "ml_predict", "data_query", "pricing_calculate",
    "document_generate", "crm_write", "crm_update"
  ],
  "hermesDisabledToolsets": [
    "admin", "system_config", "delete_operations",
    "finance_tools", "destructive_operations",
    "data_export", "admin_tools",
    "user_management", "permission_management",
    "cross_tenant_access"
  ],
  "riskLevel": "medium"
}
```

---

## 6. Identity 审计

| 检查项 | 状态 |
| --- | --- |
| JWT 认证 | ✅ authenticate hook |
| organizationId 来自 JWT | ✅ getOrganizationIdForUser() |
| 禁止 URL tenantId | ✅ 路由参数仅 orgId |
| 禁止 body.organizationId | ✅ 从 JWT 派生 |
| 禁止 user.id fallback | ✅ 全链路 organizationId |
| 组织级隔离 | ✅ findFirst({ organizationId }) |
| 跨组织访问禁止 | ✅ orgId 匹配校验 |
| 无 Runtime 越权 | ✅ 仅 Binding 操作 |

---

## 7. 架构约束

| 约束 | 状态 |
| --- | --- |
| 昆仑镜拥有控制权 | ✅ |
| API Server 不暴露公网 | ✅ |
| 用户不直接操作 Hermes Profile | ✅ |
| 用户不直接修改 SOUL.md | ✅ (通过 API 生成) |
| 跨租户 Memory 禁止 | ✅ (Profile 隔离) |
| OpenClaw 不进生产 Runtime | ✅ |

---

## ER-04-TASK-01/02/03 验收结论

**Hermes Runtime Foundation 完成 ✅**

- Profile Binding CRUD ✅
- SOUL.md 模板生成 ✅
- Tool Permission Matrix ✅

**等待 CTO Review 后进入 ER-04-TASK-04 (Memory Namespace Isolation) + TASK-05 (Runtime Health Monitor)。**

---

*OpenClaw — Enterprise Engineering*
*ER-04-TASK-01/02/03 Gate: PASSED ✅*
