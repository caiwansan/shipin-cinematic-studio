# RC3 Architecture Baseline — 架构基线

**生成日期**: 2026-07-01
**扫描目标**: `/root/shipin-cinematic-studio`
**依据**: GEO V4 Architecture Freeze + Product Constitution

---

## 模块状态总览

| # | 模块 | 路径 | 状态 | 说明 |
|---|------|------|------|------|
| 1 | Frontend - Pages | `frontend/workspaces/geo/pages/` | **Complete** | 10 pages (GEOCreate, GEODashboard, GEODetail, Health, Growth, Knowledge, Publishing, Recommendations, Verification) |
| 2 | Frontend - Components | `frontend/design-system/` | **Complete** | Design system + product blocks |
| 3 | Frontend - Store | `frontend/workspaces/geo/stores/` | **Partial** | 7 stores exist but ADI as primary KPI not implemented |
| 4 | Frontend - Services | `frontend/workspaces/geo/services/` | **Partial** | Services exist but Business Outcomes / Demand Intelligence not covered |
| 5 | Backend - Routes | `backend/src/services/geo/routes/` | **Partial** | GEO routes exist but ADI endpoint missing |
| 6 | Backend - Services | `backend/src/services/geo/services/` | **Partial** | Entity/Claim/Evidence/Graph/Review/Quality/Freshness exist |
| 7 | Backend - Benchmark | `backend/src/benchmark/` | **Complete** | types, provider, dataset, runner, judge, calculator, report, registry, cli |
| 8 | Backend - Registry | `backend/src/services/geo/registry/` | **Partial** | geo-registry + workflow-registration exist, no Public Portal |
| 9 | Backend - Publishing | `backend/src/services/geo/publishing/` | **Complete** | claim/plan/recorder + artifact-renderer, lifecycle: Draft→Review→Approve→Publish→Archive |
| 10 | Backend - Monitor | `backend/src/services/geo/monitor/` | **Partial** | Monitor engine + probes + alert exist, Discovery/Coverage Trend missing |
| 11 | Backend - Growth | `backend/src/services/geo/growth/` | **Partial** | Content generator + optimizer + learning engine exist |
| 12 | Backend - Verification | `backend/src/services/geo/verification/` | **Complete** | Verification engine + job runner + timeline + policy |
| 13 | Backend - Recommendation | `backend/src/services/geo/recommendation/` | **Complete** | Score + task + report + roadmap + timeline + simulator |
| 14 | Backend - KDP | `backend/src/services/geo/kdp/` | **Complete** | Asset builder + packaging orchestrator + delivery runtime |
| 15 | Dataset | `backend/datasets/v1/` | **Complete** | 8 dataset types (general, industry, product, comparison, recommendation, trust, freshness, multi_turn) |
| 16 | Database - Prisma | `backend/prisma/schema.prisma` | **Partial** | GEO models exist but missing: ADI models, Business Outcome models, Demand Intelligence models |
| 17 | API | `backend/src/routes/` | **Partial** | No dedicated GEO routes in main routes/; routes are in services/geo/routes/ |
| 18 | Documentation | `docs/product/` | **Complete** | Comprehensive product docs including GEO_* series |
| 19 | Architecture | `docs/architecture/geo/` | **Complete** | GEO-V4-CORE-FREEZE, KDP-ARCHITECTURE-BRIEF, V4-VERIFICATION-ENGINE |
| 20 | Frontend Legacy | `frontend/legacy/brand-geo/` | **Deprecated** | V1 implementation, superseded by workspaces/geo |

---

## 模块详细状态

### Frontend (workspaces/geo/)

| 文件 | 状态 | 说明 |
|------|------|------|
| `pages/GEOCreate.vue` | Complete | 品牌创建页面 |
| `pages/GEODashboard.vue` | Complete | 品牌扫描仪表盘（BII为主，非ADI） |
| `pages/GEODetail.vue` | Complete | 品牌详情 |
| `pages/HealthPage.vue` | Complete | 健康报告页面 |
| `pages/GrowthPage.vue` | Complete | 增长页面 |
| `pages/KnowledgePage.vue` | Complete | 知识页面 |
| `pages/PublishingPage.vue` | Complete | 发布页面 |
| `pages/RecommendationsPage.vue` | Complete | 推荐页面 |
| `pages/VerificationPage.vue` | Complete | 验证页面 |
| `stores/useHealthStore.ts` | **Partial** | 使用 BII 而非 ADI 作为主要KPI |
| `stores/useGrowthStore.ts` | Complete | 增长数据存储 |
| `services/healthService.ts` | **Partial** | 映射到 BII，非 ADI |

### Backend Benchmark

| 子模块 | 状态 | 说明 |
|--------|------|------|
| `types/index.ts` | Complete | Benchmark 类型定义 |
| `provider/registry.ts` | Complete | Provider 注册中心 |
| `dataset/loader.ts` | Complete | 数据集加载器 |
| `runner/benchmark-runner.ts` | Complete | Job-based 运行器 |
| `judge/claim-evaluator.ts` | Complete | Claim 评估器 |
| `judge/dimension-scorer.ts` | Complete | 维度评分器（BII维度） |
| `calculator/bii-calculator.ts` | Complete | BII 计算器 |
| `report/report-generator.ts` | Complete | 报告生成器 |
| `registry/benchmark-registry.ts` | Complete | Benchmark 聚合注册中心 |
| `cli/run.ts` | Complete | CLI 入口 |

### Backend GEO Services

| 子模块 | 状态 | 说明 |
|--------|------|------|
| `services/geo-entity.service.ts` | Complete | Entity CRUD |
| `services/geo-claim.service.ts` | Complete | Claim CRUD |
| `services/geo-evidence.service.ts` | Complete | Evidence CRUD |
| `services/geo-graph.service.ts` | Complete | 知识图谱 |
| `services/geo-review.service.ts` | Complete | 审核队列 |
| `services/geo-quality.service.ts` | Complete | 质量评分 |
| `services/geo-freshness.service.ts` | Complete | 新鲜度追踪 |
| `services/geo-report-generator.service.ts` | Complete | 报告生成 |
| `services/geo-faq.service.ts` | Complete | FAQ |
| `services/geo-schema.service.ts` | Complete | Schema Markup |
| `registry/geo-registry.ts` | Complete | GEO 注册中心 |
| `registry/geo-workflow.ts` | Complete | 工作流注册 |
| `agents/` | Complete | 8 agents (research, entity, knowledge-graph, claim, evidence, citation, faq, schema) |
| `growth/` | **Partial** | 缺少 Business Outcomes 和 ADI Trend |
| `publishing/` | Complete | 完整发布生命周期 |
| `monitor/` | **Partial** | 监控引擎存在但缺少 Discovery/Coverage Trend |
| `verification/` | Complete | 验证引擎完整 |
| `recommendation/` | Complete | 推荐引擎完整 |
| `kdp/` | Complete | KDP 完整（K1-K4） |

---

## 架构冲突检测

| 冲突 | 描述 | 严重度 |
|------|------|--------|
| **ADI First 违反** | Dashboard 以 BII (Brand Health Score) 为主要 KPI，而非 ADI (AI Discovery Index) | **高** |
| **Entity First 部分违反** | Entity Model 存在但 Dashboard 未以 Entity 为中心展示 | **中** |
| **Scenario First 违反** | 无 Scenario Library 概念，优化建议未按 Scenario 组织 | **高** |
| **Natural Language First 违反** | 优化建议和报告内容偏技术性 | **中** |
| **Registry First 部分违反** | Benchmark Registry 和 GEO Registry 存在，但无 Public Portal | **中** |

---

## 重复模块检测

| 重复 | 路径 | 说明 |
|------|------|------|
| BrandGEOWorkspace | `frontend/legacy/brand-geo/` + `frontend/studio-v2/workspace/brand-geo/` | V1 和迁移版共存 |
| GEO Workspace V1 | `frontend/legacy/brand-geo/` + `frontend/legacy/brand-geo-v2/` | V1 和 V2 共存 |
| geo-entity.service.ts | `backend/src/services/geo/services/geo-entity.service.ts` + `.bak` | .bak 文件未清理 |
| geo-graph.service.ts | 同上 | .bak 文件未清理 |
| geo-project.service.ts | 同上 | .bak 文件未清理 |
