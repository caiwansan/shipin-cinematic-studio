// ============================================================
// GEO Customer Success Route — Sprint G
// GET /api/geo/projects/:projectId/customer-success
// ============================================================

import { FastifyInstance } from 'fastify'
import { generateCustomerSuccessReport, CustomerSuccessInput } from '../customer-success/customer-success.service'

export default async function geoCustomerSuccessRoute(fastify: FastifyInstance) {
  // GET /api/geo/projects/:projectId/customer-success
  fastify.get('/api/geo/projects/:projectId/customer-success', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const user = request.user as any
      const userId = user?.id || 'anonymous'

      if (!projectId) {
        return reply.status(400).send({ success: false, error: 'Project ID required' })
      }

      // ── Fetch project data ──
      // In production, this would query the project repository for actual data.
      // For now, we use the query parameters or reasonable defaults to build the report.
      const query = request.query as any

      const input: CustomerSuccessInput = {
        projectId,
        completedActions: [
          {
            type: 'verification',
            completedAt: new Date().toISOString(),
            estimatedImpact: Number(query.impact) || 10,
          },
          {
            type: 'publishing',
            completedAt: new Date().toISOString(),
            estimatedImpact: Number(query.publishingImpact) || 8,
          },
        ],
        currentHealthScore: Number(query.healthScore) || 72,
        currentAIVisibility: Number(query.aiVisibility) || 45,
      }

      const report = generateCustomerSuccessReport(input)

      return {
        success: true,
        data: report,
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
