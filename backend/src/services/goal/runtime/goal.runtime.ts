// ============================================================
// Goal Runtime — Full lifecycle management
// Lifecycle: RuntimeLifecycle (Init → Load → Validate → Execute → Update → Dispose)
// Events: Created, Updated, Deleted, Started, Completed, Failed (via PlatformEventBus)
// Repository pattern: Service never directly touches Prisma
// ============================================================

import { PlatformContext, createContext } from '@platform/context/platform-context.js'
import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle.js'
import { IEventBus, platformEventBus } from '@platform/events/event-bus.js'
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
  GoalFilter,
} from '../types.js'
import { NotFoundError } from '@platform/errors/platform-errors.js'

export interface GoalInput {
  projectId: string
  title?: string
  description?: string
  successCriteria?: string
  targetMetric?: string
  deadline?: string
  priority?: number
  metadata?: string
  status?: string
  goalId?: string
}

export interface GoalOutput {
  goal?: GoalData
  strategies?: StrategyData[]
  workflows?: Array<{ strategy: StrategyData; workflows: Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }> }>
  tasks?: TaskData[]
  execution?: ExecutionData
  results?: any[]
  review?: ReviewData
}

class GoalRuntime implements RuntimeLifecycle<GoalInput, GoalOutput> {
  private initialized = false
  private eventBus: IEventBus

  constructor(eventBus: IEventBus = platformEventBus) {
    this.eventBus = eventBus
  }

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    console.log('[GoalRuntime] Runtime initialized')
  }

  async load(ctx: PlatformContext, id: string): Promise<GoalInput> {
    const goal = await goalRepository.findById(id)
    if (!goal) throw new NotFoundError('Goal not found', { goalId: id })
    return { projectId: goal.projectId, goalId: id, title: goal.title, status: goal.status }
  }

  async validate(ctx: PlatformContext, input: GoalInput): Promise<boolean> {
    if (!input.projectId) return false
    if (input.goalId) {
      const existing = await goalRepository.findById(input.goalId)
      if (!existing) return false
      // Check if goal is in executable state
      if (input.status === 'active' && existing.status === 'completed') return false
      if (input.status === 'completed' && existing.status === 'cancelled') return false
    }
    return true
  }

  async execute(ctx: PlatformContext, input: GoalInput): Promise<GoalOutput> {
    return this.runFullPipeline(input.goalId!, ctx)
  }

  async update(ctx: PlatformContext, id: string, data: Partial<GoalInput>): Promise<GoalOutput> {
    const goal = await goalRepository.update(id, data)
    this.eventBus.emit({
      type: 'goal:Updated',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: id,
      projectId: goal.projectId,
      payload: { updates: Object.keys(data) },
    })
    return { goal }
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false
    console.log('[GoalRuntime] Disposed')
  }

  // ─── Goal CRUD ───

  async createGoal(data: GoalData): Promise<GoalData> {
    const ctx = createContext({ projectId: data.projectId })
    const goal = await goalRepository.create(data)
    this.eventBus.emit({
      type: 'goal:Created',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: goal.id,
      projectId: data.projectId,
      payload: { title: data.title, status: goal.status },
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
    const ctx = createContext({ projectId: goal.projectId })
    if (data.status === 'active') {
      this.eventBus.emit({ type: 'goal:Activated', source: 'goal', timestamp: new Date().toISOString(), traceId: ctx.traceId, entityId: id, projectId: goal.projectId })
    }
    if (data.status === 'completed') {
      this.eventBus.emit({ type: 'goal:Completed', source: 'goal', timestamp: new Date().toISOString(), traceId: ctx.traceId, entityId: id, projectId: goal.projectId })
    }
    if (data.status === 'cancelled') {
      this.eventBus.emit({ type: 'goal:Cancelled', source: 'goal', timestamp: new Date().toISOString(), traceId: ctx.traceId, entityId: id, projectId: goal.projectId })
    }
    this.eventBus.emit({ type: 'goal:Updated', source: 'goal', timestamp: new Date().toISOString(), traceId: ctx.traceId, entityId: id, projectId: goal.projectId })
    return goal
  }

  async deleteGoal(id: string): Promise<void> {
    const goal = await goalRepository.findById(id)
    if (goal) {
      await goalRepository.delete(id)
      const ctx = createContext({ projectId: goal.projectId })
      this.eventBus.emit({ type: 'goal:Deleted', source: 'goal', timestamp: new Date().toISOString(), traceId: ctx.traceId, entityId: id, projectId: goal.projectId })
    }
  }

  // ─── Strategy Generation ───

  async generateStrategies(goalId: string): Promise<StrategyData[]> {
    const goal = await goalRepository.findById(goalId)
    if (!goal) throw new NotFoundError('Goal not found', { goalId })

    await strategyRepository.deleteByGoal(goalId)

    const strategies = await strategyEngine.generateStrategies(goal)
    const created = await strategyRepository.createMany(strategies)

    const ctx = createContext({ projectId: goal.projectId })
    this.eventBus.emit({
      type: 'strategy:Generated',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: goalId,
      projectId: goal.projectId,
      payload: { strategyCount: created.length },
    })

    return created
  }

  // ─── Workflow Generation ───

  async generateWorkflows(strategyId: string): Promise<Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }>> {
    const strategy = await strategyRepository.findById(strategyId)
    if (!strategy) throw new NotFoundError('Strategy not found', { strategyId })

    const plans = await workflowPlanner.planWorkflows(strategy)
    const results: Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }> = []

    for (const plan of plans) {
      const workflow = await workflowRepository.create({ ...plan.workflow, strategyId })
      const stages = await workflowRepository.createStages(
        plan.stages.map(s => ({ ...s, workflowId: workflow.id! }))
      )
      results.push({ workflow, stages })
    }

    const goal = await goalRepository.findById(strategy.goalId)
    const ctx = createContext({ projectId: goal?.projectId })
    this.eventBus.emit({
      type: 'workflow:Generated',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: strategyId,
      projectId: goal?.projectId,
      payload: { workflowCount: results.length },
    })

    return results
  }

  // ─── Task Generation ───

  async generateTasks(strategyId: string, workflowId?: string): Promise<TaskData[]> {
    const strategy = await strategyRepository.findById(strategyId)
    if (!strategy) throw new NotFoundError('Strategy not found', { strategyId })

    let allTasks: TaskData[] = []

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
    const ctx = createContext({ projectId: goal?.projectId })
    this.eventBus.emit({
      type: 'task:Created',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: strategyId,
      projectId: goal?.projectId,
      payload: { taskCount: allTasks.length },
    })

    return allTasks
  }

  // ─── Full Pipeline ───

  async runFullPipeline(goalId: string, ctx?: PlatformContext): Promise<GoalOutput> {
    const context = ctx || createContext()
    const goal = await goalRepository.findById(goalId)
    if (!goal) throw new NotFoundError('Goal not found', { goalId })

    const strategies = await this.generateStrategies(goalId)

    const allWorkflowData: Array<{ strategy: StrategyData; workflows: Array<{ workflow: WorkflowData; stages: WorkflowStageData[] }> }> = []
    const allTasks: TaskData[] = []

    for (const strategy of strategies) {
      const workflows = await this.generateWorkflows(strategy.id!)
      allWorkflowData.push({ strategy, workflows })
      for (const { workflow } of workflows) {
        const tasks = await this.generateTasks(strategy.id!, workflow.id)
        allTasks.push(...tasks)
      }
    }

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
    if (!task) throw new NotFoundError('Task not found', { taskId })

    const ctx = createContext()
    this.eventBus.emit({
      type: 'execution:Started',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: taskId,
      payload: { actionType: task.actionType },
    })

    const result = await executor.executeTask(task)

    const eventType = result.execution.status === 'failed' ? 'execution:Failed' as any : 'execution:Completed' as any
    this.eventBus.emit({
      type: eventType,
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: taskId,
      payload: { executionId: result.execution.id, status: result.execution.status },
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
    const ctx = createContext()
    this.eventBus.emit({
      type: 'review:Created',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: executionId,
    })
    return reviewLoop.createReview(executionId)
  }

  async approveReview(reviewId: string, comments?: string, score?: number): Promise<any> {
    const result = await reviewLoop.approve(reviewId, comments, score)
    const ctx = createContext()
    this.eventBus.emit({
      type: 'review:Approved',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: reviewId,
      payload: { executionId: result.review.executionId },
    })
    return result
  }

  async rejectReview(reviewId: string, comments?: string): Promise<any> {
    const result = await reviewLoop.reject(reviewId, comments)
    const ctx = createContext()
    this.eventBus.emit({
      type: 'review:Rejected',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: reviewId,
      payload: { executionId: result.review.executionId },
    })
    return result
  }

  // ─── Close Goal ───

  async closeGoal(goalId: string): Promise<GoalData> {
    const tasks = await taskRepository.listByGoal(goalId)
    const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')

    if (pendingTasks.length > 0) {
      for (const task of pendingTasks) {
        if (task.status === 'pending' || task.status === 'ready') {
          await taskRepository.update(task.id!, { status: 'cancelled' })
        }
      }
    }

    const goal = await goalRepository.update(goalId, { status: 'completed' })
    const ctx = createContext({ projectId: goal.projectId })
    this.eventBus.emit({
      type: 'goal:Closed',
      source: 'goal',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: goalId,
      projectId: goal.projectId,
      payload: { cancelledTasks: pendingTasks.length },
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
      totalStrategies: 0,
      totalTasks: allTasks.total,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      totalExecutions,
      pendingReviews,
    }
  }

  // ─── Event Subscription (legacy compat) ───

  on(eventType: string, listener: (event: any) => void) {
    this.eventBus.on(eventType as any, listener)
  }

  off(eventType: string, listener: (event: any) => void) {
    this.eventBus.off(eventType as any, listener)
  }
}

// Singleton
export const goalRuntime = new GoalRuntime()
