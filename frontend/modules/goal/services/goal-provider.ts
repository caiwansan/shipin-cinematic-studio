// ============================================================
// Goal Provider — Cross-Workspace interface
// Provides a unified API for any workspace to interact with Goal Runtime
// ============================================================

import { goalService } from './goal.service'
import type {
  Goal, Strategy, Workflow, Task, Execution, Review, GoalStats,
} from '../types/index'

/**
 * GoalProvider — used by Brand GEO workspace or any other workspace
 * that needs to create/manage goals, generate strategies, execute tasks, review results
 */
export const goalProvider = {
  // ─── Create Goal ───

  async createGoal(projectId: string, title: string, options?: {
    description?: string
    successCriteria?: string
    targetMetric?: string
    deadline?: string
    priority?: number
  }): Promise<Goal | null> {
    return goalService.createGoal({ projectId, title, ...options })
  },

  // ─── Generate Strategy ───

  async generateStrategy(goalId: string): Promise<Strategy[]> {
    return goalService.generateStrategies(goalId)
  },

  // ─── Execute ───

  async execute(taskId: string): Promise<{ execution: Execution; results: any[] } | null> {
    return goalService.triggerExecution(taskId)
  },

  // ─── Review ───

  async review(executionId: string, action: 'approve' | 'reject', comments?: string, score?: number): Promise<any> {
    const review = await goalService.createReview(executionId)
    if (!review) return null

    if (action === 'approve') {
      return goalService.approveReview(review.id, comments, score)
    }
    return goalService.rejectReview(review.id, comments)
  },

  // ─── Close ───

  async close(goalId: string): Promise<Goal | null> {
    return goalService.closeGoal(goalId)
  },

  // ─── Stats ───

  async getStats(projectId: string): Promise<GoalStats | null> {
    return goalService.getGoalStats(projectId)
  },

  // ─── Run Full Pipeline ───

  async runPipeline(projectId: string, title: string, description?: string): Promise<any> {
    return goalService.runPipeline(projectId, title, { description })
  },
}
