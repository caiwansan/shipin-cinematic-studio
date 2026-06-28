// ============================================================
// Review Agent Interface — Placeholder for future LLM integration
// ============================================================

import type { Execution, Review } from '../types/index'

/**
 * ReviewAgentInterface — AI-powered review assistance
 * Placeholder: no LLM integration in this version
 */
export interface ReviewAgentInterface {
  /**
   * Auto-review an execution result
   */
  autoReview(execution: Execution): Promise<{
    suggestedStatus: 'approved' | 'rejected' | 'needs_revision'
    score: number
    comments: string
    confidence: 'low' | 'medium' | 'high'
  }>

  /**
   * Compare execution output with success criteria
   */
  compareWithCriteria(execution: Execution, criteria: string[]): Promise<{
    matched: string[]
    missing: string[]
    score: number
  }>

  /**
   * Generate improvement suggestions for rejected results
   */
  suggestImprovements(review: Review): Promise<{
    suggestions: string[]
    examples: string[]
  }>
}

/**
 * Placeholder implementation
 */
export const reviewAgent: ReviewAgentInterface = {
  async autoReview(execution) {
    const isSuccess = execution.status === 'completed'
    return {
      suggestedStatus: isSuccess ? 'approved' : 'rejected',
      score: isSuccess ? 8 : 2,
      comments: isSuccess
        ? '执行成功，自动批准（占位符）'
        : `执行失败: ${execution.error || '未知错误'}`,
      confidence: 'low',
    }
  },

  async compareWithCriteria(execution, criteria) {
    return {
      matched: [],
      missing: criteria,
      score: 0,
    }
  },

  async suggestImprovements(_review) {
    return {
      suggestions: ['Placeholder: Improvement suggestions not yet implemented'],
      examples: [],
    }
  },
}
