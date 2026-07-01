# GEO MVP v1 — 精简版产品需求文档

**日期**: 2026-07-20  
**目标**: 30 天内跑通「创建品牌 → AI 扫描 → 基础报告 → 一键优化」完整闭环  
**定位**: 高级 VIP 增值模块（非独立大工作台）

---

## 1. 产品目标与成功指标

### 产品目标
让品牌主在 3 步内知道自己的品牌在主流 AI 模型中"被怎么看待"，并一键生成改善方案。

### 北极星指标
**Active Brands** = 过去 7 天内完成过扫描的品牌数 > 10

### 成功指标

| 指标 | 目标值 | 验证方式 |
|------|--------|----------|
| MVP 上线后首月活跃品牌数 | ≥ 10 | 后台统计 |
| 扫描完成率 | ≥ 80%（发起→完成） | 扫描状态机 |
| 优化采纳率 | ≥ 60%（生成→用户点击"应用"） | 前端事件 |
| 平均扫描耗时 | ≤ 120 秒 | 后端日志 |
| 品牌创建成功率 | ≥ 95% | 端到端测试 |

---

## 2. 用户角色与使用流程

### 用户
- **唯一用户类型**: 已登录且 VIP 级别 ≥ 高级 VIP 的平台用户
- 不需要独立注册流程，直接复用平台用户体系

### 使用流程（4 步） 

```
登录 → 进入 GEO 仪表盘 → [无品牌] 创建品牌 → [有品牌] 发起扫描
                                          ↓
                                       等待扫描完成（~60-120秒）
                                          ↓
                                       查看报告（多维分数 + 问题列表）
                                          ↓
                                       一键优化（生成文案 → 复制/应用）
```

### 用户故事

| # | 故事 | 优先级 |
|---|------|--------|
| US-01 | 作为高级VIP用户，我想在 GEO 仪表盘看到我当前的品牌总分和变化趋势 | P0 |
| US-02 | 作为高级VIP用户，我想创建一个品牌（填写品牌名、官网、关键词） | P0 |
| US-03 | 作为高级VIP用户，我想对已创建的品牌发起一次 AI 扫描 | P0 |
| US-04 | 作为高级VIP用户，我想在扫描完成后看到多维度的评分报告 | P0 |
| US-05 | 作为高级VIP用户，我想看到每个低分维度的具体问题和改善建议 | P0 |
| US-06 | 作为高级VIP用户，我想一键生成针对某个问题的优化文案 | P1 |
| US-07 | 作为高级VIP用户，我想看到每次扫描的历史分数变化趋势 | P1 |

---

## 3. 功能清单

### P0（MVP 必须）— 上线前必须交付

```
┌─────────────────────────────────────────────────────┐
│                    GEO MVP                          │
├─────────────────┬─────────────────┬─────────────────┤
│  品牌管理        │  AI 扫描         │  报告展示        │
│  (P0)           │  (P0)           │  (P0)           │
├─────────────────┼─────────────────┼─────────────────┤
│ 创建品牌         │ 发起扫描         │ 总分 + 趋势      │
│ 编辑品牌         │ 轮询扫描状态      │ 5 维评分        │
│ 品牌列表         │ 超时/失败处理     │ 问题列表        │
│ 品牌详情         │                 │ 解释性文字       │
│                 │                 │                 │
│  一键优化 (P1)   │  仪表盘 (P0)     │                 │
│ 生成优化文案      │ 历史趋势图       │                 │
│ 复制/应用文案     │ 最近扫描         │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### P0 功能详情

#### 3.1 品牌管理
- **创建品牌**: 表单输入 `品牌名(必填)`、`官网URL(必填)`、`行业(选填)`、`关键词(选填，最多 20 个)`
- **编辑品牌**: 修改品牌信息
- **品牌列表**: 卡片形式展示用户所有品牌，显示最近一次扫描时间和分数
- **品牌详情**: 展示品牌基础信息 + 最新扫描结果（如果有）

#### 3.2 AI 扫描
- **触发方式**: 品牌详情页点击"发起扫描"按钮
- **扫描范围**: 向 5 个 AI 模型发起询问，每次询问固定模板 prompt
  - ChatGPT（OpenAI API）, Grok（xAI API）, Claude（Anthropic API）, Perplexity, 通义千问
- **扫描用 prompt**:
  ```
  你了解[品牌名]吗？请用 3-5 句话描述它。它主要做什么？它的网站是[网站URL]。
  ```
- **扫描流程**: 异步 → 创建扫描记录（状态: pending）→ 逐个调用 AI → 存储响应 → 计算分数 → 状态变为 completed
- **状态轮询**: 前端每 5 秒查询一次扫描状态
- **超时处理**: 单个 AI 模型 30 秒超时，总扫描 ≤ 120 秒

#### 3.3 报告展示
- **总分 0-100**: 基于 5 个维度的加权平均
  - AI 识别度（30%）：AI 能否准确识别品牌
  - 信息准确性（25%）：AI 描述是否准确
  - 描述一致性（20%）：不同 AI 模型的描述是否一致
  - 关键词覆盖（15%）：用户定义的关键词是否被 AI 提及
  - 情感倾向（10%）：AI 描述的正/负/中性
- **每个维度**: 分数 0-100 + 简短解释 + 问题列表
- **趋势**: 如果有多条扫描记录，显示历史分数折线图

#### 3.4 仪表盘
- 用户所有品牌的卡片列表
- 每个卡片显示: 品牌名、最新总分、最后一次扫描时间
- 点击进入品牌详情

### P1 功能详情

#### 3.5 一键优化
- 在报告页的低分维度旁，显示"生成优化建议"按钮
- 点击后 AI 生成一条优化文案（例如改写品牌描述、补充 for AI 的关键信息）
- 用户可以「复制」或「应用」优化文案
- "应用" 表示用户确认已处理（不会自动发布，仅做标记）

---

## 4. 数据模型（最小字段）

### 4.1 Prisma Model（保留 + 新增/简化）

#### 保留并使用的表

```prisma
// GEO 项目 — 每个品牌一个项目
model GEOProject {
  id        String   @id @default(uuid())
  userId    String
  name      String   // 品牌名
  topic     String?  // 品牌简介
  industry  String?  // 行业
  language  String   @default("zh")
  country   String?
  status    String   @default("active")
  config    Json     @default("{}")   // 存储 keywords 等
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("kmki_geo_projects")
}

// 扫描记录
model GEOProjectVersion { // 复用为扫描记录
  id        String   @id @default(uuid())
  projectId String
  userId    String
  // MVP 新增字段
  scanStatus   String   @default("pending")   // pending/running/completed/failed
  scanStartedAt DateTime?
  scanFinishedAt DateTime?
  // MVP 分数
  overallScore  Int?     @default(0)
  visibility    Int?     // AI 识别度
  accuracy      Int?     // 信息准确性
  consistency   Int?     // 描述一致性
  keywordCoverage Int?  // 关键词覆盖
  sentiment     Int?     // 情感倾向
  // 原始响应（JSON）
  scanResults   Json?    // { chatgpt: {...}, grok: {...}, claude: {...}, ... }
  aiResponses   Json?
  // 原字段保留
  version       String?
  status        String?
  config        Json?
  metadata      Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project GEOProject @relation(fields: [projectId], references: [id])

  @@index([projectId])
  @@index([userId])
  @@map("kmki_geo_project_versions")
}

// 品牌设置（关键词等）
model GeoBrandSetting {
  id            String   @id @default(uuid())
  projectId     String
  userId        String
  // MVP 核心字段
  website       String?
  industry      String?
  keywords      Json?    // string[]
  targetAiModels Json?    // string[] — 目标 AI 平台列表
  // 原字段保留
  status        String?
  extraMetadata Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectId, userId])
  @@map("geo_brand_settings")
}
```

#### 可以安全删除的 Prisma Model

| 模型名 | 原始表 | 删除理由 |
|--------|--------|----------|
| `GeoProjectProfile` | `kmki_geo_project_profiles` | 数据已由 `GeoBrandSetting` 承载 |
| `GeoBrandProfile` | `geo_brand_profiles` | 0 行，功能与 GeoBrandSetting 重叠 |
| `GeoGraphNode` | `geo_graph_nodes` | 0 行，知识图谱 MVP 不包含 |
| `GeoGraphEdge` | `geo_graph_edges` | 0 行 |
| `GEOEntity` | `kmki_geo_entities` | 实体 MVP 不需要 |
| `GEOEntityRelation` | `kmki_geo_entity_relations` | 0 行 |
| `GEOClaim` | `kmki_geo_claims` | 声明链 MVP 不需要 |
| `GEOEvidence` | `kmki_geo_evidences` | 证据链 MVP 不需要 |
| `GEOCitation` | `kmki_geo_citations` | 引用 MVP 不需要 |
| `GEOFAQ` | `kmki_geo_faqs` | FAQ MVP 不需要 |
| `GEOSchemaMarkup` | `kmki_geo_schema_markups` | 结构化数据 MVP 不需要 |
| `GEOReviewQueue` | `kmki_geo_review_queue` | 0 行 |
| `GEOQualityScore` | `kmki_geo_quality_scores` | 0 行 |
| `GEOFreshnessRecord` | `kmki_geo_freshness_records` | 0 行 |
| `GEOBenchmarkRecord` | `kmki_geo_benchmark_records` | 0 行 |
| `GEOScoreSnapshot` | `kmki_geo_score_snapshots` | MVP 用 version.overallScore 替代 |
| `GEOOptimizationHistory` | `kmki_geo_optimization_histories` | 0 行 |
| `GeoKeyword` | `geo_keywords` | 迁入 GeoBrandSetting.keywords |
| `GeoScanHistory` | `geo_scan_history` | MVP 用 GEOProjectVersion 替代 |
| `GeoScoreVersion` | `geo_score_versions` | 0 行 |
| `VerificationJob` | — | 表未创建，完全不需要 |
| `VerificationResult` | — | 表未创建，完全不需要 |
| `VerificationPolicy` | — | 表未创建，完全不需要 |
| `GrowthMemory` | `growth_memories` | 0 行 |
| `LearningSignal` | — | 表未创建 |
| `GrowthKnowledge` | `growth_knowledge` | 0 行 |
| `KnowledgeObject` | `knowledge_objects` | MVP 不包含知识对象 |
| `PublishingRecord` | — | 表未创建 |
| `OptimizationExecution` | `optimization_executions` | MVP 简化优化逻辑 |
| `KnowledgeAsset` | — | 表未创建 |
| `KnowledgePackage` | — | 表未创建 |
| `PublishableClaim` | — | 表未创建 |
| `PublishPlan` | — | 表未创建 |
| `PublishPlanToClaim` | — | 表未创建 |

**MVP 保留的 Prisma Model（共 3 个）**: 
- `GEOProject` ✅
- `GEOProjectVersion` ✅ (复用为扫描记录)
- `GeoBrandSetting` ✅

---

## 5. 前后端交互接口（简要）

### 5.1 API 设计

```
GET    /api/v1/geo/projects                     // 获取用户品牌列表
POST   /api/v1/geo/projects                     // 创建品牌
GET    /api/v1/geo/projects/:id                  // 品牌详情
PUT    /api/v1/geo/projects/:id                  // 编辑品牌

POST   /api/v1/geo/projects/:id/scan             // 发起扫描（异步）
GET    /api/v1/geo/projects/:id/scans/:scanId    // 获取扫描结果
GET    /api/v1/geo/projects/:id/scans            // 扫描列表（历史）

GET    /api/v1/geo/projects/:id/optimize         // 生成优化建议
POST   /api/v1/geo/projects/:id/optimize/apply   // 标记优化已应用

GET    /api/v1/geo/dashboard                     // 仪表盘汇总数据
```

### 5.2 关键数据契约

**POST /scan 返回**:
```json
{
  "scanId": "uuid",
  "status": "pending",
  "estimatedSeconds": 90
}
```

**GET /scans/:scanId 返回**:
```json
{
  "scanId": "uuid",
  "status": "completed",
  "overallScore": 68,
  "dimensions": {
    "visibility": { "score": 72, "explanation": "75% 的 AI 能正确识别该品牌" },
    "accuracy": { "score": 65, "explanation": "部分 AI 描述存在事实性偏差" },
    "consistency": { "score": 58, "explanation": "Grok 和 通义千问 的描述差异较大" },
    "keywordCoverage": { "score": 45, "explanation": "20 个关键词中 AI 提及了 9 个" },
    "sentiment": { "score": 82, "explanation": "AI 描述整体偏正面" }
  },
  "problems": [
    { "dimension": "consistency", "severity": "high", "description": "Grok 和 通义千问对品牌的定位描述不一致" }
  ]
}
```

---

## 6. 高级VIP 权限控制

| 功能点 | 普通用户 | VIP | 高级VIP |
|--------|----------|-----|---------|
| 看到 GEO 入口 | ❌ | ❌ | ✅ |
| 创建品牌（上限） | - | - | 5 个 |
| 发起扫描（每月上限） | - | - | 30 次 |
| 查看报告 | - | - | ✅ |
| 一键优化 | - | - | ✅ |
| 历史趋势 | - | - | ✅ |

### 限流策略
- 扫描冷却期：同品牌两次扫描间隔 ≥ 30 分钟
- 单用户并发扫描最多 2 个
- AI 模型 API 调用走平台统一 gateway（复用现有 unified-ai-gateway.ts）

---

## 7. 不做的功能（显式排除）

| 功能 | 排除理由 |
|------|----------|
| 知识图谱 | MVP 不包含实体/关系/声明 |
| KDP / 自动发布 | 无发布需求 |
| Verification Pipeline | 无证据验证需求 |
| Growth Memory / Learning Engine | 无持续学习需求 |
| 实体提取 / 声明提取 | 简化到只做 "AI 问品牌" |
| 关键词监控 / 收录追踪 | 超出 MVP 范围 |
| 多用户协作 | 单人操作为主 |
| 自定义扫描 prompt | 固定模板，后期可扩展 |
| 导出报告 | 仅页面查看 |
