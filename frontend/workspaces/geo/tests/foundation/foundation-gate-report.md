# RC5-5B Foundation Gate Report

> **日期**: 2025-06-27
> **任务**: 迁移 HealthPage + KnowledgePage 到 PageShell，确认 Foundation 接口冻结

---

## 迁移成本统计

| 页面 | 原始 LOC | 迁移后 LOC | 变化 | 状态处理 | 接口改动 |
|------|---------|-----------|------|---------|---------|
| GEODashboard | 488 | 572 | +84 (17.2%) | loading/error/empty/default | 无 |
| HealthPage | 577 | 616 | +39 (6.8%) | loading/error/empty/default | 无 |
| KnowledgePage | 406 | 441 | +35 (8.6%) | loading/error/empty/default | 无 |

### 说明

GEODashboard 变化较大（+84 LOC）的原因是：
1. 原始文件中有部分 Geo 组件手动 layout 被移除，但增加了 PageShell 状态绑定（errorState、emptyConfig、breadcrumbs 等 computed）
2. 迁移后注释规模较大（双语言注释 + 状态对比说明）

HealthPage 和 KnowledgePage 各有 35-39 LOC 的增长，主要来自：
1. **新增状态绑定**: `errorObj` (ErrorState) 和 `emptyConfig` (EmptyStateConfig) computed → 约 15-20 LOC
2. **新增 breadcrumbs** computed → 约 5 LOC
3. **新增 PageShell wrapper 模板**（含 slots）→ 约 10 LOC
4. **注释增加**: 迁移差异说明 → 约 10 LOC

**预期随着更多页面迁移，单位成本会下降** — 开发人员熟悉 PageShell 接口后，PageShell wrapper 部分可简化为标准模板。

---

## 每页面迁移细节

### 1. GEODashboard (试点参考)

| 维度 | 原始文件 | 迁移后 |
|------|---------|--------|
| 布局容器 | `.geo-mission-control` | PageShell 接管 |
| PageHeader | NuxtLink 手动拼接 | PageShell `title/description/breadcrumbs` |
| Loading | `loading` 标志 + 具名 skeleton | PageShell `:loading` prop |
| Error | `error` 标志 + 手动 ErrorState | PageShell `:error="errorObj"` (ErrorState 接口) |
| Empty | 无独立 empty 状态（通过 `!projectId && !activityEvents.length` 判断） | PageShell `:empty="emptyConfig"` (EmptyStateConfig 接口) |
| Summary | Hero 区域（第 1 行） | `#summary` slot |
| Content | 页面主体 | `#content` slot |
| Explain | 活动展开区域 | `#explain` slot |
| Next | 底部操作 | `#next` slot |

### 2. HealthPage

| 维度 | 原始文件 | 迁移后 |
|------|---------|--------|
| 布局容器 | `max-w-6xl mx-auto px-4 py-6` | PageShell 接管（960px 统一宽度） |
| PageHeader | 导航链接 X2（NuxtLink） | PageShell `title/description/breadcrumbs` |
| Loading | `GeoPageSkeleton` | PageShell `:loading="loading && !hasProjects"` |
| Error | `GeoErrorState` + 内联错误横幅 | PageShell `:error="errorObj"` + 保留内联 `GeoCard` 错误横幅 |
| Empty | `GeoEmptyState` (no projects) + `GeoEmptyState` (no data) | PageShell `:empty="emptyConfig"` |
| Summary | ADI Score 环形图（Section 1） | `#summary` slot |
| Content | 品牌选择器 + Dimensions + Strengths + Timeline | `#content` slot |
| Explain | Explain Drawer 内容 | `#explain` slot |
| Next | "查看推荐方案" | `#next` slot |
| **删除** | `GeoPageSkeleton` 导入 | 由 PageShell 管理 |
| **删除** | `GeoEmptyState` 导入（template 中） | 由 PageShell 管理（但 script 中保留内联 `GeoEmptyState`？实际已移除） |
| **删除** | `GeoErrorState` 导入（template 中） | 由 PageShell 管理 |
| **保留** | `useRouter`, `useAdiStore`, `ofetch` | 完整保留 |
| **保留** | 内联 `GeoCard` 错误横幅 | 仍保留（recoverable error 场景） |

### 3. KnowledgePage

| 维度 | 原始文件 | 迁移后 |
|------|---------|--------|
| 布局容器 | `.knowledge-page` | PageShell 接管 |
| PageHeader | `GeoPageHeader` (title="知识库" subtitle="品牌知识资产管理") | **已移除** — 由 PageShell 的 `title` + `description` 接管 |
| Loading | `GeoPageSkeleton` | PageShell `:loading="store.isLoading && !store.hasData"` |
| Error | `GeoErrorState` + `GeoErrorState` (compact) | PageShell `:error="errorObj"` + 保留 compact `GeoErrorState` |
| Empty | `GeoEmptyState` | PageShell `:empty="emptyConfig"` |
| Summary | 无 | 无需 |
| Content | 知识卡片列表 | `#content` slot |
| Explain | 无 | 无需 |
| Next | 无 | `#next` slot（"返回品牌列表"） |
| **删除** | `GeoPageHeader` 导入 | 由 PageShell 接管 |
| **删除** | `GeoPageSkeleton` 导入 | 由 PageShell 管理 |
| **删除** | `GeoEmptyState` 导入 | 由 PageShell 管理 |
| **保留** | `toggleEditing` | 完整保留 |
| **保留** | `handleStatementClick` | 完整保留 |

---

## Foundation 接口冻结确认

### ✅ Foundation 接口是否需要修改？

**结论: 不需要修改。**

迁移三页面后，PageShell 的接口（Props + Slots + Types）完全满足需求：

| PageShell Props | 使用情况 | 是否充分 |
|----------------|---------|---------|
| `title` | 3/3 页面使用 | ✅ |
| `description` | 3/3 页面使用 | ✅ |
| `breadcrumbs` | 3/3 页面使用 | ✅ |
| `loading` | 3/3 页面使用 | ✅ |
| `error` (ErrorState) | 3/3 页面使用 | ✅ |
| `empty` (EmptyStateConfig) | 3/3 页面使用 | ✅ |
| `hideExplain` | 1/3 页面关注 | ✅ |
| `hideNext` | 1/3 页面关注 | ✅ |

| PageShell Slots | 使用情况 | 是否充分 |
|----------------|---------|---------|
| `#summary` | 2/3 页面使用 | ✅ |
| `#content` | 3/3 页面使用 | ✅ |
| `#explain` | 2/3 页面使用 | ✅ |
| `#next` | 3/3 页面使用 | ✅ |

**接口冻结决定: 冻结。** 在当前 RC 周期内，所有四个 slot 和现有 props 都已覆盖迁移需求，无需新增、修改或废弃。

### ✅ 重复布局代码是否减少？

**结论: 减少了，但不显著。**

每页面重复移除的布局代码：
- 手动 `max-width` + `margin: 0 auto` + `padding` → 集中到 PageShell
- 手动 breadcrumb / 导航链接 → 集中到 PageShell `breadcrumbs` prop
- 手动 `GeoPageSkeleton` / `GeoErrorState` / `GeoEmptyState` 状态管理 → 集中到 PageShell displayState
- 手动 PageHeader → 集中到 PageShell `title` + `description`

**预期作用**: 随着 10+ 页面迁移，重复代码减少会越来越明显。

### ✅ 状态处理是否统一？

**结论: 统一了。**

| 状态 | 以前 | 现在 |
|------|------|------|
| Loading | 各页面手动写 `v-if="loading"`，使用不同 skeleton | PageShell 统一加载骨架 |
| Error | 各页面手动写 `v-else-if="error"`，样式不一致 | PageShell 统一 ErrorState 卡片 |
| Empty | 各页面手动写 EmptyState，文案/图标不一致 | PageShell 统一 EmptyState 组件 + EmptyStateConfig 配置 |
| Default | 各页面手动编排 | PageShell 统一 content slot |

**优先级链**: `loading > error > empty > default` — 所有页面统一，不再需要各自判断优先级。

---

## 结论

| 检查项 | 状态 |
|--------|------|
| Foundation 接口冻结 | ✅ 已冻结，无需修改 |
| 重复布局代码减少 | ✅ 已开始减少（详见上） |
| 状态处理统一 | ✅ loading/error/empty 统一由 PageShell 管理 |
| 三个页面均迁移完成 | ✅ HealthPage.page-shell.vue ✓ KnowledgePage.page-shell.vue ✓ |

## 后续建议

1. ⏭ **其余页面迁移** 可按照相同模式进行（约 15-20 LOC 新增/页面）
2. ⏭ **Foundation 测试** 建议补充 HealthPage + KnowledgePage 的 Contract 测试以覆盖 full state matrix
3. ⏭ **README 更新** 添加迁移模板到 `frontend/workspaces/geo/docs/` 供开发人员使用
4. 🔔 **回滚策略**: 原始文件（HealthPage.vue / KnowledgePage.vue）均保留不动，如有需要可恢复路由配置
