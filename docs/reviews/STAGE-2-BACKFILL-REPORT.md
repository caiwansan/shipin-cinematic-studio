# Stage 2 — Backfill Complete

**Date:** 2026-07-18  
**Status:** ✅ ALL CHECKS PASSED

---

## 1. Backfill 统计

| 步骤 | 操作 | 记录数 | 状态 |
|------|------|--------|------|
| 2.1 Personal Tenant | 创建 Personal Tenant + governance_user | **43** | ✅ |
| 2.2 Project.type | 回填 type 字段 | **48** (46 video + 2 other → corrected to 8 geo) | ✅ |
| 2.3 tenantId (Project) | SET tenantId FROM user's Personal Tenant | **48** | ✅ |
| 2.3 tenantId (Workspace) | SET tenantId FROM Project | **0** (已无 NULL) | ✅ |
| 2.4 GeoProjectProfile | 创建 Project(type='geo') 行 + 关联 Profile | **8** | ✅ |
| 2.5 GEO 子表 tenantId | 链式 JOIN 回填 14 张子表 | **5** (实际更新数) | ✅ |

## 2. verify-stage2.mjs 校验结果

```
[1] Null Check
  ✅ Project.tenantId NULL: 0
  ✅ Project.type NULL: 0
  ✅ Workspace.tenantId NULL: 0
  ✅ All GEO sub-tables: 0 NULL tenantId

[2] Referential Integrity
  ✅ Orphan Projects (no Tenant): 0
  ✅ Orphan GeoProjectProfiles (no Project): 0

[3] GeoProjectProfile 1:1 Consistency
  ✅ Projects(type=geo): 8 = GeoProjectProfiles: 8

[4] Personal Tenant Coverage
  ✅ Users: 43 = Personal Tenants: 43
```

## 3. NULL/孤儿数据统计

| 检查项 | 结果 |
|--------|------|
| Project.tenantId IS NULL | **0** |
| Project.type IS NULL | **0** |
| Workspace.tenantId IS NULL | **0** |
| GEO 子表 tenantId IS NULL (14 张表) | **0** (全部) |
| Orphan Project (tenantId 指向不存在的 Tenant) | **0** |
| Orphan GeoProfile (指向不存在的 Project) | **0** |

## 4. GeoProjectProfile 1:1 一致性

| 维度 | 数值 |
|------|------|
| Projects(type='geo') | **8** |
| GeoProjectProfiles | **8** |
| 1:1 匹配 | **✅ PASS** |

---

## 旧数据备注

- **kmki_geo_projects** 中 8 个 legacy GEO 项目的 userId 是测试用户名（`test-user-1`、`test-user`、`test`、`e2e-test`），不存在于 User 表，已归入 demo@scs.com 名下
- 这些 legacy GEO 项目的 Project 行均已创建，type='geo'，tenantId 已分配
- kmki_geo_projects 表本身在 Stage 5 清理前保留（旧业务兼容）

## 结论

**Stage 2 全部 6 个条件满足：**
- ✅ Personal Tenant 全覆盖（43/43）
- ✅ Project.type 全覆盖（48/48）
- ✅ tenantId 全覆盖（Project/Workspace/14 子表）
- ✅ GeoProjectProfile 100% 建立（8/8）
- ✅ 子表全部完成回填
- ✅ verify-stage2.mjs 全部通过
- ✅ 无 NULL
- ✅ 无孤儿数据
- ✅ 无重复 Profile

**符合进入 Stage 3 (Dual Write) 的所有条件。**
