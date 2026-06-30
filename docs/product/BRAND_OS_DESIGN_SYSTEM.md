# Brand OS Design System v1.0

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Product Principles / Vocabulary / Narrative / IA / 全部 Wireframe
> 适用范围：所有 Brand Knowledge OS Workspace（GEO / 短剧 / 小说 / PPT / Studio）

---

## 目录

- DS-0：架构规则（工程宪法）
- DS-1：Foundations（基础层）
- DS-2：Layout System（布局系统）
- DS-3：Primitives（基础组件）
- DS-4：Components（组合组件）
- DS-5：Product Blocks（产品模块）
- DS-6：Interaction Patterns（交互模式）
- DS-7：Copy Rules（文案规则）
- DS-8：Accessibility（可访问性）
- DS-9：Product Pattern（产品模式）

---

# DS-0 — 架构规则（工程宪法）

## DS-AR-001：单向依赖层

```
Workspace / Studio
    ↓  import only from
Product Blocks        ← 产品模块层
    ↓  import only from
Components            ← 组合组件层
    ↓  import only from
Primitives            ← 基础组件层
    ↓  import only from
Foundations           ← 设计基础层 (Tokens)
```

**Workspace 页面禁止直接 import Components 或 Primitives。** 只能通过 Product Blocks 导入。

## DS-AR-002：旧组件冻结

所有旧组件移入 `legacy/`，标记 `@deprecated`。CI 规则：
- 禁止 Workspace 引用 `legacy/`
- 禁止 Workspace 跨层引用 Components / Primitives
- 禁止新增 Legacy Import
- 违反 → CI 直接失败

## DS-AR-003：Project Block 跨 Workspace 共享

Product Block 是跨 Workspace 的。GEO 的 Hero 与短剧的 Hero 是同一个 Block。

---

## 目录结构

```
frontend/
├── design-system/
│   ├── foundations/
│   │   ├── color/
│   │   ├── spacing/
│   │   ├── typography/
│   │   ├── radius/
│   │   ├── elevation/
│   │   └── motion/
│   ├── primitives/
│   ├── components/
│   ├── product-blocks/
│   ├── patterns/
│   └── documentation/
├── workspaces/
│   ├── geo/           ← 只引用 product-blocks
│   ├── drama/
│   ├── novel/
│   └── ppt/
├── studio/            ← 可引用 components（允许技术词汇）
└── legacy/            ← @deprecated，CI 禁止新增引用
```

---

# DS-1 — Foundations（基础层）

## 1.1 Spacing — 8pt Grid

| Token | Pixels | 用途 |
|-------|--------|------|
| space-1 | 4px | 极小间距 |
| space-2 | 8px | 基础间距 |
| space-3 | 12px | 标签内边距 |
| space-4 | 16px | 卡片内边距 |
| space-5 | 24px | 卡片间距 |
| space-6 | 32px | 区块间距 |
| space-7 | 48px | 大区块间距 |
| space-8 | 64px | 页面边距 |

## 1.2 Radius

| Token | Value | 用途 |
|-------|-------|------|
| radius-sm | 4px | Button, Input |
| radius-md | 8px | Card, Modal |
| radius-lg | 12px | Dialog, Sheet |
| radius-full | 9999px | Badge, Avatar |

## 1.3 Typography

| Token | Size | Weight | 用途 |
|-------|------|--------|------|
| display | 48px / 1.1 | 700 | Hero Score |
| heading-1 | 32px / 1.2 | 600 | 页面标题 |
| heading-2 | 24px / 1.3 | 600 | 区块标题 |
| heading-3 | 20px / 1.4 | 500 | 卡片标题 |
| body | 16px / 1.5 | 400 | 正文 |
| body-sm | 14px / 1.5 | 400 | 辅助文字 |
| caption | 12px / 1.4 | 400 | 标签, 时间戳 |
| metric | 96px / 1.0 | 700 | Brand Health 主数字 |
| metric-sm | 32px / 1.0 | 700 | 副指标数字 |

Font family: 系统默认无衬线 (Inter / -apple-system / Segoe UI / sans-serif)

## 1.4 Color Roles（非品牌色）

| Token | 色值 | 用途 |
|-------|------|------|
| color-surface | #ffffff / #111111 | 页面/卡片背景 |
| color-text-primary | #111111 / #f1f1f1 | 主文字 |
| color-text-secondary | #6b7280 / #9ca3af | 次级文字 |
| color-text-tertiary | #9ca3af / #6b7280 | 辅助文字 |
| color-border | #e5e7eb / #2d2d2d | 边框, 分割线 |
| color-health | #22c55e | Brand Health 80-100 |
| color-warning | #eab308 | Brand Health 60-79 |
| color-risk | #ef4444 | Brand Health 0-59 |
| color-success | #22c55e | 成功状态 |
| color-error | #ef4444 | 错误状态 |
| color-caution | #f97316 | 警告状态 |
| color-info | #3b82f6 | 信息提示 |
| color-surface-dim | #f9fafb / #1a1a1a | 区域背景（暗色待定） |

## 1.5 Elevation

| Token | 阴影 | 用途 |
|-------|------|------|
| elevation-sm | 0 1px 2px rgba(0,0,0,0.05) | Card 默认 |
| elevation-md | 0 4px 6px rgba(0,0,0,0.07) | Card hover, Modal |
| elevation-lg | 0 10px 15px rgba(0,0,0,0.1) | Dialog, Sheet |

## 1.6 Motion

| Token | Duration | Easing | 用途 |
|-------|----------|--------|------|
| fast | 100ms | ease-out | Hover, Tap |
| normal | 200ms | ease-out | Transition, Toggle |
| slow | 400ms | ease-in-out | Page enter/leave, Score animate |

---

# DS-2 — Layout System（布局系统）

## 2.1 页面模板

所有 Workspace 页面遵循统一布局：

```
┌──────────────────────────────────────────────────────┐
│  Navigation Sidebar (固定宽度 240px)                   │
├──────────────────────────────────────────────────────┤
│  Header (Page Title + Breadcrumb)                     │
├──────────────────────────────────────────────────────┤
│  Page Content (Product Blocks 组合)                   │
│                                                       │
│  ┌─ Hero Block ──────────────────────────────────┐  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Content Block (Left) ──┐ ┌─ Content Block ───┐  │
│  │ Output                  │ │ (Right)            │  │
│  │                         │ │ Input              │  │
│  └─────────────────────────┘ └────────────────────┘  │
│                                                       │
│  ┌─ Full Width Block ────────────────────────────┐  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ CTA Block ───────────────────────────────────┐  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

## 2.2 布局模式

| 模式 | 描述 |
|------|------|
| **Hero → Split → CTA** | Health, Recommendations |
| **Hero → Full → CTA** | Verification, Publishing |
| **Hero → Split → Full → CTA** | Growth, Knowledge |

## 2.3 响应式断点

| Breakpoint | Width | Layout |
|------------|-------|--------|
| mobile | < 768px | 单列，Stack |
| tablet | 768-1024px | 双列 50/50 |
| desktop | 1024-1440px | 双列 40/60 |
| wide | > 1440px | 双列 + 侧边栏保留 |

---

# DS-3 — Primitives（基础组件）

## 允许的 Primitives（第一批）

```
primitives/
├── Button            — primary / secondary / ghost / danger
├── Input             — text / textarea / select
├── Card              — 容器，无业务语义
├── Badge             — 状态标签
├── Avatar            — 品牌头像/图标
├── Tabs              — 顶部标签切换
├── Dialog            — 模态对话框
├── Tooltip           — 悬停提示
├── Progress          — 进度条
├── Skeleton          — 加载骨架屏
├── Icon              — 图标（封装 lucide-vue-next 等）
├── Typography        — Display / H1-H3 / Body / Caption
├── Spacer            — 间距占位
└── Divider           — 分割线
```

## 规则

- **无业务语义**。禁止 HealthCard / PublishButton / RecommendationCard 等命名。
- 所有 Primitive 接受 `class` / `style` 透传。
- 所有 Primitive 接受 `data-testid` 用于 E2E 测试。

---

# DS-4 — Components（组合组件）

## 允许的 Components（第一批）

由多个 Primitive 组成，有通用业务行为但无页面语义。

```
components/
├── ScoreCard           — 0-100 指标展示（用于维度分解）
├── StatusIndicator     — ✓ Connected / ⌛ Pending / ⚠ Error
├── MetricCard          — 单值指标卡片
├── EmptyState          — 空状态（Title + Description + CTA）
├── LoadingState        — 加载状态（Title + Steps）
├── SuccessBanner       — 成功结果横幅
├── ErrorBanner         — 错误结果横幅
├── TrendChart          — 趋势图（折线/柱状）
├── Timeline            — 事件时间线
├── SearchBox           — 搜索输入框
├── FilterBar           — 筛选条
├── DataList            — 列表数据展示
└── ConfirmDialog       — 确认弹窗（Delete / Approve / Reject）
```

## 规则

- **无页面语义**。禁止 BrandHealthHero / RecommendationPanel 等命名。
- 接受 Props 驱动，不硬编码业务文案。
- 默认值满足通用场景。

---

# DS-5 — Product Blocks（产品模块）

## 允许的 Product Blocks（第一批）

**这是 Workspace 页面唯一能 import 的层。**

```
product-blocks/
├── Hero                — 页面标题区（Title + Subtitle + Meta）
├── HealthSummary       — Brand Health 摘要（Score + Trend + Why）
├── ActionPanel         — Actions 列表（Title + Cards + CTA）
├── VerificationSummary — 验证摘要（Before / After + Confidence）
├── ProofPanel          — 证据对比（维度比较）
├── DistributionOverview— 分发概览（Active channels count）
├── ChannelList         — 渠道列表（Status per channel）
├── GrowthOverview      — 成长概览（趋势 + 里程碑）
├── TrendOverview       — 趋势展示（Chart + Delta）
├── ExplanationPanel    — 解释面板（Why / How bullets）
├── ImpactPreview       — 影响预览（Before → After）
├── NextStepPanel       — 下一步建议（连接当前页→下一页）
├── RecommendationList  — 推荐列表（Top N actions）
├── KnowledgeOverview   — 知识概览（Brand description + key items）
└── EmptyGuide          — 首次使用引导（Guide + CTA）
```

## 规则

- 每个 Product Block 有明确的 Product Intent（产品意图）
- Product Block 负责组合 Components 和 Primitives
- Product Block 是页面级组合单位

---

# DS-6 — Interaction Patterns（交互模式）

## 6.1 Hover → Explain

悬停在任何 Score / Status 上显示 Tooltip 解释。

## 6.2 Click → Expand

点击任意 Summary 展开详情，再次点击收起。

## 6.3 Click → Preview → Confirm

所有破坏性/重要操作遵循此模式：
1. 点击 → 显示预览（What will change）
2. Preview 显示 Impact
3. 用户确认 → 执行

## 6.4 Execute → Success → Return

1. 执行操作
2. Toast / Banner 显示结果
3. 自动或手动返回上一页（Health 更新）

## 6.5 Paginate / Infinite Scroll

列表数据超过 10 项时启用分页或无限滚动。

## 6.6 Empty → Guide

所有 Empty State 必须包含下一步指南。

---

# DS-7 — Copy Rules（文案规则）

## 7.1 引用 Product Vocabulary

所有 UI 文案必须符合 `GEO_PRODUCT_VOCABULARY.md`。

| 必须使用 | 禁止使用 |
|----------|---------|
| Improve | Optimize |
| Website | Repository |
| Channel | Adapter |
| Trust | Evidence |
| Recommendation | Suggestion |
| Health | Dashboard / Status |
| Verification | Validation |
| Publishing | Deploy / Release |
| Growth | Monitor / Timeline |

## 7.2 文案风格

- 动词开头：`Fix coverage`, `Improve visibility`, `Publish update`
- 自然语言：`Why we believe this` 而非 `Verification Results`
- 禁止：`Pass / Fail`，改用 `Complete / Incomplete`
- 数字：统一格式 `+5`, `-3`, `82/100`

## 7.3 错误文案

- ❌ `Error: Connection timeout`
- ✅ `Unable to reach Official Website. Please check your connection and retry.`

---

# DS-8 — Accessibility（可访问性）

## 8.1 颜色对比度

- 所有文本颜色通过 WCAG AA（4.5:1）
- Brand Health color coding 提供形状/图标辅助

## 8.2 键盘导航

- 所有交互元素可通过 Tab 聚焦
- 所有 Action 可通过 Enter 触发
- 折叠/展开内容可通过 Space 切换

## 8.3 ARIA

- 所有 Icon / Status / Banners 包含 `aria-label`
- 所有动态内容使用 `aria-live` region（Loading / Toast / Banner）
- 所有模态使用 `role="dialog"` + `aria-modal`

## 8.4 响应式

- 移动端所有 Product Block 自动堆叠
- 表格数据在移动端转为列表视图

---

# DS-9 — Product Pattern（产品模式）

## 9.1 所有页面的统一结构

每一页必须遵循以下 Block 顺序：

```
Hero
    ↓
Explanation （为什么）
    ↓
Action / Content （响应 / 展示）
    ↓
Evidence / Detail （证据 / 详情）
    ↓
Next Step （下一步连接）
```

这是 Brand OS Pattern Language。

## 9.2 各页面映射

| 页面 | Hero | Explanation | Action/Content | Evidence | Next Step |
|------|------|-------------|----------------|----------|-----------|
| Health | Brand Health 82 | Why this score | Dimensional Breakdown | — | → Recommendations |
| Recommendations | "3 actions" | Why these actions | Action Card List | Impact Preview | → Verification |
| Verification | 82 → 88 | Why we believe | Before / After | — | → Growth |
| Publishing | "3 of 5 active" | Distribution Health | Channel List | Latest Distribution | → Health |
| Growth | Trend | Milestones | Trend Chart | — | → Health |
| Knowledge | Brand Description | Knowledge Structure | Item List | — | → Recommendations |

## 9.3 跨 Workspace 复用

短剧 / 小说 / PPT Workspace 继承此 Pattern：

```
Hero → Explanation → Content → Evidence → Next Step
```

新增 Workspace 必须先映射到此 Pattern，否则不启动设计。

---

# 冻结声明

> Brand OS Design System v1.0 defines the complete design language for all Brand Knowledge OS products.
> It is the second key freeze point of P-Product Sprint (after Constitution).
> From this point forward, no new components are designed — only new Product Blocks composed from existing Components and Primitives.
> All design, code review, and CI checks must enforce the three-layer dependency rule (DS-AR-001).
