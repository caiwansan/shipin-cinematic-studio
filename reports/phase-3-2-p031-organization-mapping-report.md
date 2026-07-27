# Phase 3.2 — P0-3.1 Organization Mapping Report

> **日期**: 2026-07-17
> **阶段**: P0-3 Organization Architecture Consolidation
> **目标**: 确定唯一 Source of Truth，输出合并方案

---

## 一、双系统全景图

### 1.1 新系统 (enterprise-digital-department 体系)

| 表 | 计数 | 说明 |
|---|---|---|
| `Organization` | 4 | 独立 UUID，无 legacy 关联 |
| `OrgMember` | 3 | 3 个 OWNER |
| `EnterpriseProfile` | 3 | 其中 1 条有 BUG |

**特征**:
- UUID 完全不匹配 governance_organization
- OrgMember 的 userId 在 governance_user 中不存在
- 这是 identity-bootstrap.service.ts 登录时自动创建的

### 1.2 旧系统 (governance 体系)

| 表 | 计数 | 说明 |
|---|---|---|
| `governance_tenant` | 52 | 50 personal + 2 enterprise |
| `governance_organization` | 7 | 全部 type=enterprise, department_role=ai_department |
| `governance_user` | 43 | 全部关联 governance_tenant |

**特征**:
- 这是昆仑镜系统的核心组织模型
- 每个用户通过 email (如 `qq_xxx@aigc.fushtn.com`) 进入 tenant
- governance_organization 是部门级，挂在 tenant 下（如 "Tesla供应链公司" → "Tesla供应链公司 AI部门"）

### 1.3 关系图

```
新系统 (独立):
  Organization (4)
      ↓
  OrgMember (3)
      ↓
  用户 ID 不在 governance_user 中

旧系统 (活跃):
  governance_tenant (52)
      ↓
  governance_organization (7)
  governance_user (43)
```

---

## 二、关键交叉检查

### 2.1 新 Organization 是否在旧 gov_org 中？

| Organization ID | 名称 | 在 gov_org 中？ |
|---|---|---|
| ef97a073... | Beta Test Company | ❌ NO |
| 2adf05ef... | test_auth 的企业 | ❌ NO |
| affc9201... | qq_6F73... 的企业 | ❌ NO |
| 7c703bc3... | qq_7650... 的企业 | ❌ NO |

**结论**: 两个系统完全独立，UUID 对不上。

### 2.2 OrgMember 用户是否在 gov_user 中？

| User ID (OrgMember) | 在 gov_user 中？ |
|---|---|
| 6e476e6a... (test_auth) | ❌ NOT FOUND |
| 0ba5bf98... | ❌ NOT FOUND |
| 1a9b8fb1... | ❌ NOT FOUND |

**结论**: 两个系统的用户 ID 也是独立的。

### 2.3 enterprise_profile.organization_id 指向分析

| Profile ID | organization_id | 指向 |
|---|---|---|
| ff294466... | 6e476e6a... | ❌ **User ID** (BUG!) |
| 6a79012f... | affc9201... | ✅ Organization ID |
| e83c84a8... | 2adf05ef... | ✅ Organization ID |

**结论**: 1 条 Profile 存在历史错误，`organization_id` 写的是 User ID 而非 Org ID。

---

## 三、Enterprise 表 organization_id 审计

### 3.1 缺失 organization_id 的表 (15 张)

| 表 | 行数 | 阻塞程度 |
|---|---|---|
| enterprise_action | 0 | 🟢 空表 |
| enterprise_signal | 0 | 🟢 空表 |
| enterprise_knowledge | 0 | 🟢 空表 |
| enterprise_command | 0 | 🟢 空表 |
| enterprise_recommendation | 0 | 🟢 空表 |
| enterprise_roi_snapshot | 0 | 🟢 空表 |
| enterprise_operation_event | 0 | 🟢 空表 |
| agent_context_memory | 0 | 🟢 空表 |
| agent_goal | 0 | 🟢 空表 |
| agent_session | 0 | 🟢 空表 |
| agent_step_execution | 0 | 🟢 空表 |
| agent_artifact | 0 | 🟢 空表 |
| agent_event | 0 | 🟢 空表 |
| agent_schedule | 0 | 🟢 空表 |
| agent_queue | 0 | 🟢 空表 |

### 3.2 已有 organization_id 的表 (4 张)

| 表 | 说明 |
|---|---|
| enterprise_agent_task | ✅ |
| enterprise_agent_instance | ✅ |
| enterprise_agent_workflow | ✅ |
| enterprise_agent_workflow_step | ✅ |

---

## 四、governance_organization 重复分析

| 名称 | 数量 | 租户 |
|---|---|---|
| AI增长部门 | 2 | Tesla供应链公司, (另一个) |
| 新能源汽车公司 AI部门 | 2 | 新能源汽车公司 (同名) |

**原因**: 同名部门被不同 tenant 创建，数据合理。

---

## 五、问题总结

### 🔴 关键问题

| 编号 | 问题 | 影响 |
|---|---|---|
| P0-3-01 | 双 Organization 系统完全独立 | 无法判断哪个是 Source of Truth |
| P0-3-02 | enterprise_profile 有 1 条 User ID 作为 ORG ID | 数据一致性风险 |
| P0-3-03 | 15 张 Enterprise 表缺 organization_id | Tenant 隔离不完整 |

### 🟡 技术债

| 编号 | 问题 |
|---|---|
| TD-01 | governance_organization 有重复名称 |
| TD-02 | Organization (new) 表缺 slug/ownerId/plan 列（migration 未执行） |
| TD-03 | 新 Organization 系统无治理角色（仅 OWNER） |

---

## 六、CTO 决策项

### 6.1 Source of Truth 选择

**选项 A**: 选 governance_tenant/governance_organization 为 Source of Truth
- ✅ 数据活跃（52 tenant, 43 user, 7 org）
- ✅ 业务正在使用
- ❌ 表名带 "governance_" 前缀
- ❌ 模型名不简洁（GovOrganization）

**选项 B**: 选 Organization 为 Source of Truth
- ✅ 命名简洁
- ✅ 有 OrgMember 关联
- ❌ 数据孤岛（4 org, 3 member, 无关联）
- ❌ migration 未执行（缺列）
- ❌ governance_user 无法关联

**推荐**: **选项 A** (governance 为 Source of Truth)

**理由**: 
- governance 系统有 43 个活跃用户、52 个 tenant、7 个 enterprise
- Organization 系统只有 3 个自动创建的 org，无业务数据
- 迁移方向：将 Organization 的优点（简洁命名、OrgMember）合并进 governance

**Phase 3 这是冻结外的大规模重构，需要 CTO 明确指令后执行。**

---

## 七、迁移方案

### Phase A: 治理修复 (Phase 3 冻结内可执行)

| Step | 操作 |
|---|---|
| 1 | 修复 enterprise_profile 那条 User ID 错误 |
| 2 | 给 15 张空表加 organization_id 列（空表无风险） |
| 3 | 确认 governance_tenant.id 格式（text vs uuid） |

### Phase B: 架构合并 (CTO 审批后)

| Step | 操作 |
|---|---|
| 1 | 创建 `Organization` 视图/别名 → `governance_organization` |
| 2 | 统一 API 层：所有 Org 查询走 governance_organization |
| 3 | 逐步迁移 Organization 数据到 governance_organization |

---

## 八、风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 双系统并行导致数据不一致 | 🔴 HIGH | 确认 Source of Truth 后废弃一套 |
| 空表加列后应用代码不写 org_id | 🟡 MEDIUM | 应用层强制校验 |
| Prisma migration 未执行 | 🟡 MEDIUM | 执行 `prisma migrate deploy` |

---

## 九、下一步

1. **CTO 确认**: governance_tenant/governance_organization 为唯一 Source of Truth
2. **CTO 确认**: Phase A 修复方案
3. **Phase A 执行**: 修复数据 + 加列
4. **输出**: P0-3.2 Migration Plan

---

## 十、附录

### A. 核心 ID 对照表

| 系统 | ID | 名称 |
|---|---|---|
| Organization (new) | 2adf05ef-cafb-4d8e-8b1c-9a7f4994d86f | test_auth 的企业 |
| governance_tenant | (需查) | (test_auth 的 tenant) |
| governance_organization | 27ed3905... | AI增长部门 |

### B. 数据库大小

| 类别 | 表数 | 活跃数据 |
|---|---|---|
| Governance | 14 | ~102 条 |
| Enterprise | 28 | ~91+ 条 (agent profiles) |
| Organization (new) | 3 | ~10 条 |
