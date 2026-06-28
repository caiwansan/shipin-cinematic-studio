// ============================================================
// Resolver Routes — resolve capability to resource
// API: /api/resource/resolver/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function resolverRoutes(fastify: any) {
  // Resolve capability to resource
  fastify.post('/api/resource/resolver/resolve', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.capabilityName) return reply.status(400).send({ success: false, error: 'capabilityName is required' })
    if (!body.tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

    try {
      const result = await resourceService.resolve({
        capabilityName: body.capabilityName,
        strategy: body.strategy || 'balanced',
        tenantId: body.tenantId,
        workspaceId: body.workspaceId,
        options: body.options,
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Check if capability is resolvable
  fastify.get('/api/resource/resolver/check', async (request: any, reply: any) => {
    const query = request.query as any
    if (!query.capabilityName) return reply.status(400).send({ success: false, error: 'capabilityName is required' })
    if (!query.tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

    const resolvable = await resourceService.hasResolvable(query.capabilityName, query.tenantId)
    return { success: true, data: { resolvable } }
  })

  // List available strategies
  fastify.get('/api/resource/resolver/strategies', async (request: any, reply: any) => {
    const strategies = resourceService.listResolverStrategies()
    return { success: true, data: strategies }
  })
}
