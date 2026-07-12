# Project Lifecycle Matrix v1.0

> 生效日期：2026-07-27
> 所有 GEO 项目关联数据的生命周期规则
> 新增带 `projectId` 的表，必须先更新此矩阵

## 数据分类

### 用户原始数据 (User Source)
用户主动配置/输入的数据。Owner = User。

### 派生数据 (Runtime Derived)
系统基于用户数据自动计算的结果。Owner = Runtime。

### 运行时队列 (Runtime Queue)
运行时中间状态，无历史价值。Owner = Runtime。

### 事件日志 (Event Log)
记录用户与系统交互历史。Owner = 待产品确认。

### 缓存 (Runtime Cache)
临时计算结果，可重新生成。Owner = Runtime。

---

## 生命周期矩阵

| # | 数据 | DB 表 | Owner | 类型 | 删除策略 | 恢复能力 | 理由 |
|---|------|-------|-------|------|---------|---------|------|
| 1 | **BrandSetting** | geo_brand_settings | User | Source | **Hard Delete** | ❌ 不可恢复 | 用户主动配置的品牌信息。删除即永久。不可重算。 |
| 2 | **Keywords** | geo_keywords | User | Source | **Hard Delete** | ❌ 不可恢复 | 用户或系统采集的品牌关键词。删除即永久。 |
| 3 | **Brand Profiles** | geo_brand_profiles | User | Source | **Hard Delete** | ❌ 不可恢复 | 品牌画像数据。用户原始数据。 |
| 4 | **ScoreSnapshot** | kmki_geo_score_snapshots | Runtime | Derived | **Hard Delete** | ✅ Discovery 可重算 | 评分快照。每次发现/扫描都会重新生成。删除后可通过重新发现恢复。 |
| 5 | **QualityScore** | kmki_geo_quality_scores | Runtime | Derived | **Hard Delete** | ✅ Engine 可重算 | 质量评分。派生数据，可重新计算。 |
| 6 | **FreshnessRecord** | kmki_geo_freshness_records | Runtime | Derived | **Hard Delete** | ✅ Engine 可重算 | 新鲜度记录。派生数据。 |
| 7 | **BenchmarkRecord** | kmki_geo_benchmark_records | Runtime | Derived | **Hard Delete** | ✅ Benchmark 可重跑 | 对比基准记录。过期或错误时可重新跑。 |
| 8 | **OptimizationHistory** | kmki_geo_optimization_histories | Runtime | Derived | **Hard Delete** | ❌ 不可恢复 | 优化执行历史。属于运行时状态，当前无需长期保留。**注意**：如果未来定义为"审计日志"或"用户操作历史"，应改为 Keep。 |
| 9 | **ReviewQueue** | kmki_geo_review_queue | Runtime | Queue | **Hard Delete** | ✅ 可重新排队 | 审核队列中间状态。项目删除后队列无意义。 |
| 10 | **ScanHistory** | geo_scan_history | Runtime | Event Log | **Hard Delete** | ❌ 不可恢复 | 扫描执行记录。当前判定为运行时事件，项目删除即清理。 |
| 11 | **Timeline** | geoTimelineEvent | **产品待确认** | **产品待确认** | **待定** | 视定位而定 | Timeline 的产品定位未确认。如果是"产品历史"→ 应 Keep/Soft。如果是"运行时事件流"→ Hard Delete。**本次暂不处理，等待产品确认。** |
| 12 | **GraphCache** (nodes + edges) | geo_graph_nodes, geo_graph_edges | Runtime | Cache | **Hard Delete** | ✅ 可通过扫描重建 | 知识图谱缓存数据。 |
| 13 | **Workspace Runtime** | workspace_runtime | Multi-tenant | Infrastructure | **Soft — 保留** | N/A | 多租户公共资源，不是 GEO 项目专属。仅断开引用，不删除记录。 |
| 14 | **Mission** | （in-memory，当前无 DB） | Runtime | Memory | 当前无存储，无需清理 | — | Recovery Sprint 已证明 Mission 最终需要持久化。下一版本需入 DB 并加入此矩阵。 |

---

## 层结构（Prisma Cascade）

以下 7 张表已在 Prisma schema 声明 `onDelete: Cascade`，删除 `GEOProject` 时**自动级联**清理，`ProjectLifecycleService` 不需要显式处理：

| 表 | DB 表 | Cascade? |
|----|-------|----------|
| GEOEntity | kmki_geo_entities | ✅ Prisma 托管 |
| GEOEntityRelation | kmki_geo_entity_relations | ✅ Prisma 托管 |
| GEOProjectVersion | kmki_geo_project_versions | ✅ Prisma 托管 |
| GEOScanRecord | kmki_geo_scan_records | ✅ Prisma 托管 |
| GEODiscoveryReport | kmki_geo_discovery_reports | ✅ Prisma 托管 |
| GEOActionPlan | kmki_geo_action_plans | ✅ Prisma 托管 |
| GEOVerificationReport | kmki_geo_verification_reports | ✅ Prisma 托管 |

---

## 需要 `ProjectLifecycleService` 显式处理

| # | DB 表 | 删除 SQL |
|---|-------|---------|
| 1 | geo_brand_settings | `DELETE FROM geo_brand_settings WHERE "projectId" = $1` |
| 2 | geo_keywords | `DELETE FROM geo_keywords WHERE "projectId" = $1` |
| 3 | geo_brand_profiles | `DELETE FROM geo_brand_profiles WHERE "projectId" = $1` |
| 4 | kmki_geo_score_snapshots | `DELETE FROM kmki_geo_score_snapshots WHERE "projectId" = $1` |
| 5 | kmki_geo_quality_scores | `DELETE FROM kmki_geo_quality_scores WHERE "projectId" = $1` |
| 6 | kmki_geo_freshness_records | `DELETE FROM kmki_geo_freshness_records WHERE "projectId" = $1` |
| 7 | kmki_geo_benchmark_records | `DELETE FROM kmki_geo_benchmark_records WHERE "projectId" = $1` |
| 8 | kmki_geo_optimization_histories | `DELETE FROM kmki_geo_optimization_histories WHERE "projectId" = $1` |
| 9 | kmki_geo_review_queue | `DELETE FROM kmki_geo_review_queue WHERE "projectId" = $1` |
| 10 | geo_scan_history | `DELETE FROM geo_scan_history WHERE "projectId" = $1` |
| 11 | geo_graph_nodes | `DELETE FROM geo_graph_nodes WHERE "projectId" = $1` |
| 12 | geo_graph_edges | `DELETE FROM geo_graph_edges WHERE "projectId" = $1` |
| 13 | geoTimelineEvent | ⏳ 待产品确认后决定 |

---

## 工程纪律

> **任何新增带 `projectId` 的表，在合并代码前，必须同时更新此矩阵。**

这是工程资产，和 Prisma Schema 同级对待。合入检查清单：
- [ ] Prisma Schema 已声明 onDelete
- [ ] Project Lifecycle Matrix 已更新
- [ ] 如果未配 Cascade，在 ProjectLifecycleService 加入删除逻辑
