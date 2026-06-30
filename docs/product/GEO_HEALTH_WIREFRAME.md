# GEO Health Page Wireframe v1
## Brand Knowledge OS — 产品视觉宪法

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Product Principles / Vocabulary / Narrative / IA

---

# 一、设计前提

Health 页是整个 Workspace 的"视觉宪法"——它的布局、组件语言、信息层级将决定所有其他页面的设计方向。

## 必须同时满足的三个时间窗口

| 时间 | 用户必须知道 | 违反后果 |
|------|-------------|---------|
| 3 秒 | 我现在是好还是不好？ | 用户迷惑，关闭页面 |
| 10 秒 | 我为什么是这个分数？ | 用户对评分不信任 |
| 30 秒 | 我应该点哪里让它变好？ | 用户无法行动，产品失败 |

## UI 设计约束

| 规则 | 说明 |
|------|------|
| **One Score Dominance** | 页面只能有一个主数字（Brand Health） |
| **No Tables** | 禁止 KPI 表格化 dashboard |
| **Action Above Data** | 推荐优先于原始数据 |
| **Explanation Embedded** | 每个 score 必须带 Why + How |
| **One Primary CTA** | 只有一个主行动按钮 |

---

# 二、Wireframe（结构级）

## 页面层级

```
┌──────────────────────────────────────────────────────────┐
│  Brand Health  82                                        │
│  Good, but needs improvement             ┃  Δ +4 this wk │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │  Why this score?       │  │  Today's Actions       │  │
│  │                        │  │                        │  │
│  │  ▸ Coverage gap        │  │  [1] Fix coverage      │  │
│  │    (2 pages missing)   │  │       → +8 Health      │  │
│  │  ▸ AI visibility low   │  │  [2] Improve AI vis    │  │
│  │    (3 keywords weak)   │  │       → +5 Health      │  │
│  │                        │  │  [3] Publish update    │  │
│  │                        │  │       → +3 Health      │  │
│  └────────────────────────┘  └────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Dimensional Breakdown                           │   │
│  │                                                  │   │
│  │  Knowledge Coverage  ████████░░░░  76/100        │   │
│  │  AI Visibility       ██████░░░░░░  69/100  ⚠    │   │
│  │  Trust               ████████░░░░  88/100        │   │
│  │  Freshness           ███████░░░░░  73/100        │   │
│  │  Authority           ████████░░░░  85/100        │   │
│  │  Risk                █████████░░░  95/100        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [ Improve Brand Health ] — 3 actions pending    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

# 三、组件拆解

## 3.1 Brand Health Hero（主分数区）

### 视觉层级
```
Level 1 (Hero):
  "82" — 96px, bold, gradient color
  "Good, but needs improvement" — 14px, subtitle
Level 2 (Trend):
  "+4 this week" — 12px, green if positive
Level 3 (Subtitle):
  "Brand Health is a measure of how understandable,
   trustworthy, and recommendable your brand is to AI systems."
```

### 状态变化
| 状态 | 色彩倾向 | 色值建议 |
|------|---------|---------|
| 80-100 | 绿色 | #22c55e |
| 60-79 | 黄色 | #eab308 |
| 0-59 | 红色 | #ef4444 |

### 交互
- 悬停/点击 → 展开 Brand Health 定义（Tooltip / Modal）
- 趋势数字 → 点击跳转 Growth 页

---

## 3.2 Explain Panel（解释面板）

### 结构
```
Title: "Why this score?"
├── ▸ Coverage gap (2 pages missing from AI index)
├── ▸ AI visibility low (3 keywords below threshold)
└── ▸ Freshness stale (last publish > 14 days)
```

### 设计原则
- 使用自然语言，不使用技术术语
- 每条可点击 → 跳转到对应 Recommendations
- 最多显示 5 条，超出折叠

---

## 3.3 Actions Panel（行动面板）

### 结构
```
Title: "Today's Actions"
├── [1] Fix coverage             → Expected: +8 Health
├── [2] Improve AI visibility    → Expected: +5 Health
└── [3] Publish brand update     → Expected: +3 Health
```

### 交互
- 每条行动可展开 → 显示 Why + How
- 行动条底部 → "View all" → 跳转 Recommendations 页

---

## 3.4 Dimensional Breakdown（维度分解）

### 结构
```
Knowledge Coverage  ████████░░░░  76/100
AI Visibility       ██████░░░░░░  69/100  ⚠
Trust               ████████░░░░  88/100
Freshness           ███████░░░░░  73/100
Authority           ████████░░░░  85/100
Risk                █████████░░░  95/100
```

### 规则
- 统一 0-100 刻度
- 低于 70 显示 ⚠ 标识
- 每条可点击 → 展开详细解释
- 所有维度在同一个图表组件中

---

## 3.5 Primary CTA（主行动按钮）

### 结构
```
[ Improve Brand Health — 3 actions pending ]
```

### 规则
- 页面唯一主 CTA
- 显示待处理行动数
- 点击 → 跳转 Recommendations 页
- 无待处理时显示 "Brand Health up to date ✓"

---

# 四、状态系统

## 4.1 Empty State — 第一次使用

```
┌──────────────────────────────────────────┐
│                                          │
│       ✨ Welcome to Brand Health         │
│                                          │
│   Connect your website to see how your   │
│   brand is understood by AI systems.     │
│                                          │
│   [ Connect Website ]                    │
│                                          │
└──────────────────────────────────────────┘
```

## 4.2 Loading State

```
┌──────────────────────────────────────────┐
│                                          │
│  Skeleton: Score placeholder (96px box)  │
│  Skeleton: Text lines (3)                │
│  Skeleton: Action cards (2)              │
│  Skeleton: Dimension bars (6)            │
│                                          │
└──────────────────────────────────────────┘
```

## 4.3 Error State

```
┌──────────────────────────────────────────┐
│                                          │
│  ⚠ Unable to load Brand Health          │
│  Please check your connection and retry │
│                                          │
│  [ Retry ]                               │
│                                          │
└──────────────────────────────────────────┘
```

## 4.4 Partial State — Some dimensions unavailable

```
Knowledge Coverage  ████████░░░░  76/100
AI Visibility       ---- unavailable ---  ⚠
Trust               ████████░░░░  88/100
...
```

不可用维度不打断页面——静默降级。

---

# 五、UI 设计方向（提前冻结）

## 视觉语言参考

| 来源 | 借鉴什么 |
|------|---------|
| **Notion** | 结构清晰、侧边栏导航 |
| **Linear** | 行动驱动、CTA 设计 |
| **Stripe Dashboard** | 信息解释能力、卡片布局 |
| **OpenAI/Anthropic Console** | AI 语义、简洁性 |

## 核心设计原则

| 原则 | 体现 |
|------|------|
| One Score Dominance | 主分数 96px，其他元素不超过 16px |
| No Tables | 所有数据用卡片/进度条/列表展示 |
| Action Above Data | Actions Panel 在 Explain 右侧，同层级 |
| Explanation Embedded | 每条分数自带 Why + How |
| One Primary CTA | 页面底部唯一主按钮 |

---

# 六、与其他页面的连接关系

```
Health ───────────→ Recommendations  (主 CTA / 行动条)
  │                       │
  │                  Verification  (执行后验证)
  │                       │
  │                  Publishing  (发布)
  │                       │
  ├──→ Growth  (趋势数字点击)
  │
  └──→ Knowledge  (维度详情)
```

Health 是全局入口，但 Health 本身**不承载** Recommendations/Verification/Publishing 的完整功能——它只展示"状态 + 下一步"，具体执行在对应页面。

---

# 七、冻结声明

> Health Wireframe v1.0 defines the visual language and component system for all Brand Knowledge OS Workspace pages.
> All subsequent pages must inherit its layout patterns, component decisions, and interaction rules.
> Any deviation must be justified at Product IA level.
