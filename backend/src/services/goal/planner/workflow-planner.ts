// ============================================================
// Workflow Planner — Decompose Strategy → Workflows + Stages
// Rule-based decomposition; no LLM in this version
// ============================================================

import type { StrategyData, WorkflowData, WorkflowStageData } from '../types.js'

interface WorkflowTemplate {
  name: string
  description: string
  stages: string[]
  applicableTypes: string[]
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: '内容创建流程',
    description: '从内容规划到发布的完整流程',
    applicableTypes: ['content'],
    stages: ['内容规划', '内容创建', '内容审核', '内容发布', '效果追踪'],
  },
  {
    name: '实体构建流程',
    description: '从实体识别到知识图谱建成的完整流程',
    applicableTypes: ['entity'],
    stages: ['实体识别', '实体解析', '关系构建', '图谱验证', '图谱发布'],
  },
  {
    name: '引用建设流程',
    description: '从引用源识别到引用追踪的完整流程',
    applicableTypes: ['citation'],
    stages: ['引用源识别', '引用内容创建', '引用提交', '引用验证', '引用追踪'],
  },
  {
    name: '权威建设流程',
    description: '从权威评估到权威提升的完整流程',
    applicableTypes: ['authority'],
    stages: ['权威评估', '权威内容创建', '权威信号建设', '权威验证', '权威维护'],
  },
  {
    name: '可见性优化流程',
    description: '从可见性评估到优化的完整流程',
    applicableTypes: ['visibility'],
    stages: ['可见性评估', '关键词优化', '内容优化', '技术优化', '效果追踪'],
  },
  {
    name: '通用执行流程',
    description: '通用的策略执行流程',
    applicableTypes: ['content', 'entity', 'citation', 'authority', 'visibility'],
    stages: ['需求分析', '方案制定', '执行实施', '效果验证', '迭代优化'],
  },
]

export class WorkflowPlanner {
  /**
   * Decompose a strategy into workflows with stages
   */
  async planWorkflows(strategy: StrategyData): Promise<{ workflow: WorkflowData; stages: WorkflowStageData[] }[]> {
    // Find matching templates for this strategy type
    const matchingTemplates = WORKFLOW_TEMPLATES.filter(t =>
      t.applicableTypes.includes(strategy.type)
    )

    // If no specific match, use the generic one
    const templates = matchingTemplates.length > 0
      ? matchingTemplates
      : WORKFLOW_TEMPLATES.filter(t => t.applicableTypes.includes('content'))

    const results: { workflow: WorkflowData; stages: WorkflowStageData[] }[] = []

    for (const template of templates) {
      const workflow: WorkflowData = {
        strategyId: strategy.id!,
        name: template.name,
        description: template.description,
        status: 'draft',
        metadata: JSON.stringify({
          generatedBy: 'workflow-planner',
          template: template.name,
          generatedAt: new Date().toISOString(),
        }),
        schemaVersion: 1,
      }

      const stages: WorkflowStageData[] = template.stages.map((stageName, index) => ({
        workflowId: '', // Will be set after workflow is created
        name: stageName,
        order: index + 1,
        status: 'pending',
        metadata: JSON.stringify({
          generatedBy: 'workflow-planner',
          stageIndex: index,
        }),
        schemaVersion: 1,
      }))

      results.push({ workflow, stages })
    }

    return results
  }

  /**
   * Get default stage set for a strategy type
   */
  getDefaultStages(strategyType: string): string[] {
    const template = WORKFLOW_TEMPLATES.find(t => t.applicableTypes.includes(strategyType))
    return template?.stages || WORKFLOW_TEMPLATES[WORKFLOW_TEMPLATES.length - 1].stages
  }
}

export const workflowPlanner = new WorkflowPlanner()
