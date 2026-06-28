// ============================================================
// Workflow Agent Interface — Placeholder for future LLM integration
// ============================================================

import type { Strategy, Workflow } from '../types/index'

/**
 * WorkflowAgentInterface — AI-powered workflow optimization
 * Placeholder: no LLM integration in this version
 */
export interface WorkflowAgentInterface {
  /**
   * Suggest optimal workflow structure for a strategy
   */
  suggestWorkflows(strategy: Strategy): Promise<Array<{
    name: string
    description: string
    stages: string[]
  }>>

  /**
   * Optimize an existing workflow
   */
  optimizeWorkflow(workflow: Workflow): Promise<{
    suggestions: string[]
    reorderedStages?: string[]
  }>

  /**
   * Estimate workflow duration and complexity
   */
  estimateWorkflow(workflow: Workflow): Promise<{
    estimatedDuration: string
    complexity: 'low' | 'medium' | 'high'
    riskFactors: string[]
  }>
}

/**
 * Placeholder implementation
 */
export const workflowAgent: WorkflowAgentInterface = {
  async suggestWorkflows(strategy) {
    return [{
      name: `${strategy.name} 执行流程`,
      description: `为 ${strategy.name} 自动生成的执行流程`,
      stages: ['准备', '执行', '验证', '交付'],
    }]
  },

  async optimizeWorkflow(_workflow) {
    return {
      suggestions: ['Placeholder: Workflow optimization not yet implemented'],
    }
  },

  async estimateWorkflow(_workflow) {
    return {
      estimatedDuration: '未知',
      complexity: 'medium',
      riskFactors: [],
    }
  },
}
