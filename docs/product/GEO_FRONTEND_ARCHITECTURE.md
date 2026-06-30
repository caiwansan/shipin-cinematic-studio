# GEO Workspace 前端架构目录 v1.0

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Brand OS Design System / Product IA / 全部 Wireframe

---

# 一、目标架构

## 设计原则

1. **三层依赖**：Workspace → Product Blocks → Components → Primitives → Foundations
2. **Workspace 仅引用 Product Blocks**：禁止跨层引用 Components / Primitives
3. **所有旧组件冻结为 legacy/**：CI 检查禁止新增引用
4. **Product Block 跨 Workspace 共享**：GEO / 短剧 / 小说 / PPT 共用

## 目录结构

```
frontend/
│
├── design-system/                         ← 设计系统（新建）
│   ├── foundations/                       ← DS-1：基础层
│   │   ├── color/index.ts
│   │   ├── spacing/index.ts
│   │   ├── typography/index.ts
│   │   ├── radius/index.ts
│   │   ├── elevation/index.ts
│   │   └── motion/index.ts
│   │
│   ├── primitives/                        ← DS-3：基础组件（无业务语义）
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Card/
│   │   ├── Badge/
│   │   ├── Avatar/
│   │   ├── Tabs/
│   │   ├── Dialog/
│   │   ├── Tooltip/
│   │   ├── Progress/
│   │   ├── Skeleton/
│   │   ├── Icon/
│   │   ├── Typography/
│   │   ├── Spacer/
│   │   └── Divider/
│   │
│   ├── components/                        ← DS-4：组合组件（通用行为）
│   │   ├── ScoreCard/                    — 0-100 指标展示
│   │   ├── StatusIndicator/             — ✓ Connected / ⌛ Pending / ⚠ Error
│   │   ├── MetricCard/                   — 单值指标卡片
│   │   ├── EmptyState/                   — 空状态
│   │   ├── LoadingState/                 — 加载状态
│   │   ├── SuccessBanner/                — 成功横幅
│   │   ├── ErrorBanner/                  — 错误横幅
│   │   ├── TrendChart/                   — 趋势图
│   │   ├── Timeline/                     — 事件时间线
│   │   ├── SearchBox/                    — 搜索输入框
│   │   ├── FilterBar/                    — 筛选条
│   │   ├── DataList/                     — 列表数据
│   │   └── ConfirmDialog/                — 确认弹窗
│   │
│   ├── product-blocks/                   ← DS-5：产品模块（Workspace 唯一入口）
│   │   ├── Hero/                         — 页面标题区
│   │   ├── HealthSummary/                — Brand Health 摘要
│   │   ├── ActionPanel/                  — Actions 列表
│   │   ├── VerificationSummary/          — 验证摘要
│   │   ├── ProofPanel/                   — 证据对比
│   │   ├── DistributionOverview/         — 分发概览
│   │   ├── ChannelList/                  — 渠道列表
│   │   ├── GrowthOverview/               — 成长概览
│   │   ├── TrendOverview/                — 趋势展示
│   │   ├── ExplanationPanel/             — 解释面板
│   │   ├── ImpactPreview/                — 影响预览
│   │   ├── NextStepPanel/               — 下一步建议
│   │   ├── RecommendationList/           — 推荐列表
│   │   ├── KnowledgeOverview/            — 知识概览
│   │   ├── LearningSummary/              — 学习摘要
│   │   ├── OpportunityBlock/             — 机会块
│   │   ├── MilestoneBanner/              — 里程碑横幅
│   │   └── EmptyGuide/                   — 首次使用引导
│   │
│   ├── patterns/                         ← DS-6 + DS-9：交互模式 + 产品模式
│   │   ├── hero-action-proof-next.ts     — 标准页面模式
│   │   └── hover-expand-explain.ts       — 悬停展开解释
│   │
│   └── index.ts                          ← Barrel Export
│
├── workspaces/                           ← Workspace 目录
│   ├── geo/                              ← GEO Workspace
│   │   ├── pages/                        ← 6 个页面
│   │   │   ├── HealthPage.vue
│   │   │   ├── RecommendationsPage.vue
│   │   │   ├── VerificationPage.vue
│   │   │   ├── PublishingPage.vue
│   │   │   ├── GrowthPage.vue
│   │   │   └── KnowledgePage.vue
│   │   │
│   │   ├── stores/                       ← 状态管理
│   │   │   ├── useHealthStore.ts
│   │   │   ├── useRecommendationsStore.ts
│   │   │   ├── useVerificationStore.ts
│   │   │   ├── usePublishingStore.ts
│   │   │   ├── useGrowthStore.ts
│   │   │   └── useKnowledgeStore.ts
│   │   │
│   │   ├── services/                     ← API 调用
│   │   │   ├── healthService.ts
│   │   │   ├── recommendationsService.ts
│   │   │   ├── verificationService.ts
│   │   │   ├── publishingService.ts
│   │   │   ├── growthService.ts
│   │   │   └── knowledgeService.ts
│   │   │
│   │   └── composables/                  ← 组合式函数
│   │       ├── useGeoHydrate.ts
│   │       └── useGeoNavigation.ts
│   │
│   ├── drama/
│   ├── novel/
│   └── ppt/
│
├── pages/
│   └── workspace/
│       └── geo.vue                       ← 入口页面（保持，引用 GeoEntry.vue）
│
├── studio/                               ← Brand Studio（可引用 Components）
│
└── legacy/
    ├── brand-geo/                        ← @deprecated 冻结
    ├── brand-geo-v2/                     ← @deprecated 冻结
    └── components/                       ← 旧组件，禁止新增引用
```

---

# 二、页面 → Product Block 映射

| 页面 | 使用的 Product Blocks |
|------|-----------------------|
| **HealthPage** | Hero → HealthSummary → ExplanationPanel → RecommendationList（缩略） → NextStepPanel |
| **RecommendationsPage** | Hero → ImpactPreview → ActionPanel → ExplanationPanel → RecommendationList |
| **VerificationPage** | Hero → VerificationSummary → ProofPanel → NextStepPanel |
| **PublishingPage** | Hero → DistributionOverview → ChannelList → ExplanationPanel → NextStepPanel |
| **GrowthPage** | Hero → GrowthOverview → ProofPanel → LearningSummary → OpportunityBlock → MilestoneBanner → NextStepPanel |
| **KnowledgePage** | Hero → KnowledgeOverview → ExplanationPanel → NextStepPanel |

---

# 三、路由结构（当前保持不变）

```
/workspace/geo                → geo.vue → GeoWorkspaceV1（当前入口）
```

新增 6 个子页路由（方案待定——可以是 Nuxt pages 子路由或 Hash-based）：
```
/workspace/geo/health
/workspace/geo/recommendations
/workspace/geo/verification
/workspace/geo/publishing
/workspace/geo/growth
/workspace/geo/knowledge
```

---

# 四、API 服务映射

| Store | 后端 API 端点 |
|-------|--------------|
| healthService | `GET /api/geo/health` |
| recommendationsService | `GET /api/geo/recommendations` |
| verificationService | `GET /api/geo/verification` |
| publishingService | `GET /api/geo/publishing` |
| growthService | `GET /api/geo/growth` |
| knowledgeService | `GET /api/geo/knowledge` |

---

# 五、Store 数据结构（暂定）

```typescript
// HealthStore
interface HealthState {
  brandHealth: BrandHealth | null
  dimensions: Dimension[]
  dailyChange: number
  recommendations: Recommendation[]  // Top 3
}

// RecommendationsStore
interface RecommendationsState {
  impactPreview: ImpactPreview | null
  actions: Action[]
  selectedAction: Action | null
  executionStatus: 'idle' | 'running' | 'success' | 'error'
}

// VerificationStore
interface VerificationState {
  before: BrandHealth | null
  after: BrandHealth | null
  confidence: ConfidenceItem[]
  proof: ProofItem[]
  trust: TrustInfo | null
}

// PublishingStore
interface PublishingState {
  distributionHealth: DistributionHealth | null
  channels: Channel[]
  pendingUpdates: PendingUpdate[]
  latestDistribution: DistributionRecord | null
}

// GrowthStore
interface GrowthState {
  direction: GrowthDirection | null
  sources: SourceChange[]
  learnings: Learning[]
  opportunity: Opportunity | null
  milestones: Milestone[]
}

// KnowledgeStore
interface KnowledgeState {
  brandDescription: string | null
  statements: Statement[]
  structure: StructureItem[]
  faq: FAQ[]
}
```

---

# 六、迁移策略

## Phase 0 — Design System Foundation
- 创建 `design-system/` 目录结构和 barrel export
- 实现 Foundations（Spacing / Color / Typography / Radius / Elevation / Motion）
- 实现 Primitives（第一批 13 个）
- CI 规则：新增 `legacy-import-check`（禁止跨层引用、禁止新增 legacy import）
- 旧组件移入 `legacy/`，标记 `@deprecated`

## Phase 1 — Health Page First
- 创建 6 个 Store
- 实现 HealthPage + 相关 Product Blocks（Hero / HealthSummary / ExplanationPanel）
- 使用 Mock Service（后端 Ready 后切换）
- 旧 GeoDashboard.vue 保留但标记 @deprecated
- Deploy 验证

## Phase 2 — Recommendations + Verification
- 实现剩余 Product Blocks（ActionPanel / ImpactPreview / VerificationSummary / ProofPanel）
- RecommendationsPage + VerificationPage
- 连接真实 API

## Phase 3 — Publishing + Growth
- 实现 DistributionOverview / ChannelList / GrowthOverview / LearningSummary / OpportunityBlock / MilestoneBanner
- PublishingPage + GrowthPage
- 连接真实 API

## Phase 4 — Knowledge + Studio
- KnowledgePage（编辑器）
- Studio 入口与配置页面
- 最终完成全链路

## Phase 5 — Cleanup
- 删除旧页面文件（8 页应删除页 + 旧组件）
- 删除 `brand-geo-v2/` 旧实现
- 验证 CI Legacy Check 无误
- 生成迁移完成报告
