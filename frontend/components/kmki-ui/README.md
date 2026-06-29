# kmki-ui — 昆仑镜平台组件库

> 路径：`frontend/components/kmki-ui/`
> 用途：短剧 / 小说 / PPT / GEO 四个工作台共享
> 状态：📋 规划阶段（待 P1.5 验收后启动）

## 愿景

四个工作台各有独立 UI 但共享同一套设计语言。改一次 Card 组件，四个工作台全部更新。

## 目录结构

```
frontend/components/kmki-ui/
  Card/
    index.vue         ← 通用卡片（标题/内容/操作区）
    CardGrid.vue      ← Card 网格容器
  StatCard/
    index.vue         ← 统计卡片（图标/数字/标签）
  EmptyState/
    index.vue         ← 空状态（icon/标题/描述/操作按钮）
  Skeleton/
    index.vue         ← 加载骨架屏
    SkeletonCard.vue  ← 卡片骨架
    SkeletonText.vue  ← 文字骨架
  Toast/
    index.vue         ← 通知提示
    ToastContainer.vue
  Badge/
    index.vue         ← 状态标签（颜色/大小可配置）
  Modal/
    index.vue         ← 模态框
  Toolbar/
    index.vue         ← 操作工具栏
    ToolbarSearch.vue ← 搜索栏
  SearchBar/
    index.vue         ← 搜索输入框
  Filter/
    index.vue         ← 筛选器
  Timeline/
    index.vue         ← 时间线
    TimelineItem.vue  ← 时间线条目
  Wizard/
    index.vue         ← Wizard 主框架（进度条+Step 容器）
  ProgressBar/
    index.vue         ← 进度条
  Metric/
    index.vue         ← 指标展示
  Button/
    index.vue         ← 按钮
  Loading/
    index.vue         ← 加载状态
```

## 首批迁移清单（P1.5 → P2 间完成）

| 组件 | 当前所在位置 | 迁移目标 |
|------|------------|---------|
| GeoEmptyState | GEO 内 | kmki-ui/EmptyState |
| GeoLoadingSkeleton | GEO 内 | kmki-ui/Skeleton |
| GeoToast | GEO 内 | kmki-ui/Toast |
| GeoStatCard | GEO 内 | kmki-ui/StatCard |
| GeoStatusBadge | GEO 内 | kmki-ui/Badge |

## 组件开发规范

- 每个组件一个目录，index.vue 作为入口
- 支持 `v-model` 和 `$attrs` 透传
- 统一暗色主题，支持 CSS 变量覆盖
- 所有组件导出类型声明
- Storybook（可选，优先级低于产品开发）

## 跨工作台引用路径

```ts
// 在任意工作台中：
import KmkiCard from '~/components/kmki-ui/Card/index.vue'
import KmkiEmptyState from '~/components/kmki-ui/EmptyState/index.vue'
```

## 不纳入 kmki-ui 的内容

- 业务逻辑组件（如 Wizard 的 Step 组件）
- 页面级组件
- 调用特定 API 的组件
- 超过 80 行的组件
