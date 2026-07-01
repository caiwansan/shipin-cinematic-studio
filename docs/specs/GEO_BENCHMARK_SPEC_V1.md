# GEO Benchmark Specification v1.0

> **Benchmark measures what AI actually communicates to users—not what a brand intends to communicate.**

**状态**: FROZEN — v1.0
**生效日期**: 2026-06-30
**维护者**: GEO Platform Team
**文档路径**: `docs/specs/GEO_BENCHMARK_SPEC_V1.md`

---

## Chapter 1 — Vision & Principles

### 1.1 使命

衡量 AI 在真实用户场景下对品牌的认知、理解、引用、推荐和比较能力，并为优化提供可验证的依据。

### 1.2 核心原则

| 原则 | 含义 |
|------|------|
| **Benchmark First** | 任何优化建议必须基于 Benchmark 数据，而非推测 |
| **Provider Agnostic** | Benchmark 不依赖特定 AI 模型，模型只作为 Provider 接入 |
| **Reproducible** | 相同输入 + 相同版本 → 相同结果 |
| **Explainable** | 每个分数必须有可追溯的扣分原因 |
| **Versioned** | 所有组件（Spec / Dataset / Prompt / Judge / Formula）均版本化 |

### 1.3 评估对象

GEO Benchmark 评估的是 **AI 最终传达给用户的品牌认知**，而非企业自己发布的内容。这意味着：

- 品牌发布的内容 → 影响 AI 的 Training Data / Knowledge Base
- AI 如何理解、引用、推荐 → Benchmark 实际测量的对象
- 两者之间的 gap → GEO 优化的价值空间

---

## Chapter 2 — Benchmark Architecture

### 2.1 整体流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Benchmark Pipeline                        │
│                                                             │
│  Dataset  ──→  Runner  ──→  Provider  ──→  Response         │
│     │              │              │             │           │
│     │              │              │             ▼           │
│     │              │              │     Evidence Extractor   │
│     │              │              │             │           │
│     │              │              │             ▼           │
│     │              │              │     Claim Evaluator      │
│     │              │              │             │           │
│     │              │              │             ▼           │
│     │              │              │     Dimension Scorer     │
│     │              │              │             │           │
│     │              │              │             ▼           │
│     │              │              │        BII Calculator    │
│     │              │              │             │           │
│     └──────────────┴──────────────┴─────────────┘           │
│                                                             │
│                     Benchmark Report                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| Dataset | 标准测试题集，按类别/难度/意图组织 |
| Runner | 调度器：遍历 Dataset → 调用 Provider → 收集 Response |
| Provider | AI 模型适配层：统一 Prompt 模板 + 调用参数 |
| Evidence Extractor | 从 Response 中提取品牌相关的 Claim 和引用的证据 |
| Claim Evaluator | 对比 Actual Claims vs Expected Claims，逐条评分 |
| Dimension Scorer | 将 Claims 分数聚合到 BII 八维指标 |
| BII Calculator | 加权计算 Brand Intelligence Index 总分 |

### 2.3 扩展点

- **Provider 层** 可无限扩展，每个模型单独注册
- **Dataset 层** 按 Category 扩展，新增类别不影响现有评分逻辑
- **Evaluate 层** 可通过 Judge Version 升级评分算法

---

## Chapter 3 — BII（Brand Intelligence Index）

### 3.1 指标体系

#### 一级指标

| 指标 | 含义 | 默认权重 | 评估方式 |
|------|------|---------|---------|
| **Visibility** | AI 是否知道该品牌 | 10% | 品牌名称/Logo/基本识别 |
| **Understanding** | AI 是否理解品牌的核心业务和定位 | 15% | 主营业务/品牌使命/目标用户 |
| **Accuracy** | AI 回答的品牌信息是否准确 | 20% | 事实性验证（产品/数据/事件） |
| **Citation** | AI 在回答中是否引用或提及该品牌 | 10% | 主动引用率/上下文相关引用 |
| **Recommendation** | AI 在推荐场景下是否推荐该品牌 | 20% | 推荐频率/推荐理由质量 |
| **Comparative Preference** | 与竞品相比 AI 是否更倾向于该品牌 | 15% | 对比场景中的选择倾向 |
| **Freshness** | AI 掌握的品牌信息是否是最新的 | 5% | 最新产品/动态的认知时效 |
| **Consistency** | 不同提问方式下回答是否一致 | 5% | 同品牌多轮/多角度一致性 |

#### 二级指标（预留扩展）

每个一级指标下可扩展二级指标。例如 Accuracy 可拆分为：
- Product Accuracy：产品信息准确度
- Data Accuracy：数据准确度
- Event Accuracy：事件信息准确度

二级指标在 v1.0 中不强制实现，由具体 Judge 版本定义。

### 3.2 BII 计算公式

```
BII = Σ(wi × si) / Σ(wi)

其中：
  wi = 第 i 个指标的权重
  si = 第 i 个指标的得分（0-100）
  Σ(wi) = 1.0 (所有权重之和归一化)
```

### 3.3 权重管理

- 权重定义存储在配置中心（非硬编码）
- 规范只定义默认值（如 3.1 表）
- 行业垂直场景可覆盖权重（不推荐）
- 权重变更属于 Formula Version 变化，需记录在报告元数据中

### 3.4 BII 等级

| 分数区间 | 等级 | 含义 |
|---------|------|------|
| 90-100 | A+ | AI 对该品牌的认知极佳，全面领先 |
| 75-89 | A | 良好，仅有少数维度需优化 |
| 55-74 | B+ | 中等，存在明显短板 |
| 35-54 | B | 较弱，多个维度需优化 |
| 15-34 | C+ | 差，品牌认知严重不足 |
| 0-14 | C | 几乎不被 AI 认知 |

---

## Chapter 4 — Benchmark Dataset

### 4.1 Dataset Schema

每一道测试题的数据结构：

```typescript
interface BenchmarkQuestion {
  id: string                    // 全局唯一 ID，如 "Q-GEN-001"
  category: QuestionCategory    // 所属类别
  difficulty: 1 | 2 | 3        // 难度：1=基础, 2=中等, 3=深入
  intent: string                // 考察意图，如 "验证品牌推荐倾向"
  
  // 题目内容
  prompt: {
    system?: string             // System Prompt（可选覆盖默认）
    user: string                // User Prompt 模板
  }
  
  // 预期答案
  expectedClaims: ExpectedClaim[]
  
  // 评估规则
  evaluation: {
    dimension: BIIDimension     // 对应 BII 维度
    scoringRule: ScoringRule    // 评分规则
    weight: number              // 该题在本维度内的权重
  }
  
  // 元数据
  tags: string[]                // 标签，如 ["tech", "consumer"]
  lastUpdated: string           // ISO 日期
}
```

### 4.2 类别体系

```
Dataset
├── General（通用认知）
│   ├── Brand Recognition     — "你知道 XX 吗？"
│   ├── Business Description  — "XX 是做什么的？"
│   └── Key Products          — "XX 有哪些主要产品？"
├── Industry（行业深度）
│   ├── Industry Position      — "XX 在行业中排名如何？"
│   ├── Competitive Landscape  — "XX 的主要竞争对手是？"
│   └── Strengths & Weaknesses — "XX 的优势和劣势？"
├── Product（产品认知）
│   ├── Feature Knowledge      — "XX 产品有哪些功能？"
│   ├── Price Positioning      — "XX 的定价策略？"
│   └── User Scenarios         — "什么场景下推荐 XX？"
├── Comparison（对比评估）
│   ├── Direct Comparison      — "XX 和 YY 哪个更好？"
│   ├── Use Case Fit           — "XX 适合什么场景？YY 呢？"
│   └── Trade-off Analysis     — "选择 XX 的取舍是什么？"
├── Recommendation（推荐能力）
│   ├── Active Recommendation  — "有什么推荐？"
│   ├── Contextual Suggest     — "在这种场景下推荐什么？"
│   └── Reasoned Choice        — "为什么推荐 XX？"
├── Trust（信任评估）
│   ├── Controversy Handling   — "关于 XX 的争议你怎么看？"
│   ├── Risk Disclosure        — "使用 XX 有什么风险？"
│   └── Balanced View          — "XX 的优势和不足？"
├── Freshness（时效性）
│   ├── Recent News            — "XX 最近有什么动态？"
│   ├── Product Updates        — "XX 最近发布了什么新品？"
│   └── Market Changes         — "XX 的市场地位有变化吗？"
└── Multi-turn（多轮对话）
    ├── Follow-up              — 追问细节的一致性
    ├── Correction             — 纠正后的反应
    └── Context Persistence    — 多轮品牌信息的保持
```

### 4.3 题库版本

| 版本 | 题数 | 覆盖类别 | 状态 |
|------|------|---------|------|
| v1.0 | 100 | 8 类别 | ✅ 冻结 |
| v2.0 | 300 | 8 类别 × 难度扩展 | 📋 规划 |
| v3.0 | 1000 | 含二级指标 | 🔮 远期 |

### 4.4 题目配比

v1.0 的 100 题配比：

| 类别 | 题数 | 占比 |
|------|------|------|
| General | 15 | 15% |
| Industry | 12 | 12% |
| Product | 13 | 13% |
| Comparison | 15 | 15% |
| Recommendation | 15 | 15% |
| Trust | 10 | 10% |
| Freshness | 10 | 10% |
| Multi-turn | 10 | 10% |

### 4.5 预期 Claims（ExpectedClaim）

```typescript
interface ExpectedClaim {
  claim: string                 // 预期的陈述，如 "XX 是中国领先的智能手机制造商"
  type: 'fact' | 'opinion' | 'recommendation'
  required: boolean             // true = 必须出现，false = 可选但加分
  evidence?: EvidenceSource[]   // 预期的证据来源
  weight: number                // 该 claim 在评分中的权重
}
```

---

## Chapter 5 — Evaluation Engine

### 5.1 评分流程

```
Response Text
    │
    ▼
Step 1: Claim Extraction
    │  — 从 AI 回复中提取与品牌相关的所有陈述
    │  — 区分事实性陈述 vs 观点性陈述
    ▼
Step 2: Evidence Matching
    │  — 识别每个 Claim 是否引用了来源
    │  — 评估引用是否具体、可验证
    ▼
Step 3: Claim Scoring
    │  — 逐条对比 Actual Claim vs Expected Claim
    │  — 三类分数：matched(1.0) / partial(0.5) / missing(0)
    ▼
Step 4: Dimension Aggregation
    │  — 将 Claim 分数按维度聚合
    │  — 加权平均得到维度分
    ▼
Step 5: Reason Generation
    │  — 每个扣分点生成可读的解释
    ▼
Step 6: BII Calculation
    — 权重加权得到 BII 总分
```

### 5.2 Scoring Rules

```typescript
type ScoringRule = 'exact' | 'semantic' | 'evidence_required' | 'comparative'

// exact: Claim 必须精确匹配
// semantic: Claim 语义相似即可
// evidence_required: Claim + Evidence 两者都需匹配
// comparative: 在多选项中判断倾向
```

### 5.3 Reason 规范

每个扣分点的 Reason 必须包含：

| 字段 | 示例 |
|------|------|
| **what** | AI 没有提及品牌的核心产品 |
| **why** | 用户询问主营业务时仅回答了行业概况 |
| **impact** | Understanding 维度扣 8 分 |
| **how to fix** | 建议在品牌官网产品页面补充结构化产品描述 |

---

## Chapter 6 — Provider Specification

### 6.1 Provider 接口

```typescript
interface AIProvider {
  // 基本信息
  name: string
  model: string
  version: string
  
  // 调用方法
  chat(params: ChatParams): Promise<ChatResponse>
  
  // 可选：多轮对话
  chatStream?(params: ChatParams): AsyncIterable<ChatResponse>
}

interface ChatParams {
  messages: ChatMessage[]
  temperature: number
  maxTokens: number
  timeout: number
}

interface ChatResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}
```

### 6.2 支持的 Provider（v1.0）

| Provider | Model | 版本策略 | 优先级 |
|----------|-------|---------|-------|
| DeepSeek | deepseek-chat | 跟踪最新稳定版 | P0 |
| 豆包 | doubao-pro | 固定 API 版本 | P0 |
| 千问 | qwen-max | 跟踪最新稳定版 | P0 |
| 文心一言 | ernie-4.0 | 固定 API 版本 | P0 |
| 腾讯元宝 | hunyuan | 固定 API 版本 | P1 |
| Kimi | moonshot-v1 | 跟踪最新稳定版 | P1 |
| 星火 | spark-4.0 | 固定 API 版本 | P2 |

### 6.3 调用参数默认值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| temperature | 0.3 | 低温度确保可重复性 |
| maxTokens | 2048 | 足够回答复杂品牌问题 |
| timeout | 30s | 单次请求超时 |
| retry | 2 次 | 临时错误重试 |
| language | zh-CN | 统一中文评估 |

---

## Chapter 7 — Prompt Standard

### 7.1 System Prompt（默认）

```
你是一个中立的品牌知识问答助手。请基于你训练数据中掌握的知识，如实回答关于品牌的问题。

回答要求：
1. 如果你知道该品牌，请详细回答，包括品牌基本信息、核心业务、主要产品等。
2. 如果你不确定某些信息，请明确说明你的不确定性。
3. 不要编造不存在的品牌或信息。
4. 如果被问及推荐，请基于客观标准给出推荐理由。
5. 回答语言：简体中文。
```

### 7.2 User Prompt 模板规则

- 所有题目使用统一的 User Prompt 模板
- 模板中 {brand} 为品牌占位符
- 不包含任何引导性语言（不暗示品牌来源）
- 单轮/多轮分别定义模板

### 7.3 随机化控制

- temperature = 0.3（固定）
- top_p = 0.9（固定）
- 不启用 frequency_penalty / presence_penalty
- 同一题目对同一 provider 运行 3 次取中位分（v1.0 可选）

### 7.4 Prompt Pack 版本

Prompt 参数 + 模板组合构成一个 Prompt Pack，独立版本化：

```
prompt-pack-v1.0: 默认 System Prompt + 各题 User Prompt
prompt-pack-v1.1: 调整温度等参数
...
```

每次 Benchmark 报告记录使用的 Prompt Pack 版本。

---

## Chapter 8 — Versioning

### 8.1 多版本号体系

| 版本组件 | 标识 | 示例 | 变更触发条件 |
|---------|------|------|------------|
| Benchmark Spec | `benchmark-spec-v1` | `bm-spec-v1` | 指标体系/权重/流程变更 |
| Dataset | `dataset-v1` | `ds-v1` | 增删题目/修改题目内容 |
| Prompt Pack | `prompt-pack-v1` | `pp-v1` | Prompt 参数/模板变更 |
| Judge | `judge-v1` | `jd-v1` | 评分算法/规则变更 |
| BII Formula | `bii-v1` | `bii-v1` | 权重/等级边界变更 |

### 8.2 报告版本记录

每份 Benchmark Report 必须记录：

```json
{
  "reportId": "R-20260630-001",
  "benchmarkSpecVersion": "bm-spec-v1.0",
  "datasetVersion": "ds-v1.0",
  "promptPackVersion": "pp-v1.0",
  "judgeVersion": "jd-v1.0",
  "biiFormulaVersion": "bii-v1.0",
  "providerVersions": {
    "deepseek": "deepseek-chat@202606",
    "doubao": "doubao-pro@1.2.0"
  },
  "runAt": "2026-06-30T12:00:00Z",
  "runBy": "benchmark-runner-v1.0"
}
```

### 8.3 兼容性规则

- 同一 Spec 版本下，不同 Dataset 版本的报告不可直接对比 BII 分数（需标注版本差异）
- 同一 Dataset 版本下，不同 Judge 版本需同时保留两套分数
- Formula 版本变更需要同时计算新旧两版分数至少 30 天

---

## Chapter 9 — Golden Dataset

### 9.1 目的

建立一组长期不变的基准品牌集合，用于：
- 校准各模型的评分基准
- 验证评分稳定性（同一品牌多次运行差异）
- 检测评分漂移（算法变更后分数变化）
- 新模型接入时的基线测试

### 9.2 Golden Brands（v1.0）

#### 国际品牌

| 品牌 | 行业 | 入选理由 |
|------|------|---------|
| Apple | 消费电子 | 全球知名度极高，信息充分 |
| Microsoft | 科技/软件 | 多维度的产品线和市场认知 |
| NVIDIA | 芯片/AI | 近期热度极高，时效性测试好 |
| OpenAI | AI | 新一代 AI 公司的典型代表 |

#### 中国头部品牌

| 品牌 | 行业 | 入选理由 |
|------|------|---------|
| 华为 | 科技/通信 | 技术+消费品牌综合认知 |
| 阿里巴巴 | 电商/云计算 | 多元化业务，行业深度好 |
| 腾讯 | 互联网/游戏 | 社交+内容+金融综合 |
| 比亚迪 | 汽车/新能源 | 验证行业深度和新业务认知 |

#### 中型品牌

| 品牌 | 行业 | 入选理由 |
|------|------|---------|
| MiniMax | AI | 验证国内 AI 初创公司认知 |
| 追觅科技 | 消费电子 | 验证垂直品类品牌认知 |
| 理想汽车 | 新能源汽车 | 验证新势力车企认知 |

#### 新兴品牌

| 品牌 | 行业 | 入选理由 |
|------|------|---------|
| 智谱AI | AI | 验证最新 AI 创业公司认知 |
| Temp | — | 预留：由熊大指定 |

### 9.3 使用规则

- Golden Dataset 品牌**不参与 BII 排名对比**
- 每次 Benchmark 运行前，先跑一遍 Golden Dataset 作为 Calibration
- Golden Dataset 的分数漂移 > 5% 时，需检查 Benchmark 环境是否变化
- Golden Brand 每半年审核一次，增减需通过 Spec 版本更新

---

## Chapter 10 — Benchmark Report Schema

### 10.1 输出数据结构

```typescript
interface BenchmarkReport {
  // 元数据
  meta: {
    reportId: string
    brandName: string
    brandIndustry?: string
    benchmarkVersion: string     // Spec + Dataset + Prompt + Judge + Formula
    provider: string
    model: string
    runAt: string
    duration: number             // 总耗时（秒）
  }
  
  // BII 总评分
  overall: {
    biiScore: number             // 0-100
    biiGrade: string             // A+ / A / B+ / B / C+ / C
    confidence: number           // 置信度 0-1
  }
  
  // 维度评分
  dimensions: {
    [key in BIIDimension]: {
      score: number              // 0-100
      weight: number             // 权重
      weightedScore: number      // score × weight
      grade: string
      keyFindings: string[]      // 关键发现
      deductionReasons: DeductionReason[]
    }
  }
  
  // 模型对比（多模型运行时）
  modelComparison?: {
    best: string                 // 得分最高的模型
    scores: {
      [model: string]: number
    }
  }
  
  // 改进建议
  recommendations: Recommendation[]
  
  // 历史对比（如果有之前的数据）
  vsPrevious?: {
    previousReportId: string
    scoreDelta: number
    dimensionDeltas: { [key: string]: number }
  }
}

interface DeductionReason {
  questionId: string
  claim: string
  expected: string | null
  actual: string | null
  score: number                  // 0 / 0.5 / 1
  reason: string
  impact: string
}

interface Recommendation {
  priority: 'P0' | 'P1' | 'P2'
  dimension: BIIDimension
  category: string               // 如 "content_gap" / "freshness" / "accuracy"
  what: string                   // 问题描述
  why: string                    // 为什么重要
  how: string                    // 建议方案
  expectedImpact: {
    dimension: string
    delta: number                // 预期提升分数
  }
  confidence: number             // 0-1
}
```

### 10.2 报告版本

- 报告版本与 Dataset 版本无关
- 同一份 Dataset 可产生多份报告（不同模型，不同时间）
- 报告 ID 格式：`R-{YYYYMMDD}-{序列号}`

### 10.3 数据复用

Benchmark Report 的输出直接作为以下功能的数据源：
- **Health Report**：展示 BII 评分 + 维度详情 + 关键发现
- **Optimization**：基于 DeductionReason 生成优化建议
- **Verification**：Before/After 对比
- **Monitor**：历史趋势 + 漂移检测

---

## Appendix A — BII Dimension 定义

| 维度 | 满分场景描述 | 零分场景描述 |
|------|-------------|-------------|
| Visibility | AI 能准确说出品牌名称、所在行业、核心业务 | AI 完全不认识该品牌 |
| Understanding | AI 准确描述品牌定位、目标用户、差异化优势 | AI 只给出笼统的行业描述 |
| Accuracy | AI 提供的所有产品/数据/事件信息完全准确 | AI 提供了明显错误的信息 |
| Citation | AI 主动引用品牌官网、产品页面等具体来源 | AI 完全不提及任何品牌来源 |
| Recommendation | AI 在相关场景主动推荐该品牌并给出理由 | AI 推荐其他品牌或表示不推荐 |
| Comparative Preference | AI 在与竞品比较时倾向于该品牌 | AI 明确推荐竞争对手 |
| Freshness | AI 掌握品牌最新产品/动态（3 个月内） | AI 的信息滞后超过 1 年 |
| Consistency | 不同提问方式得到的回答一致 | 不同问题给出矛盾的回答 |

## Appendix B — ExpectedClaim 示例

```json
{
  "brand": "华为",
  "questions": [
    {
      "id": "Q-GEN-001",
      "category": "general",
      "difficulty": 1,
      "prompt": { "user": "你知道华为吗？请介绍一下。" },
      "expectedClaims": [
        {
          "claim": "华为是中国的科技公司",
          "type": "fact",
          "required": true,
          "weight": 1.0
        },
        {
          "claim": "华为主要业务包括通信设备和消费电子",
          "type": "fact",
          "required": true,
          "weight": 1.0
        },
        {
          "claim": "华为的核心产品包括智能手机、5G 设备和云服务",
          "type": "fact",
          "required": false,
          "weight": 0.8
        },
        {
          "claim": "华为在全球通信设备市场领先",
          "type": "opinion",
          "required": false,
          "weight": 0.5
        }
      ]
    }
  ]
}
```

## Appendix C — 版本记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.0 | 2026-06-30 | 初始冻结版本，10 章完整定义 |
