// ============================================================
// Goal Runtime — Full lifecycle management
// Events: GoalCreated, StrategyGenerated, TaskCreated, ExecutionCompleted, ReviewApproved
// Methods: createGoal, generateStrategy, generateWorkflow, execute, review, close
// Repository pattern: Service never directly touches Prisma
// ============================================================

import { goalRepository } from '../repositories/goal.repository.js'
import { strategyRepository } from '../repositories/strategy.repository.js'
import { workflowRepository } from '../repositories/workflow.repository.js'
import { taskRepository } from '../repositories/task.repository.js'
import { executionRepository } from '../repositories/execution.repository.js'
import { reviewRepository } from '../repositories/review.repository.js'
import { strategyEngine } from '../planner/strategy-engine.js'
import { workflowPlanner } from '../planner/workflow-planner.js'
import { taskEngine } from '../engine/task-engine.js'
import { executor } from '../executor/executor.js'
import { reviewLoop } from '../review/review-loop.js'
import { reviewValidator } from '../review/review-validator.js'
import type {
  GoalData,
  StrategyData,
  WorkflowData,
  WorkflowStageData,
  TaskData,
  ExecutionData,
  ReviewData,
  GoalEvent,
  GoalEventType,
  GoalFilter,
} from '../types.js'

// Simple event bus
const eventListeners: Map<GoalEventType, Array<(event: GoalEvent) => void>> = new Map()

function emitEvent(type: GoalEventType, projectId: string, data?: Record<string, unknown>) {
  const event: GoalEvent = { type, projectId, timestamp: new Date(), data }
  const listeners = eventListeners.get(type) || []
  for (const listener of listeners) {
    try { listener(event) } catch { /* swallow */ }
  }
}

export function onGoalEvent(type: GoalEventType, listener: (event: GoalEvent) => void) {
  if (!eventListeners.has(type)) eventListeners.set(type, [])
  eventListeners.get(type)!.push(listener)
}

export function offGoalEvent(type: GoalEventType, listener: (event: GoalEvent) => void) {
  const listeners = eventListeners.get(type)
  if (listeners) {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

class GoalRuntime {
  private initialized = false

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    console.log('[GoalRuntime] Runtime initialized')
  }

  // ─── Goal CRUD ───

  async createGoal(data: GoalData): Promise<GoalData> {
    const goal = await goalRepository.create(data)
    emitEvent('goal:created', data.projectId, {
      goalId: goal.id,
      title: data.title,
      status: goal.status,
    })
    return goal
  }

  async getGoal(id: string): Promise<GoalData | null> {
    return goalRepository.findById(id)
  }

  async listGoals(filter: GoalFilter): Promise<{ items: GoalData[]; total: number }> {
    return goalRepository.list(filter)
  }

  async updateGoal(id: string, data: Partial<GoalData>): Promise<GoalData> {
    const goal = await goalRepository.update(id, data)
    if (data.status === 'active') emitEvent('goal:activated', goal.projectId, { goalId: id })
    if (data.status === 'completed') emitEvent('goal:completed', goal.projectId, { goalId: id })
    if (data.status === 'cancelled') emitEvent('goal:cancelled', goal.projectId, { goalId: id })
    emitEvent('goal:updated', goal.projectId, { goalId: id })
    return goal
  }

  async deleteGoal(id: string): Promise<void> {
    const goal = await goalRepository.findById(id)
    if (goal) {
      await goalRepository.delete(id)
      emitEvent('goal:deleted', goal.projectId, { goalId: id })
    }
  }

  // ─── Strategy Generation ───

  async generateStrategies(goalId: string): Promise<StrategyData[]> {
    const goal = await goalRepository.findById(goalId)
    if (!goal) throw new Error(`Goal not found: ${goalId}`)

    // Delete existing strategies (replace)
    await strategyRepository.deleteByGoal(goalId)

    // Generate new strategies
    const strategies = await strategyEngine.generateStrategies(goal)
    const created = await strategyRepository.createMany(strategies)

    emitEvent('strategy:generated', goal.projectId, {
      goalId,
      strategyCount: created.length,
      strategies: created.map(s => ({ id: s.id, type: s.type, name: s.name })),
    })

    return created
  }

  // ─── Workflow Generation ───

  async generateWorkflows(strategyId: string): Promise<Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }>> {
    const strategy = await strategyRepository.findById(strategyId)
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`)

    const plans = await workflowPlanner.planWorkflows(strategy)
    const results: Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }> = []

    for (const plan of plans) {
      // Create workflow
      const workflow = await workflowRepository.create({
        ...plan.workflow,
        strategyId,
      })

      // Create stages
      const stages = await workflowRepository.createStages(
        plan.stages.map(s => ({ ...s, workflowId: workflow.id! }))
      )

      results.push({ workflow, stages })
    }

    const goal = await goalRepository.findById(strategy.goalId)
    emitEvent('workflow:generated', goal?.projectId || '', {
      strategyId,
      workflowCount: results.length,
    })

    return results
  }

  // ─── Task Generation ───

  async generateTasks(strategyId: string, workflowId?: string): Promise<TaskData[]> {
    const strategy = await strategyRepository.findById(strategyId)
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`)

    let allTasks: TaskData[] = []

    // If workflow specified, generate for that workflow only
    const workflows = workflowId
      ? [await workflowRepository.findById(workflowId)].filter(Boolean) as WorkflowData[]
      : await workflowRepository.listByStrategy(strategyId)

    for (const workflow of workflows) {
      const stages = await workflowRepository.listStagesByWorkflow(workflow.id!)
      const tasks = await taskEngine.generateTasksForWorkflow(strategy, workflow, stages)
      const created = await taskRepository.createMany(tasks)
      allTasks.push(...created)
    }

    const goal = await goalRepository.findById(strategy.goalId)
    emitEvent('task:created', goal?.projectId || '', {
      strategyId,
      taskCount: allTasks.length,
    })

    return allTasks
  }

  // ─── Full Pipeline: Goal → Strategy → Workflow → Tasks ───

  async runFullPipeline(goalId: string): Promise<{
    goal: GoalData
    strategies: StrategyData[]
    workflows: Array<{ strategy: StrategyData; workflows: Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }> }>
    tasks: TaskData[]
  }> {
    const goal = await goalRepository.findById(goalId)
    if (!goal) throw new Error(`Goal not found: ${goalId}`)

    // 1. Generate strategies
    const strategies = await this.generateStrategies(goalId)

    // 2. Generate workflows for each strategy
    const allWorkflowData: Array<{ strategy: StrategyData; workflows: Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }> }> = []
    const allTasks: TaskData[] = []

    for (const strategy of strategies) {
      const workflows = await this.generateWorkflows(strategy.id!)
      allWorkflowData.push({ strategy, workflows })

      // 3. Generate tasks for each workflow
      for (const { workflow } of workflows) {
        const tasks = await this.generateTasks(strategy.id!, workflow.id)
        allTasks.push(...tasks)
      }
    }

    // Mark goal as active
    if (goal.status === 'draft') {
      await goalRepository.update(goalId, { status: 'active' })
    }

    return {
      goal: { ...goal, status: 'active' },
      strategies,
      workflows: allWorkflowData,
      tasks: allTasks,
    }
  }

  // ─── Execution ───

  async executeTask(taskId: string): Promise<{ execution: ExecutionData; results: any[] }> {
    const task = await taskRepository.findById(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    emitEvent('execution:started', '', { taskId, actionType: task.actionType })

    const result = await executor.executeTask(task)

    emitEvent('execution:completed', '', {
      taskId,
      executionId: result.execution.id,
      status: result.execution.status,
    })

    return result
  }

  async executeReadyTasks(): Promise<any[]> {
    const tasks = await taskRepository.listExecutable(10)
    const results: any[] = []
    for (const task of tasks) {
      await taskRepository.update(task.id!, { status: 'running' })
      const result = await this.executeTask(task.id!)
      results.push(result)
    }
    return results
  }

  // ─── Review ───

  async createReview(executionId: string): Promise<ReviewData> {
    emitEvent('review:created', '', { executionId })
    return reviewLoop.createReview(executionId)
  }

  async approveReview(reviewId: string, comments?: string, score?: number): Promise<any> {
    const result = await reviewLoop.approve(reviewId, comments, score)
    emitEvent('review:approved', '', {
      reviewId,
      executionId: result.review.executionId,
    })
    return result
  }

  async rejectReview(reviewId: string, comments?: string): Promise<any> {
    const result = await reviewLoop.reject(reviewId, comments)
    emitEvent('review:rejected', '', {
      reviewId,
      executionId: result.review.executionId,
    })
    return result
  }

  // ─── Close Goal ───

  async closeGoal(goalId: string): Promise<GoalData> {
    // Check all tasks are completed or cancelled
    const tasks = await taskRepository.listByGoal(goalId)
    const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')

    if (pendingTasks.length > 0) {
      // Cancel remaining tasks
      for (const task of pendingTasks) {
        if (task.status === 'pending' || task.status === 'ready') {
          await taskRepository.update(task.id!, { status: 'cancelled' })
        }
      }
    }

    const goal = await goalRepository.update(goalId, { status: 'completed' })
    emitEvent('goal:closed', goal.projectId, {
      goalId,
      cancelledTasks: pendingTasks.length,
    })

    return goal
  }

  // ─── Stats ───

  async getProjectStats(projectId: string): Promise<{
    totalGoals: number
    activeGoals: number
    completedGoals: number
    totalStrategies: number
    totalTasks: number
    pendingTasks: number
    runningTasks: number
    completedTasks: number
    failedTasks: number
    totalExecutions: number
    pendingReviews: number
  }> {
    const [totalGoals, activeGoals, completedGoals] = await Promise.all([
      goalRepository.countByProject(projectId),
      goalRepository.countByStatus(projectId, 'active'),
      goalRepository.countByStatus(projectId, 'completed'),
    ])

    // Count tasks by status
    const allTasks = await taskRepository.list({})
    const pendingTasks = allTasks.items.filter(t => t.status === 'pending' || t.status === 'ready').length
    const runningTasks = allTasks.items.filter(t => t.status === 'running').length
    const completedTasks = allTasks.items.filter(t => t.status === 'completed').length
    const failedTasks = allTasks.items.filter(t => t.status === 'failed').length

    const [totalExecutions, pendingReviews] = await Promise.all([
      executionRepository.countByStatus('running'),
      reviewRepository.countByStatus('pending'),
    ])

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      totalStrategies: 0, // Could be optimized with a count query
      totalTasks: allTasks.total,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      totalExecutions,
      pendingReviews,
    }
  }

  // ─── Event Subscription ───

  on(eventType: GoalEventType, listener: (event: GoalEvent) => void) {
    onGoalEvent(eventType, listener)
  }

  off(eventType: GoalEventType, listener: (event: GoalEvent) => void) {
    offGoalEvent(eventType, listener)
  }
}

// Singleton
export const goalRuntime = new GoalRuntime()
