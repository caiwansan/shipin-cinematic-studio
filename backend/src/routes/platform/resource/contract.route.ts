// ============================================================
// Resource Contract Routes — CRUD for ResourceContract
// API: /api/resource/contract/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function contractRoutes(fastify: any) {
  // List all contracts
  fastify.get('/api/resource/contract', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await resourceService.listContracts({
      type: query.type,
      vendor: query.vendor,
      status: query.status,
      search: query.search,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Get contract by ID
  fastify.get('/api/resource/contract/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const contract = await resourceService.getContract(id)
    if (!contract) return reply.status(404).send({ success: false, error: 'Contract not found' })
    return { success: true, data: contract }
  })

  // Create contract
  fastify.post('/api/resource/contract', async (request: any, reply: any) => {
    const body = request.body as any
    try {
      const contract = await resourceService.registerContract(body)
      return reply.status(201).send({ success: true, data: contract })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Update contract
  fastify.put('/api/resource/contract/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const contract = await resourceService.updateContract(id, body)
    return { success: true, data: contract }
  })

  // Deprecate contract
  fastify.patch('/api/resource/contract/:id/deprecate', async (request: any, reply: any) => {
    const { id } = request.params
    const contract = await resourceService.deprecateContract(id)
    return { success: true, data: contract }
  })

  // Delete contract
  fastify.delete('/api/resource/contract/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await resourceService.deleteContract(id)
    return { success: true, message: 'Contract deleted' }
  })

  // Get stats
  fastify.get('/api/resource/contract/stats', async (request: any, reply: any) => {
    const stats = await resourceService.getRegistryStats()
    return { success: true, data: stats }
  })
}
