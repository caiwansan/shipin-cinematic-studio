// ============================================================
// Recommendation Intelligence Service — Unified API
// Returns everything: score explainability, tasks, roadmap, timeline, summary
// ============================================================

import { calculateScore, ScoreExplainability } from './recommendation-score.service.js'
import { generateTasks, TaskWithROI } from './optimization-task.service.js'
import { generateRoadmap, RoadmapResponse } from './optimization-roadmap.service.js'
import { getTimeline, TimelinePoint } from './recommendation-timeline.service.js'

export interface IntelligenceResponse {
  score: ScoreExplainability
  tasks: TaskWithROI[]
  roadmap: RoadmapResponse
  timeline: TimelinePoint[]
  summary: string
}

export async function getIntelligence(
  projectId: string,
  timelineRange: '7d' | '30d' | '90d' | '1y' = '7d'
): Promise<IntelligenceResponse> {
  const [score, tasks, roadmap, timeline] = await Promise.all([
    calculateScore(projectId),
    generateTasks(projectId),
    generateRoadmap(projectId),
    getTimeline(projectId, timelineRange),
  ])

  const summary = generateSummary(score, tasks)

  return { score, tasks, roadmap, timeline, summary }
}

function generateSummary(score: ScoreExplainability, tasks: TaskWithROI[]): string {
  const s = score.overall
  const highCount = tasks.filter(t => t.priority === 'HIGH').length
  const topTask = tasks[0]

  let level: string
  if (s >= 80) level = '优秀'
  else if (s >= 60) level = '良好'
  else if (s >= 40) level = '一般'
  else level = '较低'

  let summary = `当前 AI 推荐指数 ${s}/100，综合评分${level}。`
  summary += ` 五大维度中，`
  summary += `可见度 ${score.breakdown.visibility.score}分、`
  summary += `权威性 ${score.breakdown.authority.score}分、`
  summary += `内容 ${score.breakdown.content.score}分、`
  summary += `网站 ${score.breakdown.website.score}分、`
  summary += `知识 ${score.breakdown.knowledge.score}分。`

  if (highCount > 0) {
    summary += ` 建议优先完成 ${highCount} 项高优先级任务`
    if (topTask) summary += `，首推「${topTask.title}」(预计提升 +${topTask.impact} 分)`
    summary += '。'
  }

  if (score.overall < 60) {
    summary += ' 完成今天推荐的全部任务，评分可显著提升至 ' + Math.min(100, score.overall + 30) + ' 分以上。'
  } else if (score.overall >= 80) {
    summary += ' 继续保持，定期更新官网扫描和知识条目以维持高分。'
  }

  return summary
}
