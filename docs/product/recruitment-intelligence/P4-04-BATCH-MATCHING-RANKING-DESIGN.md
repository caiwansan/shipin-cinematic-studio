# P4-04 Design — Batch Matching + Ranking

**Date:** 2026-07-25
**Status:** 🔜 Design Phase — Pending Gate Approval
**Author:** OpenClaw / 掌柜 CTO

---

## 1. 定位

P4-04 是招聘核心闭环的编排层。它不做匹配计算（P4-01 负责），不做 JD 结构化（P4-03 负责），不做解释生成（P4-02 负责）。

**P4-04 = 批量编排 + 排名 + 持久化**

```
JD 文本
  ↓ (P4-03)
JobRequirementProfile
  ↓ (P4-04 触发)
Candidate Pool 全量扫描
  ↓ (P4-01 逐人匹配)
MatchResult × N
  ↓ (P4-04 排名)
Ranked Results
  ↓ (P4-04 持久化)
DB: talent_match_result (rank 字段)
  ↓ (P4-02 按需)
Explanation per candidate
```

---

## 2. 核心概念

### 2.1 Batch Job

一次"发布岗位 → 寻找候选人"的完整执行单元。

| 字段 | 说明 |
|------|------|
| `id` | UUID |
| `enterpriseId` | 企业 ID |
| `jobRequirementId` | 关联的岗位要求 |
| `status` | PENDING / RUNNING / COMPLETED / FAILED |
| `totalCandidates` | 候选人池大小 |
| `processedCount` | 已处理数 |
| `matchedCount` | 匹配成功数（score ≥ threshold） |
| `startedAt` | 开始时间 |
| `completedAt` | 完成时间 |
| `errorMessage` | 失败原因 |

### 2.2 Ranking Model

**关键原则：不修改 P4-01 Score。** Ranking 在 Score 之上叠加额外维度。

```
FinalRank = P4-01 Score (70%)
           + Evidence Confidence (20%)
           + Freshness (10%)
```

| 维度 | 权重 | 说明 |
|------|------|------|
| Match Score | 70% | P4-01 输出，**只读不改** |
| Evidence Confidence | 20% | 证据链平均置信度（来自 MatchEvidence.confidence） |
| Freshness | 10% | 候选人资料更新时间（越新越高） |

**Ranking 是 P4-04 的职责，但 P4-01 Score 在排名公式中的权重 ≥ 70%，确保匹配质量主导排名。**

### 2.3 阈值策略

| 阈值 | 说明 |
|------|------|
| `auto_threshold` | score ≥ 60 视为"匹配" |
| `recommend_threshold` | score ≥ 80 视为"推荐" |
| `custom_threshold` | 企业可自定义（覆盖默认值） |

---

## 3. 执行流程

### 3.1 触发方式

1. **手动触发**：HR 在岗位详情页点击"AI 寻找候选人"
2. **自动触发**：岗位状态从 draft → active 时自动执行
3. **API 触发**：`POST /api/job/match/batch`

### 3.2 执行步骤

```
Step 1: 校验 JobRequirementProfile 状态必须为 active
Step 2: 创建 BatchJob (status=PENDING)
Step 3: 加载 Candidate Pool
   - 来源: CareerProfile (status=active)
   - 过滤: 排除已匹配且 rank 不变的候选人（可选优化）
Step 4: Batch Job → status=RUNNING
Step 5: 遍历 Candidate Pool:
   a. 调用 P4-01 TalentMatchingService.matchSingle()
   b. 存储 MatchResult + MatchEvidence
   c. 更新 processedCount
Step 6: 全部完成后执行 Ranking
Step 7: 写回 rank 字段到每条 MatchResult
Step 8: BatchJob → status=COMPLETED
```

### 3.3 性能考量

| 规模 | 策略 |
|------|------|
| ≤ 100 候选人 | 同步执行，直接返回结果 |
| 100-1000 候选人 | 异步执行，返回 batchId，轮询进度 |
| > 1000 候选人 | 分批处理（每批 100），队列执行 |

**V1 范围：同步执行（≤ 100 候选人），异步队列留给 V2。**

---

## 4. API 设计

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/job/match/batch` | JWT | 触发批量匹配 |
| GET | `/api/job/match/batch/:id` | JWT | 查询 Batch Job 状态 |
| GET | `/api/job/match/batch/:id/results` | JWT | 获取排名后的匹配结果 |
| GET | `/api/job/match/batch/list` | JWT | 列出企业的 Batch Jobs |
| DELETE | `/api/job/match/batch/:id` | JWT | 取消/删除 Batch Job |

### 4.1 触发批量匹配

```http
POST /api/job/match/batch
Authorization: Bearer <token>

{
  "jobRequirementId": "uuid",
  "threshold": 60,           // optional, default 60
  "maxResults": 20,          // optional, default 20
  "filters": {
    "location": "上海",       // optional
    "minEducation": "bachelor" // optional
  }
}
```

**Response (200):**
```json
{
  "batchId": "uuid",
  "status": "COMPLETED",
  "totalCandidates": 45,
  "processedCount": 45,
  "matchedCount": 12,
  "results": [
    {
      "rank": 1,
      "candidateId": "uuid",
      "score": 92,
      "breakdown": { "skill": 95, "experience": 88, "education": 90, "career": 85 },
      "matchedSkills": ["Vue3", "TypeScript"],
      "missingSkills": ["React"]
    }
  ]
}
```

### 4.2 查询 Batch Job 状态

```http
GET /api/job/match/batch/:id
```

**Response:**
```json
{
  "id": "uuid",
  "status": "RUNNING",
  "totalCandidates": 45,
  "processedCount": 23,
  "progress": 51
}
```

---

## 5. 数据模型

### 5.1 新增模型：BatchJob

```prisma
model BatchJob {
  id              String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  enterpriseId    String   @map("tenant_id") @db.Text
  jobRequirementId String  @map("job_requirement_id") @db.Text
  status          String   @default("PENDING") @db.VarChar(20)
  totalCandidates Int      @default(0) @map("total_candidates")
  processedCount  Int      @default(0) @map("processed_count")
  matchedCount    Int      @default(0) @map("matched_count")
  threshold       Int      @default(60)
  maxResults      Int      @default(20) @map("max_results")
  errorMessage    String?  @map("error_message")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  jobRequirement  JobRequirementProfile @relation(fields: [jobRequirementId], references: [id])
  results         TalentMatchResult[]

  @@index([enterpriseId])
  @@index([jobRequirementId])
  @@index([status])
  @@map("batch_job")
}
```

### 5.2 修改模型：TalentMatchResult

新增 `rank` 字段（P4-01 已创建，补充 rank）：

```prisma
// 在现有 TalentMatchResult 中新增：
rank        Int?     // P4-04 Ranking 写入，null 表示未排名
```

---

## 6. 架构约束（待冻结）

| 约束 | 说明 |
|------|------|
| **P4-01 Score 只读** | Ranking 不修改 P4-01 Score，只在之上叠加维度 |
| **P4-01 无状态** | 逐人匹配，不感知 Batch 上下文 |
| **Candidate Pool = CareerProfile (active)** | 只匹配活跃候选人 |
| **幂等性** | 同一 jobRequirementId 重复触发，先清理旧结果再重跑 |
| **企业隔离** | 结果严格按 enterpriseId 隔离 |
| **排名公式权重冻结** | Score ≥ 70%，Evidence ≤ 20%，Freshness ≤ 10% |
| **V1 同步执行** | 不支持异步队列（V2 扩展） |

---

## 7. 错误处理

| 场景 | 处理 |
|------|------|
| JobRequirement 非 active | 400 — "岗位要求未激活" |
| Candidate Pool 为空 | 200 — matchedCount=0, results=[] |
| P4-01 单条匹配失败 | 跳过该候选人，记录日志，继续执行 |
| 超过 100 候选人（V1） | 400 — "超出 V1 限制，请联系管理员" |
| 企业无权限 | 403 |

---

## 8. 企业侧体验流程

```
HR 发布岗位
  ↓
P4-03 AI 结构化 JD → JobRequirementProfile
  ↓
HR 审核/修正 → 状态设为 active
  ↓
HR 点击"AI 寻找候选人"
  ↓
P4-04 触发 Batch Matching
  ↓
展示进度条（V1 同步，短暂等待）
  ↓
展示 Top N 候选人列表（按 rank 排序）
  ↓
HR 点击候选人 → 查看匹配原因（P4-02 Explanation）
```

---

## 9. 待掌柜 CTO 审批项

| 项目 | 待确认 |
|------|--------|
| Ranking 公式权重 | Score 70% + Evidence 20% + Freshness 10% |
| V1 候选人上限 | 100 人（同步执行） |
| 默认阈值 | 60（匹配）/ 80（推荐） |
| 幂等策略 | 同一岗位重复触发 → 清理旧结果 |
| 是否新增 BatchJob 表 | 是（还是复用现有表） |
| 异步队列 | V2 范围，V1 不做 |

---

**P4-04 Design — 待掌柜 CTO Gate Approval 后进入 Implement。**
