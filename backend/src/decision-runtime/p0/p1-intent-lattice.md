# P1 Intent Lattice — Universe Structure Definition
## Generated: 2026-06-22 23:30 CST

### Enterprise Universe (50 queries)

```
Intent Nodes (3):
  company_intelligence    ~42 queries
  product_intelligence     ~8 queries
  comparative_intelligence  0 queries (TBD)
```

#### Node 1: company_intelligence
- **Intent**: 企业公开商业情报查询
- **Sub-intents**: 
  - `market_performance` — 营收/销量/估值/上市
  - `business_strategy` — 业务布局/战略/核心业务
  - `technology_progress` — 技术进展/研发/创新
  - `financial_status` — 财报/融资/利润/增长

#### Node 2: product_intelligence
- **Intent**: 具体产品/产线/市场数据查询
- **Sub-intents**:
  - `product_performance` — 交付量/销量/份额
  - `product_launch` — 新品/迭代/发布动态
  - `supply_chain` — 产能/供应链/布局

#### Node 3: comparative_intelligence (future)
- **Intent**: 行业对比/排名/竞争分析
- Note: 当前 benchmark 中无此类 query，保留节点

---

### General Universe (50 queries)

```
Intent Nodes (4):
  concept_explanation   ~12 queries
  skill_guidance        ~22 queries
  de_facto_knowledge     ~4 queries
  policy_finance         ~6 queries
  (unclustered: ~6 queries — health/life)
```

#### Node 1: concept_explanation
- **Intent**: 概念定义/原理/科普
- **Sub-intents**:
  - `tech_concept` — 区块链/量子/ChatGPT/5G/云计算/大数据/NFT/元宇宙
  - `economic_concept` — 通货膨胀/碳中和/全球变暖
  - Note: 几乎所有 query 是"什么是X"或"X是什么意思"

#### Node 2: skill_guidance
- **Intent**: 技能学习方法/路径/对比
- **Sub-intents**:
  - `learning_path` — 考研/考公/编程/前端/数学/英语
  - `career_skill` — PPT/Excel/写作/时间管理/拍照/习惯
  - `business_startup` — 自媒体/短视频/直播/跨境电商
  - `comparison` — Python vs Java / iPhone vs Android / 新能源车 vs 燃油

#### Node 3: de_facto_knowledge
- **Intent**: 名人/热点/数据事实查询
- **Sub-intents**:
  - `person_knowledge` — 马斯克是谁/EDG
  - `data_fact` — 比特币价格/GDP数据

#### Node 4: policy_finance
- **Intent**: 政策法规/金融操作指南
- **Sub-intents**:
  - `finance_operation` — 选股/基金定投
  - `policy_query` — 房贷利率/个税/社保/公积金

#### Unclustered (health_life)
- 高血压饮食 / 糖尿病症状 / 减肥方法 / 大学生就业
- Potentially new intent: `health_guidance` (5+ queries needed to justify)

---

### Seed Design Target

| Domain | Intent | Seed ID | queryPatterns |
|--------|--------|---------|---------------|
| enterprise | company_intelligence | enterprise-company | 公司/企业/财报/融资/估值/营收/业务/战略 |
| enterprise | product_intelligence | enterprise-product | 销量/交付/新品/产能/市场份额 |
| general | concept_explanation | general-concept | 什么是/原理/是什么意思/技术 |
| general | skill_guidance | general-skill | 怎么学/学习方法/怎么做好/怎样/学习路线 |
| general | de_facto_knowledge | general-fact | 是谁/最新数据/价格/谁 |
| general | policy_finance | general-policy | 利率/怎么算/怎么提取/政策/操作 |

Total: 7 seeds (3 enterprise + 4 general)
