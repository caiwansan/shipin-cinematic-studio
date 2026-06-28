# Database Baseline Constitution

> 数据库演化的系统宪法。
> 当前数据库状态是 Canonical Baseline，未来所有 schema 变更必须通过 Migration。

## 宪法条款

### 第 1 条：当前数据库 = 唯一 Baseline

```text
id="baseline-canonic"
production database state = canonical starting point
```

- 不是 `prisma/schema.prisma`
- 更不是历史 SQL 文件
- 禁止任何人以 "历史不一致" 为由手动修改数据库

### 第 2 条：禁止 `prisma db push`

- `prisma db push` 仅允许在开发/测试数据库首次初始化时使用
- 任何生产环境的 schema 变更必须通过 `prisma migrate dev` 创建 migration
- 违规者：git hook 拦截 + team review 失败

### 第 3 条：Baseline Migration 只登记不执行

`20260531_runtime_baseline` 是从 empty → current database 生成的 single migration，职责是：

1. 登记当前所有表结构（171 models）
2. 包含所有索引、外键、唯一约束
3. 不修改数据库一行数据（`migrate diff` 模式）
4. 作为未来所有 migration 的父节点

### 第 4 条：历史漂移不追溯

- 现有的 18 个历史 migration 保留不动
- 不试图补齐缺失的 migration 文件
- 不重建 165 models 的完整演化历史
- 所有缺失的演化步骤视为"不感兴趣的中间状态"

### 第 5 条：Legacy Zone 豁免

以下模块的表不纳入 strict migration governance：

| 模块 | 状态 | 原因 |
|------|------|------|
| Director V2 表 | EXPERIMENTAL | 实验模块 |
| OMS / Kernel 表 | FROZEN | 冻结遗留 |
| Community 表 | ACTIVE | 迁移中 |

豁免不代表不管制，而是允许 `db push` 的紧急变更。但需在 24h 内补 migration。

### 第 6 条：P0/P1 表优先治理

| 优先级 | 表（组） | 门禁 |
|--------|---------|------|
| P0 | User, Auth, Project, PipelineStage, Execution | strict, 禁止非 migration 变更 |
| P0 | ModelConfig (UserModelConfig, UserModelConfigV2) | strict |
| P1 | Asset, Image 相关表 | 核心测试 |
| P2 | Experimental tables | 无门禁 |
| P3 | Lab systems | 无门禁 |

### 第 7 条：Migration Ownership

- 每个 migration 文件必须注明 owner
- P0/P1 表的 migration 需要 2 人 review
- baseline snapshot 由 infra team 维护

---

## 执行规程

### 创建 Baseline

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel=prisma/schema.prisma \
  --script > prisma/migrations/20260531_runtime_baseline/migration.sql
```

### 验证对齐

```bash
npx prisma migrate diff \
  --from-local-database \
  --to-schema-datamodel=prisma/schema.prisma
```

零 diff 即对齐成功。

### 日常开发

```bash
# ❌ 禁止
npx prisma db push

# ✅ 正确
npx prisma migrate dev --name your_change_description
```

---

*成立日期: 2026-05-31*
*版本: v1.0*
