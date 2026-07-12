# RC1 — GEO Design System Convergence 规范
**里程碑**: RC1 Phase 2 — 组件体系统一
**版本**: v1.0 (冻结)

---

## 1. 组件体系三层架构

```
Design Tokens (frontend/design-system/foundations/)
    ↓ 颜色 · 字体 · 间距 · 圆角 · 阴影 · 动画
kmki-ui (frontend/components/kmki-ui/)
    ↓ 纯通用基础组件 · 无 GEO 业务语义
Geo Components (frontend/workspaces/geo/components/)
    ↓ GEO 产品语义封装
Workspace Pages (frontend/workspaces/geo/pages/)
    ↓ 仅组合组件 · 不直接实现视觉
```

**职责边界**:
- **Design Tokens**: `color/`, `typography/`, `spacing/`, `radius/`, `elevation/`, `motion/` — 共享 token
- **kmki-ui**: Button、Input、Dialog、Table、Tabs、Popover、Tooltip 等 — 纯通用
- **Geo Components**: GeoCard、GeoMetricCard、GeoLoading、GeoEmptyState、GeoErrorState、GeoBadge 等 — 封装 GEO 产品语义
- **Workspace Pages**: 只组合 Geo Components，不直接引用 kmki-ui 或 design-system

---

## 2. 当前三套体系映射

| 层级 | 路径 | 当前状态 |
|------|------|---------|
| **Design Tokens** | `frontend/design-system/foundations/` | ✅ 存在，可直接使用 |
| **kmki-ui 基础组件** | `frontend/components/kmki-ui/` | ✅ 31 个组件 |
| **Geo Components** | `frontend/workspaces/geo/components/` | 11 个组件（需扩展） |
| **Legacy design-system** | `frontend/design-system/` | ❌ 淘汰，页面引用需要迁移 |

### 当前引用分布（审计发现）

| 页面 | 当前引用体系 | 问题 |
|------|-------------|------|
| BrandOverview | Geo ✅ | 干净 |
| Dashboard | Geo ✅ | 干净 |
| DiscoveryLabPage | Geo ✅ | 干净 |
| WorkspaceFlowPage | Geo ✅ | 干净 |
| VerificationPage | Geo + kmki-ui ⚠️ | 混用（VerificationCard / ImprovementBadge / ConfidenceMeter 来自 kmki-ui） |
| ReportCenter | kmki-ui ⚠️ | 全用 kmki-ui 领域组件，需封装到 Geo |
| **KnowledgePage** | design-system ❌ | 全部引用 DS 组件 |
| **HealthPage** | design-system ❌ | 全部引用 DS 组件 |
| **GrowthPage** | design-system ❌ | 全部引用 DS 组件 (12 处) |
| **PublishingPage** | design-system ❌ | 全部引用 DS 组件 |
| **RecommendationsPage** | design-system ❌ | 全部引用 DS 组件 |
| **GEODetail** | design-system ❌ | 引用 DS ScoreCard |
| **GEOCreate** | design-system ❌ | 引用 DS Button/Input/ErrorBanner |

---

## 3. 组件准入规则

| 类型 | 放置位置 | 示例 |
|------|---------|------|
| 通用基础能力 | kmki-ui | Button、Input、Dialog、Table、Tabs、Popover、Tooltip、Skeleton、Badge、Divider、Timeline、Progress |
| GEO 领域组件 | Geo Components | GeoCard、GeoMetricCard、GeoPageHeader、GeoSectionHeader、GeoPageSkeleton、GeoEmptyState、GeoErrorState、GeoLoading、GeoBadge、GeoExplainButton、GeoExplainDrawer |
| 页面私有组件 | 页面同级 components/ | BrandRadar、IssueTimeline、PresenceMatrix（不与页面同名） |

---

## 4. 禁止事项（冻结）

1. **页面不得直接引用 kmki-ui** — 必须通过 Geo Components 封装
2. **页面不得直接引用 `~/design-system/`** — 该路径已废弃，新代码禁止引用
3. **页面不得混用多套组件** — 同类型组件只使用一个来源（如 Card 只用 `GeoCard` 而非 `GeoCard` + `kmki Card` + `DS Card` + 原生 div）
4. **页面不得自行实现 Skeleton / EmptyState / ErrorState / LoadingOverlay** — 必须来自 Geo Components
5. **Geo Components 禁止直接引用 layout/page 级别逻辑** — 只应包裹 kmki-ui 或 Design Tokens

---

## 5. 迁移清单

### Phase 2A: 补齐 Geo Components（先创建缺少的组件）

| Geo 组件 | 优先级 | 说明 |
|----------|:------:|------|
| GeoPageHeader | P0 | 通用页面头部（标题 + 子标题 + 操作区） |
| GeoSectionHeader | P0 | 通用区域标题 |
| GeoPageSkeleton | P0 | 全页骨架屏 |
| GeoEmptyState | P0 | ✅ 已有，但需验证兼容 DS EmptyState 的数据格式 |
| GeoErrorState | P0 | ✅ 已有 |
| GeoLoading | P0 | ✅ 已有 |
| GeoExplainDrawer | P0 | ✅ 已有 |
| GeoVerificationCard | P1 | 从 kmki-ui VerificationCard 迁移 |
| GeoImprovementBadge | P1 | 从 kmki-ui ImprovementBadge 迁移 |
| GeoConfidenceMeter | P1 | 从 kmki-ui ConfidenceMeter 迁移 |
| GeoScoreCard | P1 | 封装 DS ScoreCard |

### Phase 2B: 页面迁移（按优先级）

| 页面 | 当前体系 | 目标 | 估算 |
|------|---------|------|:----:|
| KnowledgePage | DS → Geo | GeoPageSkeleton + GeoCard + GeoEmptyState | 0.5天 |
| HealthPage | DS → Geo | GeoPageSkeleton + GeoCard + GeoEmptyState | 0.5天 |
| GrowthPage | DS → Geo | GeoPageSkeleton + GeoCard + GeoEmptyState | 0.5天 |
| PublishingPage | DS → Geo | GeoPageSkeleton + GeoCard + GeoEmptyState | 0.5天 |
| RecommendationsPage | DS → Geo | GeoCard + GeoEmptyState | 0.5天 |
| GEODetail | DS → Geo | GeoScoreCard + GeoCard | 0.5天 |
| GEOCreate | DS → Geo | GeoButton + GeoInput 或直接使用 kmki-ui 原始组件 | 0.25天 |
| ReportCenter | kmki-ui → Geo | 封装 ExecutiveSummaryCard 等为 Geo 组件 | 1天 |
| VerificationPage | kmki-ui → Geo | 迁移 VerificationCard/ImprovementBadge/ConfidenceMeter | 0.5天 |

---

## 6. RC Gate 验收规则

Phase 2 完成后，满足以下验收条件才能进入 Phase 3：

1. **无明显视觉分裂** — 打开 3 个以上页面后，用户不会感觉是不同产品
2. **页面引用** — 每个页面只引用一个组件体系
3. **无 design-system 引用** — `grep -rn "design-system" frontend/workspaces/geo/pages/` 返回空
4. **Loading/Skeleton** — 所有数据页面使用 GeoPageSkeleton
5. **Empty/Error** — 所有数据页面使用 GeoEmptyState / GeoErrorState

---

## 7. 实施顺序建议

```
Phase 2A: 创建缺失的 Geo 组件
    ↓ (编译通过 + 可以预览)
Phase 2B: 迁移页面的引用
    ↓ (全站回归测试)
Phase 2C: RC Gate 验证
    ↓ (通过后进入 RC2)
```
