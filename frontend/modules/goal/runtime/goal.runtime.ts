// ============================================================
// Goal Runtime — Frontend runtime abstraction
// ============================================================

import { goalService } from '../services/goal.service'
import type {
  Goal, Strategy, Workflow, WorkflowStage, Task, Action,
  Execution, ExecutionResult, Review, GoalStats, GoalFilter,
} from '../types/index'

export interface GoalRuntimeEvents {
  onGoalCreated?: (goal: Goal) => void
  onGoalUpdated?: (goal: Goal) => void
  onGoalDeleted?: (id: string) => void
  onStrategyGenerated?: (strategies: Strategy[]) => void
  onTaskCreated?: (tasks: Task[]) => void
  onExecutionCompleted?: (execution: Execution) => void
  onReviewApproved?: (review: Review) => void
}

export function createGoalRuntime() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {
    goalCreated: [],
    goalUpdated: [],
    goalDeleted: [],
    strategyGenerated: [],
    taskCreated: [],
    executionCompleted: [],
    reviewApproved: [],
  }

  return {
    on(event: string, handler: (...args: any[]) => void) {
      if (listeners[event]) listeners[event].push(handler)
    },

    // ─── Goals ───

    async listGoals(filter: GoalFilter) {
      return goalService.listGoals(filter)
    },

    async getGoal(id: string) {
      return goalService.getGoal(id)
    },

    async createGoal(data: { projectId: string; title: string; description?: string; successCriteria?: string; targetMetric?: string }) {
      const goal = await goalService.createGoal(data)
      if (goal) {
        for (const fn of listeners.goalCreated) fn(goal)
      }
      return goal
    },

    async updateGoal(id: string, data: Partial<Goal>) {
      const goal = await goalService.updateGoal(id, data)
      if (goal) {
        for (const fn of listeners.goalUpdated) fn(goal)
      }
      return goal
    },

    async deleteGoal(id: string) {
      const ok = await goalService.deleteGoal(id)
      if (ok) {
        for (const fn of listeners.goalDeleted) fn(id)
      }
      return ok
    },

    // ─── Strategies ───

    async generateStrategies(goalId: string) {
      const strategies = await goalService.generateStrategies(goalId)
      if (strategies.length) {
        for (const fn of listeners.strategyGenerated) fn(strategies)
      }
      return strategies
    },

    async listStrategies(goalId: string) {
      const result = await goalService.listStrategies(goalId)
      return result.items
    },

    // ─── Workflows ───

    async generateWorkflows(strategyId: string) {
      return goalService.generateWorkflows(strategyId)
    },

    async getWorkflow(id: string) {
      return goalService.getWorkflow(id)
    },

    // ─── Tasks ───

    async generateTasks(strategyId: string, workflowId?: string) {
      const tasks = await goalService.generateTasks(strategyId, workflowId)
      if (tasks.length) {
        for (const fn of listeners.taskCreated) fn(tasks)
      }
      return tasks
    },

    async listTasks(filter?: { goalId?: string; strategyId?: string; status?: string }) {
      const result = await goalService.listTasks(filter)
      return result.items
    },

    // ─── Actions ───

    async listActions() {
      return goalService.listActions()
    },

    async listRegistryHandlers() {
      return goalService.listRegistryHandlers()
    },

    // ─── Executions ───

    async triggerExecution(taskId: string) {
      const result = await goalService.triggerExecution(taskId)
      if (result) {
        for (const fn of listeners.executionCompleted) fn(result.execution)
      }
      return result
    },

    async listExecutions(taskId?: string) {
      const result = await goalService.listExecutions(taskId)
      return result.items
    },

    // ─── Reviews ───

    async createReview(executionId: string) {
      return goalService.createReview(executionId)
    },

    async approveReview(id: string, comments?: string, score?: number) {
      const result = await goalService.approveReview(id, comments, score)
      return result
    },

    async rejectReview(id: string, comments?: string) {
      return goalService.rejectReview(id, comments)
    },

    async listReviews(executionId?: string) {
      return goalService.listReviews(executionId)
    },

    // ─── Pipeline ───

    async runPipeline(projectId: string, title: string, options?: any) {
      return goalService.runPipeline(projectId, title, options)
    },

    // ─── Stats ───

    async getStats(projectId: string) {
      return goalService.getGoalStats(projectId)
    },

    async closeGoal(goalId: string) {
      return goalService.closeGoal(goalId)
    },
  }
}

export type GoalRuntime = ReturnType<typeof createGoalRuntime>
