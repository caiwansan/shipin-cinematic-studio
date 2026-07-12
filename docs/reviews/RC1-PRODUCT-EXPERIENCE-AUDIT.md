# RC1 — Product Experience Audit Report
**GEO Workspace v1.0**
**日期**: 2026-07-02
**范围**: 全站 13 个页面 + 组件体系
**状态**: PHASE 1 COMPLETE — Ready for PHASE 2

---

## 1. 发现总览

### 核心问题：三套组件体系并行

GEO Workspace 同时使用三套不同的组件系统，导致视觉一致性严重分裂：

| 体系 | 引用页面 | 示例组件 |
|------|---------|---------|
| **Geo 体系** (`GeoCard`, `GeoBadge`, `GeoLoading`...) | Dashboard, BrandOverview, DiscoveryLab | `GeoCard`, `GeoBadge`, `GeoLoading`, `GeoEmptyState` |
| **kmki-ui 体系** (`kmki-ui/VerificationSection`) | ReportCenter, Verification | `ExecutiveSummaryCard`, `VerificationCard` |
| **design-system 体系** (`~/design-system/`) | Knowledge, Health, Growth, Detail, Publishing, Recommendations | `EmptyState`, `ScoreCard`, `TrendChart`, `LoadingState` |

**影响**: 同一类 UI 块（如 Loading/Empty/Error/KPI Card）在不同页面看起来完全不一样，用户会明显感觉到"这不是同一个产品"。

### 评分矩阵

| 页面 | 首屏价值 | 信息层级 | 操作路径 | Loading | Empty | 一致性 | 可解释性 | 可行动性 | **均分** |
|------|:-------:|:-------:|:-------:|:------:|:----:|:-----:|:-------:|:-------:|:-------:|
| Dashboard | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **3.7/4** |
| BrandOverview | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **3.6/4** |
| ReportCenter | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **2.9/4** |
| Verification | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | **3.0/4** |
| Knowledge | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | **2.6/4** |
| Health | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | **2.8/4** |
| DiscoveryLab | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | **2.8/4** |
| Growth | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | **2.4/4** |
| Publishing | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | **2.4/4** |
| Recommendations | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | **2.4/4** |
| WorkspaceFlow | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | **2.9/4** |
| GEOCreate | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | N/A | N/A | **3.4/4** |
| GEODetail | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | **2.6/4** |

---

## 2. 按发现归类

### P0 — 必须修复

#### P0-1: 三套组件体系不一致
**严重度**: Critical
**范围**: 全站
**影响**: 用户在不同页面间切换时体验断层，Dashboard 用 GeoCard，Knowledge 用 design-system 的 card，ReportCenter 用 kmki-ui 的 card。按钮、badge、loading、empty state 风格不一致。
**建议**: 统一到一套组件体系（Geo 体系已有完整度最高的 GeoCard/GeoBadge/GeoLoading/GeoEmptyState/GeoErrorState），其他两个体系逐步淘汰。

#### P0-2: KnowledgePage 无 skeleton 加载
**严重度**: High
**描述**: 加载时只有文字 "Loading brand knowledge..."，没有骨架屏或进度指示，初次加载体验差。
**影响**: 用户不知道数据加载进度，可能以为页面挂了。
**建议**: 使用 Skeleton 组件，显示 4-6 个卡片占位符渐进加载。

#### P0-3: Growth / Publishing / Recommendations 页面空状态弱
**严重度**: High
**描述**: 空状态只有简单的 "暂无数据" 文字提示，没有告诉用户下一步应该做什么（"先去创建品牌"或"先完成发现扫描"）。
**建议**: 每个空状态都要说明下一步做什么 + 操作按钮。

#### P0-4: Report Center 错误处理不够优雅
**严重度**: High
**描述**: 错误显示为简单 `{{ error }}` 文本，没有 retry 按钮，没有足够上下文。
**建议**: 使用 `GeoErrorState` 替代纯文本错误。

---

### P1 — 建议修复

#### P1-1: GEODetail 页面定位模糊
**严重度**: Medium
**描述**: 页面结构和用途不清晰，同时有 score card + score 视图，但没有明确的主操作路径。
**建议**: 明确该页面是 "品牌概览" 还是 "报告详情"，统一交互模式。

#### P1-2: WorkspaceFlowPage 与 Dashboard 功能重叠
**严重度**: Medium
**描述**: WorkspaceFlow 和 Dashboard 都在"品牌工作流导航"上，User 可能混淆。
**建议**: 明确两个页面的定位差异（Dashboard=全局概览，Workflow=单个品牌的操作进度追踪），或在导航中合并。

#### P1-3: BrandOverview 等待分析状态显示
**严重度**: Medium
**描述**: "等待分析"和"等待首次分析"的文案有微妙差异，初见用户可能不清楚区别。
**建议**: 统一文案：未开始 → "等待首次分析"；已分析过但 ADI 不可用 → "分析进行中"。

#### P1-4: Dashboard "今日旅程" 逻辑不够直观
**严重度**: Medium
**描述**: "今日旅程" 和 "继续旅程" 两个区块并排，用户可能不清楚区别（一个是最推荐的下一步，一个是之前未完成的任务）。
**建议**: 合并为单一旅程区，按优先级排列。

---

### P2 — 打磨

#### P2-1: Copywriting 不一致
**描述**: 品牌页面用"品牌"，dashboard 用"项目"，某些地方混用"工作台"和"Workspace"。
**建议**: 全站统一中文术语。

#### P2-2: 操作反馈 icon 不统一
**描述**: Dashboard 用 emoji（🏠、🏢），BrandOverview 用 SVG icon，ReportCenter 无 icon。
**建议**: 统一使用 SVG icon。

#### P2-3: 布局响应式
**描述**: 部分页面在窄屏下布局断裂（如 BrandOverview 的 three-column profile dimensions）。
**建议**: 添加基本的响应式断点。

---

## 3. 优先级排序 Polish Backlog

### P0（RC Blocker — 发布前必须完成）
| # | 任务 | 涉及页面 | 估算 |
|---|------|---------|:----:|
| 1 | 组件体系统一 → Geo 体系为标准 | 全站 | 2-3天 |
| 2 | Skeleton 加载（Knowledge / Growth / Publishing / Recommendations） | 4 个页面 | 0.5天 |
| 3 | Empty State 加"下一步操作" | Growth / Publishing / Recommendations / Knowledge | 0.5天 |
| 4 | 错误处理统一为 GeoErrorState | ReportCenter 等 | 0.5天 |

### P1（RC Polishing — 强烈建议）
| # | 任务 | 涉及页面 | 估算 |
|---|------|---------|:----:|
| 5 | GEODetail 页面重构 | Detail | 1天 |
| 6 | Dashboard 旅程区合并/优化 | Dashboard | 0.5天 |
| 7 | "等待分析"文案统一 | BrandOverview | 0.25天 |
| 8 | 全站统一中文术语 | 全站 | 0.5天 |

### P2（Post-RC Polish）
| # | 任务 | 涉及页面 | 估算 |
|---|------|---------|:----:|
| 9 | SVG icon 取代 emoji | Dashboard, BrandOverview | 1天 |
| 10 | 响应式布局 | BrandOverview, ReportCenter | 1天 |
| 11 | 品牌详情页 WorkflowStep 交互优化 | WorkspaceFlow | 0.5天 |

---

## 4. Phase 2 建议起点

按优先级，Phase 2 应该从 **P0-1（组件统一）** 开始。

做法：
1. 选定 Geo 组件体系为标准（GeoCard, GeoBadge, GeoLoading, GeoEmptyState, GeoErrorState）
2. 替换 Knowledge / Health / Growth / Publishing / Recommendations 中的 design-system 引用
3. 替换 ReportCenter / Verification 中的 kmki-ui 引用
4. 将 kmki-ui 中确实有价值的组件（VerificationCard, ImprovementBadge, ConfidenceMeter）迁移到 Geo 体系

这样一次改动解决全站一致性，后续所有页面都使用统一组件。
