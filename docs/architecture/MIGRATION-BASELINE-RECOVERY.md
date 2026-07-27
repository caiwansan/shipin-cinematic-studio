# Migration Baseline Recovery

> **执行日期**: 2026-07-25
> **执行原因**: 数据库 migration 历史与实际表结构不同步
> **影响范围**: 全部历史 migration（42 条）+ P3 Candidate Domain 新 migration

---

## 1. 问题诊断

### 1.1 现象

```bash
npx prisma migrate dev
# Error: P3006
# Migration 20260325000000_add_region_fields_and_table failed to apply cleanly
# to the shadow database.
# Error code: P1014 — The underlying table for model `User` does not exist.
```

### 1.2 根因

- 数据库实际表结构（415 张表）是通过**手动建表 + 部分 migration 混合方式**建立的
- `_prisma_migrations` 表中仅记录了 3 条 applied，剩余 39 条未 apply
- `migrate dev` 创建空 shadow database 后从头 replay 所有 migration，因最早的 migration SQL 依赖 `User` 表已存在，在空 shadow DB 上必然失败
- 旧 migration SQL 是按"数据库已有完整结构"编写的，缺少 `IF EXISTS` 防御

### 1.3 影响

- 无法使用 `migrate dev` 创建新 migration（shadow DB replay 必然失败）
- `migrate status` 显示大量未 apply，但实际数据库表结构完整
- 新环境无法通过 `migrate deploy` 从零重建数据库

---

## 2. 修复方案：Baseline Recovery

### 2.1 执行步骤

#### Phase 1: Database Reality Snapshot

```bash
# 确认数据库实际状态
node -e "/* 查询 information_schema.tables */"
```

结果：415 张表，3 条 applied migration 记录

#### Phase 2: 标记历史 migration 为 applied

```bash
# 对 39 个未 apply 的 migration 逐个执行
npx prisma migrate resolve --applied "<migration_name>"
```

对 2 个标记为 `failed` 的 migration：
- `20260509100645_add_prompt_memory` → `--applied`
- `20260325000000_add_region_fields_and_table` → 删除 shadow DB 失败残留记录

#### Phase 3: 修复最早 migration 的 SQL

对 `20260325000000_add_region_fields_and_table/migration.sql` 添加 `IF EXISTS`：

```sql
-- 修复前
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provinceCode" TEXT;

-- 修复后
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "provinceCode" TEXT;
```

#### Phase 4: 创建并 apply P3 migration

```bash
# migrate dev 无法使用（shadow DB 问题），改为手动写 SQL
# 创建 migration 目录
mkdir -p prisma/migrations/20260725000000_p3_candidate_domain

# 编写 migration.sql（9 张表 DDL）
# 直接 deploy
npx prisma migrate deploy
```

### 2.2 修复后状态

```
43 migrations found in prisma/migrations
Database schema is up to date! ✅
```

---

## 3. 当前数据库真实状态

| 指标 | 值 |
| --- | --- |
| 总表数 | 424（含 P3 新增 9 张） |
| Applied migrations | 43 |
| P3 表 | 9 张（career_profile / work_experience / education / candidate_resume / candidate_card / skill / candidate_skill / skill_evidence / career_timeline_event） |
| Migration 状态 | 干净（无 failed / pending） |

---

## 4. 后续 migration 规则

### 4.1 新 migration 创建方式

由于 shadow database replay 链断裂，**新 migration 采用手动写 SQL + `migrate deploy`**：

```bash
# 1. 创建 migration 目录
mkdir -p prisma/migrations/<timestamp>_<name>

# 2. 编写 migration.sql（手工 DDL）

# 3. 验证 SQL 语法
npx prisma validate

# 4. Apply
npx prisma migrate deploy
```

**不使用 `migrate dev`**，直到 shadow DB replay 链修复。

### 4.2 SQL 编写规范

- `ALTER TABLE` 必须加 `IF EXISTS`
- `ADD COLUMN` 必须加 `IF NOT EXISTS`
- `CREATE TABLE` 必须加 `IF NOT EXISTS`
- 确保 SQL 可在已有数据库上幂等执行

### 4.3 新环境恢复策略

当前**无法**通过 `migrate deploy` 从零重建完整数据库（旧 migration SQL 不完整）。

新环境恢复方案：
1. 使用 `pg_dump` 从现有数据库导出 baseline
2. 新环境导入 baseline
3. 后续通过 `migrate deploy` 应用增量 migration

---

## 5. 已知限制

| 限制 | 影响 | 优先级 |
| --- | --- | --- |
| 旧 migration 不可 replay | 新环境不能从零 migration 建库 | 中 |
| `migrate dev` 不可用 | 需手动写 migration SQL | 低 |
| shadow DB 验证跳过 | 新 migration 需人工 review SQL | 中 |

---

## 6. 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-07-25 | Baseline Recovery 执行完成，43 条 migration 全部标记为 applied，P3 Candidate Domain migration 应用成功 |
