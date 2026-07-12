# Audit L: 数据库审计 (DatabaseAudit.md)

## 1. Prisma Schema 概览

| 指标 | 数值 |
|------|------|
| 模型总数 | 324 |
| 枚举类型 | 若干 |
| 关系类型 | @relation |
| @@map 使用 | 部分 |
| 文件大小 | 6,174 行 |

## 2. 索引审计

### 2.1 索引缺失 — CRITICAL

**所有 324 个模型中，0 个有自定义索引。**

每个模型仅有默认的 `@id` 主键索引:
- `@id` 自动创建主键索引 ✅
- 无任何 `@@index` 或 `@@unique`（除主键外）

**影响**: 所有非主键查询执行全表扫描:
- `findMany` where 条件 → 全表扫描
- `findFirst` where 条件 → 全表扫描
- 排序 → 全表扫描
- 联表查询 → 全表扫描

**示例证据**: 
```prisma
model User {
  id        String   @id @default(uuid())  // 只有主键索引
  email     String?  // ❌ 无索引，email 查询全表扫描
  phone     String?  // ❌ 无索引
  name      String?  // ❌ 无索引
  // ...
}
```

### 2.2 应添加索引的字段

| 模型 | 字段 | 理由 |
|------|------|------|
| User | email, phone, role | 登录/查询 |
| Project | userId, status, type, createdAt | 列表查询/过滤 |
| Asset | projectId, type, userId | 资源查询 |
| all models | createdAt, updatedAt | 排序/时间范围查询 |
| all FK fields | userId, projectId, taskId | 联表查询 |

## 3. 孤立表审计

### 3.1 无任何关系的模型 (51+)

以下模型未与任何其他模型建立 `@relation`:

```
AiStageModelConfig, Captcha, SmsCode, EmailCode, ImagePromptTemplates,
StyleProfile, PromptTemplate, UniverseCluster, MemberPlan, AgentLevelConfig,
WorkerRegistration, DeadLetterTask, AiRoutingPolicy, AiTaskTypeMapping,
AiExecutionLog, AiCircuitBreaker, AiSandboxLog, AiTimeoutConfig,
ShadowConfig, ShadowDriftHistory, CostBudget, SystemMetric, StabilitySession,
PromptMemory, ApiKey, ModelProvider, VoicePreset, AdminUser, AssetDna,
AssetLineage, AssetReference, ContributionWeight, RevenueSplit,
AssetTransaction, CreatorWallet, ModerationQueue, PaymentConfig,
PaymentSecret, PaymentOrder, AssetRights, UserLimit, TaskQueue,
TaskExecution, AgentExecutionLog, CommissionConfig, AgentPlan,
AgentWithdraw, DAGGraph, DAGState, GPUNode, ...
```

### 3.2 未在代码中引用的模型 (51+)

通过搜索 `backend/src/` 中未引用模型名（大小写敏感）：

见 Audit S 中 DatabaseCleanupAudit 部分。
扫描结果: 至少 51 个模型在 `backend/src/` 中无代码引用。

## 4. 重复字段

### 4.1 status 字段重复定义

多个模型有 `status` 字段但含义不同:
- `Project.status` — 项目状态
- `Workflow.status` — 工作流状态
- `Task.status` — 任务状态
- `WorkflowInstance.status` — 实例状态
- 更多...

### 4.2 type/kind/category 字段

多个模型有类似含义字段命名不一致:
- `type`, `kind`, `category`, `class`, `classification` — 混用

### 4.3 时间字段不一致

- `createdAt` vs `created_at` — @@map 部分处理
- `updatedAt` vs `updated_at` — @@map 部分处理

## 5. Cascade 删除风险

### 5.1 发现 >=20 条 onDelete: Cascade

```
User 删除 → Project / Asset / SceneImage / ... 全部级联删除
Project 删除 → 15+ 子表级联删除
Task 删除 → VideoTask 子表级联删除
```

**风险**: 误删除 User 或 Project 将级联删除大量数据且不可恢复。

### 5.2 高风险 Cascade 链

```
User (delete) 
  → Project (Cascade) 
    → Scene (Cascade) 
      → SceneImage (Cascade)
    → CharacterProfile (Cascade) 
      → CharacterImage (Cascade)
    → VideoTask (Cascade) 
      → VideoSegment (Cascade)
```

## 6. 约束缺失

| 约束类型 | 现状 |
|---------|------|
| UNIQUE | 部分模型有 @@unique |
| NOT NULL | ✓ 有默认 |
| DEFAULT | ✓ 大部分有 |
| CHECK | ❌ Prisma 不支持 |
| ENUM | ⚠️ 部分使用字符串 |
| 索引 | ❌ 全部缺失 |

## 7. @@map 不一致

许多模型的 `@@map` 将 PascalCase 转为 snake_case:
```prisma
model PromptTemplate {
  @@map("prompt_template")
}
```
但部分模型没有 `@@map`，导致 Prisma 模型名直接作为表名:
```prisma
model Captcha {
  // 无 @@map → 表名 "Captcha" (PascalCase)
}
```

## 8. 建议

1. **立即添加索引**: 
   - 所有外键字段添加 `@@index`
   - 常见查询字段(createdAt, status, type) 添加索引
   - 使用 `prisma db push` 前用 `prisma validate` 检查

2. **约束强化**:
   - 所有 String 类型的状态字段改为枚举
   - 使用 `@@unique` 约束业务唯一键
   - 评估并设置合理的 Cascade 策略 (RESTRICT/SET NULL)

3. **清理孤立模型**: 
   - 删除未引用的模型
   - 为需要保留的模型添加关系

4. **统一命名**:
   - 所有模型添加 `@@map` 为带有 `_scs_` 前缀的 snake_case
   - 统一 `createdAt`/`updatedAt` 命名
