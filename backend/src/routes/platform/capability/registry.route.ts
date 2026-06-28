// ============================================================
// Registry Routes — Registry management (register, deprecate)
// API: /api/capability/registry/*
// ============================================================

import { capabilityService } from '../../../services/platform/capability/capability.service.js'

export default async function registryRoutes(fastify: any) {
  // Register a new capability
  fastify.post('/api/capability/registry/register', async (request: any, reply: any) => {
    try {
      const body = request.body as any
      if (!body.name || !body.displayName || !body.category) {
        return reply.status(400).send({ success: false, error: 'name, displayName, and category are required' })
      }
      const contract = await capabilityService.register(body)
      return { success: true, data: contract }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Deprecate a capability
  fastify.post('/api/capability/registry/:id/deprecate', async (request: any, reply: any) => {
    const { id } = request.params
    const contract = await capabilityService.deprecate(id)
    if (!contract) return reply.status(404).send({ success: false, error: 'Contract not found' })
    return { success: true, data: contract }
  })

  // Remove a capability
  fastify.delete('/api/capability/registry/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const ok = await capabilityService.remove(id)
    if (!ok) return reply.status(404).send({ success: false, error: 'Contract not found' })
    return { success: true, data: { id } }
  })

  // List all registered capabilities
  fastify.get('/api/capability/registry', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await capabilityService.search({
      category: query.category,
      status: query.status,
      search: query.search,
      limit: query.limit ? Number(query.limit) : 200,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })
}
