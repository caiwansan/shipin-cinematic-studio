// ============================================================
// GEO Dashboard Routes — REST API (Sprint P1)
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoKeywordRepository } from '../repositories/geo-keyword.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { geoClaimRepository } from '../repositories/geo-claim.repository.js'
import { geoEntityRepository, geoEntityRelationRepository } from '../repositories/geo-entity.repository.js'
import { knowledgeObjectRepository } from '../../repositories/knowledge-object.repository.js'
import { resourceCredentialRepository } from '../repositories/resource-credential.repository.js'

export default async function geoDashboardRoutes(fastify: FastifyInstance) {
  // GET /api/geo/dashboard/stats — Dashboard statistics
  fastify.get('/api/geo/dashboard/stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id
    const { projectId } = request.query as any

    try {
      // Build base project filter
      const projectFilter: any = { userId, deletedAt: null }
      if (projectId) projectFilter.id = projectId

      const projects = await geoProjectRepository.findMany(projectFilter)
      const projectIds = projects.map((p: any) => p.id)

      // Brand count = project count
      const brandCount = projects.length

      // Keyword count
      const keywordCount = projectIds.length > 0
        ? await geoKeywordRepository.count({
            projectId: { in: projectIds },
          })
        : 0

      // KO count
      const koCount = projectIds.length > 0
        ? await knowledgeObjectRepository.count({
            projectId: { in: projectIds },
          })
        : 0

      // Entity count (from GEOEntity)
      const entityCount = projectIds.length > 0
        ? await geoEntityRepository.count({
            projectId: { in: projectIds },
          })
        : 0

      // Relationship count
      const relationCount = projectIds.length > 0
        ? await geoEntityRelationRepository.count({
            projectId: { in: projectIds },
          })
        : 0

      // Recent scans
      const recentScans = projectIds.length > 0
        ? await geoScanHistoryRepository.findMany(
            { where: { projectId: { in: projectIds } } },
            { createdAt: 'desc' }
          )
        : []

      // Claims count
      const claimsCount = projectIds.length > 0
        ? await geoClaimRepository.count({
            entity: { projectId: { in: projectIds } },
          })
        : 0

      return {
        success: true,
        data: {
          brandCount,
          keywordCount,
          koCount,
          entityCount,
          relationCount,
          claimsCount,
          recentScans: (recentScans as any[]).slice(0, 5).map((s: any) => ({
            id: s.id,
            projectId: s.projectId,
            scanType: s.scanType,
            status: s.status,
            topic: s.topic,
            createdAt: s.createdAt,
          })),
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/dashboard/provider-status — Provider configuration status
  fastify.get('/api/geo/dashboard/provider-status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id

    try {
      // Check if user has any provider configured via resource credentials
      const credentials = await resourceCredentialRepository.findMany(
        { tenantId: userId },
        { include: { resource: true } }
      )

      const providers = credentials.map((c: any) => ({
        id: c.id,
        name: c.name,
        resourceName: c.resource?.name || 'Unknown',
        vendor: c.resource?.vendor || 'Unknown',
        endpoint: c.endpoint || '',
        models: c.models || '',
        status: c.status,
        lastRotated: c.lastRotated || null,
      }))

      const hasConfigured = providers.length > 0

      return {
        success: true,
        data: {
          configured: hasConfigured,
          providerCount: providers.length,
          providers,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
