# Phase 3.2 — P0-3 Identity Recovery Sprint Report

> **日期**: 2026-07-17
> **阶段**: P0-3 Organization Architecture Consolidation
> **执行**: P0-3-01 → P0-3-04

---

## 执行摘要

| 任务 | 状态 |
|------|------|
| P0-3-01 冻结 Organization 新模型 | ✅ 已标记 |
| P0-3-02 Governance → Enterprise 映射 | ✅ 完成 |
| P0-3-03 修复 enterprise_profile | ✅ 完成 |
| P0-3-04 15 表增加 organization_id | ✅ 完成 |
| P0-3-05 Enterprise API Tenant Guard 审计 | ⏳ 待执行 |
| P0-3-06 重新跑 Phase 3.2 Audit | ⏳ 待执行 |

---

## P0-3-01 冻结 Organization 新模型

### 决策

- **Source of Truth**: `governance_organization` (id: TEXT)
- **废弃**: `Organization` 和 `OrgMember` 作为业务身份来源
- **保留**: `enterprise_profile` 作为治理层 Profile

### 影响范围

- 禁止 `Organization.create()` / `OrgMember.create()`
- 新增统一入口: `governanceOrganizationService`
- 现有 API 通过 `GovernanceOrgAdapter` 调用新身份层

---

## P0-3-02 Governance → Enterprise 映射

### 核心映射

| Entity | Table | ID Type |
|--------|-------|---------|
| Tenant | `governance_tenant` | TEXT |
| Organization | `governance_organization` | TEXT |
| User | `governance_user` | TEXT |
| Profile | `enterprise_profile` | UUID (FK → gov_org) |
| Agent | `enterprise_agent_profile` | UUID (FK → gov_org) |

### 关键发现

- `governance_organization.id` 为 TEXT 类型
- `Organization.id` 为 UUID 类型 → 类型不兼容
- 需要 TEXT 类型 organization_id 关联

---

## P0-3-03 修复 enterprise_profile

### 修复内容

- **问题**: profile ff294466 的 organization_id 错误指向 User ID
- **修复**: 删除该重复记录（已有 e83c84a8 覆盖同一组织）
- **验证**: 现有 2 条 profile 均指向有效 Organization ID

### 修复后状态

```
e83c84a8 → 2adf05ef (test_auth)
6a79012f → affc9201 (qq_user)
```

---

## P0-3-04 Schema 加固

### 15 张表新增 organization_id

| 表 | 类型 | 外键 | 索引 |
|---|---|---|---|
| enterprise_action | TEXT | ✅ | ✅ |
| enterprise_signal | TEXT | ✅ | ✅ |
| enterprise_knowledge | TEXT | ✅ | ✅ |
| enterprise_command | TEXT | ✅ | ✅ |
| enterprise_recommendation | TEXT | ✅ | ✅ |
| enterprise_roi_snapshot | TEXT | ✅ | ✅ |
| enterprise_operation_event | TEXT | ✅ | ✅ |
| agent_context_memory | TEXT | ✅ | ✅ |
| agent_goal | TEXT | ✅ | ✅ |
| agent_session | TEXT | ✅ | ✅ |
| agent_step_execution | TEXT | ✅ | ✅ |
| agent_artifact | TEXT | ✅ | ✅ |
| agent_event | TEXT | ✅ | ✅ |
| agent_schedule | TEXT | ✅ | ✅ |
| agent_queue | TEXT | ✅ | ✅ |

### 外键引用

所有外键 → `governance_organization(id)`

---

## 验证

### Before

```sql
enterprise_action: ❌ MISSING org_id
enterprise_signal: ❌ MISSING org_id
...
```

### After

```sql
enterprise_action: ✅ org_id (TEXT, FK → gov_org)
enterprise_signal: ✅ org_id (TEXT, FK → gov_org)
...
```

---

## 下一步

1. **P0-3-05**: Enterprise API Tenant Guard 审计
2. **P0-3-06**: 重新跑 Phase 3.2 Audit
3. **评分预测**: 68 → 75/100
