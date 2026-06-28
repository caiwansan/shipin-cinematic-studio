// ============================================================
// Resolver Routes — Resolve capability to provider
// API: /api/capability/resolver/*
// ============================================================

import { capabilityService } from '../../../services/platform/capability/capability.service.js'
import type { ResolverRequest } from '../../../services/platform/capability/types.js'

export default async function resolverRoutes(fastify: any) {
  // Resolve a capability
  fastify.post('/api/capability/resolver/resolve', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.capabilityName) {
      return reply.status(400).send({ success: false, error: 'capabilityName is required' })
    }

    const resolverRequest: ResolverRequest = {
      capabilityName: body.capabilityName,
      capabilityVersion: body.capabilityVersion,
      input: body.input || {},
      context: body.context,
      metadata: body.metadata,
    }

    const result = await capabilityService.resolve(resolverRequest)
    return { success: true, data: result }
  })

  // List available routing strategies
  fastify.get('/api/capability/resolver/strategies', async (request: any, reply: any) => {
    const { capabilityResolver } = await import('../../../services/platform/capability/resolver/capability-resolver.js')
    return { success: true, data: capabilityResolver.listStrategies() }
  })

  // Get resolver config
  fastify.get('/api/capability/resolver/config', async (request: any, reply: any) => {
    const { capabilityResolver } = await import('../../../services/platform/capability/resolver/capability-resolver.js')
    return { success: true, data: capabilityResolver.getConfig() }
  })
}
