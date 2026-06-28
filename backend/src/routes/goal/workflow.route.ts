// ============================================================
// Workflow Routes — CRUD + stages for Workflow
// API: /api/goal/workflow/*
// ============================================================

import { workflowRepository } from '../../services/goal/repositories/workflow.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function workflowRoutes(fastify: any) {
  // Create workflow
  fastify.post('/api/goal/workflow', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.strategyId || !body.name) {
      return reply.status(400).send({ success: false, error: 'strategyId and name are required' })
    }
    const workflow = await workflowRepository.create({
      strategyId: body.strategyId,
      name: body.name,
      description: body.description,
      metadata: body.metadata,
    })
    return { success: true, data: workflow }
  })

  // Generate workflows from strategy (auto)
  fastify.post('/api/goal/workflow/generate/:strategyId', async (request: any, reply: any) => {
    const { strategyId } = request.params
    const result = await goalRuntime.generateWorkflows(strategyId)
    return { success: true, data: { workflows: result, count: result.length } }
  })

  // List workflows by strategy
  fastify.get('/api/goal/workflow', async (request: any, reply: any) => {
    const query = request.query as any
    if (!query.strategyId) {
      return reply.status(400).send({ success: false, error: 'strategyId is required' })
    }
    const workflows = await workflowRepository.listByStrategy(query.strategyId)
    return { success: true, data: { items: workflows, total: workflows.length } }
  })

  // Get workflow by ID (with stages)
  fastify.get('/api/goal/workflow/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const workflow = await workflowRepository.findById(id)
    if (!workflow) return reply.status(404).send({ success: false, error: 'Workflow not found' })
    const stages = await workflowRepository.listStagesByWorkflow(id)
    return { success: true, data: { workflow, stages } }
  })

  // Update workflow
  fastify.put('/api/goal/workflow/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const workflow = await workflowRepository.update(id, {
      name: body.name,
      description: body.description,
      status: body.status,
      metadata: body.metadata,
    })
    return { success: true, data: workflow }
  })

  // Delete workflow
  fastify.delete('/api/goal/workflow/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await workflowRepository.delete(id)
    return { success: true }
  })

  // ─── Stages ───

  // Create stage
  fastify.post('/api/goal/workflow/:workflowId/stage', async (request: any, reply: any) => {
    const { workflowId } = request.params
    const body = request.body as any
    if (!body.name || body.order === undefined) {
      return reply.status(400).send({ success: false, error: 'name and order are required' })
    }
    const stage = await workflowRepository.createStage({
      workflowId,
      name: body.name,
      order: body.order,
      metadata: body.metadata,
    })
    return { success: true, data: stage }
  })

  // List stages by workflow
  fastify.get('/api/goal/workflow/:workflowId/stage', async (request: any, reply: any) => {
    const { workflowId } = request.params
    const stages = await workflowRepository.listStagesByWorkflow(workflowId)
    return { success: true, data: { items: stages, total: stages.length } }
  })

  // Update stage
  fastify.put('/api/goal/stage/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const stage = await workflowRepository.updateStage(id, {
      name: body.name,
      order: body.order,
      status: body.status,
      metadata: body.metadata,
    })
    return { success: true, data: stage }
  })

  // Delete stage
  fastify.delete('/api/goal/stage/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await workflowRepository.deleteStage(id)
    return { success: true }
  })
}
