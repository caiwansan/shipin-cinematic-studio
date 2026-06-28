// ============================================================
// Goal Main Route — Main scheduling entry point
// POST /api/goal/run — Full pipeline: Goal → Strategy → Workflow → Tasks
// POST /api/goal/run/:goalId — Resume pipeline for existing goal
// ============================================================

import { goalRepository } from '../../services/goal/repositories/goal.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function goalMainRoutes(fastify: any) {
  // Run full pipeline: Create Goal → Generate Strategies → Generate Workflows → Generate Tasks
  fastify.post('/api/goal/run', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.title) {
      return reply.status(400).send({ success: false, error: 'projectId and title are required' })
    }

    // 1. Create goal
    const goal = await goalRuntime.createGoal({
      projectId: body.projectId,
      title: body.title,
      description: body.description,
      successCriteria: body.successCriteria,
      targetMetric: body.targetMetric,
      deadline: body.deadline,
      priority: body.priority ?? 3,
    })

    // 2. Run full pipeline
    const result = await goalRuntime.runFullPipeline(goal.id!)

    return {
      success: true,
      data: {
        goal: result.goal,
        strategies: result.strategies,
        workflowCount: result.workflows.length,
        taskCount: result.tasks.length,
        message: `Goal "${result.goal.title}" initialized with ${result.strategies.length} strategies and ${result.tasks.length} tasks`,
      },
    }
  })

  // Resume pipeline for existing goal
  fastify.post('/api/goal/run/:goalId', async (request: any, reply: any) => {
    const { goalId } = request.params
    const goal = await goalRepository.findById(goalId)
    if (!goal) return reply.status(404).send({ success: false, error: 'Goal not found' })

    const result = await goalRuntime.runFullPipeline(goalId)
    return {
      success: true,
      data: {
        goal: result.goal,
        strategies: result.strategies,
        workflowCount: result.workflows.length,
        taskCount: result.tasks.length,
        message: `Goal "${result.goal.title}" resumed with ${result.strategies.length} strategies and ${result.tasks.length} tasks`,
      },
    }
  })

  // Close goal
  fastify.post('/api/goal/:goalId/close', async (request: any, reply: any) => {
    const { goalId } = request.params
    const result = await goalRuntime.closeGoal(goalId)
    return { success: true, data: result }
  })

  // Get project stats
  fastify.get('/api/goal/stats/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const stats = await goalRuntime.getProjectStats(projectId)
    return { success: true, data: stats }
  })
}
