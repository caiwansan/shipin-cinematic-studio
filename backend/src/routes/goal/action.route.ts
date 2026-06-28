// ============================================================
// Action Routes — Action Registry CRUD
// API: /api/goal/action/*
// ============================================================

import { actionRepository } from '../../services/goal/repositories/action.repository.js'
import { actionRegistry } from '../../services/goal/registry/action-registry.js'

export default async function actionRoutes(fastify: any) {
  // Register a new action type
  fastify.post('/api/goal/action', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.name || !body.provider) {
      return reply.status(400).send({ success: false, error: 'name and provider are required' })
    }
    const action = await actionRepository.upsert({
      name: body.name,
      description: body.description,
      provider: body.provider,
      config: body.config,
    })
    return { success: true, data: action }
  })

  // List all registered actions (from DB)
  fastify.get('/api/goal/action', async (request: any, reply: any) => {
    const actions = await actionRepository.list()
    return { success: true, data: { items: actions, total: actions.length } }
  })

  // List registered handlers (from in-memory registry)
  fastify.get('/api/goal/action/registry', async (request: any, reply: any) => {
    const handlers = actionRegistry.list().map(e => ({
      name: e.action.name,
      description: e.action.description,
      provider: e.action.provider,
      registeredAt: e.registeredAt.toISOString(),
    }))
    return { success: true, data: { handlers, count: handlers.length } }
  })

  // Get action by name
  fastify.get('/api/goal/action/:name', async (request: any, reply: any) => {
    const { name } = request.params
    const action = await actionRepository.findByName(name)
    if (!action) return reply.status(404).send({ success: false, error: 'Action not found' })
    return { success: true, data: action }
  })

  // Update action
  fastify.put('/api/goal/action/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const action = await actionRepository.update(id, {
      name: body.name,
      description: body.description,
      provider: body.provider,
      config: body.config,
    })
    return { success: true, data: action }
  })

  // Delete action
  fastify.delete('/api/goal/action/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await actionRepository.delete(id)
    return { success: true }
  })
}
