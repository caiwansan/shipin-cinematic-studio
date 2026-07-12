# Golden Dataset Specification v1

> 生效日期：2026-07-02
> 状态：草稿（待熊大审核冻结）
> 所有者：GEO Team
> 关联：RC2-T002.5 Discovery Calibration

---

## 1. 设计原则

### 1.1 Ground Truth，不是 Score

Golden Dataset 是**基准真相**，不是最终分数。

| 它应该做什么 | 它不应该做什么 |
|---|---|
| 记录"某品牌是否属于某个 Scenario" | 计算最终 Coverage 分值 |
| 记录"某个 Knowledge Signal 是否成立" | 预测 AI 表现 |
| 标注预期行为等级（Band） | 指定精确数值 |

真正的 Coverage 分数留给 Benchmark Engine，通过实际运行 Discovery Provider 来计算。

### 1.2 引用不定义

- Scenario 来源：必须引用 Discovery Scenario Registry
- EntityType 来源：必须引用本规范的定义
- Industry 来源：独立字段，与 EntityType 正交

### 1.3 版本化

每份 Dataset 文件包含 Metadata 头，变更时需要创建新版本（SemVer）。

---

## 2. 目录结构

```
backend/src/services/geo/provider/benchmark/
├── golden/
│   ├── GOLDEN-DATASET-SPEC-V1.md        ← 本规范
│   ├── v1.0/                             ← 版本目录
│   │   ├── metadata.yaml                 ← 全局元数据
│   │   ├── saas.json                     ← 单一行业文件
│   │   ├── ecommerce.json
│   │   ├── manufacturing.json
│   │   ├── healthcare.json
│   │   ├── education.json
│   │   ├── local-services.json
│   │   └── ai-enterprise.json
│   └── v1.x/                             ← 未来版本
```

### 2.1 行业目录命名规则

| 行业 | 文件名 | 行业 ID |
|------|--------|---------|
| SaaS | `saas.json` | `saas` |
| 电商 | `ecommerce.json` | `ecommerce` |
| 制造 | `manufacturing.json` | `manufacturing` |
| 医疗 | `healthcare.json` | `healthcare` |
| 教育 | `education.json` | `education` |
| 本地服务 | `local-services.json` | `local-services` |
| AI 企业 | `ai-enterprise.json` | `ai-enterprise` |

---

## 3. Metadata 头

每个 Dataset 文件的第一个字段是 Metadata：

```yaml
{
  "_metadata": {
    "datasetVersion": "1.0.0",
    "schemaVersion": "1.0",
    "annotationGuideVersion": "1.0",
    "frozenAt": "2026-07-02",
    "owner": "GEO Team",
    "reviewers": ["熊大"],
    "approved": true,
    "approvalDate": "2026-07-02",
    "source": "manual-annotation",
    "description": "Golden Dataset Specification v1.0 — 已冻结",
    "schemaRef": "GOLDEN-DATASET-SPEC-V1.md",
    "scenarioSource": "Discovery Scenario Registry v1",
    "changelog": [
      {
        "date": "2026-07-02",
        "change": "Initial creation",
        "author": "OpenClaw (sub-agent)"
      }
    ],
    "count": 20,
    "industries": ["saas"],
    "entityTypes": ["Company", "Product", "Platform"],
    "coverageBands": ["Excellent", "Good", "Fair", "Weak"]
  }
}
```

---

## 4. Schema 定义

### 4.1 Entity Schema（完整结构）

```typescript
interface GoldenEntity {
  // === 标识 ===
  id: string;                    // "golden-v1-saas-001"
  entityName: string;            // "Salesforce"
  entityType: string;            // 必须来自 §5 EntityType 列表
  industry: string;              // 行业 ID，§2.1 行业目录命名规则

  // === 定位信息 ===
  country: string;               // ISO 3166-1 alpha-2，如 "US", "CN"
  language: string;              // ISO 639-1，如 "en", "zh"
  website: string;

  // === 语义信息 ===
  description: string;           // 一句话说明
  expectedScenarios: string[];   // 引用 Discovery Scenario Registry 的 ID（字符串，非数字）
  expectedIntent: string[];      // 引用 Intent Registry（见 §12）

  // === 知识信号 ===
  expectedKnowledgeSignals: KnowledgeSignal[];

  // === 实体关联 ===
  expectedEntities: string[];    // 预期 AI 应该知道的子实体/关联实体

  // === 预期等级（Band，非精确数值）===
  expectedCoverageBand: CoverageBand;
  expectedConfidenceBand: ConfidenceBand;

  // === 证据 ===
  evidence: Evidence[];          // Ground Truth 的来源（见 §13）

  // === 元信息 ===
  version: string;               // "1.0.0"
  reviewStatus: ReviewStatus;    // §14 Review Status
  origin: Origin;                // §15 Replay Origin
  notes: string;                 // 标注说明，标注理由
}
```

### 4.2 KnowledgeSignal Schema

```typescript
interface KnowledgeSignal {
  type: SignalType;              // 信号类型，见 §6
  text: string;                  // 信号内容
  importance: ImportanceLevel;   // 信号重要性
}

type ImportanceLevel = "High" | "Medium" | "Low";
```

### 4.3 Band 定义

```typescript
type CoverageBand = "Excellent" | "Good" | "Fair" | "Weak" | "Poor";
type ConfidenceBand = "High" | "Medium" | "Low";
```

### 4.4 Evidence Schema

```typescript
interface Evidence {
  type: EvidenceType;           // 证据类型
  url?: string;                 // 来源 URL
  archiveUrl?: string;          // 存档 URL（可选，推荐）
  accessedAt: string;           // 访问日期，格式 "YYYY-MM-DD"
  description: string;          // 说明了什么
}

type EvidenceType =
  | "official_website"          // 官方网站/产品页
  | "wikipedia"                 // 维基百科
  | "documentation"             // 官方文档
  | "trusted_news"              // 可信新闻报道
  | "analyst_report"            // 分析师报告（Gartner/Forrester 等）
  | "academic_paper"            // 学术论文
  | "press_release"             // 官方新闻稿
  | "patent"                    // 专利
  | "financial_report";         // 财报/公开财务数据
```

### 4.5 Review Status

```typescript
type ReviewStatus = "draft" | "reviewed" | "verified" | "golden";
```

### 4.6 Origin

```typescript
type Origin =
  | "manual"                    // 人工标注
  | "production-replay"         // 生产环境回放
  | "customer-case"             // 客户案例
  | "benchmark"                 // Benchmark 衍生
  | "synthetic";                // 合成数据（需标注）
```

---

## 5. EntityType 定义

EntityType 和 Industry 是**正交**的。

| EntityType | 含义 | 举例 |
|------------|------|------|
| `Brand` | 品牌/商标 | Nike, Apple 品牌本身 |
| `Company` | 公司/企业 | Salesforce, Inc., 京东集团 |
| `Product` | 具体产品 | iPhone 16, Salesforce Sales Cloud |
| `Service` | 服务/解决方案 | AWS, 京东物流 |
| `Platform` | 平台型产品 | iOS, 淘宝, Shopify |
| `Organization` | 组织/机构 | WHO, 清华大学 |
| `Person` | 人物 | Elon Musk, Sam Altman |
| `Technology` | 技术/框架 | GPT-4, React, Kubernetes |

### 5.1 选择规则

1. **优先选择最能描述该实体本质的 Type**
   - Salesforce → `Company`（公司实体）
   - Salesforce Sales Cloud → `Product`（公司旗下产品）
   - Amazon → `Company`
   - Amazon Web Services → `Service`
   - 京东 → `Company`
   - 京东物流 → `Service`
   - 小红书 → `Platform`（平台属性强于公司属性）

2. **如果一个实体同时符合多个 Type，选择最广泛的**
   - Shopify 既是 Company 也是 Platform → 取 `Platform`
   - Zoom 既是 Company 也是 Product → 取 `Product`（用户认知为产品）

3. **标注者在 notes 中记录思考过程**

---

## 6. Knowledge Signal 类型定义

| SignalType | 含义 | 举例 Value |
|------------|------|------------|
| `Concept` | 领域概念/定位 | "CRM leader", "enterprise SaaS" |
| `Brand` | 品牌属性 | "品牌知名度高", "design democratization" |
| `Product` | 产品/功能属性 | "all-in-one workspace", "CI/CD" |
| `Founder` | 创始人/领导团队 | "Elon Musk", "Sam Altman" |
| `Technology` | 核心技术 | "cloud computing", "AI-native" |
| `Certification` | 认证/资质 | "SOC2", "ISO 27001" |
| `Industry` | 所属/关联行业 | "fintech", "ecommerce" |
| `Competitor` | 竞品/竞争关系 | "Adobe competitor", "Salesforce competitor" |
| `Market` | 市场表现 | "unicorn", "IPO", "pandemic growth" |
| `Geography` | 地理/区域 | "China market", "Latin America" |

### 6.1 标注规则

- 每条实体至少 3 个、最多 6 个 Knowledge Signals
- 优先覆盖不同 SignalType（不要全是 `Concept`）
- Signals 应代表该实体最独特的、最能区分它的特征
- 避免通用描述（"知名企业"、"全球领先" 除非有量化依据）

---

## 7. Coverage Definition — DCI 框架

### 7.1 定义

> **Coverage = Discovery Coverage Index (DCI)**
>
> 品牌在目标 Discovery 场景中的可发现性覆盖指数。
>
> 它是四维综合指标，而非单一行为。

### 7.2 四维框架

| 维度 | 含义 | Benchmark 验证方式 |
|------|------|--------------------|
| **Discoverability** | AI 是否能找到这个实体 | 搜索品牌名，AI 是否提及 |
| **Understanding** | AI 是否理解实体是什么 | 问"XX 是什么"，AI 描述准确度 |
| **Retrieval** | AI 是否能召回相关知识 | 问具体问题（产品、服务等），AI 召回率 |
| **Authority** | AI 是否倾向于引用或推荐该实体 | 问"推荐一个 XX"，AI 是否推荐此实体 |

### 7.3 Band 映射

| Band | 含义 | DCI 范围（内部计算） | 典型特征 |
|------|------|---------------------|----------|
| `Excellent` | 完整覆盖，权威推荐 | 85–100 | 四维均高，AI 主动推荐 |
| `Good` | 覆盖良好，有少量缺失 | 70–84 | 三个维度高，一个维度偏低 |
| `Fair` | 基础覆盖，有缺失 | 50–69 | 基础理解+可发现，召回或权威不足 |
| `Weak` | 覆盖不足 | 25–49 | 只能发现，理解和召回都不足 |
| `Poor` | 几乎不可发现 | 0–24 | AI 很少或无法提及 |

**Golden Dataset 只标注 Band，不存具体分值。**
具体分数由 Benchmark Engine 运行 Discovery Provider 后计算得出。

---

## 8. Band 标注指南

### 8.1 Coverage Band 标注规则

| 条件 | 建议 Band |
|------|-----------|
| 全球知名品牌，多产品线，广泛被 AI 引用 | Excellent |
| 行业知名，AI 能较好理解，但不足够推荐 | Good |
| 有知名度但覆盖不全面，AI 只能回答基础问题 | Fair |
| 小众或新兴品牌，AI 偶尔提及但信息不全 | Weak |
| 极少数 AI 知晓 | Poor |

### 8.2 Confidence Band 标注规则

标注者对自己标注的信心：

| Band | 含义 | 适用场景 |
|------|------|---------|
| `High` | 非常确定，大规模公知信息 | Salesforce = Company, Amazon = Excellent |
| `Medium` | 较确定，但可能随版本变化 | 新兴产品的 EntityType |
| `Low` | 不确定，需要进一步验证 | 模糊边界的 Industry 归属 |

### 8.3 Intent 标注规则

每条实体至少标注 1 个预期 Intent，最多 3 个。

| Intent ID（新，无冲突） | 原来的冲突 Scenario ID | 修正后 Scenario ID |
|------------------------|----------------------|-------------------|
| `discover-brand` | `brand-discovery`（旧 Intent ID 已废弃） | `discover-brand` |
| `compare-vendors` | `brand-comparison`（旧 Intent ID 已废弃） | `compare-brands` |
| `recommend-product` | — | — |
| `assess-safety` | `product-safety` | `evaluate-product-safety` |
| `assess-trust` | `shop-trust` | `evaluate-shop-trust` |
| `ask-technical` | — | — |

> ⚠️ 此表为 Registry 修正指引。标注时如果遇到 `expectedIntent` 与 `expectedScenarios` 产生冲突的双向引用，以 Intent Registry 为基准。Scenario Registry 的 ID 后续需要统一重构。至少当前需要 Intent 与 Scenario 不共享 Identifier。

Intent 必须引用本 Registry（§9），**不允许** 自由输入字符串。

---

---

## 9. Intent Registry

Intent 必须来自以下 Registry，**不允许** 自由输入字符串。

| Intent ID | 名称 | 含义 |
|-----------|------|------|
| `discover-brand` | 发现品牌 | AI 是否知道这个品牌 |
| `compare-vendors` | 对比供应商 | AI 是否能对比多个品牌/供应商 |
| `select-vendor` | 选择供应商 | AI 是否能推荐/选择供应商 |
| `recommend-product` | 推荐产品 | AI 是否会推荐该产品 |
| `inquire-pricing` | 查询价格 | AI 是否能回答价格信息 |
| `find-alternative` | 寻找替代品 | AI 是否能推荐替代品 |
| `get-implementation-guide` | 获取实施指南 | AI 是否能提供实施指导 |
| `check-integration` | 检查集成 | AI 是否能回答集成问题 |
| `assess-trust` | 评估信任度 | AI 是否能评估可信度 |
| `assess-safety` | 评估安全性 | AI 是否能评估安全性 |
| `ask-technical` | 技术问答 | AI 是否能回答技术问题 |
| `understand-use-case` | 了解用例 | AI 是否知道产品的用途 |
| `get-industry-insight` | 获取行业洞察 | AI 是否能提供行业分析 |
| `check-compliance` | 合规查询 | AI 是否能回答合规问题 |

### 9.1 Intent 与 Scenario 的关系

- **Scenario** = "用户在什么场景下提问"（如 `discover-brand`, `compare-brands`, `research-product`）
- **Intent** = "用户想解决什么问题"（如 `select-vendor`, `recommend-product`, `assess-trust`）

两者可以关联但不是一对一。一个 Scenario 可能对应多个 Intent，反之亦然。

---

## 10. Evidence（证据来源）

### 10.1 规则

每一条 Ground Truth 都必须有 Evidence 支撑。不允许无来源的标注。

### 10.2 Evidence 选择优先级

1. **第一优先**：官方来源（official_website, documentation, press_release, financial_report）
2. **第二优先**：可信第三方（wikipedia, trusted_news, analyst_report）
3. **第三优先**：专业来源（academic_paper, patent）

### 10.3 示例

```json
{
  "evidence": [
    {
      "type": "official_website",
      "url": "https://salesforce.com",
      "archiveUrl": "https://web.archive.org/web/20260701/salesforce.com",
      "accessedAt": "2026-07-02",
      "description": "Salesforce 官方 CRM 产品页面"
    },
    {
      "type": "wikipedia",
      "url": "https://en.wikipedia.org/wiki/Salesforce",
      "accessedAt": "2026-07-02",
      "description": "Wikipedia 确认 Salesforce 是 CRM 市场领导者"
    }
  ]
}
```

### 10.4 最小要求

- Entity-level ground truth（entityName, entityType, industry）：至少 1 个 Evidence
- Coverage Band：至少 1 个 Evidence
- Knowledge Signals：建议每个 Signal 有 Evidence，至少 50% 的 Signals 有 Evidence
- Scenario/Intent 关联：建议有 Evidence

---

## 11. Review Status

Golden Dataset 的所有数据分为四个等级：

| Status | 含义 | 能否进入 Benchmark |
|--------|------|-------------------|
| `draft` | 初版标注，未审核 | ❌ |
| `reviewed` | 已人工审核，但未最终确认 | ❌ |
| `verified` | 已通过交叉验证 | ✅ 可进入内部分析 |
| `golden` | 最终确认的 Golden Data | ✅ 正式 Benchmark 标准 |
| `rejected` | 交叉审核后发现标注错误，保留历史 | ❌ |

### 11.1 晋升路径

```
draft
  │
  ▼
reviewed ──────────► rejected
  │
  ▼
verified ──────────► rejected
  │
  ▼
golden
```

- **golden → rejected**：不直接发生。已经 golden 的数据如需废弃，走 deprecation 流程，保留历史。

- **draft → reviewed**：标注者完成一次自检
- **reviewed → verified**：第二人交叉审核
- **verified → golden**：熊大或 GEO 负责人审批
- **→ rejected**：交叉审核认定为错误标注，不删除，保留历史用于审计

### 11.2 批量晋升

一个行业文件中的所有条目可以统一晋升，但：
- 晋升到 `golden` 前，单条逐一确认
- 新添加的条目默认 `draft`

---

## 12. Origin（数据来源）

| Origin | 含义 | 优先度 |
|--------|------|--------|
| `manual` | 人工标注 | ✅ 初始阶段唯一来源 |
| `production-replay` | 生产环境用户行为回放生成 | ⭐ 长期最可靠 |
| `customer-case` | 客户案例转化的 Ground Truth | ⭐ 产品价值对齐 |
| `benchmark` | 从 Benchmark 结果衍生 | ✅ 可辅助扩量 |
| `synthetic` | LLM 合成数据（需标注） | ⚠️ 仅用于起量，需标注 `synthetic` |
| `imported` | 从旧版本/旧格式迁移的历史数据 | ⚠️ 迁移专用 |

统计报告应包含：
- Golden Dataset 中 `manual` 占比
- `production-replay` 占比
- `synthetic` 占比

长期目标：`production-replay` + `customer-case` 占比超过 60%。

---

## 13. 变更流程

### 9.1 版本号规则

遵循 SemVer：`MAJOR.MINOR.PATCH`

| 变更类型 | 版本号变更 | 示例 |
|---------|-----------|------|
| Schema 变更（增加/删除字段） | MAJOR | 1.0.0 → 2.0.0 |
| 新增实体/行业 | MINOR | 1.0.0 → 1.1.0 |
| 修正现有实体的标注错误 | PATCH | 1.0.0 → 1.0.1 |

### 9.2 变更流程

1. 修改对应行业 JSON 文件
2. 更新 Metadata 中的 changelog
3. 更新 Metadata 中的 version
4. 提交 PR/commit 时附上变更说明
5. 需要熊大 approve

---

## 14. 审核清单

在审核 Golden Dataset 样本时，检查以下内容：

- [ ] `entityName` 准确，无拼写错误
- [ ] `entityType` 来自 §5 定义，Orthogonal to Industry
- [ ] `industry` 来自 §2.1 工业目录
- [ ] `country` 和 `language` 已填写
- [ ] `description` 是客观事实，非主观评价
- [ ] `expectedScenarios` 引用 Registry ID（非空）
- [ ] `expectedIntent` 引用 Intent Registry (§9)，不是自由字符串
- [ ] `expectedKnowledgeSignals` 至少有 3 条，SignalType 多样化
- [ ] `expectedEntities` 至少 3 个
- [ ] `expectedCoverageBand` 符合 Annotation Guide 判定标准
- [ ] `expectedConfidenceBand` 诚实标注
- [ ] `evidence` 至少 1 条，优先使用官方来源
- [ ] `reviewStatus` 正确（draft/reviewed/verified/golden）
- [ ] `origin` 正确
- [ ] `version` 正确
- [ ] Metadata 头完整（datasetVersion/schemaVersion/annotationGuideVersion/owner/changelog/count/entityTypes/coverageBands）

---

## 15. 已有数据的迁移计划

现有 `golden-v1-part1.json`（40 条）需要按本规范迁移：

1. 拆分 SaaS 和 电商 到各自行业文件
2. 增加 Metadata 头
3. coverage → expectedCoverageBand（需标注者重新判定 Band）
4. 增加 country/language/version 字段
5. expectedKnowledgeSignals 改为 SignalType 结构
6. entityType 按 §5 重新标注
7. 删除原始的 coverage 数值

迁移工作在规范冻结后进行。

---

*本规范由熊大于 2026-07-02 审核冻结。*
