# GEO Workspace MVP Baseline v1.0

> 2026-07-22 正式冻结
> 定位：后续所有 Sprint 的验收基准，产品 / 架构 / 研发三线统一

---

## 一、原则（三条不可变更）

### 1. Single Source of Truth
任何评分只有一套来源。所有评分统一来自 SIE + Scoring Engine，禁止页面自行计算或维护独立评分逻辑。

### 2. Explain Everywhere
任何数字都必须回答"为什么"，任何建议都必须回答"为什么推荐"，任何状态都必须回答"下一步是什么"。

### 3. User Journey First
任何新增功能，都必须证明它缩短或增强了以下用户主路径：
> **创建品牌 → 分析 → 理解 → 优化 → 验证**

---

# Product Baseline

## 二、MVP 用户主路径（必须全部打通）

```text
Dashboard
↓
创建品牌（≤ 30 秒）
↓
Brand Overview
↓
Quick Discovery（返回真实 ADI）
↓
Explain（为什么是这个分数）
↓
Recommendation（至少 3 条可执行建议）
↓
开始优化
```

## 三、MVP Definition of Done

| # | 标准 | 指标 |
|---|------|------|
| 1 | 品牌创建 | ≤ 30 秒 |
| 2 | Quick Discovery | 返回真实分析结果 |
| 3 | Dashboard / Brand Overview | 自动刷新 |
| 4 | Explain | 能解释主要得分来源 |
| 5 | Recommendation | 至少 3 条可执行建议 |
| 6 | 零文档上手 | 用户无需阅读文档即可完成首次分析 |

## 四、MVP Success Metrics

| 指标 | 目标 |
|-------------------|----------------|
| Brand 创建成功率 | ≥ 95% |
| Quick Discovery 成功率 | ≥ 95% |
| Discovery 平均耗时 | ≤ 30 秒 |
| 首次分析完成率 | ≥ 80% |
| 用户完成主路径时间 | ≤ 3 分钟 |
| Explain 覆盖率 | 100%（所有评分均可解释） |
| AI Presence 检测完成率 | ≥ 95%（所有支持平台均返回状态） |

## 五、Non-goals（不阻塞 MVP）

以下能力明确不纳入 MVP：

- Knowledge Graph 可视化
- 多 Agent 自动协同
- Planner / Queue
- Search Console 深度集成
- Embedding Matcher / LLM Matcher
- AI Visibility 漂移预测
- 企业级权限体系
- 覆盖所有 AI 平台
- 覆盖所有 GEO 优化策略
- 替代专业 SEO/GEO 工具

当前目标仅为：验证 GEO 工作台的核心用户闭环能够独立成立。

## 六、Roadmap

| Phase | 内容 | 优先级 |
|-------|------|--------|
| A（立即） | ★★★★★ 完成 MVP 主路径：空状态引导、自动刷新、删除品牌、主路径演练 | 最高 |
| B1 | ★★★★★ AI Presence：品牌在主流 AI 平台的收录状况与 Explain | 重点 |
| B2 | ★★★★★ Optimization Center：Recommend + 收益预测 | 重点 |
| C | ★★★★☆ Verification：Before/After、Claim/Evidence、BII | 中 |
| D | ★★★★☆ Knowledge Source：添加知识源、Entity Library | 中 |
| E | ★★★☆☆ Monitoring & Publishing：趋势、状态、Search Console | 低 |
| F | ★★☆☆☆ Execution Orchestrator：Planner/Queue/Agent | 最后 |

### Phase B1 详情 — AI Presence（AI 品牌可见度）

Brand Overview 第一屏 / Quick Discovery 结果下方的核心模块。连接 Quick Discovery → Explain → Recommendation 的产品中枢。

**双层架构**：

| 维度 | 含义 |
|------|------|
| **Visibility（可见性）** | AI 是否能识别该品牌或网站 |
| **Knowledge Quality（知识质量）** | AI 回答时是否准确、完整、有引用 |

展示格式：
```
ChatGPT  ✅  可见   ·   知识质量 78/100
Gemini   ✅  可见   ·   知识质量 92/100
Claude   🟡  部分可见  ·   品牌描述缺失
DeepSeek ❌  未发现  ·   建议完善官网
```

**证据等级**：

| 等级 | 说明 |
|------|------|
| A | 多次测试均稳定识别且回答一致 |
| B | 能识别，但信息不完整或偶尔不一致 |
| C | 只能偶尔识别，稳定性较差 |
| D | 当前未识别 |

**数据模型**：
```ts
interface AIPresence {
  provider: string;
  visibility: "visible" | "partial" | "missing" | "checking";
  knowledgeQuality?: number;        // 0-100
  evidenceLevel: "A" | "B" | "C" | "D";
  confidence: number;
  lastCheckedAt?: string;
  evidenceCount: number;
  summary?: string;
  recommendations: string[];
}
```

**与 B2 关系**：
```
Quick Discovery
    ↓
AI Presence (B1)  ←  可见性 + 知识质量 + 证据等级
    ↓
Explain  ←  每个平台为什么是这个状态
    ↓
Recommendation (B2)  ←  基于 AI Presence 结果归因生成建议
```

示例链路：
```
DeepSeek 未发现
  ↓ Explain: 官网未包含 Schema 标记，品牌描述不完整
  ↓ Recommendation: 增加 FAQ / 完善品牌简介 / 补充 Schema
```

**新增 KPI 指标**：`AI 收录率 8/12 67%`（Visible + Partial 合计）

**新增 Success Metric**：AI Presence 检测完成率 ≥ 95%（所有支持平台均返回状态）

**首批支持平台**：
- 国际：ChatGPT / Gemini / Claude / Perplexity / Microsoft Copilot
- 国内：DeepSeek / 豆包 / 通义千问 / 文心一言 / 腾讯元宝 / Kimi / 讯飞星火

---

# Architecture Baseline

## 七、已完成功能

### 品牌管理
- 品牌创建/编辑弹窗（名称、网址、行业、描述）
- Dashboard 品牌卡片列表展示
- 创建品牌按钮（Header 右侧）
- 品牌卡片点击进入 Brand Overview
- 创建后自动跳转 Brand Overview

### Dashboard
- KPI 统计条（品牌数 / 已分析 / 平均 ADI / 待分析）
- 品牌列表 + 完成度进度环
- 分项步骤状态（✓资料 / ○知识 / ✓分析 / ○验真）
- Brand Readiness 完成度
- 快速操作区域

### Brand Overview
- Identity 100% 展示
- Knowledge 0% → 显示"待生成"
- Optimization 进度 + 阶段状态（✓已评估 / ○验真 / ○发布）
- 品牌描述保存与展示

### Quick Discovery（品牌发现）
- 运行发现扫描
- 获取 ADI（AI Discovery Index）
- 实体匹配管线（Matcher Pipeline 重构）

### 知识页面 & 报告中心
- 知识概览展示，后端 KO 数据映射
- 报告展示页面，基础报告生成

## 八、架构 Guardrails

1. **Single Source of Truth** — 同原则 1
2. **Pipeline First** — 新增匹配能力必须实现为独立 Matcher 并注册到 Pipeline，禁止向 Legacy Matcher 堆叠逻辑
3. **DiscoveryContext** — 所有发现、评分、验证模块统一消费 `DiscoveryContext`，不得直接依赖 Project 实体
4. **Registry over Hardcode** — 行业映射、规则、权重优先配置化
5. **Explain Everywhere** — 同原则 2
6. **Adapter not If-else** — 每新增一个 AI 平台，必须实现为独立 Provider Adapter，禁止在业务代码中通过 if-else 判断平台类型

## 九、统一的 Explain 输出协议

所有模块遵循统一输出协议：

```text
Input
  ↓
Analysis
  ↓
Evidence
  ↓
Explain (Reason)
  ↓
Recommendation (Action)
```

具体映射：

| 模块 | Evidence | Explain | Action |
|------|----------|---------|--------|
| Scoring | 各维度得分 | ADI = 78 的原因 | 建议优化的方向 |
| AI Presence | 各平台检测数据 | DeepSeek 未发现的原因 | 增加 Schema / FAQ |
| Verification | Before/After 对比 | 变化来源分析 | 下一步验证建议 |

## 十、Provider Adapter Layer（新增）

AI Presence 能力的底层支撑，确保新增平台 = 新增 Adapter，不改业务层。

```text
AI Presence Engine
    ↓
Provider Adapter Registry
    ↓
┌────────────┬────────────┬────────────┬────────────┐
│ChatGPT     │Gemini      │Claude      │DeepSeek    │
│Adapter     │Adapter     │Adapter     │Adapter     │
└────────────┴────────────┴────────────┴────────────┘
```

所有 Adapter 统一返回：

```ts
interface ProviderResult {
  provider: string;
  visibility: "visible" | "partial" | "missing" | "checking";
  knowledgeQuality: number;             // 0-100
  evidenceLevel: "A" | "B" | "C" | "D";
  evidence: Array<{ source: string; content: string; confidence: number }>;
  explain: Array<{ reason: string; detail: string }>;
  recommendations: Array<{ action: string; impact: string; priority: "high" | "medium" | "low" }>;
}
```

## 十一、Future Extension Points（更新）

```text
DiscoveryContextBuilder
    ↓
Matcher Pipeline (Exact / Natural / …)
    ↓
Scoring Engine
    ↓
AI Presence Engine (新增)
    │  ← Provider Adapter Layer
    ↓
Recommendation Engine
    ↓
Verification Engine (Before/After / Claim / Evidence)
    ↓
Publishing Engine (Website / CMS / Knowledge Base)
```

任何未来模块必须挂接在此链路上，不得绕过。

## 十二、AI Presence Engine 内部架构

```text
AI Presence Engine
│
├── Provider Adapter Registry   ← 注册/发现各平台 Adapter
│   ├── ChatGPT Adapter
│   ├── Gemini Adapter
│   ├── Claude Adapter
│   ├── DeepSeek Adapter
│   └── ...
│
├── Evidence Aggregator         ← 整理来自各 Adapter 的原始证据
│
├── Presence Scoring            ← 计算 Visibility、Knowledge Quality
│
├── Explain Generator           ← 生成用户可读的 Explain + Recommendation
│
└── Presence History            ← 快照记录（Day 1 / 7 / 30），支持趋势追踪
```

### Visibility 类型（5 种）

```ts
type Visibility =
  | "visible"     // 能稳定识别并返回品牌信息
  | "partial"     // 能识别但信息不完整或不稳定
  | "missing"     // 当前未能识别
  | "checking"    // 正在检测中
  | "unknown";    // 当前无法判断（API 不支持、平台限制、证据不足）
```

`unknown` 与 `missing` 的区别：`missing` 是检测有结果但未发现，`unknown` 是检测本身无法执行。

### Data Freshness（数据新鲜度）

```ts
interface DataFreshness {
  lastCheckedAt: string;    // 上次检测时间
  nextRefreshAt: string;   // 下次刷新时间
  cacheAge: number;        // 缓存时效（秒）
  ttl: number;             // 数据有效期（秒）
}
```

UI 展示：`Last Scan 2 hours ago · Next Scan in 4 hours`

### EvidenceSource（证据来源类型）

```ts
enum EvidenceSource {
  Website          // 官网页面
  StructuredData   // Schema / JSON-LD
  KnowledgeBase    // 知识库
  Search           // 搜索引擎
  AIConversation   // AI 对话结果
  OfficialAPI      // 平台官方 API
  ThirdParty       // 第三方数据
}
```

### Explain 增加 Confidence

```ts
interface Explain {
  summary: string;
  confidence: number;       // 0-100
  limitations: string[];    // 局限性说明
  reasons: string[];
}
```

示例：
```
Confidence 92%
Reason: 官网信息完整，FAQ 丰富，Schema 存在
Limitations: 未检测到新闻源
```

### Recommendation 增加 Impact

```ts
interface Recommendation {
  action: string;
  priority: "high" | "medium" | "low";
  difficulty: "easy" | "medium" | "hard";
  expectedImpact: string;          // "ADI +6~10"
  estimatedGain: number;           // 0-100
}
```

### Overall AI Presence Score

在 Dashboard KPI 中新增：
```
Overall AI Presence  82
Visibility  9 / 12
Knowledge Quality  84
Evidence Grade  A
```

### Recommendation 消费链路（SSOT 约束）

```text
Provider Adapter
    ↓
Evidence
    ↓
Presence Engine   ← 计算打分
    ↓
Recommendation Engine  ← 只消费统一 EngineResult，不直接读 Adapter
```

不得绕过 Presence Engine 直接读取 Adapter 输出。保持 Single Source of Truth。

### Capability Registry（平台能力注册）

```ts
interface CapabilityRegistry {
  provider: string;
  supportsPresence: boolean;
  supportsCitation: boolean;
  supportsVerification: boolean;
  supportsPublishing: boolean;
}
```

所有平台统一注册能力集，前端根据能力集决定展示哪些模块。

### 核心原则条款

> 任何页面展示的状态、分数或建议，都必须能够追溯到对应的 Evidence，并能够向用户解释其来源、可信度与局限性。对于无法验证的数据，应明确标记为 Unknown、Checking 或低证据等级，而不是给出确定性结论。

### Engine 统一输出协议

所有 Engine（Scoring / AI Presence / Verification 等）遵循：

```ts
interface EngineResult<TEvidence, TRecommendation> {
  score?: number;
  status: string;
  evidence: TEvidence[];
  explain: {
    summary: string;
    confidence: number;
    limitations: string[];
    reasons: string[];
  };
  recommendations: Array<{
    action: string;
    priority: string;
    difficulty: string;
    expectedImpact: string;
    estimatedGain: number;
  }>;
}
```

### 实现边界约束

AI Presence 的判断必须基于**可验证的数据来源**（公开网页、结构化信息、平台返回结果）。对于检测能力有限的平台，应返回 `checking`、`unknown` 或降低证据等级，不得对无法验证的状态做确定性断言。

---

## 十三、成熟度评估

| 维度 | 当前状态 |
|------|----------|
| 后端架构 | 已基本稳定，可进入能力扩展阶段 |
| 数据模型/API | 已形成统一 Truth Layer |
| 前端体验 | MVP 主流程已形成，需继续降低首次使用成本 |
| 产品成熟度 | 已具备 MVP，可开始验证真实用户价值 |

---

# Engineering Baseline

## 十四、已修复问题

| 问题 | 解决方式 |
|------|----------|
| 描述保存后不显示 | 合并到 config.description |
| 完成度含弹窗不可填字段 | 改为 Identity=100 / Knowledge=100 / Analysis=100 |
| Knowledge 0% 误导 | 改为"待生成" |
| Optimization 57% 误导 | 改为分数 + 步骤状态 |
| 健康检查 500 | 删除死代码变量 |
| 知识页 API 404 | 后端返回格式兼容 |
| KPI 布局四行 | 改为一行统计条 |

## 十五、当前工程架构

- **后端**：8 模块，22 API 端点，零 Route 直接 Prisma
- **前端**：GEO Workspace v1（三栏 / 5 Tab / Explain Everywhere）
- **共享组件**：10 个 kmki-ui 组件
- **发布链**：自动化（build → validate → sync → meta → restart → smoke）

---

---

## 十七、Baseline Governance

基线治理规则，约束未来如何修改 `v1.0`。

### 版本分类

| 变更类型 | 内容 | 示例 |
|----------|------|------|
| **Minor**<br>（v1.1, v1.2, ...） | 不破坏兼容性的补充 | 新增字段 / 新增 Provider / 新增 KPI / 新增 Explain 字段 / 新增 Appender 实现 |
| **Major**<br>（v2.0） | 破坏兼容或修改核心约束 | 修改 EngineResult / 修改 DiscoveryContext 结构 / 修改 Provider Contract / 修改 SSOT 原则 |
| **Deprecated** | 标记废弃 | 任何废弃接口或约束必须至少保留一个版本周期再移除 |

### 修改规则

1. **Minor 变更**：通过附录或新章节追加，不修改 v1.0 已冻结条款。
2. **Major 变更**：必须发布新版本号（如 v2.0），并在新版本中明确标注与 v1.0 的差异。
3. **Deprecated 变更**：必须在变更前一个版本中发出废弃声明，保持至少一个版本周期向后兼容。
4. **任何对三条原则（SSOT / Explain Everywhere / User Journey First）的修改**：自动触发 Major 版本升级。
5. **所有版本变更必须记录在文档末尾的版本记录表中。**

### 版本记录

| 版本 | 日期 | 类型 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-07-22 | — | 初始冻结 |


## 附录 A：v1.1 Clarification（不阻塞 v1.0 冻结）

以下为后续版本应明确的补充约束，当前版本不作强制要求。

### A.1 AI Presence 能力边界

- **Presence（是否可见）**：系统依据当前可获取的证据，对品牌在该 AI 生态中的可见性进行评估，**不等于** AI 官方索引状态或内部收录状态。
- **Knowledge Quality（知识质量）**：基于采集到的回答、引用或公开信息，对回答质量的评估。
- 页面不得暗示检测结果等同于"官方确认已收录"。

### A.2 Engine 版本号

```ts
interface EngineResult {
  engineVersion: string;    // 引擎版本
  scoringVersion: string;   // 评分版本
}
```

算法升级不影响历史数据解释。

### A.3 Evidence 可追溯 ID

```ts
interface Evidence {
  id: string;            // 全局唯一
  provider: string;
  source: EvidenceSource;
  content: string;
  confidence: number;
  createdAt: string;     // 证据采集时间
}
```

Explain 页面可链接到原始证据。

### A.4 Adapter Raw → Normalized 分层

```text
Provider
  ↓
Raw Result        ← Adapter 原始输出
  ↓
Normalized Result  ← 统一格式转换
  ↓
Presence Engine   ← 业务层消费
```

Provider 升级后只需重新 Normalize，无需重新采集。

### A.5 KPI 分层

| 类别 | 指标 | 说明 |
|------|------|------|
| Business KPI | Brand Readiness / AI Presence / ADI | 用户关注的核心指标 |
| System KPI | Discovery Time / Scan Success / Last Refresh | 系统健康度指标 |

Dashboard 应区分展示，避免混合。

---

## 附录 B：v1.1 已知方向（不纳入 v1.0）

以下为未来版本应考虑的补充，当前不阻塞冻结。

### B.1 Engine 状态码

EngineResult 增加统一状态码：

```ts
type EngineStatus =
  | "SUCCESS"            // 正常完成
  | "PARTIAL_SUCCESS"    // 部分数据可用
  | "NO_EVIDENCE"        // 无足够证据
  | "UNSUPPORTED"        // 当前不支持
  | "FAILED";            // 执行失败
```

替代当前自由字符串 `status: string`，便于前端统一渲染。

### B.2 Machine-readable Reason Code

Explain.reasons 增加代码化原因：

```ts
interface Reason {
  code: string;      // 如 SCHEMA_MISSING
  message: string;   // 如"官网没有 Schema"
}
```

替代纯文本，使 Recommendation Engine 和 AI Agent 可直接消费。

---

*GEO Workspace MVP Baseline v1.0 — 2026-07-22 冻结*
