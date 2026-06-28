// ============================================================
// Usage Routes — usage recording and querying
// API: /api/resource/usage/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function usageRoutes(fastify: any) {
  // Record usage
  fastify.post('/api/resource/usage', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.credentialId || !body.tenantId) {
      return reply.status(400).send({ success: false, error: 'credentialId and tenantId are required' })
    }
    const usage = await resourceService.recordUsage(body)
    return reply.status(201).send({ success: true, data: usage })
  })

  // List usage history
  fastify.get('/api/resource/usage', async (request: any, reply: any) => {
    const query = request.query as any
    const tenantId = query.tenantId
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

    const result = await resourceService.getUsageHistory(tenantId, {
      resourceType: query.resourceType,
      status: query.status,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    })
    return { success: true, data: result }
  })

  // Aggregate usage
  fastify.get('/api/resource/usage/aggregate', async (request: any, reply: any) => {
    const query = request.query as any
    const tenantId = query.tenantId
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

    const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = query.endDate ? new Date(query.endDate) : new Date()

    const result = await resourceService.aggregateUsage(tenantId, startDate, endDate)
    return { success: true, data: result }
  })
}
