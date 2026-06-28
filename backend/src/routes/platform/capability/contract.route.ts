// ============================================================
// Contract Routes — Contract CRUD
// API: /api/capability/contract/*
// ============================================================

import { capabilityService } from '../../../services/platform/capability/capability.service.js'

export default async function contractRoutes(fastify: any) {
  // Create contract
  fastify.post('/api/capability/contract', async (request: any, reply: any) => {
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

  // List contracts
  fastify.get('/api/capability/contract', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await capabilityService.search({
      category: query.category,
      status: query.status,
      search: query.search,
      tags: query.tags ? query.tags.split(',') : undefined,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })

  // Get contract by ID
  fastify.get('/api/capability/contract/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const contract = await capabilityService.get(id)
    if (!contract) return reply.status(404).send({ success: false, error: 'Contract not found' })
    return { success: true, data: contract }
  })

  // Update contract
  fastify.put('/api/capability/contract/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const contract = await capabilityService.update(id, body)
    if (!contract) return reply.status(404).send({ success: false, error: 'Contract not found' })
    return { success: true, data: contract }
  })

  // Delete contract
  fastify.delete('/api/capability/contract/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const ok = await capabilityService.remove(id)
    if (!ok) return reply.status(404).send({ success: false, error: 'Contract not found' })
    return { success: true, data: { id } }
  })
}
