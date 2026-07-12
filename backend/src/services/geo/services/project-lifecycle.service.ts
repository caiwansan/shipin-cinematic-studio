// ============================================================
// ★ P0-7: ProjectLifecycleService — 项目生命周期统一入口
//
// 所有属于 GEO 项目生命周期管理的行为，统一经过这里。
// deleteProject() 不再自行堆叠删除逻辑，只调用此 Service。
//
// SSOT: docs/product/PROJECT_LIFECYCLE_MATRIX.md
// ============================================================

import { prisma } from '../../../utils/index.js'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository.js'
import { timelineEngine } from '../workspace/timeline.js'

/**
 * 删除项目及其所有关联数据
 *
 * 删除顺序（事务内）：
 *   1. Layer B 独立表（手动 DELETE）
 *   2. Layer A Cascade 表（Prisma 自动处理）
 *   3. GEOProject 本身（软删除）
 *   4. Workspace Runtime（断开引用）
 *
 * Timeline: ⏳ 等待产品确认定位，暂不清理
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const project = await geoProjectRepository.findUnique({ where: { id: projectId } })
  if (!project || project.deletedAt) return false

  // 在事务内执行，保证原子性
  await prisma.$transaction(async (tx: any) => {
    // ── Step 1: 显式清理 Layer B 独立表（按 Owner 分类） ──

    // User Source — 不可恢复
    await tx.$executeRawUnsafe(`DELETE FROM geo_brand_settings WHERE "projectId" = $1`, projectId)
    await tx.$executeRawUnsafe(`DELETE FROM geo_keywords WHERE "projectId" = $1`, projectId)
    await tx.$executeRawUnsafe(`DELETE FROM geo_brand_profiles WHERE "projectId" = $1`, projectId)

    // Runtime Derived — 可恢复
    await tx.$executeRawUnsafe(`DELETE FROM kmki_geo_score_snapshots WHERE "projectId" = $1`, projectId)
    await tx.$executeRawUnsafe(`DELETE FROM kmki_geo_quality_scores WHERE "projectId" = $1`, projectId)
    await tx.$executeRawUnsafe(`DELETE FROM kmki_geo_freshness_records WHERE "projectId" = $1`, projectId)
    await tx.$executeRawUnsafe(`DELETE FROM kmki_geo_benchmark_records WHERE "projectId" = $1`, projectId)
    await tx.$executeRawUnsafe(`DELETE FROM kmki_geo_optimization_histories WHERE "projectId" = $1`, projectId)

    // Runtime Queue
    await tx.$executeRawUnsafe(`DELETE FROM kmki_geo_review_queue WHERE "projectId" = $1`, projectId)

    // Event Log
    await tx.$executeRawUnsafe(`DELETE FROM geo_scan_history WHERE "projectId" = $1`, projectId)

    // Runtime Cache
    await tx.$executeRawUnsafe(`DELETE FROM geo_graph_nodes WHERE "projectId" = $1`, projectId)
    // geo_graph_edges 通过 Node 的 onDelete: Cascade 自动清理

    // ⏳ Timeline: 等待产品确认后决定

    // ── Step 2: Prisma 自动级联 Layer A（Entity, Relation, Version, ScanRecord, Report 等） ──
    // 通过 Prisma GEOProject delete 触发已声明的 onDelete: Cascade
    await tx.gEOProject.delete({ where: { id: projectId } })
  })

  return true
}
