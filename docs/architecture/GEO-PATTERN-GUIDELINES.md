# GEO Workspace Pattern Guidelines

**Version:** 1.0
**Status:** FROZEN ✅
**Date:** 2026-07-02

## 背景

经过 RC1 的组件体系收敛和产品模式沉淀，GEO Workspace 形成了一套统一的架构分层。本文档定义了各层职责和协作规则，确保后续所有产品能力的开发遵循同一套规范。

## 架构分层

```
Workspace Page (Stateful)
      │
      ▼
Geo Pattern / Geo Viewer (Stateless)
      │
      ▼
Registry (Extension Points)
      │
      ▼
Geo Components (Domain UI)
      │
      ▼
kmki-ui (Base UI Components)
      │
      ▼
Design Tokens (CSS Variables)
```

### 各层职责

| 层 | 职责 | 示例 |
|----|------|------|
| **Workspace Page** | 持有页面状态（loading/error/data）、数据获取、用户输入 | VerificationPage, ReportCenter |
| **Geo Pattern / Viewer** | Stateless 容器，纯渲染。接收 Props，发出 Events | GeoVerificationPattern, GeoReportViewer |
| **Registry** | 扩展点。运行时注册/查询，支持动态 import 和主题覆盖 | ReportRegistry, SectionRegistry, StatusRegistry |
| **Geo Components** | 领域级 UI 组件（可组合、可跨页面复用） | GeoCard, GeoBadge, GeoScoreCard |
| **kmki-ui** | 通用基础组件（无业务语义） | Badge, Card, EmptyState, Metric |
| **Design Tokens** | CSS 变量定义颜色/间距/字体等 | `--geo-status-bg-success` |

## 核心规则

### 1. Pattern 必须 Stateless

```
✅ DO:    <GeoVerificationPattern :report="report" :loading="loading" />
❌ DON'T: <GeoVerificationPattern @load-report="..." />
```

Pattern 不持有数据、不发起请求、不管理用户输入。所有状态通过 Props 传入，所有操作通过 Events 发出。

### 2. 页面负责 State，Pattern 负责 Render

```
✅ DO:
  VerificationPage (State: entityName, loading, report, error)
    → VerificationInput (pure input, emits @verify)
    → GeoVerificationPattern (stateless render)

❌ DON'T:
  GeoVerificationPattern (internal input, internal loading, internal fetch)
```

### 3. 数据必须先经过 Adapter/Mapper

```
API Response
    │
    ▼
Adapter / Mapper  ← 转换成本地契约
    │
    ▼
Pattern / Viewer ← 只接受标准契约
```

Pattern 不兼容多种 API 格式，不处理数据转换。

### 4. Registry 统一接口

所有 Registry 使用 `createRegistry<T>()` 或实现 `Registry<T>` 接口：

```typescript
import { createRegistry } from '~/workspaces/geo/lib/registry'

const myRegistry = createRegistry<MyConfig>({ /* defaults */ })
myRegistry.register('new-key', { ... })
myRegistry.resolve('new-key')
```

参见 `lib/registry.ts`。

### 5. Registry 不直接存储颜色值

颜色通过 Design Token（CSS 变量）引用：

```
✅ DO:   tokenBg: '--geo-status-bg-success'
❌ DON'T: bg: '#f0fdf4'
```

### 6. 新增产品能力遵循的流程

```
Define Pattern
    │
    ▼
Freeze Data Contract
    │
    ▼
Build Registry
    │
    ▼
Implement Components
    │
    ▼
Migrate Page
    │
    ▼
Compile + Deploy
    │
    ▼
Experience Audit
```

### 7. Workspace 页面不得直接引用 kmki-ui

通向 kmki-ui 的唯一路径是通过 Geo Pattern / Geo Viewer 的组件内部。

```
✅ DO:    VerificationPage → GeoVerificationPattern → (internal) kmki-ui
❌ DON'T: VerificationPage → kmki-ui/VerificationCard
```

### 8. 页面职责最小化

页面应只关心：
- 状态管理（loading / error / data）
- 数据获取（API 调用）
- 数据转换（Adapter / Mapper）
- 用户输入（Input / Search / Filter）

不应包含：
- 复杂的渲染逻辑
- 样式计算
- 注册表注册

## 已建立的产品模式

| Pattern | 文件 | 适用场景 |
|---------|------|----------|
| GeoReportViewer | `components/GeoReportViewer/` | 报告展示（brand-health / discovery / verification / publishing / executive） |
| GeoVerificationPattern | `components/GeoVerificationPattern/` | 验证操作（输入 → 执行 → 展示 → 下一步） |

## 未来可以建立的产品模式

- **GeoDiscoveryPattern** — 发现扫描
- **GeoOptimizationCenter** — 优化建议中心
- **GeoPresenceMonitor** — 可见性监测

---

**本指南与文件一起使用：**
- `docs/reviews/RC1-DESIGN-SYSTEM-CONVERGENCE.md`
- `docs/reviews/RC1-T003-GEOREPORTVIEWER-ARCHITECTURE.md`
- `docs/reviews/RC1-T004-GEO-VERIFICATION-PATTERN.md`
