# GEO Growth Wireframe v1.0
## Brand Knowledge OS — 品牌成长（Brand Progress）

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Brand OS Design System / IA / All Preceding Wireframes

---

# 一、产品定义（必须先冻结）

## Growth ≠ Trend / History

它的真实定位是：

> **Progress（品牌成长）——闭环的反馈层（Feedback Layer）。**

回答的不是"过去发生了什么"，而是：

> **品牌是否正在持续变得更容易被 AI 推荐？**

## 与被替代概念的关系

| 旧概念 | 新定位 |
|--------|--------|
| Timeline | ❌ 消失——时间只是卡片属性 |
| History | ❌ 消失——过去是背景，不是页面 |
| Monitor | ❌ 消失——Growth 是正面视角 |
| Trend | 降级为组件——TrendChart 是手段，不是目标 |

## 产品定义（冻结）

> **Growth measures whether every optimization cycle is making the brand more understandable, trustworthy, and recommendable to AI over time.**

这句话与 Brand Health 的定义一一对应。

---

# 二、页面回答的五层问题

| 层级 | 问题 | 内容 |
|------|------|------|
| 第一层 — Direction | 我在变好吗？ | Brand Health 变化总览 |
| 第二层 — Source | 为什么变好了？ | 维度分解（成长来自哪里） |
| 第三层 — Learning | 哪些动作最有效？ | Action → Impact 归因 |
| 第四层 — Opportunity | 下一阶段机会？ | 下一批推荐 |
| 第五层 — Milestone | 品牌里程碑 | 情绪价值 |

---

# 三、页面结构（Wireframe）

```
┌──────────────────────────────────────────────────────────┐
│  Growth                                                  │
│  "Brand Progress — 30-day overview"                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─── L1: Direction ───────────────────────────────┐   │
│  │                                                    │   │
│  │  Brand Health                                     │   │
│  │                                                    │   │
│  │  71  ────────  82                                   │   │
│  │        +11  past 30 days                           │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── L2: Source ─────────────────────────────────┐   │
│  │                                                    │   │
│  │  What improved                                    │   │
│  │                                                    │   │
│  │  Knowledge Coverage  +9%   68% → 77%    ▸Learn   │   │
│  │  AI Visibility       +14%  61% → 75%    ▸Learn   │   │
│  │  Authority           +6    72  → 78     ▸Learn   │   │
│  │  Freshness           +18%  55% → 73%    ▸Learn   │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── L3: Learning ───────────────────────────────┐   │
│  │                                                    │   │
│  │  Most effective actions this period                │   │
│  │                                                    │   │
│  │  Added FAQ section         → +5 Brand Health      │   │
│  │  Updated website           → +3 Brand Health      │   │
│  │  Published to AI Feed      → +2 Brand Health      │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── L4: Opportunity ────────────────────────────┐   │
│  │                                                    │   │
│  │  Next opportunity                                  │   │
│  │                                                    │   │
│  │  Create brand case study page                      │   │
│  │  Expected impact: +6 Brand Health                  │   │
│  │                                                    │   │
│  │  [ View in Recommendations ]                       │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── L5: Milestone ──────────────────────────────┐   │
│  │                                                    │   │
│  │  🏆 Brand Health broke 80 for the first time      │   │
│  │  🏆 AI Visibility reached top 20%                  │   │
│  │  🏆 Knowledge Coverage exceeded 90%                │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

# 四、组件规范

## 4.1 Direction Banner（Layer 1）

### 结构
```
Brand Health

71 ──────── 82
     +11  past 30 days
```

### 规则
- 显示期初 → 期末
- Δ 正值绿色，负值红色
- 趋势不可用时不显示方向，显示 "Insufficient data"
- 使用与 Health 页相同的 Brand Health 视觉语言

---

## 4.2 Source Breakdown（Layer 2）

### 结构
```
What improved

Knowledge Coverage  +9%   68% → 77%    ▸Learn
AI Visibility       +14%  61% → 75%    ▸Learn
Authority           +6    72  → 78     ▸Learn
Freshness           +18%  55% → 73%    ▸Learn
```

### 规则
- 与 Verification 的 Proof Panel 复用组件
- 每行可展开 Learn → 维度详细解释
- 依据视觉格式：维度名 | Δ值 | Before → After | ▸Learn

---

## 4.3 Learning Summary（Layer 3）

### 结构
```
Most effective actions this period

Added FAQ section         → +5 Brand Health
Updated website           → +3 Brand Health
Published to AI Feed      → +2 Brand Health
```

### 规则
- Action → Impact 归因
- 数据来源：过去周期的执行记录
- 限 5 条，超出折叠
- 每个 action 可点击 → 跳转 Verification 查看该次优化详情

---

## 4.4 Opportunity Block（Layer 4）

### 结构
```
Next opportunity

Create brand case study page
Expected impact: +6 Brand Health

[ View in Recommendations ]
```

### 规则
- 永远展示下一个最佳机会
- 预期提升基于 Learning Summary 的历史数据
- CTA 连接至 Recommendations 页

---

## 4.5 Milestone Banner（Layer 5）

### 结构
```
🏆 Brand Health broke 80 for the first time
🏆 AI Visibility reached top 20%
🏆 Knowledge Coverage exceeded 90%
```

### 规则
- 里程碑自动检测（首次突破 / 达到阈值 / 历史新高）
- 无新里程碑时不显示空卡片，折叠
- 使用图标增加情绪价值

---

# 五、组件映射（复用 Design System）

| Layer | Product Block | 复用来源 |
|-------|---------------|---------|
| L1 — Direction | `GrowthOverview` | 新 Block，Hero 变体 |
| L2 — Source | `ProofPanel` | 复用于 Verification |
| L3 — Learning | 新 Block `LearningSummary` | 新 |
| L4 — Opportunity | `OpportunityBlock` | 新（跨 Workspace Pattern） |
| L5 — Milestone | `MilestoneBanner` | 新 |

新增 3 个 Product Block：`GrowthOverview` / `LearningSummary` / `OpportunityBlock` / `MilestoneBanner`，全部可跨 Workspace 复用。

---

# 六、UI 设计约束

| 约束 | 说明 |
|------|------|
| No Timeline | 时间线消失，时间只是卡片属性 |
| No standalone chart page | TrendChart 是组件不是页面 |
| Opportunity 面积最大 | 未来导向优先于历史回顾 |
| Scores use Verification data | Growth 的分数来源必须是已验证数据 |
| Milestone 不重复 | 同一里程碑只显示一次 |

---

# 七、时间周期选择

| 选项 | 默认 | 说明 |
|------|------|------|
| 7 days | | 周趋势（快速变化可见） |
| 30 days | ✅ | 默认视图 |
| 90 days | | 季度趋势 |
| Custom | | 日期选择器 |

---

# 八、与 Recommendations 的关系

```
Growth Layer 4: Opportunity
  → [View in Recommendations]
  → Recommendations 页列出 Next 3-5 actions
  → 执行后 Verification
  → Verification 数据反馈回 Growth Layer 3: Learning
```

Growth 的 Learning Summary 会持续优化 Recommendations 的 Impact 预估精度。

---

# 九、状态系统

## 9.1 Empty State — No data yet

```
Not enough data yet

Complete your first optimization cycle to see brand progress.
```

## 9.2 Loading State

```
Loading brand progress...

Analyzing improvement trends...
```

## 9.3 No Change State

```
Brand Health remained stable this period

No significant improvement or decline detected.
```

---

# 十、冻结声明

> Growth Wireframe v1.0 defines the feedback layer of Brand Knowledge OS.
> It is a Progress page, not a History page.
> "Growth measures whether every optimization cycle is making the brand more
>  understandable, trustworthy, and recommendable to AI over time."
>
> Timeline as a standalone page is eliminated. Time is a property of cards.
> Opportunity Block becomes the fifth cross-Workspace Product Block pattern.
