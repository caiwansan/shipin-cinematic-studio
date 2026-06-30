# GEO Workspace 开发路线图 v1.0

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束：Design System / Architecture / Wireframe 全部冻结后再开始执行

---

# 一、里程碑总览

## Product Freeze（已完成）

```
Phase 0 — Product Freeze ✅
├── Product Principles v1.0 ✅
├── Product Vocabulary v1.0 ✅
├── Product Narrative v1.0 ✅
├── Product IA v1.0 ✅
├── Brand OS Design System v1.0 ✅
└── GEO Frontend Architecture v1.0 ✅
```

## 开发阶段总览

| Phase | 名称 | Sprint | 依赖 | 交付物 |
|-------|------|--------|------|--------|
| P0 | Design System Foundation | DS1 | — | 6 Foundations + 13 Primitives + Barrel Export + CI Rules |
| P1 | Health Page | UI-01 | DS1 | HealthPage + 核心 Product Blocks + HealthStore + Mock |
| P2 | Recommend + Verify | UI-02, UI-03 | P1 | RecommendationsPage + VerificationPage + 对应 Blocks |
| P3 | Publish + Growth | UI-04, UI-05 | P2 | PublishingPage + GrowthPage + 对应 Blocks |
| P4 | Knowledge + Studio | UI-06, UI-07 | P3 | KnowledgePage + Studio 配置页 |
| P5 | Cleanup + Final | UI-08 | P4 | 删除旧页面、Legacy 审计 |

---

# 二、Sprint 详情

## Sprint DS1 — Design System Foundation

### 目标
建立 Brand OS Design System 完整目录结构 + 基础层 + CI 门禁。

### 任务

| # | 任务 | 说明 |
|---|------|------|
| 1 | 创建 `design-system/` 目录 | foundations / primitives / components / product-blocks / patterns |
| 2 | 实现 Foundations | color / spacing / typography / radius / elevation / motion 各 index.ts |
| 3 | 实现 13 个 Primitives | Button / Input / Card / Badge / Avatar / Tabs / Dialog / Tooltip / Progress / Skeleton / Icon / Typography / Spacer / Divider |
| 4 | 创建 Barrel Export | `design-system/index.ts` 导出全部 Primitives 和 Foundations |
| 5 | 实现 `legacy-import-check` CI 规则 | 检查禁止跨层引用、禁止新增 legacy import |
| 6 | 旧组件移入 `legacy/` | brand-geo / brand-geo-v2 / 旧 components |
| 7 | 编译验证 | `npx tsc` + `pnpm build` 通过 |
| 8 | 输出迁移报告 | Legacy 组件总数、迁移数量、剩余数量 |

### 验收标准
- [ ] 新 Design System 目录建立完成
- [ ] 13 个 Primitives 全部实现
- [ ] Barrel Export 正常工作
- [ ] Legacy Import 被 CI 阻止
- [ ] 编译、构建全部通过

---

## Sprint UI-01 — Health Page

### 目标
实现 GEO Workspace 的第一个页面：HealthPage，作为后续页面的模板。

### 任务

| # | 任务 | 文件 |
|---|------|------|
| 1 | 创建 6 个 Store | `workspaces/geo/stores/` |
| 2 | 实现 HealthStore | useHealthStore.ts |
| 3 | 实现 HealthService（Mock） | healthService.ts（Mock JSON） |
| 4 | 实现 Hero Block | product-blocks/Hero/ |
| 5 | 实现 HealthSummary Block | product-blocks/HealthSummary/ |
| 6 | 实现 ExplanationPanel Block | product-blocks/ExplanationPanel/ |
| 7 | 实现 HealthPage | workspaces/geo/pages/HealthPage.vue |
| 8 | 更新路由 | `/workspace/geo/health` |
| 9 | 旧 GeoDashboard.vue 标记 @deprecated | 确认移除链接 |
| 10 | 编译 + 部署验证 | |

### 验收标准
- [ ] HealthPage 可独立访问
- [ ] Brand Health Score 展示
- [ ] 6 个维度分解展示
- [ ] "Why this score" ExplanationPanel
- [ ] "Today's Actions" 展示 Top 3
- [ ] "Improve Brand Health" CTA
- [ ] Empty / Loading / Error 状态覆盖
- [ ] 无跨层引用违规
- [ ] 不与旧 legacy 组件存在引用

---

## Sprint UI-02 — Recommendations Page

### 目标
实现 AI 推荐执行页面。

### 任务

| # | 任务 | 文件 |
|---|------|------|
| 1 | 实现 RecommendationsStore | useRecommendationsStore.ts |
| 2 | 实现 RecommendationsService（Mock） | recommendationsService.ts |
| 3 | 实现 ImpactPreview Block | product-blocks/ImpactPreview/ |
| 4 | 实现 ActionPanel Block | product-blocks/ActionPanel/ |
| 5 | 实现 RecommendationList Block | product-blocks/RecommendationList/ |
| 6 | 实现 RecommendationsPage | workspaces/geo/pages/RecommendationsPage.vue |
| 7 | 编译 + 部署验证 | |

### 验收标准
- [ ] 显示 Impact Preview（82 → 89）
- [ ] Action Card 列表展示（Impact / Effort / Why）
- [ ] "Improve All" CTA
- [ ] 单 Action One-click 执行
- [ ] 执行后反馈
- [ ] 组件全部复用 Design System

---

## Sprint UI-03 — Verification Page

### 目标
实现验证/信任中心页面。

### 任务

| # | 任务 | 文件 |
|---|------|------|
| 1 | 实现 VerificationStore | useVerificationStore.ts |
| 2 | 实现 VerificationService（Mock） | verificationService.ts |
| 3 | 实现 VerificationSummary Block | product-blocks/VerificationSummary/ |
| 4 | 实现 ProofPanel Block | product-blocks/ProofPanel/ |
| 5 | 实现 NextStepPanel Block | product-blocks/NextStepPanel/ |
| 6 | 实现 VerificationPage | workspaces/geo/pages/VerificationPage.vue |
| 7 | 编译 + 部署验证 | |

### 验收标准
- [ ] 四层结构：Outcome → Confidence → Proof → Trust
- [ ] Before / After 展示
- [ ] Confidence Summary（✓ 完成项）
- [ ] Proof Panel（维度对比）
- [ ] Trust Footer → Growth 连接

---

## Sprint UI-04 — Publishing Page

### 目标
实现分发中心页面。

### 任务

| # | 任务 | 文件 |
|---|------|------|
| 1 | 实现 PublishingStore | usePublishingStore.ts |
| 2 | 实现 PublishingService（Mock） | publishingService.ts |
| 3 | 实现 DistributionOverview Block | product-blocks/DistributionOverview/ |
| 4 | 实现 ChannelList Block | product-blocks/ChannelList/ |
| 5 | 实现 PublishingPage | workspaces/geo/pages/PublishingPage.vue |
| 6 | 编译 + 部署验证 | |

### 验收标准
- [ ] Distribution Health 展示（3/5 active）
- [ ] Channel List（Status / Last Sync）
- [ ] Pending Updates 展示
- [ ] Latest Distribution 记录
- [ ] "Update Distribution" CTA

---

## Sprint UI-05 — Growth Page

### 目标
实现品牌成长页面。

### 任务

| # | 任务 | 文件 |
|---|------|------|
| 1 | 实现 GrowthStore | useGrowthStore.ts |
| 2 | 实现 GrowthService（Mock） | growthService.ts |
| 3 | 实现 GrowthOverview Block | product-blocks/GrowthOverview/ |
| 4 | 实现 LearningSummary Block | product-blocks/LearningSummary/ |
| 5 | 实现 OpportunityBlock Block | product-blocks/OpportunityBlock/ |
| 6 | 实现 MilestoneBanner Block | product-blocks/MilestoneBanner/ |
| 7 | 实现 TrendOverview Block | product-blocks/TrendOverview/（复用 TrendChart Component） |
| 8 | 实现 GrowthPage | workspaces/geo/pages/GrowthPage.vue |
| 9 | 编译 + 部署验证 | |

### 验收标准
- [ ] 五层结构：Direction → Source → Learning → Opportunity → Milestone
- [ ] Brand Health Direction Banner
- [ ] Source Breakdown（维度对比）
- [ ] Learning Summary（Action → Impact 归因）
- [ ] Opportunity Block + CTA
- [ ] Milestone Banner
- [ ] 无 Timeline 页面概念

---

## Sprint UI-06 — Knowledge Page

### 目标
实现品牌知识管理页面。

### 任务

| # | 任务 | 文件 |
|---|------|------|
| 1 | 实现 KnowledgeStore | useKnowledgeStore.ts |
| 2 | 实现 KnowledgeService（Mock） | knowledgeService.ts |
| 3 | 实现 KnowledgeOverview Block | product-blocks/KnowledgeOverview/ |
| 4 | 实现 KnowledgePage | workspaces/geo/pages/KnowledgePage.vue |
| 5 | 编译 + 部署验证 | |

### 验收标准
- [ ] Brand Description 展示
- [ ] Key Statements 列表
- [ ] Structured Knowledge 展示
- [ ] FAQ 展示
- [ ] 支持编辑（可选，第一期只展示）

---

## Sprint UI-07 — Studio Entry

### 目标
实现 Brand Studio 入口和配置页面骨架（允许技术语言）。

### 任务
| # | 任务 |
|---|------|
| 1 | Studio 入口页面 |
| 2 | Channel（Adapter）配置页 |
| 3 | Workspace 基础设置页 |
| 4 | 编译 + 部署验证 |

### 验收标准
- [ ] Studio 路由可访问
- [ ] 允许展示 Runtime / Adapter 等配置信息
- [ ] 页面不违反 Product Vocabulary（允许使用技术语言）

---

## Sprint UI-08 — Cleanup + Final

### 目标
清理所有旧前端代码，完成迁移。

### 任务

| # | 任务 |
|---|------|
| 1 | 删除 Legacy 中 8 页应删除页面 |
| 2 | 删除 `brand-geo-v2/` 旧实现（确认无引用后） |
| 3 | 验证 CI Legacy Check 通过 |
| 4 | 验证旧页面路由 301 重定向（如果必要） |
| 5 | 生成迁移完成报告 |
| 6 | 标记 GEO Workspace v1 MVP 冻结 |

### 验收标准
- [ ] 无旧页面文件存在（除 legacy/ 保留）
- [ ] CI Legacy Import Check 无违例
- [ ] 编译、构建、部署全部通过
- [ ] 迁移报告已生成

---

# 三、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| Backend API 未同步 | 中 | 高 | Mock Service 先行，Contract First |
| 旧页面引用难以清除 | 中 | 中 | CI Legacy Check 逐层收紧 |
| 组件行为与 Design System 偏离 | 低 | 高 | DS-AR-001 强制校验 |
| 路由重构影响现有流程 | 低 | 中 | 新路由与旧路由并行，逐步切换 |

---

# 四、发布标准

每个 Sprint 的 Release Gate：

- [ ] **Architecture Check**：无跨层引用违规
- [ ] **Legacy Check**：无新增 legacy 引用
- [ ] **Build**：`pnpm build` 通过
- [ ] **Accessibility**：WCAG AA 基础项
- [ ] **Vocabulary Check**：无禁止词汇（抽样审查）
- [ ] **State Coverage**：Empty / Loading / Error / Success 四种状态
