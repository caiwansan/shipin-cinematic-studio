# TENANT-CONVERGENCE-REPORT.md
## 版本: B.3 FINAL
## 日期: 2026-07-23
## 审计方: OpenClaw Agent + CTO Review

---

## 执行摘要

### 结论
Tenant Authority Converged ✅

### 核心指标
| 指标 | 数值 | 状态 |
|------|------|------|
| governance_tenant 总量 | 57 | — |
| 新建 Organization | 57 | ✅ |
| 映射记录 | 57 | ✅ |
| Organization 总数 | 59 (2 原有) | ✅ |
| 服务影响 | 无 | ✅ |

---

## 迁移方案

```
governance_tenant (57 行, TEXT id, 全部 orphan)
    │
    └── 每行 → 新建 Organization (UUID id) + tenant_authority_map 映射
    
策略：
- governance_tenant.id 是 TEXT 格式（非 UUID），不能直接迁移
- 为每个 governance_tenant 创建新的 Organization（新 UUID）
- tenant_authority_map 建立 TEXT → UUID 映射
- 后续 API 通过映射表关联
```

---

## 数据结构

### tenant_authority_map（新建）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| governance_tenant_id | TEXT | → governance_tenant.id |
| organization_id | UUID | → Organization.id |
| status | VARCHAR(16) | migrated / existing |
| migrated_at | TIMESTAMP | 迁移时间 |

### Organization（原有 + 新增）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | TEXT | 租户名称 |
| slug | TEXT | migrated-{hash} |
| plan | TEXT | free / professional |

### 验证查询
```sql
-- 总数
SELECT 'governance_tenant' as tbl, COUNT(*) FROM governance_tenant
UNION ALL
SELECT 'Organization', COUNT(*) FROM "Organization"
UNION ALL
SELECT 'Mappings', COUNT(*) FROM tenant_authority_map;

-- 结果: governance_tenant=57, Organization=59, Mappings=57

-- 映射样例
SELECT 
    gt.id as gov_id,
    gt.name as gov_name,
    o.id as org_id,
    o.name as org_name
FROM tenant_authority_map tam
JOIN governance_tenant gt ON tam.governance_tenant_id = gt.id
JOIN "Organization" o ON tam.organization_id = o.id
LIMIT 5;
```

---

## 验证结果

| 检查项 | 状态 | 证据 |
|--------|:----:|------|
| tenant_authority_map 表 | ✅ | 57 条记录 |
| Organization 新增 | ✅ | 57 行（59 - 2 原有） |
| 映射完整性 | ✅ | 57/57 全覆盖 |
| 数据一致性 | ✅ | governance_tenant 名 → Organization.name |

---

## 下一步

- [ ] 后续 API 使用 Organization.id（通过映射表关联 governance_tenant）
- [ ] 新租户创建只走 Organization
- [ ] governance_tenant 写入已冻结（Day 2 Authority Freeze 已部署）
- [ ] 当所有 governance_* 表无新写入时，归档到历史库

---

*本报告由 OpenClaw Agent 生成，经 CTO Review 复核确认。*
