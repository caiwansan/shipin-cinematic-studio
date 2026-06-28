// ============================================================
// Task Routes — CRUD + dependencies for Task
// API: /api/goal/task/*
// ============================================================

import { taskRepository } from '../../services/goal/repositories/task.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function taskRoutes(fastify: any) {
  // Create task
  fastify.post('/api/goal/task', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.title || !body.actionType) {
      return reply.status(400).send({ success: false, error: 'title and actionType are required' })
    }
    const task = await taskRepository.create({
      goalId: body.goalId,
      strategyId: body.strategyId,
      workflowId: body.workflowId,
      stageId: body.stageId,
      title: body.title,
      description: body.description,
      actionType: body.actionType,
      priority: body.priority,
      dependencies: body.dependencies,
      maxRetries: body.maxRetries,
      deadline: body.deadline,
      metadata: body.metadata,
    })
    return { success: true, data: task }
  })

  // Generate tasks from strategy (auto)
  fastify.post('/api/goal/task/generate/:strategyId', async (request: any, reply: any) => {
    const { strategyId } = request.params
    const query = request.query as any
    const tasks = await goalRuntime.generateTasks(strategyId, query.workflowId)
    return { success: true, data: { tasks, count: tasks.length } }
  })

  // List tasks
  fastify.get('/api/goal/task', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await taskRepository.list({
      goalId: query.goalId,
      strategyId: query.strategyId,
      workflowId: query.workflowId,
      stageId: query.stageId,
      status: query.status,
      actionType: query.actionType,
      limit: query.limit ? Number(query.limit) : 100,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })

  // List ready-executable tasks
  fastify.get('/api/goal/task/executable', async (request: any, reply: any) => {
    const query = request.query as any
    const tasks = await taskRepository.listExecutable(query.limit ? Number(query.limit) : 20)
    return { success: true, data: { items: tasks, total: tasks.length } }
  })

  // Get task by ID
  fastify.get('/api/goal/task/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const task = await taskRepository.findById(id)
    if (!task) return reply.status(404).send({ success: false, error: 'Task not found' })
    return { success: true, data: task }
  })

  // Update task
  fastify.put('/api/goal/task/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const task = await taskRepository.update(id, {
      title: body.title,
      description: body.description,
      actionType: body.actionType,
      priority: body.priority,
      dependencies: body.dependencies,
      status: body.status,
      metadata: body.metadata,
    })
    return { success: true, data: task }
  })

  // Delete task
  fastify.delete('/api/goal/task/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await taskRepository.delete(id)
    return { success: true }
  })
}
