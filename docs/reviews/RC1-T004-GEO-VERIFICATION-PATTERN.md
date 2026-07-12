# RC1-T004: Geo Verification Pattern — Architecture Freeze

**Status:** FROZEN ✅
**Date:** 2026-07-02
**Author:** OpenClaw (熊二)

## 目标

设计一个可跨页面复用的验证模式（Verification Pattern），使 Verification、Publishing、Presence、Audit 等页面都能共享同一套验证 UI 体系。

## 定位：它是 Pattern，不是页面组件

Geo Verification Pattern 是一个**产品模式（Product Pattern）**，而非单个页面组件。

```
VerificationPage  PublishingPage     Presence     Audit
       │               │               │           │
       ▼               │               │           │
  VerificationInput    │               │           │  （Input 由页面持有）
       │               │               │           │
       └───────────────┼───────────────┼───────────┘
                       ▼
         GeoVerificationPattern  ← Stateless 纯渲染
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   SummaryBlock  EvidenceList    Timeline
   StatusBanner  BreakdownBlock  ConfidenceIndicator
   NextActionsBlock  ⋯
```

## 1. 数据契约 — VerificationReport

采用 `meta + payload` 结构，与 GeoReportViewer 保持一致的架构理念。

```typescript
interface VerificationReport {
  meta: VerificationMeta;
  payload: VerificationPayload;
}

interface VerificationMeta {
  entityName: string;
  entityType: 'brand' | 'entity' | 'keyword';
  reportId: string;
  generatedAt: string;
  duration: number; // ms
  source: 'manual' | 'scheduled' | 'api';
}
```

### Payload（可增量更新，Meta 保持不变）

```typescript
interface VerificationPayload {
  /** Before/After ADI */
  beforeAdi: number;
  afterAdi: number;
  deltaAdi: number;
  improvementRate: number;

  /** 完成情况 */
  completionRate: number;
  totalActions: number;
  completedActions: number;
  pendingActions: number;
  skippedActions: number;

  /** 子维度变化 */
  dimensionChanges: VerificationDimensionChanges;

  /** 可扩展的改进 Breakdown 数组（不固定格式） */
  breakdowns: BreakdownSection[];

  /** 已验证条目列表 */
  verifiedItems: VerifiedItem[];

  /** 剩余问题 */
  remainingIssues: RemainingIssue[];

  /** 置信度 */
  confidence: number;
}

interface VerificationDimensionChanges {
  coverage: { before: number; after: number; delta: number };
  share: { before: number; after: number; delta: number };
  position: { before: number; after: number; delta: number };
}

interface VerifiedItem {
  id: string;
  title: string;
  status: 'completed' | 'pending' | 'skipped';
  adiContribution: number;
  details: string;
}

interface RemainingIssue {
  scenarioId: string;
  scenarioName: string;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}
```

### BreakdownSection（可扩展）

```typescript
type BreakdownType = 'waterfall' | 'pie' | 'table' | 'timeline' | 'heatmap';

interface BreakdownSection {
  type: BreakdownType;
  label: string;
  data: unknown; // 每种类型自行解析
}
```

默认基于 `breakdowns` 中 type 为 `"waterfall"` 的 section 渲染改进瀑布图。

## 2. Pattern 子组件

```
GeoVerificationPattern/
├── index.vue                       ← Stateless 容器（纯渲染，无 Input）
├── VerificationSummary.vue         ← ✅ Score Comparison（包装 kmki-ui/VerificationCard）
├── DimensionChanges.vue            ← 子维度变化对比条
├── ActionCompletion.vue            ← Action 完成率 + 统计数据
├── VerifiedItemsTable.vue          ← 已验证条目表格
├── RemainingIssuesList.vue         ← 剩余问题列表（含优先级标签）
├── ConfidenceIndicator.vue         ← 置信度指示器（包装 kmki-ui/ConfidenceMeter）
├── StatusBanner.vue                ← 通用状态横幅（success/warning/error/info/neutral）
├── EvidenceList.vue                ← 证据列表（跨域复用：Verification、Discovery、Presence）
├── VerificationTimeline.vue        ← 时间线视图（包装 kmki-ui/VerificationTimeline）
├── NextActionsBlock.vue            ← 下一步行动（生成报告 / 继续优化）
├── BreakdownBlock.vue              ← 可扩展的改进视图（根据 type 路由到不同渲染方式）
├── registry/
│   ├── status-registry.ts          ← StatusBanner 通过 token 引用 Design Tokens
│   ├── priority-registry.ts        ← 优先级标签配色通过 token 引用
│   └── widget-registry.ts          ← VerificationWidgetRegistry
```

### 2.1 StatusBanner（通用组件）

StatusBanner 是多个页面都会用到的通用组件，不属于 Verification 域，但 T004 会首次实现。

```
Props:
  - variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  - title: string
  - message?: string
  - dismissible?: boolean
  - action?: { label: string; onClick: () => void }

Slots:
  - default: 自定义内容
  - actions: 操作按钮区域
```

### 2.2 EvidenceList（通用组件）

证据列表在多个域中出现（Verification、Discovery、Presence），抽取为独立组件。

```
Props:
  - items: EvidenceItem[]
  - maxItems?: number
  - showSource?: boolean
  - emptyText?: string

Slots:
  - item: 自定义单个证据渲染
  - empty: 空态
  - expand: 展开更多按钮
```

## 3. Registry 设计

### 3.1 StatusRegistry（Token 化引用，不直接保存颜色）

```typescript
type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusTheme {
  tokenBg: string;       // Design Token 名，如 '--color-bg-success'
  tokenBorder: string;   // 如 '--color-border-success'
  tokenText: string;     // 如 '--color-text-success'
  icon: string;
  label: string;
}

const StatusRegistry: Record<StatusVariant, StatusTheme> = {
  success: { tokenBg: '--geo-status-bg-success',  tokenBorder: '--geo-status-border-success',  tokenText: '--geo-status-text-success',  icon: '✅', label: '成功' },
  warning: { tokenBg: '--geo-status-bg-warning',  tokenBorder: '--geo-status-border-warning',  tokenText: '--geo-status-text-warning',  icon: '⚠️', label: '警告' },
  error:   { tokenBg: '--geo-status-bg-error',    tokenBorder: '--geo-status-border-error',    tokenText: '--geo-status-text-error',    icon: '❌', label: '错误' },
  info:    { tokenBg: '--geo-status-bg-info',      tokenBorder: '--geo-status-border-info',      tokenText: '--geo-status-text-info',      icon: 'ℹ️', label: '信息' },
  neutral: { tokenBg: '--geo-status-bg-neutral',  tokenBorder: '--geo-status-border-neutral',  tokenText: '--geo-status-text-neutral',  icon: '•',  label: '默认' },
};
```

CSS 变量在 `GeoVerificationPattern/index.vue` 的作用域或全局定义，支持 Dark Mode / Theme Brand 覆盖：

```css
:root {
  --geo-status-bg-success: #f0fdf4;
  --geo-status-border-success: #bbf7d0;
  --geo-status-text-success: #16a34a;
  /* ... */
}
```

### 3.2 PriorityRegistry（同样 Token 化）

```typescript
interface PriorityTheme {
  tokenBg: string;
  tokenText: string;
  tokenBorder: string;
  label: string;
}

const PriorityRegistry: Record<string, PriorityTheme> = {
  high:   { tokenBg: '--geo-priority-bg-high',   tokenText: '--geo-priority-text-high',   tokenBorder: '--geo-priority-border-high',   label: '高优先级' },
  medium: { tokenBg: '--geo-priority-bg-medium', tokenText: '--geo-priority-text-medium', tokenBorder: '--geo-priority-border-medium', label: '中优先级' },
  low:    { tokenBg: '--geo-priority-bg-low',    tokenText: '--geo-priority-text-low',    tokenBorder: '--geo-priority-border-low',    label: '低优先级' },
};
```

### 3.3 VerificationWidgetRegistry（新增）

Widget Registry 支持按 section type 动态路由到渲染组件：

```typescript
interface WidgetConfig {
  component: () => Promise<{ default: any }>;
  label: string;
}

const VerificationWidgetRegistry: Record<string, WidgetConfig> = {
  'summary':      { component: () => import('./VerificationSummary.vue'),      label: '分数对比' },
  'dimensions':   { component: () => import('./DimensionChanges.vue'),         label: '子维度' },
  'actions':      { component: () => import('./ActionCompletion.vue'),         label: '行动完成' },
  'items':        { component: () => import('./VerifiedItemsTable.vue'),       label: '已验证条目' },
  'issues':       { component: () => import('./RemainingIssuesList.vue'),      label: '剩余问题' },
  'confidence':   { component: () => import('./ConfidenceIndicator.vue'),      label: '置信度' },
  'timeline':     { component: () => import('./VerificationTimeline.vue'),     label: '时间线' },
  'evidence':     { component: () => import('./EvidenceList.vue'),             label: '证据' },
  'breakdown':    { component: () => import('./BreakdownBlock.vue'),           label: '改进' },
  'next-actions': { component: () => import('./NextActionsBlock.vue'),         label: '下一步' },
};
```

企业版可以替换某个 widget 的组件实现，无需修改 GeoVerificationPattern。

## 4. 状态管理

GeoVerificationPattern 是**纯 Stateless 容器**。

```
VerificationPage (有状态：input, loading, error, data, execution)
       │
       ▼
  VerificationInput.vue  ← 页面持有，Pattern 不关心
       │
       ▼
  GeoVerificationPattern (Stateless：只接收 report/loading/error props)
       │
       └──→ 内部子组件（纯展示）
```

**Usage 示例：**

```vue
<template>
  <div>
    <!-- Input controlled by page -->
    <VerificationInput v-model="entityName" @verify="runVerification" :loading="isLoading" />

    <!-- Stateless Pattern -->
    <GeoVerificationPattern
      :report="verificationReport"
      :loading="isLoading"
      :error="error"
      @generate-report="handleGenerateReport"
    />
  </div>
</template>
```

## 5. 与 GeoReportViewer 的关系

两个体系互相独立、不耦合。交集在于：

```
Verification Result
       │
       ├── GeoVerificationPattern (验证交互：输入→执行→展示→下一步)
       │
       └── reportType: "verification" → GeoReportViewer (报告展示：一页多 section)
```

Pattern 和 Presentation 真正解耦。

## 6. 与 kmki-ui 的边界

```
VerificationPage
    │
    ▼
  GeoVerificationPattern  ← workspace 页面直接使用
    │
    ├── GeoVerificationPattern/VerificationSummary.vue
    │       └── kmki-ui/VerificationCard              ← 底层实现
    │
    ├── GeoVerificationPattern/ConfidenceIndicator.vue
    │       └── kmki-ui/ConfidenceMeter               ← 底层实现
    │
    ├── GeoVerificationPattern/VerificationTimeline.vue
    │       └── kmki-ui/VerificationTimeline          ← 底层实现
    │
    └── GeoVerificationPattern/其余组件                ← 内联实现
```

## 7. 实施计划

| Step | 内容 | 影响 |
|------|------|------|
| 1 | 冻结本设计文档 | ✅ |
| 2 | 创建目录 + Registry 文件（status, priority, widget） | 新文件 |
| 3 | 创建 CSS Token 声明 | 新文件 |
| 4 | 实现 StatusBanner + EvidenceList（通用组件） | 新文件 |
| 5 | 实现所有 Pattern 子组件 | 13 新文件 |
| 6 | 实现 GeoVerificationPattern/index.vue 容器 | 新文件 |
| 7 | 实现 VerificationInput.vue（页面层，不放入 Pattern） | 新文件 |
| 8 | VerificationPage.vue → 迁移到 GeoVerificationPattern | 迁移 |
| 9 | 编译验证 + 部署 | 构建 |
| 10 | 更新 components/index.ts 导出 | 更新 |

## 8. 验收标准

- [ ] GeoVerificationPattern 目录完整（18 文件+）
- [ ] StatusBanner 可作为独立通用组件使用
- [ ] EvidenceList 可作为独立通用组件使用
- [ ] VerificationPage 通过 `<GeoVerificationPattern>` 渲染完整验证流程
- [ ] VerificationPage 零 kmki-ui 直接引用
- [ ] VerificationWidgetRegistry 可按 section type 动态路由组件
- [ ] GeoVerificationPattern 是纯 Stateless（无 VerificationInput）
- [ ] Status/Priority Registry 通过 Design Token 引用颜色，支持主题覆盖
- [ ] 新增验证类型页面无需修改 GeoVerificationPattern 主体
- [ ] Verification Result 可通过 reportType: "verification" 传入 GeoReportViewer
- [ ] components/index.ts 导出 GeoVerificationPattern / StatusBanner / EvidenceList

---

**下一步（本文件冻结后）：**
从 Step 2 开始实现。
