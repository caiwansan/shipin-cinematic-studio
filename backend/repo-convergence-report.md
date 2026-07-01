# Repository Convergence Progress Report
═══════════════════════════════════════════
**Generated**: $(date +%Y-%m-%d)

## Module Status Overview

| Module | Status | Coverage | Direct Prisma (remaining/total) |
|--------|--------|----------|-------------------------------|
| **geo** (services) | IN_PROGRESS | 45% | 5/11 services |
| **geo** (routes) | IN_PROGRESS | 93% | 1/15 routes |
| **hdz** | NOT_STARTED | 0% | 18/18 files |
| **p18** | NOT_STARTED | 0% | 2/2 files |
| **community** | NOT_STARTED | 0% | 2/2 files |
| **music** | NOT_STARTED | 0% | 1/1 file |
| **narrative-reader** | NOT_STARTED | 0% | 1/1 file |
| **member** | NOT_STARTED | 0% | 1/1 file |
| **balance** | NOT_STARTED | 0% | 1/1 file |
| **核心服务** (root *.ts) | NOT_STARTED | 0% | 43/43 files |

## Overall

**Overall Convergence**: ~10% (estimated)
**Total direct prisma references**: 85 files across all services
**Geo services converged**: 6 of 11 (54%)
**Geo routes converged**: 14 of 15 (93%)
**Non-geo modules converged**: 0%

## 上次操作以来

- **上次操作备份文件 (.bak)**: 13 files in geo/ (9 routes + 4 services)
- **已修复/清理的 route 文件 (geo/)**: 8 routes (geo-brand, geo-claim, geo-evidence, geo-history, geo-keyword, geo-knowledge-quality, geo-scan, geo-watcher)
- **新增违规**: 0 (no new .bak files outside geo/)
- **当前剩余直连 (geo services)**: 5 files
- **当前剩余直连 (geo routes)**: 1 file (geo-dashboard)
- **当前剩余直连 (其他目录)**: 10 files in geo/ non-service dirs

## 当前剩余直连文件（按模块）

### geo/ — services (5 remaining)
- src/services/geo/services/geo-entity.service.ts
- src/services/geo/services/geo-graph.service.ts
- src/services/geo/services/geo-project.service.ts
- src/services/geo/services/geo-quality.service.ts (dynamic import)
- src/services/geo/services/geo-report-generator.service.ts

### geo/ — routes (1 remaining)
- src/services/geo/routes/geo-dashboard.route.ts

### geo/ — 其他目录 (10 remaining)
- src/services/geo/lifecycle/lifecycle-aggregator.service.ts
- src/services/geo/recommendation/recommendation-score.service.ts
- src/services/geo/recommendation/recommendation-timeline.service.ts
- src/services/geo/runtime/knowledge/GraphSync.ts
- src/services/geo/runtime/knowledge/KnowledgeObjectRepository.ts
- src/services/geo/runtime/knowledge/KnowledgeObjectService.ts
- src/services/geo/runtime/provider/provider-resolver.ts
- src/services/geo/runtime/trace/ExecutionTraceService.ts
- src/services/geo/runtime/usage/UsageRecorder.ts
- src/services/geo/utils/user-utils.ts

### hdz/ (18 remaining)
- src/services/hdz/alignment-backtest.service.ts
- src/services/hdz/alignment-metric.service.ts
- src/services/hdz/character.service.ts
- src/services/hdz/consistency-verifier.service.ts
- src/services/hdz/director.service.ts
- src/services/hdz/drift-analyzer.service.ts
- src/services/hdz/entity-contract-checker.service.ts
- src/services/hdz/entity-registry.service.ts
- src/services/hdz/event-log.service.ts
- src/services/hdz/llm.client.ts
- src/services/hdz/orchestrator.service.ts
- src/services/hdz/planner.service.ts
- src/services/hdz/reviewer.service.ts
- src/services/hdz/scene-compiler.service.ts
- src/services/hdz/screenwriter.service.ts
- src/services/hdz/worldbuilder.service.ts
- src/services/hdz/world-state.service.ts
- src/services/hdz/writer.service.ts

### p18/ (2 remaining)
- src/services/p18/dual-render-orchestrator.ts
- src/services/p18/evaluation-collector.ts

### community/ (2 remaining)
- src/services/community/community-reward.service.ts
- src/services/community/sensitive-word.service.ts

### music/ (1 remaining)
- src/services/music/registry.ts

### narrative-reader/ (1 remaining)
- src/services/narrative-reader/observation/entity_table.ts

### member/ (1 remaining)
- src/services/member/plan-guard.ts

### balance/ (1 remaining)
- src/services/balance/index.ts

### 核心服务层 — root *.ts (43 remaining)
- src/services/aggregation-engine.ts
- src/services/ai-router.service.ts
- src/services/alipay.service.ts
- src/services/api-router.service.ts
- src/services/artifact-sync.service.ts
- src/services/asset-duplicate.service.ts
- src/services/asset-heat.service.ts
- src/services/asset-registry.service.ts
- src/services/asset-version.service.ts
- src/services/auth.service.ts
- src/services/capability.service.ts
- src/services/card-render.engine.ts
- src/services/continuity-link.service.ts
- src/services/cos-service.ts
- src/services/dag-runtime.ts
- src/services/execution-journal.service.ts
- src/services/invocation-log.service.ts
- src/services/mock-worker.ts
- src/services/novel-publisher.ts
- src/services/PipelineMaterializer.ts
- src/services/project-hydrate.service.ts
- src/services/project.service.ts
- src/services/provider-registry.service.ts
- src/services/region-commission.ts
- src/services/runtime-event-ledger.ts
- src/services/scene.service.ts
- src/services/scheduler.service.ts
- src/services/scroll-generator.service.ts
- src/services/shot-resolver.service.ts
- src/services/storage-policy.service.ts
- src/services/storyboard.service.ts
- src/services/style-profile.service.ts
- src/services/unified-ai-gateway.ts
- src/services/usage-quota.service.ts
- src/services/user-model-resolver.ts
- src/services/user-model-resolver-v2.ts
- src/services/v3-metrics.service.ts
- src/services/video-merge.service.ts
- src/services/video-pipeline.engine.ts
- src/services/voice-manager.service.ts
- src/services/with-user-key.ts
- src/services/worker-pool.service.ts
- src/services/wxpay.service.ts

## ⚠️ Route 层 prisma 残留
- src/services/geo/routes/geo-dashboard.route.ts
  — 唯一残余，直接 `import { prisma } from '../../../utils/index'`

## 已建立 Repository 的模块
- **geo/**: 20 repositories (entities, projects, claims, evidence, etc.)
- **platform/**: 40+ repositories (capability, governance, execution, workspace, etc.)
- **asset/**: 4 repositories
- **goal/**: 7 repositories
- **semantic/**: 6 repositories
- **root level**: 4 repositories (execution-trace, knowledge-object, membership, user)

## 建议优先级
1. **geo/ services 收尾** — 5个service残留（entity, graph, project, quality, report-generator）+ 1个route残余（geo-dashboard.route）
2. **hdz/ 模块** — 18个文件全量直连，建议先建立 Repository 层
3. **核心服务层** — 43个文件（project, scene, storyboard, auth 等），建议分批迁移
4. **p18/ community/ music 等小模块** — 可以穿插处理
