// ============================================================
// Strategy Engine — Generate strategies from a Goal
// Rule-based; no LLM in this version
// ============================================================

import type { GoalData, StrategyData } from '../types.js'

/** Strategy template configuration */
interface StrategyTemplate {
  type: string
  name: string
  description: string
  priority: number
  conditions: (goal: GoalData) => boolean
}

/**
 * Default strategy templates
 * Each template defines when it should be generated based on goal characteristics
 */
const DEFAULT_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    type: 'content',
    name: '内容策略',
    description: '创建和优化品牌相关内容，提升内容覆盖率和质量',
    priority: 1,
    conditions: () => true, // Always include content strategy
  },
  {
    type: 'entity',
    name: '实体策略',
    description: '构建品牌实体知识图谱，增强搜索引擎对品牌的理解',
    priority: 2,
    conditions: () => true, // Always include entity strategy
  },
  {
    type: 'citation',
    name: '引用策略',
    description: '增加品牌在全网的引用频次和权威来源引用',
    priority: 3,
    conditions: (goal: GoalData) => {
      // Skip if no citation-related targets
      if (goal.targetMetric && goal.targetMetric.includes('citation')) return true
      return true
    },
  },
  {
    type: 'authority',
    name: '权威策略',
    description: '提升品牌在行业内的权威性和信任度',
    priority: 4,
    conditions: (goal: GoalData) => {
      // Include if target involves authority/trust
      if (goal.targetMetric && goal.targetMetric.includes('authority')) return true
      if (goal.description && goal.description.includes('权威')) return true
      return true
    },
  },
  {
    type: 'visibility',
    name: '可见性策略',
    description: '提升品牌在搜索结果和AI推荐中的展现率',
    priority: 5,
    conditions: (goal: GoalData) => {
      if (goal.targetMetric && goal.targetMetric.includes('visibility')) return true
      if (goal.targetMetric && goal.targetMetric.includes('visibility_score')) return true
      return true
    },
  },
]

export class StrategyEngine {
  private templates: StrategyTemplate[]

  constructor(templates?: StrategyTemplate[]) {
    this.templates = templates || DEFAULT_STRATEGY_TEMPLATES
  }

  /**
   * Generate strategies for a given goal
   * Evaluates each template against the goal's characteristics
   */
  async generateStrategies(goal: GoalData): Promise<StrategyData[]> {
    const strategies: StrategyData[] = []

    for (const template of this.templates) {
      if (template.conditions(goal)) {
        strategies.push({
          goalId: goal.id!,
          name: template.name,
          description: template.description,
          type: template.type,
          status: 'draft',
          priority: template.priority,
          metadata: JSON.stringify({
            generatedBy: 'strategy-engine',
            template: template.type,
            generatedAt: new Date().toISOString(),
          }),
          schemaVersion: 1,
        })
      }
    }

    return strategies
  }

  /**
   * Get supported strategy types
   */
  getSupportedTypes(): string[] {
    return this.templates.map(t => t.type)
  }
}

export const strategyEngine = new StrategyEngine()
