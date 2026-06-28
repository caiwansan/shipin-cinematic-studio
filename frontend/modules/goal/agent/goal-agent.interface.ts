// ============================================================
// Goal Agent Interface — Placeholder for future LLM integration
// This module defines the interface for an AI agent that helps
// create, analyze, and optimize goals.
// ============================================================

import type { Goal, GoalFilter } from '../types/index'

/**
 * GoalAgentInterface — AI-powered goal management
 * Placeholder: no LLM integration in this version
 */
export interface GoalAgentInterface {
  /**
   * Analyze a goal and suggest improvements
   */
  analyzeGoal(goal: Goal): Promise<{
    suggestions: string[]
    risks: string[]
    score: number
  }>

  /**
   * Suggest new goals based on project context
   */
  suggestGoals(projectId: string, context: string): Promise<Array<{
    title: string
    description: string
    targetMetric: string
    priority: number
  }>>

  /**
   * Decompose a goal into actionable strategies
   */
  decomposeGoal(goal: Goal): Promise<{
    strategies: string[]
    suggestedTypes: string[]
  }>
}

/**
 * Placeholder implementation
 */
export const goalAgent: GoalAgentInterface = {
  async analyzeGoal(goal) {
    return {
      suggestions: ['Placeholder: Enable LLM integration for goal analysis'],
      risks: ['Placeholder: Risk analysis not yet implemented'],
      score: 5,
    }
  },

  async suggestGoals(_projectId, _context) {
    return []
  },

  async decomposeGoal(goal) {
    return {
      strategies: ['content', 'entity', 'citation'],
      suggestedTypes: ['content', 'entity', 'citation', 'visibility'],
    }
  },
}
