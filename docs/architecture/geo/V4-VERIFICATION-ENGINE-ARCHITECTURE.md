# GEO v4 Verification Engine — Architecture Freeze

> 版本: v4.0.0  
> 状态: **FROZEN**（评审通过前不得实施）  
> 定位: Truth Layer — 证明优化是否真实有效  
> 所有提升必须来自实际重新评分，禁止前端模拟  
> 扩展闭环: Recommendation → Optimization → Verification → **Publishing** → Monitor → Learn

---

## 目录

1. [Domain 结构](#1-domain-结构)
2. [数据模型](#2-数据模型)
3. [数据流](#3-数据流)
4. [API 契约](#4-api-契约)
5. [与现有模块的关系](#5-与现有模块的关系)
6. [Growth Memory 模型](#6-growth-memory-模型)
7. [Publishing / Knowledge Distribution](#7-publishing--knowledge-distribution)
8. [分阶段实施计划](#8-分阶段实施计划)
9. [报告标准](#9-报告标准报告标准)

---

## 1. Domain 结构

```
backend/src/
├── platform/                       # v4 共享平台基础设施
│   ├── state-machine/              # 🆕 统一状态机（Freeze④）
│   │   ├── state-machine.ts            # 所有状态机定义 + 注册
│   │   ├── transition-validator.ts     # 状态转换验证
│   │   └── status-enum.ts              # 统一状态枚举
│   ├── repository/                 # 🆕 统一 Repository 接口（Freeze⑤）
│   │   ├── verification-repo.interface.ts
│   │   ├── publishing-repo.interface.ts
│   │   └── growth-repo.interface.ts
│   ├── event-bus/                  # 🆕 Domain Event Bus（Freeze⑥）
│   │   ├── event-bus.ts
│   │   ├── event-types.ts
│   │   └── subscribers/
│   │       ├── growth-memory.subscriber.ts
│   │       ├── learning.subscriber.ts
│   │       └── publishing.subscriber.ts
│   └── version/                    # 🆕 版本策略（Freeze⑦）
│       ├── version-manager.ts
│       └── version-registry.ts
│
backend/src/services/geo/
├── verification/                  # v4 验证引擎
│   ├── verification.types.ts          # 类型定义（含 JobStatus, TriggerSource, Confidence 等）
│   ├── verification.types.ts          # 🆕 VerificationJobRunner 接口定义
│   ├── verification.repository.ts     # DB 访问层
│   ├── verification.service.ts        # 核心业务逻辑
│   ├── verification-engine.ts         # 验证引擎编排（依赖 JobRunner 接口，不依赖具体 Queue）
│   ├── verification-job.service.ts    # 🆕 VerificationJobRunner 实现（异步任务状态机 + 重试 + 幂等）
│   └── verification.route.ts          # Fastify 路由注册
│
├── publishing/                    # 🆕 v4 发布引擎
│   ├── publishing.types.ts            # 🆕 PublishingAdapter 接口定义
│   ├── publishing.service.ts          # 🆕 发布业务逻辑（依赖 AdapterRegistry，不直接调用 Adapter）
│   ├── publishing-registry.ts         # 🆕 PublishingAdapterRegistry（register + resolve + list）
│   ├── adapters/                      # 🆕 各平台适配器
│   │   ├── website.adapter.ts
│   │   ├── wordpress.adapter.ts
│   │   ├── shopify.adapter.ts
│   │   └── knowledge-base.adapter.ts
│   ├── publishing-pipeline.ts         # 🆕 发布流水线编排
│   └── publishing.route.ts            # 🆕 Fastify 路由注册
│
├── growth/                        # v3 增长引擎（已有）
│   ├── learning-engine.ts             # 🆕 统一学习引擎（v4 新增，Phase 6 实现）
│   ├── learning-signal.service.ts     # 🆕 LearningSignal 持久化服务
│   └── growth-knowledge.service.ts    # 🆕 GrowthKnowledge 服务（P1）
│
├── policy/                        # 🆕 v4 策略管理
│   └── verification-policy.service.ts # VerificationPolicy（配置化 minimumDelta 等）
│
├── event/                         # 🆕 v4 事件溯源（预留）
│   └── verification-event.service.ts  # VerificationEvent（事件溯源预留）
```

### 不变约束
- 不修改 v1/v2/v3 公共接口
- 不破坏现有 API
- 所有验证独立模块，可单独部署

---

## 2. 数据模型

### 2.1 OptimizationExecution（新增表）

```prisma
model OptimizationExecution {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  
  // 执行信息
  optimizationType String   @map("optimization_type")  // faq | schema | knowledge | brand_story | organization_schema | breadcrumb_schema | product_description | about_page
  executionStatus  String   @map("execution_status")    // started | completed | failed
  triggerSource    String   @map("trigger_source")      // 🆕 manual | executor | monitor | scheduler | api
  
  // 🆕 版本追溯（必须指向具体 Snapshot，而非最新值）
  beforeSnapshotId String?  @map("before_snapshot_id")
  afterSnapshotId  String?  @map("after_snapshot_id")
  verificationVersion String? @map("verification_version")  // 验证引擎版本号
  geoScoreVersion  String?  @map("geo_score_version")      // 🆕 评分器版本（与 verificationVersion 分离）
  
  // 验证信息（由 Verification Engine 填充）
  verificationStatus String? @map("verification_status") // pending | verified | failed | no_change
  
  // 评分变化
  beforeScore     Float?    @map("before_score")
  afterScore      Float?    @map("after_score")
  scoreDelta      Float?    @map("score_delta")
  
  // 🆕 变化的维度列表（前端直接显示，不用自己计算）
  changedDimensions String[]? @map("changed_dimensions")  // ["knowledge", "authority"]
  
  // 分维度评分变化（JSON 存储，便于扩展）
  beforeDimensions Json?    @map("before_dimensions")
  afterDimensions  Json?    @map("after_dimensions")
  
  // 行业分类（用于 Growth Memory 聚合）
  industry        String?   // 从 project 冗余存储，避免联表查询
  brandType       String?   @map("brand_type")
  
  // 时间戳
  startedAt       DateTime  @default(now()) @map("started_at")
  completedAt     DateTime? @map("completed_at")
  verifiedAt      DateTime? @map("verified_at")
  
  @@map("optimization_executions")
}
```

### 2.2 VerificationJob（新增表 — 异步任务状态机）

```prisma
model VerificationJob {
  id              String   @id @default(uuid())
  executionId     String   @map("execution_id")
  
  // 状态机
  status          String   @default("pending")  // pending | running | completed | failed | retrying
  retryCount      Int      @default(0) @map("retry_count")
  maxRetries      Int      @default(3) @map("max_retries")
  
  // 锁（幂等）
  lockedBy        String?  @map("locked_by")
  lockedAt        DateTime? @map("locked_at")
  
  // 错误信息
  lastError       String?  @map("last_error")
  
  // 时间戳
  createdAt       DateTime @default(now()) @map("created_at")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  
  @@unique([executionId])  // 每个执行记录只有一个 Job
  @@map("verification_jobs")
}
```

### 2.2.1 VerificationJobRunner 接口

```typescript
// Verification Engine 只依赖这个接口，不关心 Queue 实现
interface VerificationJobRunner {
  enqueue(executionId: string): Promise<JobHandle>;
  cancel(executionId: string): Promise<void>;
  retry(executionId: string): Promise<JobHandle>;
  resume(executionId: string): Promise<JobHandle>;
  getStatus(executionId: string): Promise<JobStatus>;
}

interface JobHandle {
  executionId: string;
  status: JobStatus;
  createdAt: Date;
}
```

**接口隔离：**
- Phase 1 实现可直接使用 `InMemoryJobRunner`（同步执行）
- 后续可替换为 `BullMQJobRunner` / `RabbitMQJobRunner` / `RedisQueueJobRunner`
- Verification Engine 永远只调用 `enqueue()`，不知道背后的队列实现

**状态流转：**
```
pending → running → completed
                ↘ failed → retrying → running → completed
                                      ↘ failed（已达 maxRetries → 最终失败）
```

**幂等保证：** `@@unique([executionId])` 确保同一 executionId 只有一个 Job。`lockedBy` + `lockedAt` 防止并发启动。

### 2.3 GrowthMemory（新增表 — 自动聚合）

```prisma
model GrowthMemory {
  id              String   @id @default(uuid())
  
  // 聚合维度
  industry        String   // 行业
  brandType       String?  @map("brand_type")  // 品牌类型（可选）
  optimizationType String  @map("optimization_type")  // 优化类型
  
  // 统计
  totalExecutions Int      @default(0) @map("total_executions")
  successfulCount Int      @default(0) @map("successful_count")
  failedCount     Int      @default(0) @map("failed_count")
  noChangeCount   Int      @default(0) @map("no_change_count")
  
  totalDelta      Float    @default(0) @map("total_delta")
  averageDelta    Float    @default(0) @map("average_delta")
  successRate     Float    @default(0) @map("success_rate")  // 0~100
  
  // 置信度
  sampleSize      Int      @default(0) @map("sample_size")
  confidence      String   @default("LOW") @map("confidence")  // 🆕 LOW | MEDIUM | HIGH — 基于 sampleSize 自动计算
  
  // 🆕 聚合版本（支持未来重算）
  aggregationVersion String @default("v1") @map("aggregation_version")
  
  // 最近更新时间
  lastUpdated     DateTime @updatedAt @map("last_updated")
  
  @@unique([industry, brandType, optimizationType])
  @@map("growth_memories")
}
```

### 2.3 GeoScoreSnapshot 增强（修改现有表）

现有 `GeoScoreSnapshot` 增加字段：

```prisma
model GeoScoreSnapshot {
  // ... 现有字段保持不变 ...
  optimizationExecutionId String? @map("optimization_execution_id") // 关联到触发该快照的优化执行
}
```

### 2.5 GeoScoreVersion（新增表 — 评分引擎版本追踪）

```prisma
model GeoScoreVersion {
  id              String   @id @default(uuid())
  
  // 版本标识
  version         String   // "v1.0", "v1.2", "v2.0"
  releaseNote     String?  @map("release_note")
  isActive        Boolean  @default(false) @map("is_active")
  
  // 各维度权重快照（可用于重算历史分数）
  dimensionWeights Json?   @map("dimension_weights")
  
  createdAt       DateTime @default(now()) @map("created_at")
  activatedAt     DateTime? @map("activated_at")
  
  @@map("geo_score_versions")
}
```

每个 OptimizationExecution 记录 `geoScoreVersion`，确保分数变化可归因：
- 优化有效 → 同版本下 before/after 对比
- 模型升级 → cross-version 对比时知晓版本变化

### 2.7 VerificationPolicy（新增表 — 策略配置化）

```prisma
model VerificationPolicy {
  id              String   @id @default(uuid())
  
  // 作用范围
  industry        String?  // null = 全局默认策略
  optimizationType String? // null = 所有类型适用
  
  // 阈值配置
  minimumDelta      Float  @default(1.0) @map("minimum_delta")   // 最小有效提升
  noiseThreshold    Float  @default(0.5) @map("noise_threshold") // 噪声阈值
  minimumConfidence String @default("LOW") @map("minimum_confidence") // 最低置信度
  
  // 验证策略
  requireRevalidation Boolean @default(true) @map("require_revalidation") // 是否强制重新评分
  maxRetries          Int     @default(3) @map("max_retries")
  
  // 优先级（industry 精确匹配 > 通配策略）
  priority        Int      @default(0)
  
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@map("verification_policies")
}
```

**策略匹配规则：**
1. 精确匹配 `industry + optimizationType` → 最高优先级
2. 匹配 `industry` 通配 → 次高优先级
3. 全局默认策略（industry = null）→ 基础配置

**示例配置：**
```yaml
# 全局默认
industry: null
minimumDelta: 1.0
noiseThreshold: 0.5

# 金融行业 — 更保守
industry: finance
minimumDelta: 2.0
noiseThreshold: 1.0
maxRetries: 5

# 教育行业 FAQ — 更激进
industry: education
optimizationType: faq
minimumDelta: 0.5
```

### 2.9 LearningSignal（新增表 — Learning Engine 决策记录）

```prisma
model LearningSignal {
  id              String   @id @default(uuid())
  
  // 信号来源
  source          String   // growth_memory | ai_lab | benchmark | human_feedback
  
  // 信号内容
  signalType      String   @map("signal_type")  // success_rate | avg_delta | recommendation_rate
  originalValue   Float    @map("original_value")
  normalizedValue Float    @map("normalized_value") // 归一化到 0~1
  
  // 权重
  weight          Float    @default(1.0)  // 该信号源的权重
  weightedValue   Float    @map("weighted_value") // normalizedValue * weight
  
  // 上下文
  industry        String?
  optimizationType String?
  
  // 决策依据
  reason          String?  // "Growth Memory: FAQ 在教育行业成功率 91%, sampleSize=34(confidence=HIGH)"
  
  // 关联
  executionId     String?  @map("execution_id")
  
  generatedAt     DateTime @default(now()) @map("generated_at")
  
  @@map("learning_signals")
}
```

**为什么需要持久化 LearningSignal？**
- 可解释性：每个 Recommendation 权重的调整都有据可查
- 审计链：Learning Engine 的每次决策都不可篡改
- 调优：可以复盘"哪个信号源对最终推荐的影响最大"
- v5 兼容：AI Lab 的结果也作为 LearningSignal 写入同一张表

### 2.10 VerificationResult（新增 — 用于 Evidence Dashboard）

```prisma
model VerificationResult {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  
  // 关联到执行记录
  executionId     String   @map("execution_id")
  
  // 验证结果
  isImprovement   Boolean  @map("is_improvement")
  deltaWhenVerified Float  @map("delta_when_verified")  // 验证时的实际 delta
  
  // 验证上下文
  verifiedAt      DateTime @default(now()) @map("verified_at")
  
  // 🆕 原始验证证据（用于 Evidence Dashboard 展开明细）
  rawEvidence     Json?    @map("raw_evidence")
  // 示例：
  // {
  //   "snapshotDiff": { "before": "snap-001", "after": "snap-002" },
  //   "scoreDiff": { "before": 49, "after": 57, "delta": 8 },
  //   "dimensionDiffs": {
  //     "knowledge":  { "before": 12, "after": 15, "delta": 3 },
  //     "entity":     { "before": 8,  "after": 10, "delta": 2 },
  //     "authority":  { "before": 5,  "after": 8,  "delta": 3 }
  //   }
  // }
  
  // 验证明细
  details         Json?    // 按维度分解的验证详情（保持兼容）
  
  @@map("verification_results")
}
```

---

## 3. 数据流

### 3.1 完整闭环（Full Cycle）

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Growth Loop (v4 — Full Cycle)                     │
│                                                                        │
│  Recommendation ──→ Optimization ──→ Verification (Truth Layer)       │
│       ↑                                      │                        │
│       │                                      ▼                        │
│       └── Learning Engine ←── Growth Memory ←───┘                    │
│                              │                                        │
│                              ▼                                        │
│                     Publishing / Knowledge Distribution               │
│                              │                                        │
│                              ▼                                        │
│               ┌── Website ── CMS ── Knowledge Base ──┐               │
│               │         (public distribution)         │               │
│               └───────────────────────────────────────┘               │
│                              │                                        │
│                              ▼                                        │
│                     Monitor (drift detection)                         │
│                              │                                        │
│                              ▼                                        │
│                     Growth Memory (updated by drift)                  │
│                                                                        │
│                     ↓ (full loop continues)                            │
│                                                                        │
│  Evidence Dashboard  ←── 全链路真实数据                                │
└──────────────────────────────────────────────────────────────────────┘
```

**v4 核心变化：**
1. 引入独立的 **Learning Engine**，Recommendation 不再直接读取 Growth Memory
2. 新增 **Publishing / Knowledge Distribution** 层，优化内容实际分发到公网
3. 形成完整闭环：**Recommend → Optimize → Verify → Publish → Monitor → Learn**


### 3.2 完整数据流（含 Learning Engine）

```
Recommendation
     │
     ▼
Optimization Executor ──→ 创建 OptimizationExecution (status=started, triggerSource)
     │                       记录 beforeSnapshotId → 指向当前最新 GeoScoreSnapshot
     │                       记录 beforeScore, beforeDimensions
     ▼
执行完成 ──→ 更新 OptimizationExecution (status=completed)
     │
     ▼
Verification Engine 被触发
     │
     ├─ 调用 GeoScorer 重新评分（复用 v1）
     ├─ 创建新的 GeoScoreSnapshot（afterSnapshotId ← 此快照 ID）
     ├─ 计算 scoreDelta = afterScore - beforeScore
     ├─ 计算 changedDimensions = 前后差异维度列表
     ├─ 设置 verificationStatus:
     │    delta > 0  → "verified"
     │    delta = 0  → "no_change"
     │    delta < 0  → "failed"
     ├─ 创建 VerificationResult（含 rawEvidence）
     │
     ▼
Growth Memory 聚合更新
     │ 按 industry + brandType + optimizationType upsert
     │ 更新 totalExecutions, successfulCount, averageDelta, successRate
     │ 基于 sampleSize 自动设置 confidence:
     │   sampleSize < 5   → "LOW"
     │   sampleSize < 30  → "MEDIUM"
     │   sampleSize >= 30 → "HIGH"
     │
     ▼
Learning Engine（统一入口，接收多个学习源）
     │ 输入源:
     │   ├─ Growth Memory（来自 v4 验证）
     │   ├─ AI Recommendation Lab（来自 v5，各模型推荐表现）
     │   └─ Industry Benchmark（未来扩展）
     │
     ├─ 聚合多个学习信号
     ├─ 计算加权影响因子
     ├─ 输出: Recommendation 权重调整信号
     │
     ▼
Recommendation Engine 接收学习信号
     │ weightedImpact = baseImpact * (1 + learningFactor * signal)
     │
     ▼
Publishing / Knowledge Distribution
     │ 已验证的优化内容进入发布流程
     │ 适配器模式：Website / CMS / Knowledge Base
     ├─ 创建 PublishingRecord (status=pending)
     ├─ 用户审核 Before/After Diff
     └─ Approve → Adapter.publish()
     │
     ▼
Published on 公网
     │ 品牌官网 / WordPress / Shopify / Notion / GitBook
     │
     ▼
Monitor（检测真实生效）
     │ 验证内容是否上线、搜索引擎是否索引
     │
     ▼
Evidence Dashboard
     │ 全部来自真实数据，无模拟
     │
     ▼
GrowthKnowledge（P1 — 高级知识沉淀）
     保存非结构化洞察:
     "FAQ 对教育行业平均 +6.2，成功率 91%，原因是..."
     "Schema 对制造业效果不佳，常见问题..."
```

```
1. Optimization Executor 开始执行优化
   → 创建 OptimizationExecution (status=started)
   → 记录 before_score（当前 GeoScoreSnapshot 最新值）
   → 记录 before_dimensions

2. Optimization Executor 完成优化
   → 更新 OptimizationExecution (status=completed)

3. Verification Engine 被触发
   → 调用 existing GeoScorer（复用 v1 评分引擎）
   → 记录 after_score, after_dimensions
   → 计算 scoreDelta = afterScore - beforeScore
   → 更新 verificationStatus:
        delta > 0  → "verified"
        delta = 0  → "no_change"
        delta < 0  → "failed"（负分表示优化引入问题）
   → 创建 VerificationResult

4. Growth Memory 聚合更新
   → 按 industry + brandType + optimizationType 聚合
   → 更新 totalExecutions, successfulCount, averageDelta 等
   → 重新计算 successRate

5. Evidence Dashboard 自动更新
   → 无需额外计算，直接查聚合数据
```

### 3.3 关键规则

- 所有评分必须通过已有的 `GeoScorer`（纯后端）
- `scoreDelta` 是否视为有效提升取决于 `VerificationPolicy.minimumDelta`（默认 >= 1）
- 历史记录永久保存，不允许 DELETE
- Verification Engine 不修改 Recommendation 的数据
- Growth Memory 的 `successRate` 使用 `successfulCount / totalExecutions * 100`

### 3.4 版本策略（Freeze⑦）

每个域名独立版本号，共同构成完整的决策上下文：

| 版本 | 所属 | 用途 |
|------|------|------|
| `verificationVersion` | Verification Engine | 验证引擎逻辑版本 |
| `geoScoreVersion` | GeoScorer | 评分算法版本 |
| `policyVersion` | VerificationPolicy | 策略配置版本 |
| `learningVersion` | Learning Engine | 学习算法版本 |
| `publishingVersion` | Publishing Pipeline | 发布流水线版本 |

所有版本号独立递增。OptimizationExecution 同时记录 `verificationVersion` + `geoScoreVersion` + `policyVersion`。

**Version Registry 元数据（Freeze⑬）：**
```typescript
interface VersionEntry {
  version: string;          // "v2.1"
  releasedAt: Date;
  migrationNotes: string;   // "知识维度权重从 0.3 调整为 0.35"
  breakingChanges: string[]; // ["knowledge.maxScore 从 10 变为 15"]
  featureFlags: string[];   // ["enable_authority_boost"]
  // 该版本是否需要重新验证旧快照
  requiresRevalidation: boolean;  // true = GeoScorer 升级，已有快照应重算
}
```

**目的：**
1. GeoScorer v2→v3 升级时，自动标记哪些 Project 需要重新验证
2. Dashboard 显示"该品牌在 GeoScorer v2.1 下评分 67，建议升级到 v3.0 重新评估"
3. 特征开关支持灰度发布，不升级评分器即可切换实验性配置

**未来可以回答：**
> Q: 为什么今天的结果和昨天不同？
> A: GeoScorer v2.0→v2.1, Policy v1→v3, Learning v1.0→v1.5

### 3.5 幂等保证

**Why:** 连续两次 `POST /verification/run/:executionId` 不能产生双倍结果。

**三层次幂等：**

| 层 | 机制 | 效果 |
|----|------|------|
| 1. DB 唯一约束 | `VerificationJob.executionId` 有 `@@unique` | 同 executionId 只能有一个 Job |
| 2. Job 状态锁 | `lockedBy` + `lockedAt` 防止并发 | 两个 Worker 不会同时跑同一个 Job |
| 3. VerificationResult 去重 | `VerificationResult.executionId` 有 `@@unique` | 同 executionId 只能有一个 Result |

**关键流程：**
```
POST /verification/run/:executionId
  → try create VerificationJob (executionId, status=pending)
  → 若已存在: 返回现有 Job 状态（幂等）
  → 获取锁: UPDATE ... SET lockedBy=me WHERE lockedBy IS NULL
  → 执行业务逻辑
  → 写入 VerificationResult（@@unique 防重）
  → 释放锁
```

### 3.6 VerificationEvent（事件溯源预留）

为 v4 预留事件溯源能力，不要求 Phase 1 实现，但架构留出扩展点。

**Event Bus 架构（Freeze⑥）：**

```
Verification Engine ──publishEvent()──→ Event Bus
                                              │
                            ┌─────────────────┼─────────────────┐
                            ▼                 ▼                 ▼
                    GrowthMemoryUpdater  LearningEngine   PublishingPipeline
                            │                 │                 │
                            ▼                 ▼                 ▼
                    (Slack Webhook / Email / AI Lab / 其他订阅者)
```

**核心原则：所有 Event 不可变（Freeze⑫）**
- Event 创建后禁止修改（immutable by design）
- Event 是已发生事实的记录，而非未来意图
- 支持 Event Replay、Timeline 重建、Audit 追溯
- Any mutation is a new Event, not a mutation of old one.

**优势：**
1. 模块解耦：Verification Engine 不知道也不关心谁订阅了它的 Event
2. 可扩展：新增订阅者不需要修改已有代码
3. 可观测：Event Bus 记录所有 Event 的发布/消费情况
4. 逐步迁移：现有 Service 调用链可以逐步替换为 Event 驱动

```typescript
// 事件类型（预留）
enum VerificationEventType {
  JobCreated           = "verification.job.created",
  JobStarted           = "verification.job.started",
  JobCompleted         = "verification.job.completed",
  JobFailed            = "verification.job.failed",
  JobRetried           = "verification.job.retried",
  ScorerCallStarted    = "verification.scorer.started",
  ScorerCallCompleted  = "verification.scorer.completed",
  SnapshotCreated      = "verification.snapshot.created",
  EvidenceRecorded     = "verification.evidence.recorded",
  GrowthMemoryUpdated  = "verification.growth_memory.updated",
  LearningSignalGenerated = "verification.learning_signal.generated",
}
```

**优势：**
- Timeline 直接从 Event 重建，无需查询多个表
- Debug：按时间线重放任何一次验证流程
- Dashboard：Event 驱动更新，无需轮询

---

## 4. API 契约

### 4.1 新增端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/geo/verification/history/:projectId` | 项目验证历史 |
| GET | `/api/geo/verification/dashboard/:projectId` | Evidence Dashboard 数据 |
| POST | `/api/geo/verification/run/:executionId` | 手动触发验证（幂等） |
| GET | `/api/geo/verification/evidence/:projectId` | 已验证提升明细 |
| GET | `/api/geo/verification/compare/:executionId` | 🆕 单次验证前后对比（Before/After/Diff） |
| GET | `/api/geo/verification/job/:executionId` | 🆕 查看 Job 状态 |
| GET | `/api/geo/growth/memory` | Growth Memory 全局数据 |
| GET | `/api/geo/growth/memory/:industry` | 按行业 Growth Memory |
| GET | `/api/geo/growth/signals` | 🆕 LearningSignal 查询 |
| GET | `/api/geo/policy` | 🆕 验证策略列表 |
| PUT | `/api/geo/policy/:id` | 🆕 更新验证策略 |

### 4.2 响应格式

#### GET /verification/compare/:executionId

```json
{
  "executionId": "uuid",
  "optimizationType": "faq",
  "triggerSource": "executor",
  "before": {
    "snapshotId": "snap-001",
    "score": 49,
    "dimensions": {
      "knowledge": 12,
      "entity": 8,
      "claim": 10,
      "evidence": 7,
      "visibility": 6,
      "authority": 6
    }
  },
  "after": {
    "snapshotId": "snap-002",
    "score": 57,
    "dimensions": {
      "knowledge": 15,
      "entity": 10,
      "claim": 10,
      "evidence": 7,
      "visibility": 6,
      "authority": 9
    }
  },
  "diff": {
    "scoreDelta": 8,
    "changedDimensions": ["knowledge", "entity", "authority"],
    "dimensionDeltas": {
      "knowledge": 3,
      "entity": 2,
      "authority": 3
    }
  },
  "verificationStatus": "verified",
  "verifiedAt": "2026-07-19T10:10:00Z"
}
```

#### GET /verification/history/:projectId

```json
{
  "executions": [
    {
      "id": "uuid",
      "optimizationType": "faq",
      "beforeScore": 49,
      "afterScore": 57,
      "scoreDelta": 8,
      "verificationStatus": "verified",
      "startedAt": "2026-07-19T10:00:00Z",
      "completedAt": "2026-07-19T10:05:00Z",
      "verifiedAt": "2026-07-19T10:10:00Z"
    }
  ],
  "summary": {
    "totalExecutions": 18,
    "verifiedCount": 15,
    "successRate": 83.3,
    "totalDelta": 31
  }
}
```

#### GET /verification/evidence/:projectId

```json
{
  "evidence": [
    {
      "id": "ver-001",
      "executionId": "exec-001",
      "optimizationType": "faq",
      "delta": 8,
      "status": "verified",
      "changedDimensions": ["knowledge", "entity", "authority"],
      "verifiedAt": "2026-07-19T10:10:00Z",
      "rawEvidence": {
        "snapshotDiff": { "before": "snap-001", "after": "snap-002" },
        "scoreDiff": { "before": 49, "after": 57, "delta": 8 },
        "dimensionDiffs": {
          "knowledge": { "delta": 3 },
          "entity": { "delta": 2 },
          "authority": { "delta": 3 }
        }
      }
    }
  ],
  "aggregated": {
    "faq": { "totalDelta": 8, "count": 1, "averageDelta": 8.0 },
    "schema": { "totalDelta": 5, "count": 1, "averageDelta": 5.0 }
  }
}
```

#### GET /growth/memory?industry=education

```json
{
  "industry": "education",
  "records": [
    {
      "optimizationType": "faq",
      "averageDelta": 6.2,
      "successRate": 91.0,
      "sampleSize": 34,
      "confidence": "HIGH"
    },
    {
      "optimizationType": "schema",
      "averageDelta": 4.1,
      "successRate": 78.0,
      "sampleSize": 22,
      "confidence": "MEDIUM"
    },
    {
      "optimizationType": "breadcrumb_schema",
      "averageDelta": 3.0,
      "successRate": 66.7,
      "sampleSize": 3,
      "confidence": "LOW"
    }
  ]
}
```

---

## 5. 与现有模块的关系

### 5.1 依赖方向

```
v1 GeoScorer ──────────→ Verification Engine (调用计分)
v3 Executor ───────────→ Verification Engine (触发验证)
v3 Monitor ────────────→ Verification Engine (可选触发)
Verification Engine ───→ Growth Memory (写入聚合)

Growth Memory ─────────→ Learning Engine (统计信号输入)
v5 AI Lab ─────────────→ Learning Engine (多模型推荐表现输入，未来)
Learning Engine ───────→ v1 Recommendation (加权影响因子，唯一通路)

Verification Engine ───→ Evidence Dashboard (查询验证结果)
Growth Memory ─────────→ Evidence Dashboard (查询聚合统计)
```

### 5.2 不变承诺

| 模块 | 承诺 |
|------|------|
| v1 GeoScorer | 不做任何修改 |
| v2 Recommendation | 不改推荐接口。Learning Engine 是唯一学习信号输入 |
| v3 Executor | 执行完成后触发 Verification（新增事件，不改原有逻辑） |
| v3 Monitor | 可选：监控时自动触发验证 |

---

## 6. Growth Memory & Learning Engine

### 6.1 聚合维度

三维度复合主键：`(industry, brandType?, optimizationType)`

- `industry` — 行业（教育/医疗/制造/零售/金融/科技等）
- `brandType` — 品牌类型（DTC/企业/本地/电商等，可选）
- `optimizationType` — 优化类型（faq/schema/knowledge 等）

### 6.2 Confidence 计算规则

confidence 字段基于 sampleSize 自动计算：

| sampleSize | confidence | 含义 |
|------------|-----------|------|
| < 5 | `LOW` | 样本太少，不建议作为推荐依据 |
| 5 ~ 29 | `MEDIUM` | 有一定参考价值，但需谨慎 |
| >= 30 | `HIGH` | 统计显著，可纳入推荐权重 |

Evidence Dashboard 对 LOW 置信度的数据应标注"样本不足"警告。

### 6.3 聚合时机

- 每次 VerificationResult 写入后触发
- 使用 `prisma.$transaction` 原子更新
- 异步执行，不阻塞验证主流程

### 6.4 Learning Engine（P0 — 新增独立模块）

**为什么需要 Learning Engine？**

v3 设计是 Recommendation 直接读取 Growth Memory。v4 改为中间加一层 Learning Engine：

```
Growth Memory ──→ Learning Engine ──→ Recommendation
v5 AI Lab ──────→ Learning Engine ──→ Recommendation
```

理由：
1. **v5 兼容** — AI Recommendation Lab 也会产生学习数据（ChatGPT 推荐了谁、Claude 没推荐谁）
2. **多源聚合** — 未来多个学习源的数据需要统一规范化、加权、过滤
3. **单一出口** — Recommendation 永远只从一个入口接收学习信号，不需要关心数据来源
4. **可审计** — Learning Engine 记录每次学习的计算过程和权重调整原因

**Learning Engine 职责：**
- 接收来自 Growth Memory 的统计信号
- 接收来自 AI Recommendation Lab 的推荐信号（v5）
- 计算加权影响因子
- 输出归一化的权重调整信号给 Recommendation Engine

```
weightedSignal = aggregate(
  growthMemorySignal * growthWeight,
  aiLabSignal * aiLabWeight
)

weightedImpact = baseImpact * (1 + learningFactor * weightedSignal)
```

### 6.5 GrowthKnowledge（P1 — 高级知识沉淀）

Growth Memory 保存量化统计。GrowthKnowledge 保存非结构化洞察。

```prisma
model GrowthKnowledge {
  id              String   @id @default(uuid())
  
  // 关联维度
  industry        String
  brandType       String?
  optimizationType String
  
  // 知识内容
  insight         String   // "FAQ 对教育行业平均 +6.2 分，原因是搜索引擎对结构化问答响应更好"
  bestPractice    String?  // "最佳实践：FAQ 页面应包含至少 5 个真实问题"
  commonFailure   String?  // "常见失败：FAQ 内容过于通用、与品牌无关"
  
  // 元数据
  source          String?  // auto_generated | manual | verified
  sampleSize      Int
  averageDelta    Float
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@map("growth_knowledge")
}
```

---

## 7. Publishing / Knowledge Distribution

Publishing 是 GEO v4 闭环的最后一公里——优化内容验证有效后，必须实际发布到公网才能产生真实价值。

### 7.1 设计原则

1. **适配器模式（Adapter）** — 每个目标平台一个适配器，统一接口
2. **发布前审核（Publish Review）** — 每次发布前显示 Before/After Diff，用户确认后执行
3. **可回滚** — 每次发布保存快照，支持一键回滚
4. **非阻塞** — 发布异步执行，不阻塞主流程

### 7.2 目标平台（可扩展）

| 平台 | 适配器 | 发布内容类型 |
|------|--------|-------------|
| 品牌官网 | `WebsiteAdapter` | 品牌故事、About 页面更新 |
| CMS (WordPress) | `WordPressAdapter` | FAQ、博客内容、Schema Markup |
| CMS (Shopify) | `ShopifyAdapter` | 产品描述、Organization Schema |
| 知识库 (Notion/GitBook) | `KnowledgeBaseAdapter` | FAQ、Knowledge 条目 |
| 社交媒体 | `SocialAdapter` (未来) | 品牌简介 |

### 7.3 Publishing Record（发布记录表 - 预留）

```prisma
model PublishingRecord {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  executionId     String?  @map("execution_id")     // 关联到触发本次发布的优化执行
  
  // 发布目标
  platform        String   // website | wordpress | shopify | knowledge_base
  adapterType     String   @map("adapter_type")
  
  // 发布内容
  contentType     String   @map("content_type")     // faq | brand_story | schema | knowledge
  content         Json     // 发布的内容体
  
  // 发布状态
  status          String   @default("draft")           // draft | approved | publishing | published | verified_online | indexed | failed | rolled_back
  publishVersion  Int      @default(1) @map("publish_version")
  
  // Diff（发布审核用）
  beforeContent   Json?    @map("before_content")
  afterContent    Json?    @map("after_content")
  diffSummary     String?  @map("diff_summary")
  
  // 审核
  reviewedBy      String?  @map("reviewed_by")
  reviewedAt      DateTime? @map("reviewed_at")
  approvalNote    String?  @map("approval_note")
  
  // 回滚
  rollbackVersion Int?     @map("rollback_version")
  rollbackReason  String?  @map("rollback_reason")
  rolledBackAt    DateTime? @map("rolled_back_at")
  
  // 时间戳
  createdAt       DateTime @default(now()) @map("created_at")
  publishedAt     DateTime? @map("published_at")
  
  @@map("publishing_records")
}
```

### 7.4 Publishing Adapter 接口（预留）

```typescript
interface PublishingAdapter {
  platform: string;
  
  // 平台能力查询（Freeze⑩）
  supports(contentType: string): boolean;           // 该平台是否支持某种内容类型
  health(): Promise<HealthStatus>;                  // 平台连接状态
  capabilities(): string[];                         // 平台能力列表，如 ["faq", "schema", "blog"]
  
  // 发布前预览
  preview(content: PublishContent): Promise<PublishPreview>;
  
  // 执行发布
  publish(projectId: string, content: PublishContent): Promise<PublishResult>;
  
  // 回滚
  rollback(projectId: string, version: number): Promise<RollbackResult>;
  
  // 验证发布状态
  checkStatus(publishId: string): Promise<PublishStatus>;
}
```

### 7.5 发布流水线（Publishing Pipeline）

状态流转：

```
draft
  │
  ▼
approved（用户审核通过）
  │
  ▼
publishing（适配器执行发布中）
  │
  ├── published（已上线到公网）
  │      │
  │      ├── verified_online（Monitor 验证确认为活跃内容）
  │      │      │
  │      │      └── indexed（搜索引擎已收录，AI 可访问）
  │      │
  │      └── failed（发布失败，可重试）
  │
  └── rolled_back（发现问题回滚）
```

### 7.6 理解 Published vs Indexed

一个常见的误解是"发布了就等于有效了"。实际上：

| 状态 | 含义 | 验证方式 |
|------|------|---------|
| `published` | 内容已上线到目标平台 | Adapter.checkStatus() |
| `verified_online` | Monitor 确认内容为活跃可访问 | HTTP 请求目标 URL |
| `indexed` | 搜索引擎已收录，AI 可引用 | Google Search Console API / Bing API |
| `failed` | 发布或验证过程中出错 | 错误日志 |

Monitor 针对 Publishing 的职责：
1. 扫描所有 `published` 记录，验证 URL 可访问 → 升级为 `verified_online`
2. 扫描所有 `verified_online` 记录，检查搜索索引 → 升级为 `indexed`
3. 捕获降级或 404 → 触发告警或回滚

### 7.7 发布流程

```
优化 → 验证通过
     │
     ▼
创建 PublishingRecord (status=pending)
     │
     ▼
显示 Before / After Diff 给用户
     │
     ▼
用户审核 → Approve
     │
     ▼
调用对应 Adapter.publish()
     │
     ▼
更新 status = published
     │
     ▼
Monitor 扫描（细粒度验证）
     ├── 验证 URL 可访问 → verified_online
     └── 检查搜索索引 → indexed
     │
     ▼
触发 Growth Memory 更新

← 若发现问题 → rollback()
```

### 7.8 Capability 命名规范（Freeze⑧）

所有 GEO 操作统一按 `domain.action` 命名：

| Capability | 对应操作 |
|------------|---------|
| `verification.run` | 触发验证 |
| `verification.compare` | 前后对比 |
| `verification.history` | 验证历史 |
| `publishing.preview` | 发布预览 |
| `publishing.publish` | 执行发布 |
| `publishing.rollback` | 回滚 |
| `publishing.verify` | 验证发布状态 |
| `growth.aggregate` | 聚合 Growth Memory |
| `growth.learn` | 触发 Learning Engine |
| `monitor.verifyPublishing` | 验证发布上线状态 |

所有 Agent 通过 Capability Orchestrator Dispatch，不再出现 `if(type==="faq")`。

### 7.9 与 Monitor 的关系

发布成功后，Monitor 会在下次扫描时检测：
1. 优化内容是否真实上线（例如网站是否能访问到新 FAQ 页面）
2. 搜索引擎是否已索引
3. AI 模型是否已更新推荐结果

---

## 8. 分阶段实施计划

实施顺序调整：Learning Engine 放在最后——必须先建立完整的 Verification + Publishing + Monitor 闭环，Learning 才能学到真实的"优化→发布→验证"数据。

### Sprint 1 — Phase 1: 数据层 (P0)
- 创建所有表（见设计章节，共 8 张新表 + 1 张修改）
- 创建 `GeoScoreVersion` 初始种子数据
- Prisma migrate

### Sprint 2 — Phase 2: Repository + Verification Engine (P0)
- `verification.types.ts` — 全部类型定义（含 JobRunner 接口、VerificationEvent 枚举等）
- `verification.repository.ts` — DB 操作层（history/evidence/compare/job/signals）
- `verification-job.service.ts` — 实现 `VerificationJobRunner` 接口（Phase 1 先用 InMemoryJobRunner）
- `verification-engine.ts` — 验证编排（读取 VerificationPolicy → 触发重新评分 → 计算 delta → changedDimensions → 写入结果）
- `verification.service.ts` — 业务逻辑
- `verification-policy.service.ts` — 策略读取

### Sprint 3 — Phase 3: Verification Engine + API (P0)
- `verification.route.ts` — 全部 API 端点注册到 Fastify
- `verification-job.service.ts` — VerificationJobRunner 实现
- `verification-engine.ts` — 验证编排（读取 VerificationPolicy → 触发重新评分 → 计算 delta → changedDimensions → 写入结果）

### Sprint 4 — Phase 4: Publishing Adapter + Publishing Pipeline (P0)
- `publishing.types.ts` — PublishingAdapter 接口定义（含 supports/health/capabilities）
- `publishing-registry.ts` — AdapterRegistry（register + resolve + list + supports）
- 首个适配器 `website.adapter.ts`（品牌官网 / 静态站发布）
- `publishing-pipeline.ts` — 发布流水线编排
- `verification.route.ts` 增加 Publishing 端点

### Sprint 5 — Phase 5: Monitor Integration (P0)
- Monitor 扩展：新增 Publishing 相关检测
  - 扫描 `published` → 验证 URL 可访问 → `verified_online`
  - 扫描 `verified_online` → 检查搜索索引 → `indexed`
- 分数漂移检测：Monitor 发现分数下降后自动创建优化任务
- 验证 `verified_online` 和 `indexed` 两阶段差异

### Sprint 6 — Phase 6: Learning Engine + Growth Memory (P0)
- `learning-engine.ts` — 统一学习引擎（已有真实 Verification + Publishing + Monitor 数据）
- `learning-signal.service.ts` — 持久化每条 LearningSignal
- Growth Memory 聚合逻辑（含 confidence 自动计算）
- Recommendation Learning 集成（Learning Engine 输出作为信号输入）
- 替代 v3 中 Recommendation 直接读 Growth Memory 的逻辑

### Sprint 7 — Phase 7: Verification Workspace (Frontend) (P1)
- **Workspace 建立在完整闭环之上**，不再边开发边改
- 创建 **Verification Workspace**（5 Tab）
  - **Overview** — 项目整体验证状态、累计提升、成功率
  - **Executions** — 优化执行列表 + 状态机可视化
  - **Evidence** — 已验证提升明细 + 置信度标注 + Compare 面板
  - **Publishing** — 发布流水线状态、审核 Diff、发布/回滚
  - **Growth** — Growth Memory + Learning Signal 趋势
- 布局：左侧 Projects / 中间 Timeline / 右侧 Evidence+Recommendation+Publishing / 底部 Growth Trend
- 默认极简：当前关键指标优先，高级信息折叠到详情面板
- 全部使用真实数据，禁止模拟

### Sprint 8 — Production Deployment (P0)
- Build 验证
- 回归测试（存量 API 不受影响）
- 幂等测试（连续 POST run 验证结果不重复）
- PM2 Restart
- 健康检查
- 输出完整架构文档与上线报告（按最新报告模板）

---

## 架构决策记录 (ADR)

### ADR-001: 为什么新增表而不是在现有表加字段？
- `OptimizationExecution` 和 `VerificationResult` 有独立生命周期
- 现有表（如 `GeoScoreSnapshot`）不应该混合业务含义
- 独立表便于审计和独立查询

### ADR-002: 为什么 Growth Memory 是预聚合表而不是实时计算？
- 实时聚合随数据量增长性能下降
- 每次验证后的预聚合成本很低
- 配合唯一约束 `@@unique([industry, brandType, optimizationType])` 使用 `upsert`
- 统计口径不会随时间变化（快照式聚合）

### ADR-003: 为什么 verificationStatus 有三个状态而不是两个？
- `verified` — 验证确认有效提升
- `no_change` — 执行后分数不变
- `failed` — 执行后分数下降或执行本身失败
- 三态避免二分类的模糊性

### ADR-004: Verification Engine 是否修改 Recommendation？
- 不修改。Verification 只写验证结果到自己的表。
- Recommendation Learning 通过 **Learning Engine** 接收信号，不直接读取 Growth Memory。
- 这是三松散耦合：Verification → Growth Memory → Learning Engine → Recommendation。

### ADR-005: 为什么引入独立的 Learning Engine？
- **v5 兼容** — AI Recommendation Lab (v5) 会产生多种学习信号（ChatGPT 推荐率、Claude 引用频次等）
- **单一出口原则** — Recommendation Engine 只从一个入口接收学习信号
- **可审计** — Learning Engine 记录每次学习的计算过程
- **灵活性** — 不同学习源的权重可独立调整（growthWeight / aiLabWeight）
- 更多细节见 [6.4 Learning Engine](#64-learning-engine-p0--新增独立模块)

### ADR-006: 为什么使用 beforeSnapshotId/afterSnapshotId 而非直接存分数？
- 分数是瞬态值，快照 ID 可以追溯完整的评分上下文
- 审计需求：必须能回答"61 分是 49→61 还是 54→61"
- 支持版本化：未来验证引擎升级后可以 re-verify 历史执行记录

### ADR-007: 为什么 VerificationJob 独立于 OptimizationExecution？
- 职责分离：Execution 负责"执行优化"，Job 负责"验证任务调度"
- 状态机独立：Job 有重试/失败/锁生命周期，Execution 没有
- 幂等：`@@unique([executionId])` 天然防止重复创建
- 恢复能力：Scheduler 可以扫描 pending/failed Job 并补偿

### ADR-008: 为什么 VerificationPolicy 用表存而不是配置文件？
- 支持运行时修改（PUT /api/geo/policy/:id）
- 支持行业/优化类型粒度的差异化配置
- 与 Prisma 生态一致，无需引入额外配置中心
- 变更可审计（未来可叠加 policy change log）

### ADR-009: 为什么 LearningSignal 需要持久化？
- Recommendation 的权重调整必须有据可查
- 审计：能回答"为什么 FAQ 的 impact 从 8 变成了 10.5"
- 调优：通过分析 LearningSignal 分布，发现哪个信号源噪声最大
- v5 兼容：AI Lab 的推荐数据直接写入同一张表，Learning Engine 统一处理

### ADR-010: 为什么 aggregationVersion 放在 GrowthMemory？

### ADR-011 (Freeze ①): 为什么 Verification Engine 要通过 JobRunner 接口而不是直接调用 Queue？
- **接口隔离** — Engine 只关心 `enqueue(executionId)`，不关心背后是同步执行还是分布式队列
- **可替换** — Phase 1 用 InMemoryJobRunner，后续可无痛切换到 BullMQ / RabbitMQ / Redis
- **可测试** — 单元测试时注入 MockJobRunner，无需启动队列基础设施
- **与 KMKI 一致** — 整个平台统一使用 JobRunner 接口模式

### ADR-012 (Freeze ②): 为什么 Publishing 使用 Adapter Registry 而不是 switch/case？
- **开闭原则** — 新增平台只需要 `registry.register(new GhostAdapter())`，不改 Publishing Service
- **运行时发现** — Registry 支持 `resolve(platform)` 动态解析，无需硬编码
- **扩展点** — 后续 Ghost / Medium / 知乎 / 微信公众号 / Confluence 都可以注册为 Adapter
- **可观测** — Registry.adapters 可枚举所有已注册平台

### ADR-013 (Freeze ③, P1): 为什么后续 Publishing 应该走 Capability Dispatch？
- 与 KMKI Runtime 保持一致 — 短剧/小说/PPT/GEO 都通过统一 Capability Dispatch
- 未来 `publish.website` / `publish.wordpress` / `publish.knowledge` 都是 Capability
- Phase 1 暂不实现，Phase 4 预留接口

### ADR-014 (Freeze④): 为什么统一状态机？
- 三个独立模块（Verification / Publishing / Growth）各有状态机，但转换规则一致
- 统一 `state-machine.ts` 注册所有状态机并验证转换合法性
- 防止非法转换：`completed → running`、`draft → published`
- 所有 Timeline 和 Dashboard 直接读取状态机定义，无需重复定义

### ADR-015 (Freeze⑤): 为什么 Repository 要抽象接口？
- 当前用 Prisma，未来可能换 Drizzle / ClickHouse
- 接口隔离使测试可以注入 MockRepository
- Repository 不暴露 Prisma 类型，只暴露 Domain 类型

### ADR-016 (Freeze⑥): 为什么引入 Domain Event Bus 而不是 Service 链式调用？
- 当前数据流是链式：Verification → Growth → Learning → Publishing
- 未来每加一个步骤都要改中间代码
- Event Bus：模块只发出 Event，不关心谁订阅
- 订阅者独立部署/启用/禁用
- 支持未来 Slack Webhook / Email / AI Lab 等扩展

### ADR-017 (Freeze⑦): 为什么每个模块都需要版本？
- `verificationVersion` / `geoScoreVersion` / `policyVersion` / `learningVersion` / `publishingVersion`
- 保证任何结果都能回答"为什么今天的结果和昨天不同"
- 每个版本号独立递增，不耦合

### ADR-018 (Freeze⑧): 为什么提前冻结 Capability 命名规范？
- 所有操作都按 `domain.action` 命名：`verification.run` / `publishing.preview` / `growth.learn`
- 后续 Agent 开发时直接 `dispatch("verification.run", payload)`
- 不再出现 `if (type === "faq")` 这种代码
- 与 KMKI Runtime 的 Capability Orchestrator 一致

### ADR-019 (Freeze⑨): Verification Workspace 布局定位
- 左侧：Projects（品牌项目列表）
- 中间：Verification Timeline（优化执行流）
- 右侧：Evidence / Recommendation / Publishing 面板
- 底部：Growth Trend + Learning Signal 趋势
- 默认极简：当前关键指标优先，高级信息折叠到详情面板

### ADR-020 (Freeze⑩): 为什么 PublishingAdapter 需要 supports/health/capabilities？
- `supports(contentType)` — 系统自动知道哪些平台能发 FAQ / Schema / Blog
- `health()` — 发布前检查平台连接状态，失败提前告警
- `capabilities()` — 枚举平台能力，前端自动展示可用发布目标

### ADR-021 (Freeze⑪): 为什么 Domain Contract 统一？
- Route / Service / Frontend 各自维护 DTO → 数据不一致时 Debug 成本极高
- Contract 统一后 SDK、Frontend、OpenAPI 从同一来源生成
- 修改 DTO 时 TypeScript 编译期检查所有调用方
- 避免"Route 返回 5 个字段，Frontend 期待 6 个"的运行时错误

### ADR-022 (Freeze⑫): 为什么 Event 必须是 immutable？
- 可变的 Event 破坏 Audit Trail：无法确认"这个 Event 到底是啥时候发布的"
- Immutable Event 支持精确的 Event Replay：每次 Replay 产生相同结果
- Timeline 重建不依赖"最后一次修改时间"，只依赖 Event 创建时间
- 任何需要"修改 Event"的场景，正确的做法是发出一个新 Event

### ADR-023 (Freeze⑬): 为什么 Version Registry 需要元数据而不是只有版本号？
- `requiresRevalidation: true` — GeoScorer 升级后系统自动知道哪些 Project 需要重评
- `breakingChanges` — 前端可以展示"该品牌基于旧版本评分，建议重新评估"
- `featureFlags` — 灰度发布实验性评分规则，不影响主线版本
- 这些元数据在数据模型中是 `GeoScoreVersion` 和 `VerificationPolicy` 表的扩展字段
- `supports(contentType)` — 系统自动知道哪些平台能发 FAQ / Schema / Blog
- `health()` — 发布前检查平台连接状态，失败提前告警
- `capabilities()` — 枚举平台能力，前端自动展示可用发布目标

---

## 9. 报告标准（Reporting Standard）

所有 GEO 开发任务完成后，默认执行报告结构：

```
### Architecture
### Implementation
### Verification
### Publishing
### Deployment
### Monitor
### Learning
### Next Sprint
```

此模板确保每次执行报告覆盖完整闭环：**Diagnose → Optimize → Verify → Publish → Monitor → Learn**，不会只停留在"代码已完成"。

> **架构冻结（Freeze）**  
> 本文档为 GEO v4 架构基准。  
> 所有变更必须先更新本文档，评审通过后方可实施。  
> 未经冻结评审的代码提交将被驳回。
