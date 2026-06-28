// ============================================================
// Health Routes — health query endpoints
// API: /api/resource/health/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function healthRoutes(fastify: any) {
  // Get health overview
  fastify.get('/api/resource/health/overview', async (request: any, reply: any) => {
    const overview = await resourceService.getHealthOverview()
    return { success: true, data: overview }
  })

  // Check a specific resource's health
  fastify.post('/api/resource/health/check/:resourceId', async (request: any, reply: any) => {
    const { resourceId } = request.params
    const health = await resourceService.checkHealth(resourceId)
    if (!health) return reply.status(404).send({ success: false, error: 'Resource not found' })
    return { success: true, data: health }
  })

  // Get latest health for a resource
  fastify.get('/api/resource/health/:resourceId', async (request: any, reply: any) => {
    const { resourceId } = request.params
    const health = await resourceService.getResourceHealth(resourceId)
    if (!health) return reply.status(404).send({ success: false, error: 'No health data found' })
    return { success: true, data: health }
  })
}
