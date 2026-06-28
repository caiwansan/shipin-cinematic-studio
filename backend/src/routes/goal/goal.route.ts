// ============================================================
// Goal Routes — CRUD for Goal
// API: /api/goal/*
// ============================================================

import { goalRepository } from '../../services/goal/repositories/goal.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function goalRoutes(fastify: any) {
  // Create goal
  fastify.post('/api/goal', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.title) {
      return reply.status(400).send({ success: false, error: 'projectId and title are required' })
    }
    const goal = await goalRuntime.createGoal({
      projectId: body.projectId,
      title: body.title,
      description: body.description,
      successCriteria: body.successCriteria,
      targetMetric: body.targetMetric,
      deadline: body.deadline,
      priority: body.priority,
      metadata: body.metadata,
    })
    return { success: true, data: goal }
  })

  // List goals
  fastify.get('/api/goal', async (request: any, reply: any) => {
    const query = request.query as any
    if (!query.projectId) {
      return reply.status(400).send({ success: false, error: 'projectId is required' })
    }
    const result = await goalRuntime.listGoals({
      projectId: query.projectId,
      status: query.status,
      priority: query.priority ? Number(query.priority) : undefined,
      search: query.search,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })

  // Get goal by ID
  fastify.get('/api/goal/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const goal = await goalRuntime.getGoal(id)
    if (!goal) return reply.status(404).send({ success: false, error: 'Goal not found' })
    return { success: true, data: goal }
  })

  // Update goal
  fastify.put('/api/goal/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const goal = await goalRuntime.updateGoal(id, {
      title: body.title,
      description: body.description,
      successCriteria: body.successCriteria,
      targetMetric: body.targetMetric,
      deadline: body.deadline,
      priority: body.priority,
      status: body.status,
      metadata: body.metadata,
    })
    return { success: true, data: goal }
  })

  // Delete goal
  fastify.delete('/api/goal/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await goalRuntime.deleteGoal(id)
    return { success: true }
  })
}
