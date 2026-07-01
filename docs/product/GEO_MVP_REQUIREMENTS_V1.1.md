# GEO MVP v1.1 — 精简版产品需求文档

**日期**: 2026-07-20 | 版本: v1.1  
**基于**: v1.0 + 熊大 Review 5 条调整  
**目标**: 30 天内跑通「创建品牌 → AI 扫描 → 基础报告 → 一键优化」完整闭环  
**定位**: 高级 VIP 增值模块（非独立大工作台）

---

## 1. 产品目标与成功指标

### 产品目标
让品牌主在 3 步内知道自己的品牌在主流 AI 模型中"被怎么看待"，并一键生成改善方案。

**3 步**: 创建品牌 → 扫描 → 看到报告 + 优化建议

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
                                       查看报告（4 维分数 + 问题列表）
                                          ↓
                                       一键优化（生成文案 → 复制/应用）
```

### 用户故事

| # | 故事 | 优先级 | 状态 |
|---|------|--------|------|
| US-01 | 作为高级VIP用户，我想在 GEO 仪表盘看到我当前的品牌总分和变化趋势 | P0 | ✅ |
| US-02 | 作为高级VIP用户，我想创建一个品牌（填写品牌名、官网、关键词） | P0 | ✅ |
| US-03 | 作为高级VIP用户，我想对已创建的品牌发起一次 AI 扫描 | P0 | ✅ |
| US-04 | 作为高级VIP用户，我想在扫描完成后看到多维度的评分报告 | P0 | ✅ |
| US-05 | 作为高级VIP用户，我想看到每个低分维度的具体问题和改善建议 | P0 | ✅ |
| US-06 | **作为高级VIP用户，我想一键生成针对某个问题的优化文案，并复制应用** | **P0(从P1提升)** | ✅ |
| US-07 | 作为高级VIP用户，我想看到每次扫描的历史分数变化趋势 | P1 | ✅ |

---

## 3. 功能清单

### P0（MVP 必做）— 上线前必须交付

```
┌─────────────────────────────────────────────────────────────┐
│                    GEO MVP                                  │
├────────────────┬─────────────────┬─────────────────────────┤
│  品牌管理 (P0)  │  AI 扫描 (P0)    │  报告 + 优化 (P0)       │
├────────────────┼─────────────────┼─────────────────────────┤
│ 创建品牌        │ 发起扫描         │ 总分 + 趋势             │
│ 编辑品牌        │ 轮询扫描状态      │ 4 维评分               │
│ 品牌列表        │ 超时/失败处理     │ 问题列表               │
│ 品牌详情        │ 结构化 JSON 响应  │ 解释性文字              │
│                │                 │ **一键优化 (从P1升P0)**  │
│                │                 │ 生成优化文案             │
│                │                 │ 复制/应用文案            │
│                │                 │                         │
│  仪表盘 (P0)    │                 │                         │
│  品牌卡片列表    │                 │                         │
│  最近扫描时间    │                 │                         │
└────────────────┴─────────────────┴─────────────────────────┘
```

### P0 功能详情

#### 3.1 品牌管理
- **创建品牌**: 表单输入
  - `品牌名`（必填）
  - `官网URL`（必填）
  - `行业`（选填）
  - `关键词`（选填，最多 20 个，存放于 GEOProject.config.keywords）
- **编辑品牌**: 修改品牌信息
- **品牌列表**: 卡片形式展示用户所有品牌，显示最近一次扫描时间和分数
- **品牌详情**: 展示品牌基础信息 + 最新扫描结果（如果有）

#### 3.2 AI 扫描
- **触发方式**: 品牌详情页点击"发起扫描"按钮
- **扫描范围**: 向 5 个 AI 模型发起询问
  - ChatGPT（OpenAI API）
  - Grok（xAI API）
  - Claude（Anthropic API）
  - Perplexity
  - 通义千问
- **扫描 Prompt（结构化多轮）**:
  ```
  [系统指令]
  你是一个品牌分析助手。请你尽可能全面地描述[品牌名]这个品牌。
  请按以下 JSON 格式回复，不要包含其他内容：

  {
    "recognizes": true/false,
    "description": "用 3-5 句话描述这个品牌",
    "accuracy": "accurate|partial|inaccurate",
    "recommendation": "positive|neutral|negative",
    "mentionsKeywords": ["提及的关键词"],
    "facts": [
      { "statement": "提取的陈述句", "confidence": "high|medium|low" }
    ],
    "website": "[品牌名]的网站是[网站URL]"
  }
  ```
- **扫描流程**:
  1. 创建扫描记录（状态: pending）
  2. 逐个调用 5 个 AI 模型（并行 + 30 秒超时）
  3. 每个模型收到相同的结构化 prompt
  4. 解析 JSON 响应
  5. 计算 4 维分数
  6. 状态 → completed（或 failed）

- **状态轮询**: 前端每 5 秒查一次扫描状态
- **超时处理**: 单个 AI 模型 30 秒超时。总扫描 ≤ 120 秒，超时标记为 partial

#### 3.3 报告展示（4 个维度）

维度定义简化自 v1.0 的 5 维：

| 维度 | 权重 | 说明 | 计算方式 |
|------|------|------|----------|
| 可见度 | 35% | AI 能否准确识别品牌 | 各模型 `recognizes: true` 的比例 |
| 准确性 | 25% | AI 描述是否准确可靠 | 各模型 `accuracy` 评分的均值 |
| 一致性 | 20% | 不同 AI 对品牌描述是否一致 | 各模型 description 的文本相似度 |
| 推荐意愿 | 20% | AI 对品牌的整体态度 | 各模型 `recommendation` 为正/中/负的比例 |

每个维度显示：
- 分数 0-100（条形图）
- 简短解释
- 低分维度的具体问题列表

#### 3.4 仪表盘
- 用户所有品牌的卡片列表
- 每个卡片显示：品牌名、最新总分、最后一次扫描时间
- 点击进入品牌详情

#### 3.5 一键优化（从 P1 提升为 P0）
- 在报告页的低分维度旁，显示"生成优化建议"按钮
- 点击后根据 AI 描述中的问题，生成一条结构化优化文案：
  - 品牌描述改写建议（for AI）
  - 关键词补充建议
  - 官网信息优化建议（for AI 爬取）
- 用户可以 **「复制」** 或 **「标记已应用」**（标记后该优化建议不再显示）
- "应用" = 用户确认已处理，不会自动发布

### P1 功能

#### P1.1 历史趋势
- 每次扫描记录历史分数
- 品牌详情页显示分数变化折线图（过去 7 天 / 30 天）

---

## 4. 数据模型（最小字段）

### 保留的 Prisma Model（共 3 个）

```prisma
// GEO 项目 — 每个品牌一个项目
model GEOProject {
  id        String   @id @default(uuid())
  userId    String
  name      String   // 品牌名
  website   String?  // 官网 URL（从 GeoBrandSetting 移入）
  industry  String?  // 行业
  keywords  Json?    // 关键词 string[]（从 GeoBrandSetting 移入）
  language  String   @default("zh")
  country   String?
  status    String   @default("active")
  config    Json     @default("{}")  // 扩展配置
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  scans GEOScanRecord[]

  @@index([userId])
  @@index([status])
  @@map("kmki_geo_projects")
}

// 扫描记录（原名 GEOProjectVersion，语义更清晰）
model GEOScanRecord {
  id        String   @id @default(uuid())
  projectId String
  userId    String

  // 扫描状态
  scanStatus   String   @default("pending")  // pending | running | completed | failed | partial
  scanStartedAt DateTime?
  scanFinishedAt DateTime?

  // 4 维分数
  visibilityScore    Int?   // 可见度 0-100
  accuracyScore      Int?   // 准确性 0-100
  consistencyScore   Int?   // 一致性 0-100
  recommendationScore Int?  // 推荐意愿 0-100
  overallScore       Int?   // 总分 0-100（加权）

  // 原始数据
  aiResponses   Json?   // { chatgpt: {...}, grok: {...}, claude: {...}, perplexity: {...}, tongyi: {...} }

  // 优化建议（JSON 数组）
  optimizationItems Json?  // [{ dimension, description, suggestion }]

  // 元数据
  errorMessage  String?
  durationMs    Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project GEOProject @relation(fields: [projectId], references: [id])
  @@index([projectId])
  @@index([userId])
  @@index([scanStatus])
  @@map("kmki_geo_scan_records")
}

// 品牌设置（仅保留原 GeoBrandSetting 中尚未合并的字段）
// 核心字段已合并到 GEOProject，此表只保留扩展配置
model GeoBrandSetting {
  id          String   @id @default(uuid())
  projectId   String
  userId      String

  targetAiModels Json?    // string[] — 目标 AI 平台列表
  extraMetadata  Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectId, userId])
  @@map("geo_brand_settings")
}
```

### 被删除的 Model（共 34 个）

参见审计报告附录。所有删除的 Model 都是在 schema 中直接移除注解，对应的表保留数据不操作（后续手动 DROP）。

---

## 5. 前后端交互接口（完整）

### 5.1 API 列表

```
GET    /api/v1/geo/projects                     → 项目列表（仪表盘）
POST   /api/v1/geo/projects                     → 创建品牌
GET    /api/v1/geo/projects/:id                  → 品牌详情
PUT    /api/v1/geo/projects/:id                  → 编辑品牌

POST   /api/v1/geo/projects/:id/scan             → 发起扫描
GET    /api/v1/geo/projects/:id/scans/:scanId    → 获取单次扫描结果
GET    /api/v1/geo/projects/:id/scans            → 扫描列表（历史）

POST   /api/v1/geo/projects/:id/scans/:scanId/optimize  → 生成优化建议
POST   /api/v1/geo/projects/:id/scans/:scanId/apply     → 标记优化已应用

GET    /api/v1/geo/dashboard                     → 用户仪表盘（所有品牌摘要）
```

### 5.2 核心数据契约

**POST /projects** (创建品牌):
```json
{
  "name": "品牌名",
  "website": "https://example.com",
  "industry": "科技",
  "keywords": ["AI", "SaaS", "品牌"]
}
```

**POST /projects/:id/scan** (发起扫描，异步):
```json
// 响应
{
  "scanId": "uuid",
  "status": "pending",
  "estimatedSeconds": 90
}
```

**GET /scans/:scanId** (获取扫描结果):
```json
{
  "scanId": "uuid",
  "status": "completed",
  "overallScore": 68,
  "dimensions": {
    "visibility": { "score": 72, "explanation": "5 个 AI 模型中 4 个能准确识别该品牌" },
    "accuracy": { "score": 65, "explanation": "Claude 和 通义千问 的描述存在事实性偏差" },
    "consistency": { "score": 58, "explanation": "各模型对品牌的定位描述一致性较低" },
    "recommendation": { "score": 82, "explanation": "AI 对品牌整体持正面态度" }
  },
  "problems": [
    {
      "dimension": "consistency",
      "severity": "high",
      "description": "Grok 和 通义千问对品牌的定位描述不一致",
      "optimizationSuggestion": "建议在官网 about 页面补充更明确的品牌定位描述，使用结构化数据标记"
    }
  ],
  "optimizationItems": [
    {
      "dimension": "accuracy",
      "description": "Claude 认为品牌主要面向企业客户，但实际产品同时服务个人和团队",
      "suggestion": "在官网添加 '面向所有用户' 的明确声明，并在首页和 about 页使用 FAQ 结构化数据覆盖这个歧义"
    }
  ],
  "durationMs": 45000,
  "scanFinishedAt": "2026-07-20T10:30:00Z"
}
```

**POST /optimize** (生成优化建议):
```json
// 请求体
{
  "dimension": "accuracy",
  "issueId": "claude-description-偏差"
}

// 响应
{
  "suggestion": "在官网首页的 hero section 添加 '从个人到企业，我们服务于每一位用户' 的描述...",
  "structuredData": "将以下 JSON-LD 添加到页面 <head>:</head>..."
}
```

---

## 6. 高级VIP 权限控制

| 功能点 | 普通用户 | VIP | 高级VIP |
|--------|----------|-----|---------|
| 看到 GEO 入口 | ❌ | ❌ | ✅ |
| 创建品牌（上限） | - | - | **10 个** |
| 发起扫描（每月上限） | - | - | 30 次 |
| 查看报告 | - | - | ✅ |
| 一键优化 | - | - | ✅ |
| 历史趋势 | - | - | ✅ |

**变更**: 品牌上限从 5 个提升到 10 个。

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

---

## 附录: v1.0 → v1.1 变更记录

| # | 变更 | 来源 |
|---|------|------|
| 1 | 5 维度简化为 4 维度：合并情感→推荐意愿 | Review 建议 1 |
| 2 | 扫描 Prompt 改为结构化 JSON 输出，带评分 | Review 建议 2 |
| 3 | 品牌上限 5→10 | Review 建议 3 |
| 4 | 一键优化从 P1 提升为 P0 | Review 建议 4 |
| 5 | GEOProjectVersion 表名改为 GEOScanRecord | Review 建议 5 |
| 6 | website/keywords 字段从 GeoBrandSetting 合并入 GEOProject | Review 建议 5 |
| 7 | 优化建议 API 设计明确 | Review 建议 4 拓展 |
