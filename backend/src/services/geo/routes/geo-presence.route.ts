// ============================================================
// GEO Presence Route — P0-T005 AI Presence Engine Foundation
// P0-T005.1: 12 Platform Extension — included platformGroups in response
// GET /api/geo/brands/:id/presence
//
// SSOT: All presence data comes from PresenceEngine.
// Route is purely a transport layer — no provider logic here.
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { presenceEngine, providerAdapterRegistry } from '../presence/index.js'

export default async function geoPresenceRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands/:id/presence — 获取品牌 AI 可见度分析
  fastify.get(
    '/api/geo/brands/:id/presence',
    { preHandler: [] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      try {
        const project = await geoProjectRepository.findUnique({ where: { id } })
        if (!project || project.deletedAt) {
          return reply.status(404).send({ success: false, error: '品牌未找到' })
        }

        // Build context from project data
        const context = {
          projectId: id,
          name: project.name || '',
          website: project.website || (project.config?.website as string) || '',
          industry: project.industry || (project.config?.industry as string) || '',
          description: project.description || (project.config?.description as string) || '',
        }

        // Run presence engine
        const result = await presenceEngine.checkAll(context)

        // Build platform groups from registry metadata
        const grouped = providerAdapterRegistry.getGroupedProviders()

        // Return empty state if no meaningful data
        if (!context.name && !context.website) {
          return reply.send({
            success: true,
            data: {
              overall: {
                score: 0,
                visibilityCount: 0,
                totalChecked: result.overall.totalChecked,
                averageKnowledge: 0,
              },
              providers: result.providers.map((p) => ({
                ...p,
                visibility: 'unknown' as const,
                evidenceLevel: 'N/A' as const,
                confidence: 0,
                knowledgeQuality: undefined,
                evidenceCount: 0,
                summary: '请先配置品牌信息以进行 AI 可见度分析。',
                recommendations: [
                  '添加品牌名称和官网 URL',
                  '补充品牌行业和描述信息',
                  '运行 Quick Discovery 进行初步扫描',
                ],
              })),
              platformGroups: {
                international: grouped.international.map((a) => a.provider),
                china: grouped.china.map((a) => a.provider),
              },
              checkedAt: result.checkedAt,
            },
          })
        }

        return reply.send({ success: true, data: result })
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message })
      }
    }
  )
}
