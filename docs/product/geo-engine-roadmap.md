# GEO 产品北极星：六大引擎架构

> **当前阶段定位：** 分析能力 80%，执行能力 30%，结果闭环 10%。
> 最大瓶颈已经不是工作台 UI，而是缺少"发布→传播→收录→引用→学习"的引擎层能力。
> GEO 已不是 0→1，需要回答的是：**如何让 GEO 生成的知识，第一次真正被 AI 消费？**

---

## 核心架构

```text
┌─────────────────────────────────────────────────────┐
│                   Evidence Engine                    │
│      （横跨全链 — 每条建议必有证据、推理、预期收益）      │
└─────────────────────────────────────────────────────┘
         ↓
① Discovery Engine    — 扫描品牌在各 AI 平台的可见状态
         ↓
② Knowledge Engine    — 构建品牌知识（Entity/FAQ/Schema/Relation）
         ↓
③ Knowledge Packaging Engine  — 将知识打包为消费级产物
         ↓
④ Knowledge Distribution Engine  — 发布到 AI 能消费的地方
         ↓
⑤ Observation Engine  — 观察 AI 是否引用/推荐/收录/回答
         ↓
⑥ Adaptive GEO Engine — 自动形成 Publish → Observe → Learn → Publish 闭环
```

**六个引擎依次递进，③④⑤⑥ 是当前 GEO 缺失的下半段。**

---

# 引擎 ①：Discovery Engine

**产品目标：** 回答"品牌在 AI 模型中是否被识别、识别度如何、缺口在哪？"

**输入：** 品牌名称 + 行业 + 目标模型列表

**输出：**
- 各模型的 Awareness 状态（Known / Unknown / Partial）
- 认知分歧度（Divergence）
- 召回一致性（Consistency）
- 各维度缺口（Definition / Entity / FAQ / Citation…）

**与上下游的关系：**
- 为 Knowledge Engine 提供缺口输入（缺什么补什么）
- 为 Evidence Engine 提供基准数据（当前值 vs 目标值）

**当前状态：★★★★☆** — 12 个 adapter 真实 API 调用，非 Mock。但有 BYOK 限制，用户需自带 Key。

**用户可感知的价值：** "我的品牌在 ChatGPT、DeepSeek、豆包这些地方能不能被认出来？认出来多少？"

**对 AI 可理解/可收录/可引用/可推荐的贡献：** 诊断层，不直接贡献。但为后续所有引擎提供输入。

**Definition of Done（当前阶段已基本满足）：**
- [x] 12 个 adapter 可真实调用
- [x] Awareness / Trend / Divergence 三层信号输出
- [x] UI 展示认知信号面板
- [ ] 向后端 ③ ④ 引擎输出 Gap 信号（待打通）

---

# 引擎 ②：Knowledge Engine

**产品目标：** 将品牌信息转化为结构化、AI 可消费的知识体系。

**输入：** Discovery 缺口 + 用户主动提交的品牌信息

**输出：**
- Entity（实体及别名、描述、属性）
- FAQ（问答对，结构化）
- Brand Facts（品牌事实陈述）
- Schema（JSON-LD、Schema.org 对齐）
- Semantic Relationships（实体间关系图）
- Citation-ready Content（引用就绪的内容块）

**与上下游的关系：**
- 从 Discovery 获取应补充的知识缺口
- 向 ③ Knowledge Packaging Engine 输出原始知识数据

**当前状态：★★★★☆** — KnowledgeObject 架构完整（Entity/Relation/Claim/Evidence/Citation），写入数据库。但 Schema Agent 和 FAQ Agent 注册但未激活。

**用户可感知的价值：** "系统已经帮我整理好了品牌的核心知识，不再是零散的信息片段。"

**对 AI 可理解的贡献（核心贡献引擎）：**
- 结构化知识 → 提高 AI 实体识别准确率
- FAQ 对 → 提高问答类召回
- Schema → 提高搜索引擎结构化数据解析

**Definition of Done：**
- [x] Entity/Relation/Claim 写入数据库
- [x] Presence 扫描结果自动入库
- [ ] 激活 Schema Agent（自动生成 Schema.org 对齐）
- [ ] 激活 FAQ Agent（自动生成 FAQ 对）
- [ ] 知识可版本化（snapshot 已有，版本链待完善）

---

# 引擎 ③：Knowledge Packaging Engine

**产品目标：** 将 Knowledge Engine 中的原始知识打包为消费级产物，适配不同发布渠道。

**输入：** Knowledge Object（Entity / FAQ / Facts / Schema / Relations）

**输出（四种发布产物）：**

| 产物 | 内容 | 消费方 |
|------|------|--------|
| **Entity Package** | 品牌介绍、定义、属性、FAQ、引用、更新时间、JSON-LD | Website / LLM |
| **Topic Package** | 主题权威内容（"什么是 GEO"、"AI 可见度"等主题深度内容） | Website / LLM |
| **Feed Package** | knowledge-feed.json / llm-feed.json / rss.xml | AI / 搜索引擎 / 合作方 |
| **Schema Package** | JSON-LD（Organization / FAQ / Article / Breadcrumb / Product / Person） | 搜索引擎 / 机器解析 |

**与上下游的关系：**
- 从 ② Knowledge Engine 获取原始知识
- 向 ④ Distribution Engine 输出已打包的产物

**当前状态：☆☆☆☆☆** — 不存在。

**用户可感知的价值：** 不可直接感知，但 GE 用户可在发布面板看到"已打包 X 个 Entity Package、Y 个 Topic Package"。

**对 AI 可收录/可推荐的贡献（核心贡献引擎）：**
- 打包后的 Entity Page 是 AI 爬虫最偏好的内容形态
- Feed 给 AI/搜索引擎提供持续的订阅更新源
- JSON-LD 大幅提高搜索引擎结构化理解概率

**Definition of Done：**
- [ ] Entity Package：品牌实体 + 定义 + 属性 + FAQ + 引用 + JSON-LD
- [ ] Topic Package：主题权威内容 + 内部链接 + 结构化数据
- [ ] Feed Package：JSON Feed + RSS
- [ ] Schema Package：自动生成 Organization / FAQ / Article / Breadcrumb JSON-LD
- [ ] Package 可版本化和增量更新

---

# 引擎 ④：Knowledge Distribution Engine

**产品目标：** 让包装后的知识第一次被网站、搜索引擎和 LLM 生态消费。

**这不是"开发发布渠道"，而是"让 GEO 第一次真正把知识送到 AI 能消费的地方。"**

**输入：** ③ Packaging Engine 输出的 Package

**输出（发布产物）：**
| 渠道 | 产物 | 优先级 |
|------|------|--------|
| **Website** | Entity Page + Topic Page 落地 | P0 |
| **JSON-LD Schema** | 嵌入页面的结构化数据 | P0 |
| **Sitemap** | 动态生成，通知搜索引擎 | P0 |
| **robots.txt** | 控制爬虫路径 | P0 |
| **Feed** | rss.xml / knowledge-feed.json | P0 |
| Knowledge Base | Zendesk / Notion / Confluence | P1 |
| CMS 集成 | WordPress / Contentful | P1 |
| API Feed | 直接输出给 LLM Provider | P1 |

**与上下游的关系：**
- 从 ③ Packaging Engine 获取 Package
- 向 ⑤ Observation Engine 提供"已发布清单"（用于对比哪些被收录）

**当前状态：★☆☆☆☆** — Plan/Claim CRUD 完备但无任何真实发布渠道。

**用户可感知的价值：** "我的品牌知识已经上线到网站，搜索引擎和 AI 可以看到了。"

**对 AI 可收录/可推荐的贡献（最关键缺失引擎）：**
- 没有发布，AI 爬虫永远无法获取品牌知识
- 这是 AI 可收录的**物理前提**
- ④ 不完成，⑤ ⑥ 全无意义

**Definition of Done：**
- [ ] Entity Page 可访问（/knowledge/entity/{slug}）
- [ ] Topic Page 可访问（/knowledge/topic/{slug}）
- [ ] FAQ 结构化页面可访问
- [ ] JSON-LD 自动嵌入所有页面
- [ ] Sitemap 动态生成并更新
- [ ] robots.txt 正确配置
- [ ] Feed（rss + json）可订阅
- [ ] 发布状态可追踪（已发布 / 更新中 / 失败）
- [ ] GEO 用户在 UI 中可查看已发布内容清单

---

# 引擎 ⑤：Observation Engine

**产品目标：** 观察发布后 AI 是否真正开始引用、推荐、收录品牌信息。

**注意：这不是 Monitoring（监控），而是 Observation（观测）。**
它不仅看"出没出问题"，还观察 AI 回答的变化、Entity 的演化、新出现的问题。

**输入：** ④ Distribution Engine 的发布清单 + AI 平台 API

**输出（观测维度）：**

| 观测项 | 说明 | 优先级 |
|--------|------|--------|
| AI 是否引用品牌 | LLM Response 中是否出现品牌名 / 品牌知识 | P0 |
| AI 推荐频率变化 | 同一模型在不同时间段的推荐行为对比 | P0 |
| 收录状态 | 搜索引擎 / AI Crawler 是否获取并收录 | P0 |
| AI 回答质量变化 | 语义匹配度、事实准确度 | P1 |
| Entity 演化 | Knowledge Graph 中实体是否增加或退化 | P1 |
| Citation 演化 | 外部引用数量变化 | P1 |
| 新出现的问题 | AI 对品牌的新问题类型（之前未出现的 Query） | P1 |
| Knowledge Drift | 已有知识是否随时间退化 | P2 |
| Competitor 动向 | 竞品在 AI 空间中的可见度变化 | P2 |

**与上下游的关系：**
- 从 ④ Distribution Engine 获取"已发布"基准
- 向 ⑥ Adaptive GEO Engine 输出观测信号
- 为 Evidence Engine 提供"发布后效果"证据

**当前状态：★☆☆☆☆** — 仅有 Score Drift 检测，无 AI 引用/推荐/回答监测。

**用户可感知的价值：** "我的品牌知识发布之后，AI 开始引用了吗？推荐有增加吗？"

**对 AI 可引用/可推荐的验证贡献：**
- 不直接贡献收录或推荐，但**验证**发布是否有效
- 不能验证的发布 = 盲发

**Definition of Done：**
- [ ] 最少一个模型可检测"AI 开始引用品牌"的信号
- [ ] 可回溯（非一次性扫描，持续观测）
- [ ] 可对比（发布前后 AI 的引用/推荐行为变化）
- [ ] 信号可视化（UI 中展示观测时间线）

---

# 引擎 ⑥：Adaptive GEO Engine

**产品目标：** 形成 Publish → Observe → Extract → Reason → Republish 的 AI Feedback Loop。

**这不是 Learning（学习），而是 Adaptive（自适应）。**
系统不是"练了个模型"，而是通过观察 AI 行为，迭代优化发布内容，形成持续演化的知识体。

**闭环流程：**

```text
④ Publish
    ↓
⑤ Observe  ←  AI Response
    ↓
Extract → Knowledge Delta（AI 引用了什么？漏了什么？错了什么？）
    ↓
Reason → 新推荐策略
    ↓
③ Repackage + ④ Republish（下一轮）
    ↑
```

**输入：** ⑤ Observation Engine 的观测信号

**输出：**
- Knowledge Delta（对比已有知识 vs AI 实际认知的差异）
- 新推荐（针对 Delta 的优化策略）
- 更新后的发布 Package

**与上下游的关系：**
- 从 ⑤ Observation Engine 获取观测信号
- 向 ③ Packaging Engine + ④ Distribution Engine 输出增量更新
- Evidence Engine 记录每一次闭环的"经验"证据

**当前状态：☆☆☆☆☆** — SignalRegistry 空，没有任何信号 Provider 注册。

**用户可感知的价值：** "系统自动发现 AI 对我的品牌有了新看法，并自动更新了我的知识站。我不需要每次手动跑扫描。"

**对 AI 可引用/可推荐/首选回答的贡献（最终引擎）：**
- 静态知识站 → AI 爬一次就结束了
- 自适应知识站 → AI 每次爬都有新内容、新结构、新证据
- 持续更新的知识体在 AI 生态中天然获得更高的引用优先级

**Definition of Done（最小闭环）：**
- [ ] 一个完整闭环可运行（Publish → Observe → Extract → Reason → Republish）
- [ ] 系统可在两次迭代间检测到 Knowledge Delta
- [ ] 推荐质量随时间收敛（不相同时每次一样）
- [ ] 闭环无需人工干预（但可人工审查和打断）

---

# 横跨引擎：Evidence Engine

**产品目标：** GEO 不是告诉用户"做什么"，而是告诉用户"为什么做、做了会怎样"。

每条 Recommendation 必须包含：

```json
{
  "evidence": {
    "observation": "ChatGPT Definition Recall = 12%",
    "benchmark": "行业基准 = 46%",
    "gap": "品牌缺少 Definition Card",
    "reason": "ChatGPT 在 Definition 类 Query 中召回依赖结构化定义内容",
    "expectedGain": "+34%（预计可提升至 46%）",
    "confidence": "High"
  }
}
```

**覆盖范围：** 横跨 ①-⑥ 所有引擎。
- ① Discovery 的输出应自动成为 Evidence 的 observation 部分
- ② Knowledge 的缺口应自动成为 Evidence 的 part
- ③ Packaging + ④ Distribution 的发布状态应成为 Evidence 的 action_taken
- ⑤ Observation 的回检结果应成为 Evidence 的 actual_gain
- ⑥ Adaptive 每次闭环的输出应成为 Evidence 的历史记录

**当前状态：☆☆☆☆☆** — 不存在。当前 Recommendation 仅为"建议增加 FAQ"级别。

**用户可感知的价值：** "系统不仅告诉我做什么，还告诉我为什么这么做、预期效果、以及实际效果是否符合预期。我信任这个系统。"

**Definition of Done：**
- [ ] 每条 Recommendation 自带 Evidence 卡片（observation / benchmark / gap / reason / expectedGain / confidence）
- [ ] 发布后 Observation 结果自动回填 Evidence（actualGain）
- [ ] Dashboard 级别的 Evidence 聚合视图
- [ ] 无 Evidence 的 Recommendation 系统不输出

---

# 优先级与依赖关系

## 执行顺序（三个串行 Sprint）

```
Sprint P0-1: Knowledge Packaging Engine
    ↓（Packaging 稳定后）
Sprint P0-2: Knowledge Distribution Engine
    ↓（可发布后）
Sprint P0-3: Evidence Engine v1（覆盖 Packaging + Distribution）
    ↓（基础稳固后）
Observation Engine → Adaptive GEO Engine
```

### Sprint P0-1: Knowledge Packaging Engine

**目标：** 把 Knowledge Object 转换为稳定、标准化的 Package。这是整个 GEO 的分水岭——后续所有 Distribution Adapter 只消费 Package，不直接读数据库。

**输出产物（四类）：**
- Entity Package
- Topic Package
- FAQ Package
- Schema Package（JSON-LD 等）

**Definition of Done：**
- [ ] 任意一个 Knowledge Object 都能生成对应 Package
- [ ] Package 有统一 Schema 和版本号
- [ ] Package 可预览、可导出
- [ ] 后续任何 Distribution Adapter 只消费 Package，不直接读数据库

### Sprint P0-2: Knowledge Distribution Engine

**目标：** 让 Package 第一次被网站、搜索引擎和 LLM 消费。不是做几十个 Adapter，只做真正影响 AI 的几个渠道。

**首批渠道：**
- Website（静态页面输出：Entity Page / Topic Page / FAQ Page）
- Sitemap（动态生成）
- robots.txt
- JSON Feed / LLM Feed

**Definition of Done：**
- [ ] 用户一次 Publish 生成完整的网站发布产物
- [ ] 发布产物可部署到站点
- [ ] GEO 第一次真正开始影响外部 AI 和搜索系统

### Sprint P0-3: Evidence Engine v1

**目标：** 让 Packaging 和 Distribution 的结果对用户可解释、可证明。每个 Package 和 Publish 结果都要回答四个问题。

**每个 Package / Publish 必须附带：**
1. 为什么生成？
2. 根据什么证据？
3. 希望解决什么缺口？
4. 预计会带来什么收益？

**Definition of Done：**
- [ ] 每条 Recommendation（Package 生成 / Publish 动作）自带 Evidence 卡片
- [ ] 用户可查看完整的推理链
- [ ] 无 Evidence 的 Recommendation 不输出

### 之后

- Sprint P0-4: Observation Engine
- Sprint P0-5: Adaptive GEO Engine

---

## Package 统一元数据规范

每个 Package 必须包含以下元数据，确保 Distribution、Observation、Adaptive 各引擎可直接复用：

```json
{
  "packageId": "pkg_xxxxxxxx",
  "packageType": "entity | topic | faq | schema",
  "sourceKnowledgeIds": ["know_xxx", "know_yyy"],
  "generatedAt": "2025-07-04T00:00:00Z",
  "freshness": "2025-07-04T00:00:00Z",
  "evidenceIds": ["ev_xxx", "ev_yyy"],
  "entityIds": ["ent_xxx"],
  "topics": ["GEO", "AI Visibility"],
  "targetAudience": "search-engine | llm | general",
  "targetAiModels": ["ChatGPT", "DeepSeek", "Qwen"],
  "version": 1
}
```

---

# 引擎成熟度总评

| 引擎 | 当前状态 | 目标 | 缺口判断 |
|------|---------|------|----------|
| ① Discovery | ★★★★☆ | ★★★★★ | 打通到后续引擎的信号链路 |
| ② Knowledge | ★★★★☆ | ★★★★★ | 激活 Schema/FAQ Agent |
| ③ Packaging | ☆☆☆☆☆ | ★★★★★ | **新建（首个 Sprint 目标）** |
| ④ Distribution | ★☆☆☆☆ | ★★★★★ | **新建（最关键的 P0）** |
| ⑤ Observation | ★☆☆☆☆ | ★★★★★ | 依赖④就绪 |
| ⑥ Adaptive | ☆☆☆☆☆ | ★★★★★ | 依赖④+⑤就绪 |
| 证据 Engine | ☆☆☆☆☆ | ★★★★★ | 可与③④并行 |

---

# AI 可收录/可推荐能力评估（基于当前状态）

| 维度 | 当前评分 | Phase A 完成后 | 完全体 |
|------|---------|---------------|--------|
| AI 可识别（Recognizable） | 4/5 | 4/5 | 5/5 |
| AI 可理解（Understandable） | 3/5 | 4/5 | 5/5 |
| AI 可收录（Indexable） | 1/5 | **4/5** | 5/5 |
| AI 可引用（Citable） | 1/5 | 3/5 | 5/5 |
| AI 可推荐（Recommendable） | 1/5 | 2/5 | 5/5 |

**关键跳跃点：** Phase A（③ Packaging + ④ Distribution）完成后，"可收录"从 1/5 跳到 4/5。这是整个系统最大的单次能力提升。

---

# 停止方向 / 转到方向

**停止：**
- ❌ 继续做工作台 UI 优化（当前 UI 已可用）
- ❌ 继续做状态机 / 流程编排
- ❌ 继续扩展 Provider Adapter（12 个已够用）
- ❌ 在没有发布的情况下做 Crawler 验证（验证无意义）

**转到：**
- ✅ **Knowledge Packaging Engine（③）** — 首批 Sprint
- ✅ **Knowledge Distribution Engine（④）** — 核心 P0
- ✅ **Evidence Engine** — 与 ③④ 并行
- ✅ **Observation Engine（⑤）** — ④ 就绪后立即启动
- ✅ **Adaptive GEO Engine（⑥）** — ⑤ 就绪后启动

---

*本文档是 GEO 产品的北极星。所有 Sprint 规划应当围绕单个引擎展开，确保每次迭代都有明确的引擎层贡献，而非 UI 层修补。*
