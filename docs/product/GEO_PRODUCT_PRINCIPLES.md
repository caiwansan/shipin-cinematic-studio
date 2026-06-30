# GEO Product Principles
## Brand Knowledge OS — 产品宪法与设计准则

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 生效范围：所有 Brand Knowledge OS Workspace（GEO / 短剧 / 小说 / PPT）

---

## 核心信念（Core Belief）

```
Every interaction should improve Brand Health.
```

Brand Knowledge OS 的一切设计，都源于这一句话。
无论开发哪个 Workspace，用它判断功能的价值：
- 帮助用户提升核心成果 → 保留
- 暴露系统内部能力或增加操作复杂度 → 重新设计或放到 Studio

---

# 第一部分：宪法（Constitution）

五条原则，不可违反。

---

## Principle 1 — Brand First

**Workspace 服务的是品牌，不是系统，不是 Runtime，不是 AI。**

任何页面都必须围绕一个核心问题：

> 品牌现在怎么样？

不得出现的页面主题：
- ❌ 系统状态
- ❌ Pipeline 运行情况
- ❌ 内部指标
- ❌ 技术架构

只能出现的页面主题：
- ✅ 品牌健康度
- ✅ 品牌知识覆盖
- ✅ 品牌 AI 可见性
- ✅ 品牌知识资产

> **"Brand First" 意味着每一次页面设计评审，先问：这个页面用户看到的第一个元素是品牌的什么信息？**

---

## Principle 2 — Action First

**任何页面必须回答下一个行动是什么。**

如果一个页面只是展示数据，没有指引用户下一步做什么，它就应当被删除或重新设计。

回答模式：
```
健康度 82      → "AI 可见性有 3 项待优化"
覆盖率 64%     → "添加品牌描述可提升至 78%"
验证通过       → "发布到官网"
发布完成       → "查看效果趋势"
```

不允许的页面模式：
- ❌ 只有数字没有建议
- ❌ 只有列表没有操作
- ❌ 只有状态没有下一步

> **"Action First" 意味着用户读完每一页，都知道鼠标应该点哪里。**

---

## Principle 3 — Outcome First

**用户关心结果，不关心过程。**

展示方式对比：

| ❌ 不要 | ✅ 要 |
|---------|-------|
| Verification Engine Running... | Brand Health **+7** |
| 优化任务已提交 | 官网已更新，**+12%** AI 可见性 |
| 打包中... | 知识已覆盖 **3 个渠道** |
| 发布成功 | 关键词排名 **升至第 2** |

> **"Outcome First" 意味着任何耗时操作结束后，用户看到的第一个东西是"变好了多少"，而不是"操作已完成"。**

---

## Principle 4 — Simplicity Wins

**普通市场人员第一次使用，30 秒内完成第一次优化。**

如果用户需要：
- ❌ 培训
- ❌ 文档
- ❌ 引导配置
- ❌ 理解技术概念

产品就失败了。

30 秒测试：
```
第 0 秒：打开 Workspace
第 5 秒：看到品牌健康度
第 10 秒：看到第一条推荐
第 15 秒：点击"一键优化"
第 25 秒：看到效果预览
第 30 秒：点击"确认发布"
```

> **"Simplicity Wins" 意味着任何需要解释的功能都不是好功能。**

---

## Principle 5 — Technology Stays Invisible

**Runtime、Adapter、Repository、Pipeline、Engine 默认全部不可见。**

可见范围规则：

| 概念 | Workspace | Brand Studio |
|------|-----------|--------------|
| Brand Health | ✅ 核心 | ✅ 配置 |
| Recommendations | ✅ 核心 | ✅ 配置 |
| Verification | ✅ 结果展示 | ✅ 引擎配置 |
| Publishing | ✅ 渠道管理 | ✅ Adapter 配置 |
| Knowledge | ✅ 资产管理 | ✅ Pipeline 配置 |
| Runtime | ❌ 隐藏 | ✅ 可见 |
| Adapter | ❌ 隐藏 | ✅ 可见 |
| Repository | ❌ 隐藏 | ✅ 可见 |
| Engine | ❌ 隐藏 | ✅ 可见 |

> **"Technology Stays Invisible" 意味着用户永远不需要知道"这是怎么工作的"，只需要知道"这能帮我做什么"。**

---

# 第二部分：设计准则（Design Guidelines）

七条准则，允许随产品演进优化。

---

## Principle 6 — One North Star

**Workspace 永远只有一个北极星：Brand Health。**

其他所有指标都是组成维度：

```
Brand Health 82
├── Knowledge Coverage    71%
├── AI Visibility         64%
├── Verification          ✅ (85%)
├── Publishing Freshness  3 days
├── Authority             B+
└── Risk                  2 open
```

用户永远只需要关心一个数字：
- 今天 Brand Health 是多少？
- 比昨天好还是差？
- 怎样才能更高？

> **"One North Star" 意味着所有页面、所有功能、所有推荐，最终都指向提升一个数字。**

---

## Principle 7 — Progressive Disclosure

**用户第一次看到的永远是最简单的版本。高级能力按需展开。**

分层展示：

```
L1（默认可见）：
  Brand Health | Recommendations | Quick Action

L2（点击展开）：
  History | Trends | Detail Metrics

L3（高级模式）：
  Custom Dashboard | Batch Operations | Export

L4（Studio）：
  Pipeline Config | Runtime Config | Adapter Debug
```

- 新用户只看到 L1
- 进阶用户自然发现 L2-L3
- 开发者知道 L4 在 Studio

> **"Progressive Disclosure" 意味着从不在一开始展示全部能力，而是让用户按需探索。**

---

## Principle 8 — Recommendation, Not Configuration

**Workspace 告诉用户"建议这样做"，而不是"请配置以下参数"。**

| ❌ 配置模式 | ✅ 推荐模式 |
|------------|------------|
| 请选择优化策略 | 建议优化：添加品牌描述 |
| 请配置发布渠道 | 建议发布到官网+AI Feed |
| 请设置验证参数 | 开始验证 |
| 请选择关键词 | 推荐 3 个高价值关键词 |

**用户不需要选择参数。用户只需要说 Yes。**

> **"Recommendation, Not Configuration" 意味着产品替用户做决策，用户只需要确认或拒绝。**

---

## Principle 9 — Continuous Growth

**产品没有"完成"状态，只有"越来越健康"。**

- Workspace 不设"完成所有任务"
- Growth 页面永远有新的建议
- Brand Health 的目标值会持续提升
- 用户永远知道下一步做什么

> **"Continuous Growth" 意味着用户每次打开 Workspace，都能看到比上次更好的状态。**

---

## Principle 10 — Explain Every Score

**任何显示的数字，都必须回答"为什么"和"如何提升"。**

显示规则：
```
Brand Health 82      ✅ 有解释 + 提升建议
AI Visibility 64%    ✅ 有解释 + 提升建议
Unknown               ❌ 没有 Why + How 的数字不能显示
```

解释模式：
```
为什么只有 64%？
  2 个关键页面未被 AI 索引
  品牌描述未覆盖核心关键词

如何提升到 78%？
  添加品牌描述（预计 +8%）
  提交 Sitemap（预计 +6%）
```

> **"Explain Every Score" 意味着用户从不面对一个无意义的数字。**

---

## Principle 11 — Trust Before Automation

**AI 可以建议，但最终决定永远属于用户。**

- AI 推荐默认可执行（一键确认）
- 但从不自动执行
- 效果预览必须可见
- 回滚路径必须存在
- 用户永远可以"拒绝"

> **"Trust Before Automation" 意味着从不越过用户做决定，但让用户以最少的操作完成确认。**

---

## Principle 12 — Workspace over Console

**Workspace 不是 Admin Panel，不是 Engineering Console，不是 Debug Tool。**

Workspace 的特质：
- ✅ 普通用户欢迎页
- ✅ 品牌语言优先
- ✅ 每个页面都有价值
- ✅ 视觉统一、体验一致
- ❌ 不是功能清单
- ❌ 不是菜单堆叠
- ❌ 不是后台管理

> **"Workspace over Console" 意味着每次添加一个功能，先问：这应该属于 Workspace 还是 Studio？**

---

# 第三部分：Brand Health Constitution

## 什么是 Brand Health

Brand Health **不是一个算法分数**，而是**品牌的生命体征（Vital Sign）**。

类比人的健康：
```
人的健康：
  Vital Signs: 体温 36.5°C | 心率 72 | 血压 120/80
  Diagnosis:  良好
  Actions:    保持运动

品牌健康：
  Vital Signs: Knowledge Coverage | AI Visibility | Freshness | Authority
  Diagnosis:  82/100 — 良好，有提升空间
  Actions:    建议优化 3 项
```

## Brand Health 的组成

```
Brand Health
├── Knowledge Coverage     — 品牌知识被 AI 理解的广度
├── AI Visibility          — 品牌在 AI 推荐中的可见性
├── Verification           — 品牌知识的真实性验证
├── Publishing Freshness   — 内容发布的新鲜度
├── Authority              — 品牌来源的权威性
└── Risk                   — 潜在风险检测
```

每个维度都是可解释、可提升的。

## Brand Health 的约束

1. **Brand Health 必须始终在 0-100 范围内** — 用户直觉理解
2. **Brand Health 必须有维度分解** — 用户知道问题在哪
3. **Brand Health 必须有趋势** — 用户知道好还是差
4. **Brand Health 必须有建议** — 用户知道怎么提升
5. **Brand Health 从不显示为负数** — 最低也是 0

## Brand Health ≠ Performance

Brand Health 不是：
- ❌ 网站性能分
- ❌ SEO 排名
- ❌ 广告 ROI
- ❌ KPI 汇总

Brand Health 是：
- ✅ 品牌在 AI 时代的知识健康度
- ✅ 品牌被 AI 推荐的可能性
- ✅ 品牌知识的完整性和可信度

---

> **这 12 条原则 + Brand Health Constitution 是 Brand Knowledge OS 所有产品决策的最终依据。**
>
> 任何新功能、新页面、新交互在开发前，必须对照这 12 条原则逐条评审。
> 违反任何一条宪法原则，必须重新设计。
>
> *"Every interaction should improve Brand Health."*
