# PageShell Component Specification

> **RC5-5B Component Library — Contract #001**
> 冻结日期：2026-07-26
> 状态：Approved · Implementation Ready

---

## 目录

1. [设计目标](#1-设计目标)
2. [职责边界](#2-职责边界)
3. [Props 接口](#3-props-接口)
4. [Slots 定义](#4-slots-定义)
5. [状态处理](#5-状态处理)
6. [视觉结构](#6-视觉结构)
7. [与 GeoWorkspaceLayout 的关系](#7-与-geoworkspacelayout-的关系)
8. [与 Navigation Architecture 对接](#8-与-navigation-architecture-对接)
9. [与现有页面的映射](#9-与现有页面的映射)
10. [工程规范](#10-工程规范)
11. [反模式（禁止事项）](#11-反模式禁止事项)

---

## 1. 设计目标

PageShell 是 GEO Workspace **唯一允许**使用的页面骨架组件。它的存在解决了以下问题：

| 问题 | 现状 | PageShell 目标 |
|------|------|---------------|
| 每个页面自己拼布局 | 每个 `.vue` 文件写 `<div class="page-header">` + `<div class="summary-panel">` 等结构 | 统一骨架，页面只关心内容 |
| 状态处理散落各处 | Loading/Empty/Error 每个页面自己实现，不一致 | 统一状态层，Slot 根据状态决定渲染 |
| 区域顺序不一致 | 有的 Summary 在上，有的在主内容下方 | 固定区域顺序：PageHeader → Summary → Content → Explain → NextAction |
| 重复代码 | 每个页面复制 Breadcrumb / PageHeader / NextAction 的 HTML 和 CSS | 一次实现，所有页面继承 |

---

## 2. 职责边界

### 2.1 PageShell 负责的

| 职责 | 说明 |
|------|------|
| 页面标题展示 | 通过 `title` prop 渲染 PageHeader 区域 |
| 页面描述展示 | 通过 `description` prop 渲染 PageHeader 子标题 |
| 面包屑导航 | 通过 `breadcrumbs` prop 渲染面包屑路径 |
| 页面状态管理 | 根据 `loading` / `empty` / `error` 状态决定渲染内容 |
| 区域布局编排 | 按固定顺序排列：PageHeader → Summary → Content → Explain → NextAction |
| 页面过渡动画 | 内容切换时的入场动画（与 GeoWorkspaceLayout 的 transition 协同） |
| 空状态展示 | 当 `empty` 为 true 时，渲染统一的空状态视图 |
| 加载骨架屏 | 当 `loading` 为 true 时，渲染 Skeleton 骨架屏 |
| 错误状态展示 | 当 `error` 被传递时，渲染统一错误卡片 |
| 滚动容器管理 | Content 区域可独立滚动，PageHeader 和 NextAction 保持 sticky |

### 2.2 PageShell 不负责的（绝对不碰）

| 禁止行为 | 原因 |
|----------|------|
| ❌ 不获取数据 | 数据获取是页面/组件的职责 |
| ❌ 不调用 API | 无任何 Service / API 调用 |
| ❌ 不使用 Store | 不读 Pinia / Vuex，不 dispatch action |
| ❌ 不包含业务逻辑 | 没有品牌/推荐/验证/发布等 GEO 业务概念 |
| ❌ 不渲染业务组件 | 不 import HealthScore / RecommendationCard 等 |
| ❌ 不控制路由 | 不调用 `router.push` / `router.replace` |
| ❌ 不管理用户权限 | 不检查角色、权限、功能开关 |
| ❌ 不处理导航切换逻辑 | 不决定 Sidebar 选中态，不处理前进/后退 |
| ❌ 不包含 Header / Sidebar | Header 和 Sidebar 由 GeoWorkspaceLayout 提供 |
| ❌ 不包含品牌选择器 | 品牌选择器是 GeoWorkspaceLayout 的职责 |
| ❌ 不打包 AI 交互逻辑 | 没有 Explain Drawer 的控制逻辑（只提供 slot 位置） |

### 2.3 与 GeoWorkspaceLayout 的关系

```
┌─────────────────────────────────────────────────────────────┐
│  GeoWorkspaceLayout                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Header (Brand + Workspace Selector + User Info)      │  │
│  ├──────────┬────────────────────────────────────────────┤  │
│  │          │  PageShell                                 │  │
│  │  Sidebar │  ┌──────────────────────────────────────┐ │  │
│  │  (Nav)   │  │  PageHeader (title + description)    │ │  │
│  │          │  │  Breadcrumb                          │ │  │
│  │          │  ├──────────────────────────────────────┤ │  │
│  │          │  │  #summary (SummaryPanel)              │ │  │
│  │          │  ├──────────────────────────────────────┤ │  │
│  │          │  │  #content (页面主体)                   │ │  │
│  │          │  ├──────────────────────────────────────┤ │  │
│  │          │  │  #explain (Explain 区域 / Drawer)     │ │  │
│  │          │  ├──────────────────────────────────────┤ │  │
│  │          │  │  #next (NextActionPanel)              │ │  │
│  │          │  └──────────────────────────────────────┘ │  │
│  └──────────┴────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**核心规则：**

1. `GeoWorkspaceLayout` 提供：Header（品牌标识 + 工作区选择器 + 用户信息）、Sidebar（导航入口 + 品牌选择器）、页面过渡动画容器（`<slot />`）
2. `PageShell` **插入在 GeoWorkspaceLayout 的默认 slot 内**，负责编排内容区的标准页面结构
3. `GeoWorkspaceLayout` 是路由级别的 Layout，`PageShell` 是页面级别的 Layout
4. 页面组件既不能跳过 `GeoWorkspaceLayout`，也不能跳过 `PageShell`
5. 每个页面在 `<template>` 中的结构必须是：

```vue
<!-- 正确 ✅ -->
<template>
  <PageShell
    title="品牌健康"
    description="查看品牌在 AI 眼中的健康度"
    :breadcrumbs="breadcrumbs"
    :loading="isLoading"
    :error="errorState"
  >
    <template #summary>
      <HealthScore :score="healthData.score" />
    </template>
    <template #content>
      <HealthDetails :dimensions="healthData.dimensions" />
    </template>
    <template #explain>
      <ExplainDrawer :document="explainDoc" />
    </template>
    <template #next>
      <NextAction action="recommendations" />
    </template>
  </PageShell>
</template>

<!-- 错误 ❌ — 直接拼 HTML -->
<template>
  <div class="health-page">
    <div class="page-header">...</div>
    <div class="summary">...</div>
  </div>
</template>
```

---

## 3. Props 接口

```ts
/**
 * PageShell Props
 *
 * 设计原则：
 * - 只包含布局/状态相关的属性
 * - 不包含任何业务数据（品牌、推荐、验证等）
 * - 不包含事件回调（页面组件通过 emit 自行处理）
 */
interface PageShellProps {
  /**
   * 页面标题
   * 显示在 PageHeader 区域，使用 h1 标签
   * 长度限制：≤ 8 字
   * @required
   */
  title: string

  /**
   * 页面描述
   * 显示在 PageHeader 标题下方，作为一句话说明
   * 长度限制：≤ 25 字
   * @optional
   */
  description?: string

  /**
   * 面包屑路径
   * 显示当前用户在导航中的位置
   * 格式：[品牌] → [一级导航] → [当前页面]
   * 示例：[{ label: '云栖咖啡', to: '/geo/dashboard' }, { label: '开始优化' }, { label: '品牌健康' }]
   * @optional
   */
  breadcrumbs?: Breadcrumb[]

  /**
   * 是否处于加载状态
   * true 时：显示 Skeleton 骨架屏，隐藏所有 slot 内容
   * @optional
   * @default false
   */
  loading?: boolean

  /**
   * 是否处于空状态
   * true 时：显示空状态提示，隐藏 #content #explain #next slot
   * @optional
   * @default false
   */
  empty?: boolean

  /**
   * 空状态的标题文案
   * 仅 empty=true 时有效
   * 示例："还没有优化记录"
   * @optional
   */
  emptyTitle?: string

  /**
   * 空状态的描述文案
   * 仅 empty=true 时有效
   * 示例："完成一项优化后，这里会显示效果对比"
   * @optional
   */
  emptyDescription?: string

  /**
   * 空状态的操作按钮文案
   * 仅 empty=true 时有效。不传则不显示按钮
   * 示例："去执行建议"
   * @optional
   */
  emptyActionText?: string

  /**
   * 错误状态
   * 非 null/undefined 时：显示错误卡片，隐藏 #content #explain #next
   * @optional
   */
  error?: ErrorState | null

  /**
   * 是否隐藏 NextAction 区域
   * 用于无需推荐下一步的页面（如设置页）
   * @optional
   * @default false
   */
  hideNext?: boolean
}

/**
 * 面包屑项
 */
interface Breadcrumb {
  /**
   * 显示文本
   */
  label: string

  /**
   * 路由路径（可选）。最后一个面包屑通常没有 to（表示当前位置）
   */
  to?: string
}

/**
 * 错误状态
 */
interface ErrorState {
  /**
   * 错误标题
   * @required
   */
  title: string

  /**
   * 错误详细描述
   * @optional
   */
  message?: string

  /**
   * 是否可重试
   * true 时显示"重试"按钮
   * @optional
   * @default false
   */
  retryable?: boolean
}
```

### Props 验证规则

| 规则 | 说明 |
|------|------|
| title 必填 | 没有标题的页面不存在 |
| title 渲染为 `<h1>` | 每页只有一个 `<h1>`，SEO 合规 |
| loading 优先 | loading=true 时忽略 empty 和 error |
| error 优先于 empty | error 非 null 时忽略 empty |
| hideNext=true 时 #next slot 始终不渲染 | 即使有内容也不渲染 |

---

## 4. Slots 定义

```vue
<PageShell>
  <!-- 关键数据摘要区域 -->
  <template #summary>
    <!-- SummaryPanel（关键数据摘要） -->
  </template>

  <!-- 页面主体内容区域 -->
  <template #content>
    <!-- 页面核心功能 -->
  </template>

  <!-- AI 解释区域 -->
  <template #explain>
    <!-- Explain Drawer 或 Explain 内联区域 -->
  </template>

  <!-- 下一步推荐区域 -->
  <template #next>
    <!-- NextActionPanel（下一步推荐） -->
  </template>
</PageShell>
```

### 4.1 Slot 详细规范

| Slot | 名称 | 渲染条件 | 内容预期 | 滚动行为 |
|------|------|----------|---------|---------|
| #summary | 摘要 | 非 loading 且非空状态 | 关键数据摘要（分数、统计、状态） | 静态，不滚动 |
| #content | 内容 | 非 loading、非空状态、无 error | 页面核心功能组件 | 可垂直滚动 |
| #explain | 解释 | 非 loading、非空状态、无 error | Explain Drawer 或嵌入说明 | 跟随内容或 Drawer |
| #next | 下一步 | 非 loading、非空状态、无 error、hideNext=false | NextActionPanel | 底部 sticky |

### 4.2 Slot 渲染规则矩阵

| 状态 | #summary | #content | #explain | #next |
|------|----------|----------|----------|-------|
| **default**（正常） | ✅ 渲染 | ✅ 渲染 | ✅ 渲染 | ✅ 渲染 |
| **loading** | ❌ Skeleton | ❌ Skeleton | ❌ 隐藏 | ❌ 隐藏 |
| **empty** | ✅ 渲染 | ❌ 空状态 | ❌ 隐藏 | ❌ 隐藏 |
| **error** | 视情况渲染 | ❌ 错误卡片 | ❌ 隐藏 | ❌ 隐藏 |
| **loading → default** | ✅ 渲染（过渡动画） | ✅ 渲染（过渡动画） | ✅ 渲染（过渡动画） | ✅ 渲染（过渡动画） |

**empty 状态下 #summary 仍然渲染的原因**：
即使没有主内容，摘要也应该显示"暂无数据"的概括性状态。例如 Knowledge 页面无知识声明时，Summary 显示"知识覆盖率 0%"以保持信息层级一致性。

**error 状态下 #summary 视情况渲染说明**：
- 如果错误是可恢复的局部错误（如某个 API 失败但已有缓存数据），#summary 可保留
- 如果错误是全局性的（如品牌不存在、网络断开），#summary 也应被错误卡片替代
- 判断逻辑由页面组件决定，PageShell 只根据 `error` prop 是否存在决定是否渲染错误卡片

---

## 5. 状态处理

### 5.1 Loading 状态

**触发条件：** `loading = true`

**视觉表现：**
```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │  ▓▓▓▓▓▓▓▓▓▓ (title skeleton) │  │
│  │  ▓▓▓▓▓▓ (breadcrumb)         │  │
│  ├───────────────────────────────┤  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐    │  │
│  │  │ ▓▓▓ │ │ ▓▓▓ │ │ ▓▓▓ │    │  │  ← summary skeleton (3 cards)
│  │  └─────┘ └─────┘ └─────┘    │  │
│  ├───────────────────────────────┤  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  │  ← content skeleton
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**规则：**
1. 所有 slot 内容不渲染（DOM 树中不存在）
2. PageHeader 区域显示 Skeleton（标题和面包屑的灰色脉冲条）
3. Summary 区域显示 3 个 Skeleton Card（灰色方块 + 脉冲动画）
4. Content 区域显示 0-6 行 Skeleton 条（根据页面类型）
5. Explain 和 NextAction 区域完全隐藏
6. Skeleton 使用 Design System 的 `skeleton-pulse` 动画（`@keyframes: opacity 1.5s ease-in-out infinite`）
7. Skeleton 不应有额外动画（只做脉冲，不做骨架屏的"加载完成→内容"的过渡——那是页面组件的职责）

### 5.2 Empty 状态

**触发条件：** `empty = true`（且 `loading = false`）

**视觉表现：**
```
┌─────────────────────────────────────┐
│  品牌知识                             │
│  管理 AI 知道的品牌信息                │
│  ───────────────────────────────────  │
│  知识覆盖率 0%                        │  ← #summary 正常渲染
│  ───────────────────────────────────  │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │        📋 (icon)              │  │  ← empty state（替代 #content）
│  │   还没有品牌知识声明             │  │
│  │  添加品牌信息后，AI 可以更好地    │  │
│  │  了解你的品牌                    │  │
│  │                               │  │
│  │   [ 添加品牌信息 → ]            │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│  (explain 和 next 不渲染)            │
└─────────────────────────────────────┘
```

**规则：**
1. `#summary` 正常渲染（即使是 0 值也要展示，符合 P6: Explain Every Score）
2. `#content` 区域替换为统一空状态组件
3. `#explain` 和 `#next` 不渲染
4. 空状态使用 `emptyTitle` / `emptyDescription` / `emptyActionText` 定制文案
5. 空状态图标根据页面类型动态选择（由 PageShell 内部从内置图标集中选择，不依赖业务传入）
   - 数据类页面：📊
   - 列表类页面：📋
   - 结果类页面：🔍
   - 默认：📌

### 5.3 Error 状态

**触发条件：** `error` prop 非 `null`/`undefined`

**视觉表现：**
```
┌─────────────────────────────────────┐
│  PageHeader (正常渲染)                │
│  ───────────────────────────────────  │
│  ┌───────────────────────────────┐  │
│  │  ⚠️  (warning icon)           │  │
│  │                               │  │
│  │  数据加载失败                    │  │  ← error.title
│  │  无法获取品牌健康数据，请稍后重试  │  │  ← error.message
│  │                               │  │
│  │   [ 重试 ]                     │  │  ← 仅 error.retryable=true 时显示
│  │                               │  │
│  └───────────────────────────────┘  │
│  (content / explain / next 不渲染)    │
└─────────────────────────────────────┘
```

**规则：**
1. PageHeader 正常渲染（用户需要知道自己在哪个页面）
2. `#content` / `#explain` / `#next` 不渲染
3. `#summary` 视情况渲染（参考 4.2 规则矩阵）
4. Error 卡片统一样式：白底红框（1px `#ef4444`）+ ⚠️ 图标
5. `error.retryable = true` 时显示"重试"按钮
6. ❌ 不直接绑定重试事件——PageShell 通过 `@retry` emit 通知父组件

### 5.4 状态 transition（loading → default）

当从 `loading=true` 变为 `loading=false` 时：

1. Skeleton 保持 150ms 淡出（`opacity 150ms ease-out`）
2. Slot 内容 200ms 淡入（使用 `fade-in-up` 动画）
3. Explain 和 NextAction 延迟 100ms 后开始动画（层级 5 应略晚于主体内容）

---

## 6. 视觉结构

### 6.1 内容区域布局

```
┌──────────────────────────────────────────────────┐
│  Breadcrumb                                       │
│  云栖咖啡 > 开始优化 > 品牌健康                     │
│  ────────────────────────────────────────────────  │
│  PageHeader                                        │
│  品牌健康                          (info icon)     │
│  查看品牌在 AI 眼中的健康度                          │
│  ────────────────────────────────────────────────  │
│  Summary (min-height: 120px)                       │
│  ┌──────┐ ┌──────┐ ┌──────┐                       │
│  │ 45   │ │ 32   │ │ 78   │                       │
│  │ 总分  │ │ 知识  │ │ 可见  │                       │
│  └──────┘ └──────┘ └──────┘                       │
│  ────────────────────────────────────────────────  │
│  Content (flex: 1, overflow-y: auto)               │
│  ┌────────────────────────────────────────────┐    │
│  │  页面主体内容区域                            │    │
│  │                                            │    │
│  │  (由页面组件通过 #content slot 提供)          │    │
│  │                                            │    │
│  └────────────────────────────────────────────┘    │
│  ────────────────────────────────────────────────  │
│  Explain                                           │
│  由 #explain slot 提供，或默认隐藏                  │
│  ────────────────────────────────────────────────  │
│  Next Action                                       │
│  由 #next slot 提供                                │
└──────────────────────────────────────────────────┘
```

### 6.2 CSS 架构

| 区域 | CSS class | 布局方式 | sticky |
|------|-----------|---------|--------|
| 容器 | `.page-shell` | `display: flex; flex-direction: column; height: 100%` | — |
| Breadcrumb | `.page-shell__breadcrumb` | `padding: 0 0 8px` | 否 |
| PageHeader | `.page-shell__header` | `padding: 0 0 16px` | 否 |
| Summary | `.page-shell__summary` | `padding: 0 0 20px; min-height: 120px` | 否 |
| Content | `.page-shell__content` | `flex: 1; overflow-y: auto; padding: 0 0 20px` | 否（内部可滚动） |
| Explain | `.page-shell__explain` | `padding: 0 0 16px` | 否 |
| NextAction | `.page-shell__next` | `padding: 16px 0 0; border-top: 1px solid var(--color-border)` | `position: sticky; bottom: 0` |

**关键样式规则：**

```css
.page-shell {
  display: flex;
  flex-direction: column;
  height: 100%;                /* 占满 GeoWorkspaceLayout content 区域 */
  max-width: 960px;            /* 内容最大宽度，居中 */
  margin: 0 auto;             /* 水平居中 */
}

.page-shell__content {
  flex: 1;
  overflow-y: auto;           /* 内容过长时滚动 */
  scrollbar-width: thin;
}

.page-shell__next {
  position: sticky;
  bottom: 0;
  background-color: var(--color-surface);
  z-index: 10;
  /* 保证 NextAction 始终可见，不被内容滚动推下去 */
}
```

---

## 7. 与 GeoWorkspaceLayout 的关系

### 7.1 嵌套方式

```vue
<!-- 路由组件示例 -->
<template>
  <GeoWorkspaceLayout>
    <PageShell
      title="品牌健康"
      description="查看品牌在 AI 眼中的健康度"
      :breadcrumbs="breadcrumbs"
      :loading="isLoading"
      :error="errorState"
    >
      <template #summary>
        <HealthScore :score="data.score" />
      </template>
      <template #content>
        <HealthDimensions :dimensions="data.dimensions" />
      </template>
      <template #explain>
        <ExplainDrawer :document="data.explain" />
      </template>
      <template #next>
        <NextActionPanel action="recommendations" />
      </template>
    </PageShell>
  </GeoWorkspaceLayout>
</template>
```

### 7.2 职责划分矩阵

| 职责 | GeoWorkspaceLayout | PageShell | 页面组件 |
|------|--------------------|-----------|---------|
| Header（品牌 Logo + 工作区选择器 + 用户信息） | ✅ | ❌ | ❌ |
| Sidebar（导航 + 品牌选择器） | ✅ | ❌ | ❌ |
| 移动端响应式（Sidebar 折叠） | ✅ | ❌ | ❌ |
| 页面过渡动画（路由切换） | ✅ 提供 `<Transition>` 容器 | ❌ | ❌ |
| 内容区布局编排 | ❌ | ✅ | ❌ |
| 页面标题 + 描述 | ❌ | ✅ | 通过 props 传入 |
| 面包屑 | ❌ | ✅ | 通过 props 传入 |
| 状态控制（loading/empty/error） | ❌ | ✅ | 通过 props 传入 |
| Summary 区域 | ❌ | ✅ slot 占位 | 提供内容 |
| Primary Content 区域 | ❌ | ✅ slot 占位 | 提供内容 |
| Explain 区域 | ❌ | ✅ slot 占位 | 提供内容 |
| NextAction 区域 | ❌ | ✅ slot 占位 | 提供内容 |
| 实际数据获取 | ❌ | ❌ | ✅ |
| API 调用 | ❌ | ❌ | ✅ |
| Store 操作 | ❌ | ❌ | ✅ |
| 业务组件渲染 | ❌ | ❌ | ✅ |

### 7.3 路由层级

```
Route:  /workspace/geo/:page
         │
         ▼
GeoWorkspaceLayout.vue       ← 路由 Layout（提供 Header + Sidebar + Transition）
         │
         ▼
    [默认 slot]
         │
         ▼
PageShell.vue                ← 页面骨架（提供标准内容区结构）
         │
         ▼
    [content slot]
         │
         ▼
HealthPage.vue               ← 实际页面组件（提供业务组件和数据）
```

---

## 8. 与 Navigation Architecture 对接

### 8.1 Breadcrumb 映射

根据 Navigation Architecture v1.0 第 4.1 节定义，所有页面的面包屑固定格式为：

| 页面 | breadcrumbs prop 值 |
|------|---------------------|
| Health | `[{ label: brandName, to: '/geo/dashboard' }, { label: '开始优化' }, { label: '品牌健康' }]` |
| Recommendations | `[{ label: brandName, to: '/geo/dashboard' }, { label: '执行建议' }, { label: '推荐方案' }]` |
| Mission | `[{ label: brandName, to: '/geo/dashboard' }, { label: '执行建议' }, { label: taskName }]` |
| Verification | `[{ label: brandName, to: '/geo/dashboard' }, { label: '验证效果' }, { label: '优化对比' }]` |
| Publishing | `[{ label: brandName, to: '/geo/dashboard' }, { label: '发布成果' }, { label: '发布管理' }]` |
| Knowledge | `[{ label: brandName, to: '/geo/dashboard' }, { label: '发布成果' }, { label: '品牌知识' }]` |
| Dashboard | `[{ label: brandName, to: '/geo/dashboard' }, { label: '持续增长' }, { label: '数据总览' }]` |
| Growth | `[{ label: brandName, to: '/geo/dashboard' }, { label: '持续增长' }, { label: '成长趋势' }]` |
| MissionCenter | `[{ label: brandName, to: '/geo/dashboard' }, { label: '执行建议' }, { label: '任务中心' }]` |

### 8.2 页面 Header 描述映射

根据 Navigation Architecture 各页面 Primary Goal 定义：

| 页面 | title | description |
|------|-------|-------------|
| Health | 品牌健康 | 查看品牌在 AI 眼中的健康度 |
| Recommendations | 推荐方案 | AI 建议优化以下内容 |
| Verification | 验证效果 | 查看优化前后对比 |
| Publishing | 发布管理 | 让品牌知识触达更多渠道 |
| Knowledge | 品牌知识 | AI 知道的品牌信息 |
| Dashboard | 数据总览 | 品牌全景数据 |
| Growth | 成长趋势 | 品牌随时间的变化轨迹 |
| MissionCenter | 任务中心 | 管理和执行优化任务 |

---

## 9. 与现有页面的映射

下表列出当前所有 GEO 页面如何使用 PageShell：

| 当前页面 | 文件路径 | title | description | #summary | #content | #explain | #next |
|----------|---------|-------|-------------|----------|----------|----------|-------|
| GEODashboard | `pages/GEODashboard.vue` | 数据总览 | 品牌全景数据 | HealthScore 关键指标行 | DashboardGrid 图表 + 列表 | ActivityExplain 活动说明 | NextAction"查看健康" |
| HealthPage | `pages/HealthPage.vue` | 品牌健康 | 查看品牌在 AI 眼中的健康度 | HealthScore 总分+ 一句话 | HealthDetails 6 维度网格 | ExplainDrawer 维度详情 | Recommendations CTAs |
| RecommendationsPage | `pages/RecommendationsPage.vue` | 推荐方案 | AI 建议优化以下内容 | RecommendationCount 总数+预期提升 | RecommendationList 优先级排序卡片 | RecommendExplain 每项"了解为什么" | Verify"一键执行全部" |
| VerificationPage | `pages/VerificationPage.vue` | 优化对比 | 查看优化前后效果 | BeforeAfter 对比+ 变化值 | VerificationResult 维度变化明细 | VerificationExplain 变化原因 | ContinueOptimize"继续优化" |
| PublishingPage | `pages/PublishingPage.vue` | 发布管理 | 让品牌知识触达更多渠道 | PublishingStatus 渠道状态摘要 | PublishingChannels 渠道列表+ 发布按钮 | PublishingExplain 发布机制 | Growth"查看发版效果" |
| GrowthPage | `pages/GrowthPage.vue` | 成长趋势 | 品牌随时间的变化轨迹 | GrowthSummary 累计变化+ 方向 | GrowthChart 趋势图+ 里程碑 | GrowthExplain 趋势原因 | Publish"继续优化" |
| KnowledgePage | `pages/KnowledgePage.vue` | 品牌知识 | AI 知道的品牌信息 | KnowledgeCoverage 覆盖率 | KnowledgeGrid 声明卡片列表 | KnowledgeExplain AI 理解方式 | Action"编辑知识" |
| MissionCenter | `pages/MissionCenterShell.vue` | 任务中心 | 管理和执行优化任务 | MissionSummary 待办/完成统计 | MissionList 任务列表 | MissionExplain 任务说明 | Verify"验证效果" |

### 9.1 映射迁移说明

每个现有页面需要做以下改造：

1. **移除** 页面内自有的 `<div class="page-header">`、`<div class="summary-area">` 等布局 HTML
2. **移除** 页面内自有的 Loading/Empty/Error 状态管理（交由 PageShell props 控制）
3. **替换为** `<PageShell>` 组件 + slots
4. **提取** 原有 Summary 区域的代码到 `<template #summary>`
5. **提取** 原有 Content 区域的代码到 `<template #content>`
6. **提取** 原有 Explain 逻辑到 `<template #explain>`
7. **提取** 原有 NextAction 区域到 `<template #next>`
8. **传入** `title` / `description` / `breadcrumbs` / `loading` / `empty` / `error` 等 props

---

## 10. 工程规范

### 10.1 组件注册

- 全局注册为 `PageShell`（无需每个页面 import）
- 文件位置：`frontend/workspaces/geo/components/PageShell.vue`
- TypeScript 类型导出：`frontend/workspaces/geo/types/page-shell.ts`

### 10.2 组件签名

```vue
<script setup lang="ts">
// PageShell.vue
// ── 不 import 任何业务 Service / Store / API ──
import { computed } from 'vue'

interface Breadcrumb {
  label: string
  to?: string
}

interface ErrorState {
  title: string
  message?: string
  retryable?: boolean
}

const props = withDefaults(defineProps<{
  title: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  loading?: boolean
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyActionText?: string
  error?: ErrorState | null
  hideNext?: boolean
}>(), {
  description: '',
  breadcrumbs: () => [],
  loading: false,
  empty: false,
  emptyTitle: '暂无数据',
  emptyDescription: '',
  emptyActionText: '',
  error: null,
  hideNext: false,
})

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'empty-action'): void
}>()

// ── 状态计算 ──
const showSkeleton = computed(() => props.loading)
const showEmpty = computed(() => !props.loading && props.empty)
const showError = computed(() => !props.loading && !props.empty && props.error !== null)
const showContent = computed(() => !showSkeleton.value && !showEmpty.value && !showError.value)
</script>
```

**emit 事件：**

| 事件 | 触发时机 | 说明 |
|------|---------|------|
| `retry` | 用户点击错误卡片的重试按钮 | 父组件处理重试逻辑 |
| `empty-action` | 用户点击空状态的操作按钮 | 父组件处理导航/操作逻辑 |

### 10.3 测试契约

| 测试用例 | 预期行为 |
|---------|---------|
| `loading=true` 时不渲染 slot 内容 | DOM 中无 slot 内容，只有 Skeleton |
| `empty=true` 时只渲染 summary + empty state | DOM 中有 summary slot 内容 + 空状态组件，无 content/explain/next |
| `error={title:'错误'}` 时渲染 PageHeader + ErrorCard | 显示 PageHeader 和错误卡片，无 content slot |
| 无 loading/empty/error 时渲染所有 slots | 所有 slot 内容正常显示 |
| `hideNext=true` 时不渲染 #next | DOM 中无 next 区域 |
| title 渲染为 `<h1>` | 检查 h1 标签存在且内容正确 |
| Skeleton 使用 `aria-hidden="true"` | 辅助技术不读取骨架屏 |
| empty state 的 button 触发 `empty-action` emit | 点击后 emit 被调用 |

### 10.4 无障碍要求

| 要求 | 实现方式 |
|------|---------|
| PageShell 根元素 `role="region"` + `aria-label` | `role="region" aria-label={title}` |
| Skeleton 不干扰屏幕阅读器 | `aria-hidden="true"` |
| Breadcrumb 使用 `nav` + `aria-label="Breadcrumb"` | 标准面包屑无障碍模式 |
| Error card 使用 `role="alert"` | 屏幕阅读器立即播报 |
| Empty state 使用 `role="status"` | 屏读器播报"暂无数据" |

---

## 11. 反模式（禁止事项）

### 11.1 绝对禁止

| 反模式 | 示例 | 后果 |
|--------|------|------|
| 页面直接使用 HTML 布局 div/container | `<div class="health-page"><div class="header">...</div></div>` | ❌ 绕过 Component Library，维护失控 |
| PageShell 内调用 API | 在 PageShell 的 `<script setup>` 中写 `fetch()` | ❌ 违反职责边界，耦合业务 |
| PageShell 内使用 Store | `const store = useGeoStore()` | ❌ 违反职责边界 |
| PageShell 内 import 业务组件 | `import HealthScore from '@/