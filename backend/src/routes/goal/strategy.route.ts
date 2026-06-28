// ============================================================
// Strategy Routes — CRUD + generate for Strategy
// API: /api/goal/strategy/*
// ============================================================

import { strategyRepository } from '../../services/goal/repositories/strategy.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function strategyRoutes(fastify: any) {
  // Create strategy
  fastify.post('/api/goal/strategy', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.goalId || !body.name) {
      return reply.status(400).send({ success: false, error: 'goalId and name are required' })
    }
    const strategy = await strategyRepository.create({
      goalId: body.goalId,
      name: body.name,
      description: body.description,
      type: body.type || 'content',
      priority: body.priority,
      metadata: body.metadata,
    })
    return { success: true, data: strategy }
  })

  // Generate strategies from goal (auto)
  fastify.post('/api/goal/strategy/generate/:goalId', async (request: any, reply: any) => {
    const { goalId } = request.params
    const strategies = await goalRuntime.generateStrategies(goalId)
    return { success: true, data: { strategies, count: strategies.length } }
  })

  // List strategies
  fastify.get('/api/goal/strategy', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await strategyRepository.list({
      goalId: query.goalId,
      type: query.type,
      status: query.status,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })

  // Get strategy by ID
  fastify.get('/api/goal/strategy/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const strategy = await strategyRepository.findById(id)
    if (!strategy) return reply.status(404).send({ success: false, error: 'Strategy not found' })
    return { success: true, data: strategy }
  })

  // Update strategy
  fastify.put('/api/goal/strategy/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const strategy = await strategyRepository.update(id, {
      name: body.name,
      description: body.description,
      type: body.type,
      status: body.status,
      priority: body.priority,
      metadata: body.metadata,
    })
    return { success: true, data: strategy }
  })

  // Delete strategy
  fastify.delete('/api/goal/strategy/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await strategyRepository.delete(id)
    return { success: true }
  })
}
