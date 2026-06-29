// ============================================================
// GEO Dashboard Routes — REST API (Sprint P1)
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index'

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

      const projects = await prisma.gEOProject.findMany({
        where: projectFilter,
      })
      const projectIds = projects.map(p => p.id)

      // Brand count = project count
      const brandCount = projects.length

      // Keyword count
      const keywordCount = projectIds.length > 0
        ? await prisma.geoKeyword.count({
            where: { projectId: { in: projectIds } },
          })
        : 0

      // KO count
      const koCount = projectIds.length > 0
        ? await prisma.knowledgeObject.count({
            where: { projectId: { in: projectIds } },
          })
        : 0

      // Entity count (from GEOEntity)
      const entityCount = projectIds.length > 0
        ? await prisma.gEOEntity.count({
            where: { projectId: { in: projectIds } },
          })
        : 0

      // Relationship count
      const relationCount = projectIds.length > 0
        ? await prisma.gEOEntityRelation.count({
            where: { projectId: { in: projectIds } },
          })
        : 0

      // Recent scans
      const recentScans = projectIds.length > 0
        ? await prisma.geoScanHistory.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : []

      // Claims count
      const claimsCount = projectIds.length > 0
        ? await prisma.gEOClaim.count({
            where: { entity: { projectId: { in: projectIds } } },
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
          recentScans: recentScans.map(s => ({
            id: s.id,
            projectId: s.projectId,
            scanType: s.scanType,
            status: s.status,
            topic: s.topic,
            createdAt: s.createdAt.toISOString(),
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
      const credentials = await prisma.resourceCredential.findMany({
        where: { tenantId: userId },
        include: { resource: true },
      })

      const providers = credentials.map(c => ({
        id: c.id,
        name: c.name,
        resourceName: c.resource?.name || 'Unknown',
        vendor: c.resource?.vendor || 'Unknown',
        endpoint: c.endpoint || '',
        models: c.models || '',
        status: c.status,
        lastRotated: c.lastRotated?.toISOString() || null,
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
