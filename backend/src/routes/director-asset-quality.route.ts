/**
 * routes/director-asset-quality.route.ts
 *
 * AI 导演质量观察路由。
 *
 * GET /api/director/assets/:assetId/quality
 *   观察指定资产的质量，返回 QualityReport。
 *
 * 设计原则：
 *   - 不调用 AI Provider
 *   - 不修改 Asset
 *   - 不自动重生成
 */

import { FastifyInstance } from 'fastify'
import { observeAsset } from '../services/director/asset-quality-observer.service.js'

export default async function directorAssetQualityRoutes(app: FastifyInstance) {
  // ── GET /api/director/assets/:assetId/quality ──
  // 查询资产质量报告
  app.get('/api/director/assets/:assetId/quality', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { assetId } = req.params as { assetId: string }

    if (!assetId || assetId.length < 8) {
      return reply.status(400).send({
        success: false,
        error: '缺少有效的 assetId',
      })
    }

    try {
      const report = await observeAsset(assetId)
      return {
        success: true,
        report,
      }
    } catch (err: any) {
      if (err.message === 'ASSET_NOT_FOUND' || err.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'ASSET_NOT_FOUND',
          message: `资产 ${assetId} 不存在`,
        })
      }
      // Prisma UUID 格式异常 → 404
      if (err.message?.includes('Inconsistent column data') || err.message?.includes('invalid character')) {
        return reply.status(404).send({
          success: false,
          error: 'ASSET_NOT_FOUND',
          message: `资产 ID 格式无效: ${assetId}`,
        })
      }
      req.log.error(`[asset-quality] quality check failed: ${err.message}`)
      return reply.status(500).send({
        success: false,
        error: 'QUALITY_CHECK_FAILED',
        message: err.message,
      })
    }
  })

  // ── GET /api/director/projects/:projectId/assets/quality ──
  // 批量查询项目中所有已完成资产的质量
  app.get('/api/director/projects/:projectId/assets/quality', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const { prisma } = await import('../utils/index.js')

    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    const tasks = await prisma.videoTask.findMany({
      where: { projectId, status: 'completed' },
      select: { id: true, taskType: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    // 对每个任务做观察（只查前 10 个，防止阻塞）
    const targetTasks = tasks.slice(0, 10)
    const reports = await Promise.allSettled(
      targetTasks.map(t => observeAsset(t.id).catch(() => null))
    )

    return {
      success: true,
      data: {
        total: tasks.length,
        observed: targetTasks.length,
        reports: reports
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => (r as PromiseFulfilledResult<any>).value),
      },
    }
  })
}
