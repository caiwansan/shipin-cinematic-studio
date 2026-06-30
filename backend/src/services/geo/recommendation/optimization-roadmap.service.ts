// ============================================================
// Optimization Roadmap Service — Tiers: Today → This Week → All
// ============================================================

import { calculateScore } from './recommendation-score.service.js'
import { generateTasks, TaskWithROI } from './optimization-task.service.js'

export interface RoadmapTier {
  label: string        // "今天任务" | "本周任务" | "全部任务"
  targetScore: number
  tasks: TaskWithROI[]
}

export interface RoadmapResponse {
  currentScore: number
  tiers: RoadmapTier[]
}

export async function generateRoadmap(projectId: string): Promise<RoadmapResponse> {
  const score = await calculateScore(projectId)
  const allTasks = await generateTasks(projectId)

  const highTasks = allTasks.filter(t => t.priority === 'HIGH')
  const mediumTasks = allTasks.filter(t => t.priority === 'MEDIUM')

  // Calculate estimated score impact per tier
  const highImpact = highTasks.reduce((s, t) => s + t.impact, 0)
  const mediumImpact = mediumTasks.reduce((s, t) => s + t.impact, 0)

  const tiers: RoadmapTier[] = [
    {
      label: '今天任务',
      targetScore: Math.min(100, score.overall + Math.round(highImpact * 0.7)),
      tasks: highTasks,
    },
    {
      label: '本周任务',
      targetScore: Math.min(100, score.overall + Math.round((highImpact + mediumImpact) * 0.6)),
      tasks: [...highTasks, ...mediumTasks],
    },
    {
      label: '全部任务',
      targetScore: Math.min(100, score.overall + Math.round(allTasks.reduce((s, t) => s + t.impact, 0) * 0.5)),
      tasks: allTasks,
    },
  ]

  return {
    currentScore: score.overall,
    tiers,
  }
}
