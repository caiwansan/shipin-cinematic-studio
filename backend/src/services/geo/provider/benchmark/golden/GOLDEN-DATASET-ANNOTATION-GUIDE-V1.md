# Golden Dataset Annotation Guide v1

> 生效日期：2026-07-02
> 状态：**已冻结（Frozen）**
> 关联规范：GOLDEN-DATASET-SPEC-V1.md（v1.0 已冻结）
> 用途：确保不同标注者、不同时期的标注结果一致，消除标注漂移

---

## 1. Coverage Band 判定指南

### 1.1 核心原则

Coverage Band 是**综合判断**，不是算术平均。标注者需要同时考虑 DCI 四维（Discoverability / Understanding / Retrieval / Authority），然后给出一个整体 Band。

### 1.2 各 Band 判定标准

#### Excellent（优秀）
| 维度 | 标准 |
|------|------|
| Discoverability | 搜索品牌名，AI 必然提及 |
| Understanding | AI 能准确描述其核心业务、主要产品、行业定位 |
| Retrieval | AI 能回答 3 个以上该实体相关的深度问题 |
| Authority | AI 会主动推荐该实体作为行业标杆 |

**可量化的判断法：** 用 DeepSeek/ChatGPT 各问 3 个问题，如果 6 次回答中该实体都被准确提及且描述无误 → Excellent

**典型实体：** Salesforce, Amazon, Google, Apple, 淘宝, 微信

#### Good（良好）
| 维度 | 标准 |
|------|------|
| Discoverability | 搜索品牌名，AI 基本提及 |
| Understanding | AI 能描述核心业务，但可能有 1 处轻微不准确 |
| Retrieval | AI 能回答 1-2 个深度问题，其他问题回答泛化 |
| Authority | AI 不会优先推荐，但被问到时可以认可 |

**典型实体：** Notion, Figma, Canva, 唯品会, 得物

#### Fair（一般）
| 维度 | 标准 |
|------|------|
| Discoverability | AI 知道这个品牌但可能不会主动提及 |
| Understanding | AI 能说出一句广告语级别的描述（如"XX 是一个 CRM 工具"）|
| Retrieval | AI 只能回答最基本的问题 |
| Authority | AI 不会主动推荐，被问到时也不一定提到 |

**典型实体：** 新兴 SaaS 公司, 区域型平台

#### Weak（弱）
| 维度 | 标准 |
|------|------|
| Discoverability | 搜索品牌名，AI 偶尔提及或含糊不清 |
| Understanding | AI 描述有歧义或混淆 |
| Retrieval | AI 基本无法回答相关问题 |
| Authority | AI 不会推荐 |

**典型实体：** 新创品牌, 垂直小众产品

#### Poor（极弱）
与 Weak 的区别：AI 极少或完全无法感知该实体。

### 1.3 判定流程图

```
该品牌是否无人不知？
  ├─ 是 → 是否跨行业、跨场景？
  │   ├─ 是 → Excellent
  │   └─ 否 → Good
  └─ 否 → 该品牌在行业内知名吗？
      ├─ 是 → AI 能理解其核心吗？
      │   ├─ 是 → Good 或 Fair
      │   └─ 否 → Fair
      └─ 否 → AI 能找到它吗？
          ├─ 是 → Weak
          └─ 否 → Poor
```

> ⚠️ 这是辅助工具，不是死规则。标注者的判断始终优先，但需要在 notes 中说明理由。

### 1.4 基准：哪个 AI？

Coverage Band 的评估基准是 **当前 Benchmark Provider 集合的综合表现**，而非任何单一模型。

默认集合包括（可配置）：
- ChatGPT
- DeepSeek
- Qwen（通义千问）
- Claude
- Gemini
- 豆包
- 文心一言
- 其他后续接入的 Provider

**标注规则：**
1. 标注者**不需要逐模型测试**。标注者基于对一个品牌在**主流 AI 平台平均水平**的认知来给出 Band。
2. 如果标注者对某个品牌在某个 AI 平台上的表现有明确认知差异，应在 `notes` 中注明（如 "DeepSeek 对该品牌的 Coverage 可能高于 ChatGPT"）。
3. 具体的 Provider 级分数由 Benchmark Engine 运行后产出，Golden Dataset 只标注综合 Band。

---

## 2. Confidence Band 判定指南

### 2.1 核心原则

> **Confidence 仅表示标注者对 Ground Truth 的确定程度，与实体质量、品牌影响力、Coverage 高低无任何关系。**

| Band | 标准 | 何时使用 |
|------|------|---------|
| **High** | Ground Truth 有明确官方来源或公知信息 | "Salesforce 是美国公司" → High |
| **Medium** | Ground Truth 合理但可能有争议或版本差异 | 新兴产品的覆盖范围 |
| **Low** | 标注者自己也没有十足把握 | 高速变化的市场地位 |

### 2.2 避免自动绑定

标注者不要默认 Coverage Band 高 → Confidence High。以下都是合理组合：

| Coverage Band | Confidence Band | 场景 |
|--------------|----------------|------|
| Excellent | High | 公知品牌，公认标杆 |
| Excellent | Medium | 虽覆盖广泛，但标注者对 Band 判定不够确定 |
| Fair | High | 标注者非常确定该品牌只有基础覆盖 |
| Excellent | Low | 品牌信息变化极快，今天 Excellent 下月可能不同 |

---

## 3. EntityType 判定指南

### 3.1 八类 EntityType 判定规则

| EntityType | 提问验证 | 举例 |
|-----------|---------|------|
| **Brand** | "这个品牌本身是否独立于公司被认知？" | Nike（品牌名 > 公司名 Nike, Inc.）|
| **Company** | "这是一个注册公司实体吗？" | Salesforce, Inc. |
| **Product** | "这是一个具体的、可购买的产品吗？" | iPhone 16, Photoshop |
| **Service** | "这是一个持续的、非一次性交付的服务吗？" | AWS, 京东物流 |
| **Platform** | "它是否支持第三方在上面构建/交易？" | Shopify, 淘宝, iOS |
| **Organization** | "这是一个非商业机构吗？" | WHO, MIT, 故宫博物院 |
| **Person** | "这是一个真实人物吗？" | Sam Altman, 雷军 |
| **Technology** | "这是一个技术框架/语言/协议？" | React, Kubernetes, HTTP/3 |

### 3.2 容易混淆的情况

| 实体 | 易错 Type | 正确 Type | 原因 |
|------|-----------|-----------|------|
| Shopify | Company | Platform | 更核心的属性是让商家开店 |
| Zoom | Company/Platform | Product | 用户认知为"视频会议产品" |
| 小红书 | Company | Platform | UGC 平台属性 > 公司实体 |
| 京东物流 | Product | Service | 持续性服务 > 一次性产品 |
| Adobe | Company | Company | 公司属性强 | 
| Photoshop | Product | Product | 具体产品 |

### 3.3 Primary Type & Alias

部分实体存在多种合理的 EntityType 选择，例如：

| 实体 | 可能的 Type 冲突 | Primary Type | Alias |
|------|------------------|-------------|-------|
| OpenAI | Company / Brand / Organization | `Company` | `Brand`, `Organization` |
| Apple | Company / Brand | `Brand` | `Company` |
| 清华大学 | Organization / Brand | `Organization` | `Brand` |
| DeepSeek | Company / Product | `Company` | `Product` |

**规则：**
1. 每个实体有且只有一个 **Primary Type** — Benchmark 永远使用 Primary
2. 标注者可以增加 0 或多个 **Alias** — 用于搜索/索引时的备选
3. `notes` 中记录选择 Primary Type 的理由

**Schema 扩展建议（未来版本）：**
```typescript
{
  entityType: "Company",
  entityTypeAliases: ["Brand", "Organization"]
}
```

目前 v1.0 暂不强制 Alias 字段，标注者在 `notes` 中记录即可。

### 3.4 如果仍不确定

选择原则：
1. **用户视角优先** — 用户说"我用 Zoom"说的是产品，不是公司
2. **本质属性优先** — 核心能力是平台还是产品
3. 在 notes 中标注思考过程和备选方案

---

## 4. Scenario 标注指南

### 4.1 规则

- 必须引用 Discovery Scenario Registry 中的 ID
- 不允许自由编写 Scenario 名称
- 如果某个实体明显对应某个现有 Scenario，直接引用
- 如果某个实体的 Scenario 不在 Registry 中，在 notes 中建议新增

### 4.2 典型映射

| 场景 ID | 适用实体类型 | 示例 |
|---------|------------|------|
| discover-brand | Company, Brand, Product | "谁在 CRM 领域？" → Salesforce |
| compare-brands | Company, Product | "Salesforce 和 HubSpot 对比" |
| research-product | Product | "Notion 有什么功能？" |
| evaluate-product-safety | 电商, 医疗 | "亚马逊上的第三方卖家可信吗？" |
| evaluate-shop-trust | 电商平台 | "淘宝上的商品可信吗？" |
| recommend-restaurant | 本地服务 | "附近有什么好的川菜馆？" |

---

## 5. Intent 标注指南

### 5.1 规则

- 必须引用 Intent Registry（Spec §9）
- 不允许自由输入字符串
- 每条记录至少 1 个、最多 3 个 Intent

### 5.2 典型映射

| 实体类型 | 常见 Intent | 示例 |
|---------|------------|------|
| SaaS Company | select-vendor, recommend-product, inquire-pricing | "什么 CRM 最好？" |
| 电商平台 | assess-trust, understand-use-case, find-alternative | "哪里买最靠谱？" |
| 医疗实体 | check-compliance, assess-safety | "这个药安全吗？" |
| 本地服务 | discover-brand, recommend-product | "附近有什么好吃的？" |

---

## 6. Knowledge Signal 标注指南

### 6.1 Signal Type 判定

| SignalType | 选择标准 | 举例 |
|-----------|---------|------|
| Concept | 领域级概念或定位 | "CRM leader"（不是品牌名，是位置）|
| Brand | 品牌自身的特征 | "品牌知名度高" |
| Product | 产品具体功能 | "all-in-one workspace" |
| Founder | 创始人的影响力 | "Elon Musk" |
| Technology | 核心技术栈 | "cloud-native" |
| Certification | 认证资质 | "SOC2 certified" |
| Industry | 所属行业 | "fintech" |
| Competitor | 竞品参照 | "Adobe competitor"（Figma）|
| Market | 市场表现 | "最速 billion ARR" |
| Geography | 地域标签 | "China market leader" |

### 6.2 标注规则

1. **差异化优先** — 选择最能区分该实体与他者的 Signals
   - ✅ Salesforce → "CRM market leader", "massive acquisition strategy"
   - ✅ Workday → "cloud HCM leader", "enterprise HR focus"
   - ❌ Salesforce → "知名企业"（通用描述，任何大公司都能用）

2. **Type 多样化** — 不要全部使用同一 SignalType
   - ✅ "CRM leader"（Concept）+ "cloud platform"（Technology）+ "acquisition of Slack"（Market）
   - ❌ "CRM leader" + "sales tool" + "CRM platform"（全是 Concept）

3. **最少 3 条、最多 6 条**

4. **标注 Importance 等级**

| Importance | 含义 | 举例 |
|-----------|------|------|
| High | 该实体最核心、最具辨识度的特征 | Salesforce → "CRM market leader" |
| Medium | 重要但不定义该实体 | Salesforce → "acquired Slack" |
| Low | 附加信息，辅助理解 | Salesforce → "HQ in San Francisco" |

> ⚠️ **Importance 是语义重要性标注，不是 Benchmark 权重。** 它描述的是这个 Knowledge Signal 在定义该实体时有多重要，而不是它在分数计算中的权重系数。Benchmark Engine 可以以此为参考，但不承诺 `High × 2, Medium × 1` 这类算术映射。

一个实体应至少 1 个 High Signal，最多 2 个。

5. **避免模糊描述** — "全球领先"、"知名企业"、"顶级品牌"这类需要量化证据

---

## 7. Evidence 选择指南

### 7.1 选择优先级

```
第一梯队：官方来源
  → official_website: 公司官网/产品页面
  → documentation: API 文档、开发者指南
  → press_release: 官方新闻稿
  → financial_report: 财报

第二梯队：可信第三方
  → wikipedia: 维基百科
  → trusted_news: 主流媒体（Reuters, Bloomberg, 36Kr, 虎嗅等）
  → analyst_report: Gartner, Forrester, IDC, 艾瑞等

第三梯队：专业来源
  → academic_paper: 学术论文
  → patent: 专利
```

### 7.2 Evidence 结构

```json
{
  "type": "official_website",
  "url": "https://example.com",
  "archiveUrl": "https://web.archive.org/web/...",
  "accessedAt": "2026-07-02",
  "description": "..."
}
```

- `url`：来源链接
- `archiveUrl`（可选）：Web Archive 等存档链接，推荐提供
- `accessedAt`：访问日期，格式 `YYYY-MM-DD`
- `description`：该证据说明了什么

### 7.3 数量要求

| 信息类型 | 最低 Evidence 要求 |
|---------|-------------------|
| entityName, entityType, industry | 至少 1 条 |
| Coverage Band | 至少 1 条（可以是分析报告）|
| Knowledge Signals | 建议 50%+ 有 Evidence |
| Scenarios / Intent | 建议有 Evidence |

### 7.3 常见错误

- ❌ 用社交媒体作为 Evidence（除非是官方账号）
- ❌ 用另一个 AI 输出的内容作为 Evidence
- ❌ 用百度百科/互动百科（依赖作者公信力——标注者自行判断）
- ⚠️ Crunchbase/Tracxn —— 可以用于基础信息，不建议作为 Coverage 的 Evidence

---

## 8. 常见标注错误

### 8.1 EntityType 混淆

| 错误 | 正确 | 原因 |
|------|------|------|
| 给 SaaS 公司标 Brand | Company | 公司注册实体 > 品牌认知 |
| 给平台标 Company | Platform | 平台属性 > 公司属性 |
| 给产品标 Brand | Product | 产品可独立购买 |

### 8.2 Coverage 漂移

| 错误 | 说明 |
|------|------|
| 标注者 A 认为 Adobe = Excellent | 标注者 B 认为 Adobe = Good |
| **纠正方法** | 按 §1 判定流程，询问：AI 是否跨场景推荐 Adobe？|

### 8.3 Knowledge Signal 过于通用

| 错误 | 正确 |
|------|------|
| "全球知名的 XX 平台" | 具体特征：如"最大的 B2B 跨境电商平台" |

---

## 9. 标注工作流

```
Step 1: 确认实体基本信息
  → entityName, entityType, industry, country, language, website
  → 至少 1 个 Evidence

Step 2: 确认语义信息
  → description（客观描述，非广告语）
  → expectedScenarios（引用 Registry）
  → expectedIntent（引用 Registry）

Step 3: 标注 Knowledge Signals
  → 至少 3 条
  → Type 多样化
  → 50%+ 有 Evidence

Step 4: 标注关联实体
  → expectedEntities（至少 3 个）

Step 5: 标注 Bands
  → expectedCoverageBand（按 §1 判定流程）
  → expectedConfidenceBand（诚实标注）

Step 6: 填写元信息
  → version
  → reviewStatus（默认 draft）
  → origin
  → notes（标注理由）

Step 7: 自检
  → 对照 §14 审核清单逐项检查
```

---

## 10. 标注移检测量

为了检测标注漂移，建议：

1. **每批次随机抽 20% 进行交叉审核**（第二人独立标注相同实体）
2. **计算一致性**：Coverage Band 差异 ≤ 1 级为通过
3. **首次标注一致性目标**：≥ 80%
4. **如 < 80%**：回滚该批次，重新培训后再标

---

*本指南由熊大于 2026-07-02 审核冻结。*
