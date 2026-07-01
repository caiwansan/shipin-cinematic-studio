// ============================================================
// GEO Brand Routes — 仅包含与 geo-project.route.ts 不冲突的路由
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoBrandSettingRepository } from '../repositories/geo-brand-setting.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { knowledgeObjectRepository } from '../../repositories/knowledge-object.repository.js'
import { geoKeywordRepository } from '../repositories/geo-keyword.repository.js'
import { userRepository } from '../../repositories/user.repository.js'
import { membershipRepository } from '../../repositories/membership.repository.js'

export default async function geoBrandRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands/:id — 获取品牌详情（合并 project + brand setting）
  fastify.get('/api/geo/brands/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const project = await geoProjectRepository.findUnique({ where: { id } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      // Get brand setting if exists
      const brandSetting = await geoBrandSettingRepository.findUnique({
        where: { projectId: id },
      })

      // Get additional stats
      const scanCount = await geoScanHistoryRepository.count({ where: { projectId: id } })
      const entityCount = await knowledgeObjectRepository.count({
        where: { projectId: id },
      })
      const keywordsCount = await geoKeywordRepository.count({ where: { projectId: id } })

      // Verify user
      const user = await userRepository.findUnique({ where: { id: project.userId } })

      return reply.send({
        success: true,
        data: {
          ...project,
          brandSetting: brandSetting || null,
          stats: {
            entityCount,
            scanCount,
            keywordsCount,
          },
          user: user ? { id: user.id, name: user.name, email: user.email } : null,
        },
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/settings — 获取品牌设定
  fastify.get('/api/geo/projects/:id/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const setting = await geoBrandSettingRepository.findUnique({
        where: { projectId: id },
      })
      return reply.send({ success: true, data: setting || {} })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id/settings — 更新品牌设定
  fastify.put('/api/geo/projects/:id/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    try {
      const setting = await geoBrandSettingRepository.upsert({
        where: { projectId: id },
        create: { projectId: id, ...body },
        update: body,
      })
      return reply.send({ success: true, data: setting })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/brands/:id — 软删除品牌
  fastify.delete('/api/geo/brands/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const project = await geoProjectRepository.findUnique({ where: { id } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      await geoProjectRepository.update({ id }, { deletedAt: new Date() })

      return reply.send({ success: true, data: { deleted: true } })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/status — 品牌状态（Provider, Scan, KO）
  fastify.get('/api/geo/projects/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const project = await geoProjectRepository.findUnique({ where: { id } })
      if (!project) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      const entityCount = await knowledgeObjectRepository.count({
        where: { projectId: id },
      })
      const scanHistory = await geoScanHistoryRepository.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
      const keywordsCount = await geoKeywordRepository.count({ where: { projectId: id } })

      // Check membership
      const membership = await membershipRepository.findFirst({
        where: { userId: project.userId, status: 'active' },
      })

      return reply.send({
        success: true,
        data: {
          projectId: id,
          entityCount,
          keywordsCount,
          recentScans: scanHistory.length,
          lastScanAt: scanHistory[0]?.createdAt || null,
          plan: membership?.plan || 'free',
          status: project.deletedAt ? 'deleted' : project.status || 'active',
        },
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
