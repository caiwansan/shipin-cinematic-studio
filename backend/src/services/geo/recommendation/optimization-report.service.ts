// ============================================================
// Optimization Report Service — Generate summary report
// Updated for v2 intelligence format
// ============================================================

import { calculateScore, ScoreExplainability } from './recommendation-score.service.js'
import { generateTasks, TaskWithROI } from './optimization-task.service.js'
import { generateRoadmap } from './optimization-roadmap.service.js'
import { getTimeline } from './recommendation-timeline.service.js'
import { getIntelligence } from './recommendation-intelligence.service.js'

export interface OptimizationReport {
  score: ScoreExplainability
  tasks: TaskWithROI[]
  summary: string
  recommendations: string[]
  roadmap?: any
  timeline?: any
}

export async function generateReport(projectId: string): Promise<OptimizationReport> {
  // Use the unified intelligence for consistency
  const intelligence = await getIntelligence(projectId)

  const recommendations: string[] = []
  const s = intelligence.score.overall
  if (s < 30) {
    recommendations.push('请先从基础品牌信息入手，完善品牌名称、官网和描述')
  } else if (s < 60) {
    recommendations.push('继续补充知识条目和品牌信息，提升 AI 可见度和权威性')
  } else if (s < 80) {
    recommendations.push('已经具备良好基础，建议开始积累事实证据和引用来源')
  } else {
    recommendations.push('AI 推荐指数优秀，持续维护即可保持高分')
  }

  if (intelligence.score.breakdown.visibility.score < intelligence.score.breakdown.authority.score) {
    recommendations.push('可见度低于权威性，建议优先提升品牌基础信息')
  }
  if (intelligence.score.breakdown.knowledge.score < intelligence.score.breakdown.content.score) {
    recommendations.push('知识条目数量有待提升，补充更多产品/品牌知识')
  }

  return {
    score: intelligence.score,
    tasks: intelligence.tasks,
    summary: intelligence.summary,
    recommendations,
    roadmap: intelligence.roadmap,
    timeline: intelligence.timeline,
  }
}
