// ============================================================
// Cost Routes — cost query endpoints
// API: /api/resource/cost/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function costRoutes(fastify: any) {
  // List cost records
  fastify.get('/api/resource/cost', async (request: any, reply: any) => {
    const query = request.query as any
    const tenantId = query.tenantId
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

    const result = await resourceService.getCosts(tenantId, {
      workspaceId: query.workspaceId,
      billingPeriod: query.billingPeriod,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Get total cost over period
  fastify.get('/api/resource/cost/total', async (request: any, reply: any) => {
    const query = request.query as any
    const tenantId = query.tenantId
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

    const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = query.endDate ? new Date(query.endDate) : new Date()

    const total = await resourceService.getTotalCost(tenantId, startDate, endDate)
    return { success: true, data: { total, startDate, endDate } }
  })

  // Estimate cost
  fastify.post('/api/resource/cost/estimate', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.resourceId) return reply.status(400).send({ success: false, error: 'resourceId is required' })

    try {
      const estimate = await resourceService.estimateCost(body.resourceId, {
        promptLength: body.promptLength,
        expectedOutputLength: body.expectedOutputLength,
      })
      return { success: true, data: estimate }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })
}
