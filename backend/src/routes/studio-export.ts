/**
 * routes/studio-export.ts — Studio Export v0.1 (RC-FIX-01)
 *
 * 创作作品导出：用户获得最终成果文件
 *
 * POST   /api/v1/studio/export/:projectId   — 创建导出任务
 * GET    /api/v1/studio/export/:projectId    — 查询导出状态
 * GET    /api/v1/studio/exports/:projectId   — 查询所有导出记录
 */

import type { ApiResponse } from '../contracts/api/base.js'
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// ══════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════

export default async function studioExportRoutes(fastify: FastifyInstance) {

  // ── POST /api/v1/studio/export/:projectId ────────────
  fastify.post<{ Params: { projectId: string } }>(
    '/api/v1/studio/export/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })
      if (project.userId !== user.id) {
        const member = await prisma.studioProjectMember.findUnique({
          where: { projectId_userId: { projectId, userId: user.id } },
        })
        if (!member || !['owner', 'director', 'editor'].includes(member.role)) {
          return reply.status(403).send({ error: '无权导出' })
        }
      }

      // 1. 收集项目资产
      const assets = await prisma.asset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      })

      // 2. 收集视频任务
      const videoTasks = await prisma.videoTask.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      })

      // 3. 收集 ProductionPlan
      const productionPlan = await prisma.productionPlan.findUnique({
        where: { projectId },
      })

      if (assets.length === 0 && videoTasks.length === 0) {
        return reply.status(400).send({ error: '暂无可导出的资产' })
      }

      // 4. 确定导出类型
      const hasCompletedVideo = videoTasks.some(v => v.status === 'completed')
      let exportType = 'zip'
      let sourceUrl: string | null = null

      if (hasCompletedVideo) {
        exportType = 'video'
        // 项目级别的合并视频URL
        sourceUrl = project.mergedVideoUrl
      } else if (assets.length > 0) {
        exportType = 'image'
        sourceUrl = assets[0].filePath
      }

      // 5. 创建导出记录
      const exportRecord = await prisma.studioExport.create({
        data: {
          projectId,
          status: sourceUrl ? 'ready' : 'pending',
          fileUrl: sourceUrl,
          fileType: exportType,
          assetCount: assets.length + videoTasks.length,
          fileSize: assets.reduce((sum, a) => sum + (a.fileSize || 0), 0),
        },
      })

      return {
        success: true,
        data: {
          exportId: exportRecord.id,
          projectId: project.id,
          projectName: project.name,
          status: exportRecord.status,
          downloadUrl: exportRecord.fileUrl,
          fileType: exportRecord.fileType,
          assetCount: exportRecord.assetCount,
          fileSize: exportRecord.fileSize,
          createdAt: exportRecord.createdAt,
          summary: {
            totalAssets: assets.length,
            totalVideos: videoTasks.length,
            productionPlan: productionPlan ? {
              episodeCount: productionPlan.episodeCount,
              sceneCount: productionPlan.sceneCount,
              shotCount: productionPlan.shotCount,
            } : null,
            assets: assets.slice(0, 20).map(a => ({
              id: a.id,
              type: a.type,
              fileName: a.fileName,
              filePath: a.filePath,
            })),
          }
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // ── GET /api/v1/studio/export/:projectId ─────────────
  fastify.get<{ Params: { projectId: string } }>(
    '/api/v1/studio/export/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })
      if (project.userId !== user.id) {
        const member = await prisma.studioProjectMember.findUnique({
          where: { projectId_userId: { projectId, userId: user.id } },
        })
        if (!member) return reply.status(403).send({ error: '无权访问' })
      }

      const exports = await prisma.studioExport.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      return {
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          exports: exports.map(e => ({
            id: e.id,
            status: e.status,
            downloadUrl: e.fileUrl,
            fileType: e.fileType,
            assetCount: e.assetCount,
            fileSize: e.fileSize,
            createdAt: e.createdAt,
          })),
        }
      } satisfies ApiResponse<unknown>
    }
  )
}
