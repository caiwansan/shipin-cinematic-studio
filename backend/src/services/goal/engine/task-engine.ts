// ============================================================
// Task Engine — Automatically generate Tasks from Strategy/Workflow/Stage
// Rule-based task generation; no LLM in this version
// ============================================================

import type { StrategyData, WorkflowData, WorkflowStageData, TaskData } from '../types.js'

/**
 * Default action templates for each strategy type + stage combination
 */
const TASK_ACTION_TEMPLATES: Record<string, Array<{ stageName: string; actionType: string; title: string; description: string; priority: number }>> = {
  content: [
    { stageName: '内容规划', actionType: 'GenerateFAQ', title: '生成FAQ内容', description: '生成品牌常见问题内容', priority: 1 },
    { stageName: '内容创建', actionType: 'GenerateFAQ', title: '创建深度内容', description: '创建品牌深度内容', priority: 2 },
    { stageName: '内容审核', actionType: 'ReviewContent', title: '审核内容质量', description: '审核创建内容的准确性和质量', priority: 3 },
    { stageName: '内容发布', actionType: 'PublishCMS', title: '发布到CMS平台', description: '将内容发布到CMS平台', priority: 4 },
    { stageName: '效果追踪', actionType: 'TrackMetrics', title: '追踪内容效果', description: '追踪发布内容的展现和点击效果', priority: 5 },
  ],
  entity: [
    { stageName: '实体识别', actionType: 'ExtractEntity', title: '提取品牌实体', description: '从现有内容中提取品牌实体', priority: 1 },
    { stageName: '实体解析', actionType: 'ResolveEntity', title: '解析实体关系', description: '解析实体之间的语义关系', priority: 2 },
    { stageName: '关系构建', actionType: 'UpdateKnowledgeGraph', title: '构建知识图谱', description: '将解析的实体关系更新至知识图谱', priority: 3 },
    { stageName: '图谱验证', actionType: 'ValidateGraph', title: '验证图谱一致性', description: '验证知识图谱的准确性和完整性', priority: 4 },
    { stageName: '图谱发布', actionType: 'UpdateKnowledgeGraph', title: '发布知识图谱', description: '将知识图谱更新发布到生产环境', priority: 5 },
  ],
  citation: [
    { stageName: '引用源识别', actionType: 'IdentifySources', title: '识别引用来源', description: '识别可获取引用的权威来源', priority: 1 },
    { stageName: '引用内容创建', actionType: 'GenerateFAQ', title: '创建引用内容', description: '根据引用源创建相关内容', priority: 2 },
    { stageName: '引用提交', actionType: 'PublishCMS', title: '提交引用申请', description: '向引用源提交品牌引用申请', priority: 3 },
    { stageName: '引用验证', actionType: 'VerifyCitation', title: '验证引用状态', description: '验证引用是否已被收录', priority: 4 },
    { stageName: '引用追踪', actionType: 'TrackMetrics', title: '追踪引用效果', description: '追踪引用的曝光和影响', priority: 5 },
  ],
  authority: [
    { stageName: '权威评估', actionType: 'AssessAuthority', title: '评估权威水平', description: '评估品牌当前的行业权威水平', priority: 1 },
    { stageName: '权威内容创建', actionType: 'GenerateFAQ', title: '创建权威内容', description: '创建展现品牌权威的深度内容', priority: 2 },
    { stageName: '权威信号建设', actionType: 'PublishCMS', title: '建设权威信号', description: '在权威平台建设品牌信号', priority: 3 },
    { stageName: '权威验证', actionType: 'VerifyCitation', title: '验证权威指标', description: '验证权威建设的效果', priority: 4 },
    { stageName: '权威维护', actionType: 'TrackMetrics', title: '维护权威地位', description: '持续追踪和维护品牌权威', priority: 5 },
  ],
  visibility: [
    { stageName: '可见性评估', actionType: 'AssessVisibility', title: '评估可见性水平', description: '评估品牌当前在搜索中的可见性', priority: 1 },
    { stageName: '关键词优化', actionType: 'OptimizeKeywords', title: '优化关键词覆盖', description: '优化品牌关联的关键词', priority: 2 },
    { stageName: '内容优化', actionType: 'GenerateFAQ', title: '优化可见性内容', description: '创建针对搜索可见性的优化内容', priority: 3 },
    { stageName: '技术优化', actionType: 'OptimizeTechnical', title: '技术优化', description: '执行技术层面的可见性优化', priority: 4 },
    { stageName: '效果追踪', actionType: 'TrackMetrics', title: '追踪可见性效果', description: '追踪可见性优化效果', priority: 5 },
  ],
}

export class TaskEngine {
  /**
   * Generate tasks for a workflow stage
   */
  async generateTasksForStage(
    strategy: StrategyData,
    workflow: WorkflowData,
    stage: WorkflowStageData,
  ): Promise<TaskData[]> {
    const templates = TASK_ACTION_TEMPLATES[strategy.type] || TASK_ACTION_TEMPLATES.content
    const matching = templates.filter(t => t.stageName === stage.name)

    if (matching.length === 0) {
      // Generate a generic task if no template matches
      return [{
        goalId: strategy.goalId,
        strategyId: strategy.id,
        workflowId: workflow.id,
        stageId: stage.id,
        title: `执行${stage.name}`,
        description: `执行策略 "${strategy.name}" 阶段 "${stage.name}" 的任务`,
        actionType: 'ExecuteGeneric',
        priority: stage.order,
        status: 'pending',
        metadata: JSON.stringify({
          generatedBy: 'task-engine',
          strategyType: strategy.type,
          stageName: stage.name,
          stageOrder: stage.order,
        }),
        schemaVersion: 1,
      }]
    }

    return matching.map((t, index) => ({
      goalId: strategy.goalId,
      strategyId: strategy.id,
      workflowId: workflow.id,
      stageId: stage.id,
      title: t.title,
      description: t.description,
      actionType: t.actionType,
      priority: t.priority,
      status: 'pending',
      dependencies: index > 0 ? JSON.stringify([]) : undefined, // Sequential within stage
      metadata: JSON.stringify({
        generatedBy: 'task-engine',
        strategyType: strategy.type,
        stageName: stage.name,
        templateIndex: index,
      }),
      schemaVersion: 1,
    }))
  }

  /**
   * Generate all tasks for all stages in a workflow
   */
  async generateTasksForWorkflow(
    strategy: StrategyData,
    workflow: WorkflowData,
    stages: WorkflowStageData[],
  ): Promise<TaskData[]> {
    const allTasks: TaskData[] = []

    for (const stage of stages) {
      const stageTasks = await this.generateTasksForStage(strategy, workflow, stage)
      allTasks.push(...stageTasks)
    }

    // Set cross-stage dependencies: last task of previous stage → first task of this stage
    let previousStageLastTaskIndex = -1
    for (let i = 0; i < stages.length; i++) {
      const stageTasks = allTasks.filter(t => t.stageId === stages[i].id)
      if (stageTasks.length === 0) continue

      if (previousStageLastTaskIndex >= 0) {
        // First task of this stage depends on last task of previous stage
        stageTasks[0].dependencies = JSON.stringify([allTasks[previousStageLastTaskIndex].id])
      }

      previousStageLastTaskIndex = allTasks.indexOf(stageTasks[stageTasks.length - 1])
    }

    return allTasks
  }

  /**
   * Get available action types for a strategy type
   */
  getAvailableActions(strategyType: string): string[] {
    const templates = TASK_ACTION_TEMPLATES[strategyType]
    if (!templates) return []
    return [...new Set(templates.map(t => t.actionType))]
  }
}

export const taskEngine = new TaskEngine()
