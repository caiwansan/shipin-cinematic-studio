# 手动 SQL 整合分析报告

## 总览

| 文件 | 大小 | 状态 |
|------|------|------|
| `add_image_prompt_templates.sql` | 3.6 KB | ✅ Schema 已覆盖 |
| `add_resilience.sql` | 1.2 KB | ✅ Schema 已覆盖 |
| `add_user_model_config_v2.sql` | 4.4 KB | ✅ Schema 已覆盖 |
| `add_user_model_config_v2_llm.sql` | 347 B | ✅ Schema 已覆盖 |
| `cleanup_zombie_tables.sql` | 11.1 KB | ⚠️ 已执行，部分表仍在 schema 中 |
| `step6_shadow.sql` | 6.3 KB | ✅ Schema 已覆盖 |
| `upgrade_six_dimension_prompt.sql` | 4.6 KB | ✅ 数据更新，不影响 schema |

---

## 详细分析

### 1. `add_image_prompt_templates.sql` ✅
- **操作**: 创建 `image_prompt_templates` 表并插入种子数据
- **Schema**: model `ImagePromptTemplates` 已定义 (map: `image_prompt_templates`)
- **建议**: 可安全删除此 .sql 文件，schema.prisma 已完整覆盖结构

### 2. `add_resilience.sql` ✅
- **操作**: 给 `VideoTask` 加字段 + 索引，给 `TaskLog` 加 `eventId`，给 `Asset` 加 `taskId`
- **Schema**: 所有字段已在 schema 中有定义（`idempotencyKey`、`heartbeatAt`、`lockedBy`、`retryCount`、`maxRetries`、`completedAt`、`TaskLog.eventId`、`Asset.taskId`）
- **建议**: 可安全删除此 .sql 文件，schema 已覆盖

### 3. `add_user_model_config_v2.sql` ✅
- **操作**: 创建 `UserModelConfigV2` 表 + 迁移旧数据
- **Schema**: model `UserModelConfigV2` 已定义
- **建议**: 可安全删除此 .sql 文件

### 4. `add_user_model_config_v2_llm.sql` ✅
- **操作**: 给 `UserModelConfigV2` 加 LLM 相关字段
- **Schema**: `llmProvider`、`llmApiKey`、`llmModel`、`llmEnabled` 已在 schema 中
- **建议**: 可安全删除此 .sql 文件

### 5. `cleanup_zombie_tables.sql` ⚠️
- **操作**: DROP TABLE 95 个僵尸表（涉及 OMS 世界观、Kernel 系统等）
- **风险**: 执行后**部分表仍在 schema.prisma 中保留 model 定义**，包括：
  - `World`, `Observer`, `Event`, `NarrativeScene`, `Character`

- **建议**: 
  - 此文件是**一次性执行**的清理脚本，不需要再执行
  - 如果数据库中的这些表已被删除，schema 中的对应 model 需要标注 `@ignore` 或删除
  - 为防止 `npx prisma db push` 尝试重建这些表，建议在 schema 中给这些 model 添加 `@@ignore()`
  - **当前不需要删除此 .sql 文件**，但需要跟进处理 schema vs 数据库不一致问题

### 6. `step6_shadow.sql` ✅
- **操作**: 创建 5 张 Shadow Layer 表（`ShadowConfig`、`ShadowExecutionLog`、`ShadowDiffResult`、`ShadowDriftHistory`、`CostBudget`）+ 种子数据
- **Schema**: 所有 5 个 model 均已定义
- **建议**: 可安全删除此 .sql 文件

### 7. `upgrade_six_dimension_prompt.sql` ✅
- **操作**: `UPDATE "PromptTemplate"` 更新 prompt 内容
- **Schema**: 不影响结构，纯数据操作
- **建议**: 可安全删除此 .sql 文件（已执行的 SQL 无需保留）

---

## 结论

| 状态 | 数量 | 文件 |
|------|------|------|
| ✅ 可安全删除 | 6 | `add_image_prompt_templates.sql`, `add_resilience.sql`, `add_user_model_config_v2.sql`, `add_user_model_config_v2_llm.sql`, `step6_shadow.sql`, `upgrade_six_dimension_prompt.sql` |
| ⚠️ 需要跟进 | 1 | `cleanup_zombie_tables.sql` |

### 跟进项
1. `cleanup_zombie_tables.sql` 删除的 95 个表中有部分（World/Observer/Event/NarrativeScene/Character）仍在 schema 中有 model 定义
2. 建议在 schema 中给这些僵尸 model 添加 `@@ignore()` 注解，避免 `prisma db push` 重建空表
3. 或者运行 `npx prisma db pull` 重新生成 schema 以匹配实际数据库状态
