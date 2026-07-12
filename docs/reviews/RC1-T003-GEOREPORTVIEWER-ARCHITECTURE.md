# RC1-T003: GeoReportViewer Architecture Freeze

**Status:** FROZEN ✅
**Date:** 2026-07-02
**Author:** OpenClaw (熊二)

## 目标

设计一个跨页面复用的报告展示组件 `GeoReportViewer`，使得未来的 Brand Health Report、Discovery Report、Verification Report、Publishing Report 等所有报告页面只需提供数据，无需重复实现布局和 UI。

## 1. 组件定位

```
ReportCenter / BrandHealth / Discovery / Verification / Publishing
        │
        ▼
  GeoReportViewer  ← 页面通过 props 提供 Report 数据
        │
        ▼
  kmki-ui 报告组件  ← 底层基础 UI（ExecutiveSummaryCard, FindingsSection, 等）
```

**设计原则：**
- GeoReportViewer 是**领域级容器组件**，不关心数据来源（API / Mock / Store）
- 它接收冻结的 `Report` 契约，按 slot 布局渲染
- 它不包含业务逻辑——调用方负责获取数据和传递 report
- kmki-ui 报告组件是**底层实现**，GeoReportViewer 内部使用它们，但对外暴露统一接口
- 页面（如 ReportCenter）**只导入 GeoReportViewer**，不直接接触 kmki-ui
- **Open Closed Principle**: Viewer 永远不知道未来有哪些 Report 类型

## 2. 数据契约 — Report 模型

```typescript
interface Report {
  /** 元数据 */
  meta: ReportMeta;
  /** 执行摘要 */
  executiveSummary: ExecutiveSummary;
  /** 动态 section 数组（替代固定字段） */
  sections: ReportSection[];
  /** 扩展字段（调用方自定义） */
  extra?: Record<string, unknown>;
}

interface ReportMeta {
  id: string;
  projectId: string;
  projectName: string;
  /** 不固定枚举，字符串即可。Viewer 通过元数据处理布局 */
  reportType: string;
  generatedAt: string;
  version: string;
}
```

### ReportSection

```typescript
interface ReportSection {
  /** section 类型标识符，供 SectionRenderer 路由用 */
  type: string;
  title: string;
  description?: string;
  /** section 的具体数据，Renderer 自行解析 */
  data: unknown;
  /** 排序权重（小 → 大） */
  order?: number;
}
```

**理由**：数组 + Renderer Registry 替代固定字段。以后新增 Citation、Competitor 等任意 section 类型，无需修改 Report 接口。

## 3. Report Registry（替代固定枚举）

```typescript
interface ReportTypeConfig {
  /** 该类型默认显示的 section type 列表（按顺序） */
  defaultSections: string[];
  /** 该类型的默认指标构建器 */
  metricsBuilder?: (report: Report) => MetricItem[];
}

const ReportRegistry: Record<string, ReportTypeConfig> = {
  "brand-health": {
    defaultSections: ["findings", "opportunities", "actions", "verification", "recommendations"],
    metricsBuilder: (r) => [
      { label: "当前 ADI", value: r.executiveSummary.currentAdi },
      { label: "覆盖场景", value: r.sections.find(s => s.type === "findings")?.data?.coverageCount ?? 0 },
    ],
  },
  "discovery": {
    defaultSections: ["findings", "opportunities", "recommendations"],
  },
  "verification": {
    defaultSections: ["verification", "actions"],
    metricsBuilder: (r) => [
      { label: "通过率", value: r.sections.find(s => s.type === "verification")?.data?.passRate ?? 0 },
      { label: "证据数量", value: r.sections.find(s => s.type === "verification")?.data?.evidenceCount ?? 0 },
    ],
  },
  "publishing": {
    defaultSections: ["publishing-status", "verification"],
    metricsBuilder: (r) => [
      { label: "已发布", value: r.sections.find(s => s.type === "publishing-status")?.data?.publishedCount ?? 0 },
      { label: "已索引", value: r.sections.find(s => s.type === "publishing-status")?.data?.indexedCount ?? 0 },
    ],
  },
  "executive": {
    defaultSections: ["findings", "opportunities"],
  },
};
```

**扩展方式**：新增 reportType 时，只需向 Registry 加一条配置，零改动 Viewer。

## 4. SectionRenderer Registry（替代条件分支）

```typescript
interface SectionRendererConfig {
  /** 渲染组件的路径 */
  component: () => Promise<Component>;
  /** 该 section 是否始终可见 */
  alwaysShow?: boolean;
}

const SectionRendererRegistry: Record<string, SectionRendererConfig> = {
  "findings": {
    component: () => import("../../../components/kmki-ui/FindingsSection/index.vue"),
  },
  "opportunities": {
    component: () => import("../../../components/kmki-ui/OpportunitiesSection/index.vue"),
  },
  "actions": {
    component: () => import("../../../components/kmki-ui/ActionsSection/index.vue"),
  },
  "verification": {
    component: () => import("../../../components/kmki-ui/VerificationSection/index.vue"),
  },
  "recommendations": {
    component: () => import("../../../components/kmki-ui/NextRecommendations/index.vue"),
  },
};
```

**SectionRenderer.vue** 逻辑：

```
section.type → lookup Registry → dynamic import → 渲染
                          ↓
                   如果未注册 → 渲染 `SectionFallback`（显示 JSON 或自定义提示）
```

**扩展方式**：新增 section type 时，向 Registry 注册一个组件即可。

## 5. 插槽（Slot）设计

```
┌──────────────────────────────────────┐
│ <slot name="header">                 │  ← 默认：Report Meta（标题/类型/时间/导出）
├──────────────────────────────────────┤
│ <slot name="summary">                │  ← 默认：ExecutiveSummaryCard
│  当前 ADI / 趋势 / 完成率 / 信心      │
├──────────────────────────────────────┤
│ <slot name="metrics">                │  ← 默认：ReportRegistry[type].metricsBuilder()
│  指标卡区域（每类报告显示不同 KPI）     │     每类 report 定义自己的指标
├──────────────────────────────────────┤
│ <slot name="sections">               │  ← 默认：ReportRegistry[type].defaultSections
│  按 SectionRendererRegistry 动态渲染  │     遍历 → 动态 import → 逐个渲染
├──────────────────────────────────────┤
│ <slot name="footer">                 │  ← 默认：报告 ID + 时间戳
├──────────────────────────────────────┤
│ <slot name="export">                 │  ← 默认：ExporterRegistry 渲染导出按钮
└──────────────────────────────────────┘
```

**定制规则：**
- 调用方可覆盖任意 slot 实现自定义内容
- 默认行为：从 ReportRegistry 读取 `defaultSections` → 遍历 → SectionRendererRegistry 动态 import → 渲染
- 未在 Registry 中注册的 section type → 自动降级到 SectionFallback 组件

## 6. 组件拆分

```
GeoReportViewer/
├── index.vue                  ← 容器 + slot 布局
├── ReportMeta.vue             ← Header 区域（标题/时间/类型标签）
├── ReportSummary.vue          ← Executive Summary（内部包装 kmki-ui）
├── ReportMetrics.vue          ← 指标卡区域（按 reportType 决定 KPI）
├── ReportSection.vue          ← 通用 section 容器（标题/描述/内容区域）
├── SectionRenderer.vue        ← Registry 路由，动态 import 对应 kmki-ui 组件
├── SectionFallback.vue        ← 未注册 section type 时的降级显示
├── registry/
│   ├── report-registry.ts     ← ReportRegistry（配置驱动）
│   ├── section-registry.ts    ← SectionRendererRegistry（动态 import）
│   └── exporter-registry.ts   ← ExporterRegistry（导出格式）
└── exporters/
    ├── types.ts
    ├── markdown-exporter.ts   ← Markdown 导出器
    └── json-exporter.ts       ← JSON 导出器
```

## 7. 导出系统 — Exporter Registry（替代硬编码 ExportMenu）

```typescript
interface ExportFormat {
  label: string;
  icon: string;
  export: (report: Report) => Promise<{ content: string; mime: string; filename: string }>;
}

const ExporterRegistry: Record<string, ExportFormat> = {
  "markdown": {
    label: "Markdown",
    icon: "📝",
    export: markdownExporter,
  },
  "json": {
    label: "JSON",
    icon: "📋",
    export: jsonExporter,
  },
  // future: "pdf", "docx", "pptx", "notion", "confluence"
};
```

GeoReportExporter 不硬编码格式，而是遍历 ExporterRegistry 渲染按钮列表。新增导出格式只需注册一个新的 exporter，零改动 Viewer。

## 8. 与 kmki-ui 的边界

```
GeoReportViewer
      │
      ├── GeoReportViewer/ReportSummary.vue
      │       └── kmki-ui/ExecutiveSummaryCard
      │
      ├── GeoReportViewer/SectionRenderer.vue
      │       └── (dynamic import via SectionRendererRegistry)
      │               ├── kmki-ui/FindingsSection
      │               ├── kmki-ui/OpportunitiesSection
      │               ├── kmki-ui/ActionsSection
      │               ├── kmki-ui/VerificationSection
      │               └── kmki-ui/NextRecommendations
      │
      └── GeoReportViewer/exporters/*
              └── (纯 TS，无 UI 依赖)
```

**Workspace 页面不得直接引用 kmki-ui。**
通向 kmki-ui 的唯一路径是 `GeoReportViewer` 组件。

## 9. 状态管理

GeoReportViewer 是**无状态容器**：
- 所有数据通过 `report: Report` prop 传入
- 加载态/空态/错误态由调用方控制（通过 slot 或 props）
- 导出操作的事件向外派发（`@export`, `@copy`）

```vue
<GeoReportViewer
  :report="myReport"
  :loading="isLoading"
  :error="errorMessage"
  report-type="brand-health"
  @export="handleExport"
/>
```

**关键决策**：因为 Viewer 是 Stateless，API / Store / SSR / Realtime / Streaming 都可以直接塞进去。

## 10. 实施计划

| Step | 内容 | 影响 |
|------|------|------|
| 1 | 冻结本设计文档 | ✅ |
| 2 | 创建 GeoReportViewer 目录 + 所有子组件 | 新文件 |
| 3 | 实现 ReportRegistry + SectionRendererRegistry | 新文件 |
| 4 | 实现 SectionRenderer + SectionFallback | 新文件 |
| 5 | 实现 ExporterRegistry + markdown/json exporter | 新文件 |
| 6 | 实现 GeoReportExporter 组件（UI 按钮+下拉） | 新文件 |
| 7 | ReportCenter.vue → 改用 GeoReportViewer | 迁移 |
| 8 | 验证：ReportCenter 功能完整回归 | 测试 |
| 9 | 提交 + 更新 components/index.ts 导出 | 更新 |
| 10 | 写 Migration Notes，供未来页面参考 | 文档 |

## 11. 验收标准

- [ ] GeoReportViewer 目录完整（index, Meta, Summary, Metrics, Section, SectionRenderer, Fallback, registry/*, exporters/*）
- [ ] ReportCenter.vue 可通过 `<GeoReportViewer>` 渲染完整报告
- [ ] Markdown/JSON 导出功能正常（通过 ExporterRegistry）
- [ ] ReportCenter.vue 零 kmki-ui 直接引用
- [ ] 新增 reportType 只需加 Registry 配置，无需修改 Viewer
- [ ] 新增 section type 只需注册渲染器，无需修改 Report 接口
- [ ] 未注册的 section type 自动降级到 SectionFallback
- [ ] components/index.ts 导出 GeoReportViewer

---

**开始实现（已完成 Step 1）：**
直接进入 Step 2。
