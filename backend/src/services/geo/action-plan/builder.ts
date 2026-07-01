// ============================================================
// ActionPlanBuilder — P0-T007 Action Plan Engine
// 将 Recommendation 转为可执行的 ActionPlan
// ============================================================

import crypto from 'crypto'
import { ActionPlan } from './types.js'

function generateId(): string {
  return crypto.randomUUID()
}

function estimateMinutes(difficulty: 'easy' | 'medium' | 'hard'): number {
  switch (difficulty) {
    case 'easy': return 15
    case 'medium': return 30
    case 'hard': return 60
    default: return 30
  }
}

function generateExplain(action: string, recommendation: any): string {
  // 如果 recommendation 有 reason，用它生成 explain
  if (recommendation.reason) {
    return `因为 ${recommendation.reason}`
  }
  // 基于 action 关键词生成 explain
  if (action.includes('官网') && !action.includes('结构化')) {
    return '因为官网是品牌 AI 可见度的核心基础，建议确保官网可访问并配置完整信息'
  }
  if (action.includes('结构化') || action.includes('Schema')) {
    return '因为官网未检测到 Schema 结构化数据标记，搜索引擎无法识别品牌信息'
  }
  if (action.includes('实体') || action.includes('知识图谱')) {
    return '因为知识库为空，未提取到品牌相关实体'
  }
  if (action.includes('Quick Discovery') || action.includes('运行分析')) {
    return '因为尚未运行分析，无法获取品牌基线数据'
  }
  if (action.includes('FAQ') || action.includes('描述')) {
    return '因为品牌描述不够详细，无法提供足够的品牌上下文'
  }
  if (action.includes('知识源') || action.includes('案例')) {
    return '因为品牌已具备基础可见度，可通过权威内容提升可信度'
  }
  if (action.includes('监控')) {
    return '因为品牌表现优秀，需持续监控防止评分衰减'
  }
  if (action.includes('About')) {
    return '因为品牌页面内容不够丰富，无法提供完整的品牌故事'
  }
  return '建议优先处理该项目以提升品牌 AI 可见度'
}

export class ActionPlanBuilder {
  /**
   * 从 Recommendations 构建 ActionPlan 列表
   * @param recommendations — 来自 explain API 的 recommendations 数组
   * @param projectId — 项目 ID
   */
  buildFromRecommendations(recommendations: any[], projectId: string): ActionPlan[] {
    const now = new Date().toISOString()
    const plans: ActionPlan[] = []

    // 用 Map 做去重：同一 title 的 recommendation 只生成一条 ActionPlan
    const seen = new Set<string>()

    for (const rec of recommendations) {
      const title = rec.action || rec.title || ''
      if (!title || seen.has(title)) continue
      seen.add(title)

      const priority: 'high' | 'medium' | 'low' = rec.priority || 'medium'
      const difficulty: 'easy' | 'medium' | 'hard' = rec.difficulty || 'medium'
      const estimatedMinutes = estimateMinutes(difficulty)
      const expectedImpact = rec.expectedImpact || `预计 +${rec.estimatedGain || 5} ADI`
      const estimatedGain = rec.estimatedGain || 30
      const explain = generateExplain(title, rec)

      const plan: ActionPlan = {
        id: generateId(),
        projectId,
        title,
        description: title,
        priority,
        difficulty,
        estimatedMinutes,
        expectedImpact,
        estimatedGain,
        status: 'todo',
        sourceEvidenceIds: [],
        recommendationId: rec.id || generateId(),
        explain,
        createdAt: now,
        updatedAt: now,
      }

      plans.push(plan)
    }

    // 如果 recommendation 为空，提供默认的 fallback plans
    if (plans.length === 0) {
      const fallbacks = [
        {
          action: '配置官网 URL 并确保可访问',
          priority: 'high' as const,
          difficulty: 'easy' as const,
          expectedImpact: '预计 +5~10',
          estimatedGain: 60,
          reason: '官网是品牌 AI 可见度的核心基础，未检测到官网信息',
        },
        {
          action: '在官网添加 Schema.org 结构化数据标记',
          priority: 'high' as const,
          difficulty: 'medium' as const,
          expectedImpact: '预计 +6~12',
          estimatedGain: 70,
          reason: '官网未检测到结构化数据标记，搜索引擎无法识别品牌信息',
        },
        {
          action: '运行 Quick Discovery 获取品牌基线评分',
          priority: 'high' as const,
          difficulty: 'easy' as const,
          expectedImpact: '预计 +0~2（获取基线）',
          estimatedGain: 30,
          reason: '尚未运行发现扫描，无法评估品牌可见度基线',
        },
      ]

      for (const fb of fallbacks) {
        const plan: ActionPlan = {
          id: generateId(),
          projectId,
          title: fb.action,
          description: fb.action,
          priority: fb.priority,
          difficulty: fb.difficulty,
          estimatedMinutes: estimateMinutes(fb.difficulty),
          expectedImpact: fb.expectedImpact,
          estimatedGain: fb.estimatedGain,
          status: 'todo',
          sourceEvidenceIds: [],
          recommendationId: generateId(),
          explain: `因为 ${fb.reason}`,
          createdAt: now,
          updatedAt: now,
        }
        plans.push(plan)
      }
    }

    return plans
  }
}
