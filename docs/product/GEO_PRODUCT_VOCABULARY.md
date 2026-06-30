# GEO Product Vocabulary v1.0
## Brand Knowledge OS — 允许词汇体系（Approved Language Set）

> 冻结日期：2026-07-19
> 生效范围：Workspace + Studio + 全部 Brand OS 产品
> 原则：只允许使用"用户可理解语言"，禁止工程语言外溢

---

# 一、核心原则（Vocabulary Principles）

## Principle V1 — User Language First

所有术语必须是用户能理解的商业/品牌语言，不是系统语言、工程语言或数据结构语言。

## Principle V2 — One Meaning Only

每个词只能有一个核心含义。不允许一词多义、技术重载或模型内隐含解释。

## Principle V3 — Workspace Consistency

Workspace 与 Studio 可以使用不同语言层级，但 Workspace 永远优先简单语言。

## Principle V4 — No Technical Leakage

任何词不得暴露 Runtime、Pipeline、Adapter、Repository、Engine、Graph、Node、Claim、Evidence。

---

# 二、核心产品词汇（Core Vocabulary）

## 1. Brand（品牌）

**定义**：用户正在管理的主体（公司 / 产品 / 个人品牌）。

**使用场景**：Brand 是 Workspace 的最高级实体。所有页面围绕 Brand 展开。

## 2. Brand Health（品牌健康）

**定义**：品牌在 AI 世界中的整体可理解性、可信度与推荐能力。

**使用场景**：Workspace 的北极星指标。唯一的主分。

## 3. Knowledge（品牌知识）

**定义**：构成品牌的所有可被 AI 理解的信息集合。

**包含**：品牌介绍、产品信息、页面内容、FAQ、结构化信息。

## 4. Recommendation（推荐）

**定义**：AI 给出的提升 Brand Health 的建议。

**替代**：Optimize / Suggestion / Action Plan。

## 5. Improvement（优化）

**定义**：对品牌知识进行改进、使 Brand Health 提升的行为。

## 6. Verification（验证）

**定义**：确认品牌信息是否真实、完整、一致的过程。

## 7. Publishing（发布）

**定义**：将品牌知识分发到外部渠道的过程。

**包含**：Website, CMS, AI Feed, Search Index。

## 8. Growth（成长）

**定义**：品牌随时间在 AI 世界中的影响力提升过程。

**替代**：Monitor / Timeline / History。

## 9. Channel（渠道）

**定义**：品牌知识发布的目标平台。

**示例**：Website, CMS, AI Feed, Search Engines。

**替代**：Adapter（禁止词）。

## 10. Insight（洞察）

**定义**：AI 对品牌状态的解释性分析。

## 11. Action（行动）

**定义**：用户可以执行的明确操作。

## 12. Status（状态）

**定义**：当前系统或品牌所处的结果状态。

## 13. Score（评分）

**定义**：0-100 的品牌健康量化值。

**仅允许用于**：Brand Health 及其子维度指标。

---

# 三、产品结构词汇（Structural Vocabulary）

| 词汇 | 定义 | 说明 |
|------|------|------|
| **Workspace** | 面向品牌管理者的操作界面 | 简单、非技术、引导行动 |
| **Studio** | 面向高级用户/内部人员的配置与系统管理环境 | 包含系统能力、发布规则、集成配置 |
| **Health** | 展示 Brand Health 状态与趋势的页面 | 一级导航 |
| **Recommendations** | AI 推荐用户可执行的品牌优化动作 | 一级导航 |
| **Verification** | 展示品牌信息可信度与验证结果 | 一级导航 |
| **Publishing** | 管理品牌内容发布与渠道分发 | 一级导航 |
| **Growth** | 展示品牌长期趋势与历史变化 | 一级导航 |
| **Knowledge** | 管理品牌知识资产的地方 | 一级导航 |

---

# 四、禁止与替代映射（Forbidden → Allowed）

## 必须统一替换

| 禁止词 | 正确词 |
|--------|--------|
| Optimize | Recommendation / Improvement |
| Monitor | Growth |
| Timeline | Growth |
| History | Growth |
| Claim | Knowledge / 品牌声明 |
| Evidence | Verification Evidence |
| Adapter | Channel |
| Pipeline | Publishing Flow / 工作流 |
| Runtime | System |
| Engine | AI Service |
| Execution | 执行中 / 优化中 |
| Deployment | 发布 / 上线 |
| Repository | 网站连接 |
| Config | 设置 |
| Endpoint | —（不出现） |
| Schema | 数据格式 |
| Token | 密钥 |
| Registry | —（不出现） |

---

# 五、语义规则（Semantic Rules）

## Rule 1 — Actionable Words Only

所有用户可见词必须可行动：Recommendation ✅ / Verification ✅ / Publishing ✅ / Health ✅

## Rule 2 — No Internal Structure Words

禁止：Graph, Node, DAG, Pipeline, Runtime。

## Rule 3 — One Word, One Concept

一个词只能对应一个概念。

例如：Growth = 品牌长期变化，不能扩展成"成长 + 监控 + 历史 + 分析"。

## Rule 4 — Studio Separation Rule

Studio 可以使用技术词，但 Workspace 永远不能使用技术词。

---

# 六、最终冻结声明

> This vocabulary defines the only allowed language in Brand Knowledge OS Workspace.
> Any deviation must be moved to Studio or removed.
> All UI, API exposure, and documentation must comply.

---

# 七、与 Product Principles 的关系

| 词汇原则 | 对应产品原则 |
|----------|-------------|
| V1 — User Language First | P12 — Human Language First |
| V2 — One Meaning Only | P6 — One North Star |
| V3 — Workspace Consistency | P1 — Brand First |
| V4 — No Technical Leakage | P5 — Technology Stays Invisible |

**所有词汇原则与产品原则互锁。违反任意一条，即违反宪法。**
