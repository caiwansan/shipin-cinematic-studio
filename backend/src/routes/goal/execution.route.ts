// ============================================================
// Execution Routes — CRUD + trigger for Execution
// API: /api/goal/execution/*
// ============================================================

import { executionRepository } from '../../services/goal/repositories/execution.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function executionRoutes(fastify: any) {
  // List executions
  fastify.get('/api/goal/execution', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await executionRepository.list({
      taskId: query.taskId,
      status: query.status,
      actionType: query.actionType,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })

  // List executions by task
  fastify.get('/api/goal/execution/by-task/:taskId', async (request: any, reply: any) => {
    const { taskId } = request.params
    const executions = await executionRepository.listByTask(taskId)
    return { success: true, data: { items: executions, total: executions.length } }
  })

  // Get execution by ID (with results)
  fastify.get('/api/goal/execution/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const execution = await executionRepository.findById(id)
    if (!execution) return reply.status(404).send({ success: false, error: 'Execution not found' })
    const results = await executionRepository.listResultsByExecution(id)
    return { success: true, data: { execution, results } }
  })

  // Trigger execution for a task
  fastify.post('/api/goal/execution/trigger/:taskId', async (request: any, reply: any) => {
    const { taskId } = request.params
    const result = await goalRuntime.executeTask(taskId)
    return { success: true, data: result }
  })

  // Trigger execution for all ready tasks
  fastify.post('/api/goal/execution/trigger-ready', async (request: any, reply: any) => {
    const results = await goalRuntime.executeReadyTasks()
    return { success: true, data: { executed: results.length, results } }
  })
}
