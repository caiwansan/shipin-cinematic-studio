# GEO Workspace Product Audit
## 品牌知识操作系统 → 从工程控制台到可商业交付产品

> 审计日期：2026-07-19
> 审计范围：frontend/studio-v2/workspace/brand-geo（v1 旧版）、brand-geo-v2（v1.5 当前版）

---

## 1. 当前状态概览

### 代码规模

| 维度 | 数量 |
|------|------|
| 总页面 | 23 个文件 |
| 总组件 | ~60 个文件 |
| 后端服务 | 10 个 service |
| 设计系统 CSS | 1 份 |
| 设计 Token | 1 份 |
| kmki-ui 组件 | 10 个 |
| 两条并行路线 | v1（brand-geo）+ v1.5（brand-geo-v2） |

### Parallel Versions 问题

当前存在**两条独立开发路线**，共享相同后端但前端互不相通：

| 版本 | 路径 | 入口 | 主导航 | 技术栈 |
|------|------|------|--------|--------|
| v1 (Legacy) | `brand-geo/` | `BrandGEOWorkspace.vue` | 左侧 Sidebar → 17 个页面路由 | Tab 式页面切换 |
| v1.5 (Current) | `brand-geo-v2/` | `GeoWorkspaceV1.vue` | 左面板项目列表 + 顶部 Tab + 右面板洞察 | 三栏布局 |

v1.5 已标记 v1 为 deprecated（Sidebar 注释），但 v1 的 17 个页面和组件仍然存在于代码库中。

---

## 2. IA（Information Architecture）现状

### v1 导航结构（17 个页面）

```
BrandGEO Workspace (Sidebar)
├── Dashboard                   → GeoDashboard.vue (719行, 项目)
├── Brand List                  → BrandListPage.vue
├── Brand Detail                → BrandDetailPage.vue
├── Brand Wizard                → BrandWizardPage.vue (新品牌引导)
├── Keywords                    → KeywordPage.vue
├── Claim Tree                  → ClaimTreePage.vue
├── Claim Detail                → ClaimDetailPage.vue
├── Evidence List               → EvidenceListPage.vue
├── Evidence Detail             → EvidenceDetailPage.vue
├── Report                      → ReportPage.vue
├── Execution Studio            → ExecutionStudioPage.vue
├── Knowledge Center            → KnowledgeCenterPage.vue
├── Knowledge Graph             → KnowledgeGraphPage.vue
├── History                     → HistoryPage.vue
├── Settings                    → SettingsPage.vue
├── System Control              → SystemControlPage.vue (500行, 内部工具)
├── System Lens                 → SystemLensPage.vue
├── System Metadata             → SystemMetadataPage.vue
```

### v1.5 导航结构（5 个 Tab）

```
GeoWorkspaceV1（三栏布局）
├── 左: Projects Panel          → 项目列表
├── 中: Tab 导航（5 个）
│   ├── 概览 (Overview)         → GeoOverview.vue (551行)
│   ├── 时间线 (Timeline)       → GeoTimeline.vue
│   ├── 验证 (Evidence)         → GeoEvidence.vue
│   ├── 发布 (Publish)          → GeoPublish.vue
│   └── 洞察 (Insights)         → GeoInsights.vue
├── 右: Insights Panel          → GeoInsightsPanel.vue
```

---

## 3. User Flow 分析

### 核心工作流（产品白皮书定义）

```
Build → Analyze → Report → Optimize → Execute → Publish → Verify → Monitor
```

### 当前 v1.5 用户路径

```
进入 GeoWorkspaceV1
  ↓
选中项目 (Projects Panel)
  ↓
Tab 切换
  ├→ 概览: 看项目汇总数字
  ├→ 时间线: 看历史活动
  ├→ 验证: 看证据
  ├→ 发布: 管理发布配置
  └→ 洞察: 看 AI 推荐成果
```

### 问题发现

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **无"优化"工作流**：白皮书的 Optimize + Execute 环节没有 UI 入口 | P0 |
| 2 | **发布与验证独立**：用户发布后需要手动切换到"验证"Tab 确认 | P0 |
| 3 | **概览=Dashboard 但无推荐**：只显示统计数字，不展示推荐优化项 | P1 |
| 4 | **Timeline 无业务价值**：只显示事件流水账，不回答"效果" | P1 |
| 5 | **Insights Panel 内容空洞**：右面板展示的内容不足以支撑它占用的空间 | P1 |
| 6 | **发布无统一管理**：Publish 页面不含发布历史、状态追踪  | P1 |
| 7 | **无 Monitor 入口**：发布后的监测完全不在 UI 中 | P1 |
| 8 | **技术概念暴露在 UI**：Execution Studio、Claim Tree 等面向内部架构 | P2 |
| 9 | **缺少空状态/引导**：无项目时只显示白屏 | P2 |
| 10 | **无全局搜索** | P3 |

### 关键断点

```
Build ──→ Analyze ──→ Report ──→ Optimize ──→ Execute ──→ Publish ──→ Verify ──→ Monitor
                                   ❌无UI      ❌无UI        ✅部分       ❌独立       ❌缺失
```

---

## 4. 页面价值分析

| 页面/组件 | 行数 | 白皮书映射 | 用户价值 | 建议 |
|-----------|------|-----------|---------|------|
| GeoOverview (v1.5) | 551 | Report + Monitor | 高 — 需重做为 Dashboard | 🔄 重构 |
| GeoPublish (v1.5) | 363 | Publish | 高 — 需增强发布管理 | 🔄 增强 |
| GeoEvidence (v1.5) | 175 | Verify | 中 — 概念正确但交互弱 | 🔄 重构 |
| GeoInsights (v1.5) | 199 | Learn | 中 — 内容不聚焦 | 🔄 重构 |
| GeoTimeline (v1.5) | 105 | Monitor | 低 — 事件流水账 | 🔄 改为 Monitor |
| GeoInsightsPanel (v1.5) | 145 | — | 低 — 占用空间回报低 | 🗑 删除/合并 |
| GeoProjectsPanel (v1.5) | 61 | — | 中 — 项目选择必要 | 🔄 改造 |
| SystemControlPage (v1) | 500 | — | 无 — 内部工程工具 | 🗑 删除 |
| SystemLensPage (v1) | 354 | — | 无 — 内部调试 | 🗑 删除 |
| SystemMetadataPage (v1) | 395 | — | 无 — 内部调试 | 🗑 删除 |
| ExecutionStudioPage (v1) | 165 | Execute | 低 — 暴露 Runtime 细节 | 🗑 删除/重构 |
| ClaimTreePage (v1) | 128 | — | 低 — 技术概念 | 🗑 删除 |
| KnowledgeGraphPage (v1) | 279 | — | 低 — 预留未完成 | 🗑 暂删 |
| BrandListPage (v1) | 133 | Build | 中 — 品牌选择 | 🔄 合并到左侧 |
| BrandDetailPage (v1) | 255 | Build+Analyze | 中 | 🔄 合并 |
| KeywordPage (v1) | 159 | Analyze | 中 | 🔄 合并 |
| EvidenceListPage (v1) | 138 | Verify | 低 | 🗑 合并到 Verify |
| KnowledgeCenterPage (v1) | 145 | Knowledge | 中—重要但非核心流程 | 🔄 保留 |
| SettingsPage (v1) | 303 | — | 中—配置 | 🔄 简化 |
| HistoryPage (v1) | 84 | Monitor | 低 | 🗑 合并 |
| ReportPage (v1) | 115 | Report | 低 | 🗑 合并到 Overview |

**标记为删除的页面：8 个 (SystemControl/Lens/Metadata, ExecutionStudio, ClaimTree, KnowledgeGraph, EvidenceList, HistoryPage)**

---

## 5. 后端能力映射

| 后端能力 | 模块 | 对应页面 | 用户价值 | 状态 |
|----------|------|----------|---------|------|
| Brand CRUD | geo-brand | BrandList/Detail | 品牌管理 | ✅ |
| Knowledge Asset | kdp/asset-builder | Knowledge Center | 知识资产 | ✅ |
| Distribution Plan | kdp/distribution-planner | Publish | 发布计划 | ✅ (无 UI 绑定) |
| Packaging | kdp/orchestrator | — | 打包 | ❌ Internal Only |
| Delivery (Git) | kdp/delivery/git | Publish | Git 发布 | ✅ (部分) |
| Delivery (Storage) | kdp/delivery/storage | — | 对象存储发布 | ❌ Internal Only |
| Delivery (HTTP) | kdp/delivery/http | — | HTTP 发布 | ❌ Internal Only |
| Recommendation | recommendation | — | AI 推荐 | ❌ Internal Only |
| Monitoring | monitor | — | 监测 | ❌ Internal Only (有 API 无 UI) |
| Verification | verification | Evidence | 验证 | ✅ (间接) |
| Growth Memory | growth | — | 学习记忆 | ❌ Internal Only |
| Publishing | publishing | Publish | 发布管理 | ✅ (部分) |
| Learning Engine | learning | — | 学习循环 | ❌ Internal Only |

**Internal Only 标记：8 个后端模块（51%）**

---

## 6. 现存双版本分析

### brand-geo (v1) — 应退役

- 17 个页面，大量为系统调试工具
- Sidebar 已标记 deprecated
- 但 719 行的 `GeoDashboard.vue` 仍有大量可复用逻辑
- **建议**：提取有价值逻辑后删除整个目录

### brand-geo-v2 (v1.5) — 当前版本

- 5 个 Tab，三栏布局
- 方向正确但缺少核心工作流环节
- 551 行的 `GeoOverview.vue` 最大（需要拆分）
- **建议**：以这个为基础重构

---

## 7. 产品化优先级建议

### 需立即解决的高优先级问题（P0）

| # | 问题 | 解决方向 |
|---|------|---------|
| P0-1 | 缺少 Optimize 工作流 | 新建 Optimize 页面作为核心交互 |
| P0-2 | 发布与验证不连通 | 统一 Publish → Verify 流程 |
| P0-3 | 无 Dashboard 入口 | 新建 Brand Health Dashboard |
| P0-4 | 8 页内部工具混淆 | 删除 SystemControl/Lens/Metadata 等 |

### 需增强的中优先级（P1）

| # | 问题 | 解决方向 |
|---|------|---------|
| P1-1 | Timeline 无业务价值 | 改为 Monitor 页面（趋势/覆盖率/AI可见度） |
| P1-2 | 发布管理不完整 | 增强状态、历史、回滚 |
| P1-3 | Insights Panel 占用回报低 | 删除/合并到 Dashboard |
| P1-4 | 空状态/新用户引导缺失 | 增加空白状态和快速上手 |

---

## 8. 结论

**现状评分：3/10（作为产品可交付性）**

- ✅ 正确识别了三栏布局方向
- ✅ 后端能力完整（虽 51% 未对应用户价值）
- ✅ 部分 Tab（Publish, Evidence）有价值

- ❌ 缺少两个核心工作流环节（Optimize, Execute）
- ❌ 8 个页面应删除
- ❌ Dashboard 应重建
- ❌ 51% 后端能力无 UI
- ❌ 两条并行前端路线增加维护成本
- ❌ 空状态、引导、错误处理不完整
- ❌ 无产品级 Design System（目前用 Tailwind 随意堆叠）

下一步：基于此审计，重新设计 IA、User Flow、Design System，然后开始实施。
