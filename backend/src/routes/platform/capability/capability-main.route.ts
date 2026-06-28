// ============================================================
// Capability Main Routes — aggregated capability endpoints
// API: /api/capability/*
// ============================================================

import { capabilityService } from '../../../services/platform/capability/capability.service.js'

export default async function capabilityMainRoutes(fastify: any) {
  // Get stats
  fastify.get('/api/capability/stats', async (request: any, reply: any) => {
    const stats = await capabilityService.getStats()
    return { success: true, data: stats }
  })

  // Add provider mapping
  fastify.post('/api/capability/mapping', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.capabilityId || !body.provider) {
      return reply.status(400).send({ success: false, error: 'capabilityId and provider are required' })
    }
    const mapping = await capabilityService.addProviderMapping(body)
    return { success: true, data: mapping }
  })

  // Get provider mappings for a capability
  fastify.get('/api/capability/mapping/:capabilityId', async (request: any, reply: any) => {
    const { capabilityId } = request.params
    const mappings = await capabilityService.getProviderMappings(capabilityId)
    return { success: true, data: mappings }
  })

  // Remove provider mapping
  fastify.delete('/api/capability/mapping/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await capabilityService.removeProviderMapping(id)
    return { success: true, data: { id } }
  })

  // Health check
  fastify.get('/api/capability/health', async (request: any, reply: any) => {
    const { capabilityRuntime } = await import('../../../services/platform/capability/runtime/capability.runtime.js')
    return {
      success: true,
      data: {
        initialized: capabilityRuntime.isReady(),
        registeredCount: capabilityRuntime.listCapabilities().length,
        timestamp: new Date().toISOString(),
      },
    }
  })
}
