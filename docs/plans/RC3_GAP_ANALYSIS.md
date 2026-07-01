# RC3 Gap Analysis — 差距分析

**生成日期**: 2026-07-01
**参照标准**: RC3 Master Implementation Goals + Product Constitution

---

## GAP-001: ADI (AI Discovery Index) 作为主要 KPI — **缺失** — **P0**

**说明**: Product Constitution 第 7 条明确 "ADI First"，但当前 Dashboard (GEODashboard.vue) 和 Health Store 均以 BII (Brand Health Score) 为主要 KPI。ADI 的三个子维度（Coverage Score / Share Score / Position Score）未在任何页面或 API 中实现。Benchmark 中存在 BII Calculator 但无 ADI Calculator。

**影响**: 违反核心产品原则，用户看到的是 BII 而非 ADI，导致产品定位偏差。

---

## GAP-002: AI Discovery Lab (ADI Lab) — **缺失** — **P0**

**说明**: 应有一个专门的 "AI Discovery Lab" 页面/模块，展示：
- ADI 综合得分
- Coverage/Share/Position 三个子维度拆解
- Scenario-based 发现分析
- Opportunity 识别

当前无此模块。Coverage/Share/Position 概念不存在于任何 store 或 service 中。

---

## GAP-003: Scenario Library — **缺失** — **P0**

**说明**: Product Constitution 第 8 条 "Scenario First"。应存在 Scenario Library，包含不同类型场景（如：品牌搜索、竞品对比、产品推荐等），每个 Scenario 包含发现状况分析。当前完全不存在。

---

## GAP-004: Natural Demand Corpus — **缺失** — **P0**

**说明**: Product Constitution 第 9 条 "Natural Language First"。应存在 Natural Demand Corpus，包含用户自然语言查询集合。当前完全不存在。

---

## GAP-005: Demand Intelligence 模块 — **缺失** — **P1**

**说明**: 应存在完整的 Demand Intelligence 模块，包括：
- Natural Demand Corpus 管理
- Scenario Library 管理
- Demand-Scenario 映射

当前完全不存在。

---

## GAP-006: Business Outcomes 追踪 — **缺失** — **P1**

**说明**: 应追踪四个业务指标：
- Discovery（品牌被发现次数）
- Engagement（品牌被提及/互动次数）
- Conversion（品牌被推荐/选择次数）
- Retention（品牌持续提及率）

Prisma schema 中有 `engagementScore` 和 `retentionScore` 字段，但缺乏完整 BusinessOutcome 模型和服务。

---

## GAP-007: Dashboard 以 ADI 为主 KPI — **缺失** — **P0**

**说明**: GEODashboard.vue 当前显示"品牌扫描"和 BII。应改为以 ADI 为核心的品牌发现仪表盘，展示 AI 视角下的品牌可见性和发现表现。这与 GAP-001 同源但范围更广（涉及UI重新设计）。

---

## GAP-008: Discovery Trend / Coverage Trend (Monitor) — **缺失** — **P1**

**说明**: Monitor 模块 (`backend/src/services/geo/monitor/`) 仅有发布物监控能力。缺少：
- Discovery Trend（发现趋势随时间变化）
- Coverage Trend（覆盖趋势随时间变化）
- Monitor route 和 store 对 ADI 趋势无支持

---

## GAP-009: Registry Public Portal — **缺失** — **P2**

**说明**: Registry First 原则要求存在公开的 Registry Portal，外部用户可以查阅已发布的 Ground Truth、Claims、Evidence。当前 Registry 仅内部使用，无 Public Portal。

---

## GAP-010: Entity Model → Version 完整链路 — **Partial** — **P1**

**说明**: Entity Model (Entity → Claims → Evidence) 在 schema 中已定义但 Version 机制不完整。`GEOProjectVersion` 存在但 entity-level versioning 缺失。无 Entity Change History 展示。

---

## GAP-011: Knowledge Evaluation 的 Explainability — **Partial** — **P1**

**说明**: Benchmark Judge (claim-evaluator, dimension-scorer) 存在，但 Knowledge Evaluation 的 Explainability 模块未与 Dashboard/Health Page 完整集成。ExplainPanel 组件存在但未用于 ADI 场景。

---

## GAP-012: Dogfooding (昆仑镜自身在 Benchmark 中) — **缺失** — **P2**

**说明**: 昆仑镜自身应该作为 Benchmark 的被评估对象，系统应该能评估自身在 AI 发现中的表现。当前完全不存在。

---

## GAP-013: Publishing 完整 UI — **Partial** — **P1**

**说明**: Publishing 后端完整（Draft→Review→Approve→Publish→Archive），但前端 PublishingPage.vue 仅为占位符，未实现完整生命周期交互。用户无法在 UI 中完成 Draft→Review→Approve 流程。

---

## GAP-014: Benchmark Runner 可视化 — **Partial** — **P2**

**说明**: Benchmark Runner 后端完整（job-based, provider independence），但缺少运行状态可视化页面。用户无法在 UI 中查看 Benchmark Job 进度和结果。

---

## GAP-015: 架构原则一致性审计 — **Missing** — **P2**

**说明**: 当前存在多个架构层次（V4.1 Execution Kernel, V4.2 Capability Orchestrator, GEO V4），部分原则相互冲突。需进行一致性审计并输出迁移路径。

---

## GAP-016: 弃用模块清理 — **Partial** — **P2**

**说明**: legacy/brand-geo 和 studio-v2/workspace/brand-geo 共存，.bak 文件未清理。需统一到 workspaces/geo/ 并删除遗留代码。

---

## GAP 汇总

| GAP ID | 功能 | 类型 | 优先级 | 估算 |
|--------|------|------|--------|------|
| GAP-001 | ADI 作为主要 KPI | Missing | P0 | L |
| GAP-002 | AI Discovery Lab | Missing | P0 | XL |
| GAP-003 | Scenario Library | Missing | P0 | L |
| GAP-004 | Natural Demand Corpus | Missing | P0 | L |
| GAP-005 | Demand Intelligence 模块 | Missing | P1 | L |
| GAP-006 | Business Outcomes 追踪 | Missing | P1 | M |
| GAP-007 | Dashboard 以 ADI 为主 | Missing | P0 | L |
| GAP-008 | Discovery/Coverage Trend | Missing | P1 | M |
| GAP-009 | Registry Public Portal | Missing | P2 | L |
| GAP-010 | Entity Versioning | Partial | P1 | M |
| GAP-011 | Explainability 集成 | Partial | P1 | M |
| GAP-012 | Dogfooding | Missing | P2 | M |
| GAP-013 | Publishing UI 完整 | Partial | P1 | M |
| GAP-014 | Benchmark Runner 可视化 | Partial | P2 | S |
| GAP-015 | 架构一致性审计 | Missing | P2 | M |
| GAP-016 | 弃用模块清理 | Partial | P2 | S |

**总计**: 16 Gaps (P0: 5, P1: 6, P2: 5)
