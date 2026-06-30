// ============================================================
// Recommendation Service v2 — GEO Intelligence
// Calls backend recommendation endpoints (v1 + v2)
// ============================================================

import { client } from '../clients/GEOApiClient'

// ── v1 Types (backward compatible) ──

export interface ScoreData {
  overall: number
  visibility: number
  authority: number
  content: number
  website: number
  knowledge: number
}

export interface TaskData {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  title: string
  description: string
  impact: number
  actionUrl?: string
  reason?: string          // v2: WHY this task exists
  impactPercentile?: string // v2: e.g. "+6~12%"
  effort?: 'EASY' | 'MEDIUM' | 'HARD'
  prerequisites?: string[]
}

export interface ReportData {
  score: ScoreData
  tasks: TaskData[]
  summary: string
  recommendations: string[]
  roadmap?: RoadmapData
  timeline?: TimelinePoint[]
}

// ── v2 Types ──

export interface ScoreDetailItem {
  label: string
  status: 'good' | 'neutral' | 'bad'
  reason: string
  points: number
  maxPoints: number
}

export interface ScoreDimension {
  score: number
  details: ScoreDetailItem[]
}

export interface ScoreExplainability {
  overall: number
  breakdown: {
    visibility: ScoreDimension
    authority: ScoreDimension
    content: ScoreDimension
    website: ScoreDimension
    knowledge: ScoreDimension
  }
}

export interface TaskWithROI {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  title: string
  description: string
  reason: string
  impact: number
  impactPercentile: string
  effort: 'EASY' | 'MEDIUM' | 'HARD'
  prerequisites: string[]
}

export interface RoadmapTier {
  label: string
  targetScore: number
  tasks: TaskWithROI[]
}

export interface RoadmapData {
  currentScore: number
  tiers: RoadmapTier[]
}

export interface TimelinePoint {
  date: string
  score: number
}

export interface IntelligenceData {
  score: ScoreExplainability
  tasks: TaskWithROI[]
  roadmap: RoadmapData
  timeline: TimelinePoint[]
  summary: string
}

export const recommendationService = {
  // ── v1 Endpoints ──

  /**
   * Get AI recommendation score (simple numeric output)
   */
  getScore(projectId: string): Promise<{ success: boolean; data?: ScoreData }> {
    return client.get<ScoreData>(`/recommendation/score?projectId=${projectId}`)
  },

  /**
   * Get optimization tasks
   */
  getTasks(projectId: string): Promise<{ success: boolean; data?: TaskData[] }> {
    return client.get<TaskData[]>(`/recommendation/tasks?projectId=${projectId}`)
  },

  /**
   * Get full optimization report
   */
  getReport(projectId: string): Promise<{ success: boolean; data?: ReportData }> {
    return client.get<ReportData>(`/recommendation/report?projectId=${projectId}`)
  },

  // ── v2 Endpoints ──

  /**
   * Get score explainability with per-dimension breakdown
   */
  explain(projectId: string): Promise<{ success: boolean; data?: ScoreExplainability }> {
    return client.get<ScoreExplainability>(`/recommendation/explain?projectId=${projectId}`)
  },

  /**
   * Get optimization roadmap
   */
  roadmap(projectId: string): Promise<{ success: boolean; data?: RoadmapData }> {
    return client.get<RoadmapData>(`/recommendation/roadmap?projectId=${projectId}`)
  },

  /**
   * Get score timeline
   */
  timeline(projectId: string, range: '7d' | '30d' | '90d' | '1y' = '7d'): Promise<{ success: boolean; data?: TimelinePoint[] }> {
    return client.get<TimelinePoint[]>(`/recommendation/timeline?projectId=${projectId}&range=${range}`)
  },

  /**
   * Get unified intelligence (score + tasks + roadmap + timeline + summary)
   */
  intelligence(projectId: string, range: '7d' | '30d' | '90d' | '1y' = '7d'): Promise<{ success: boolean; data?: IntelligenceData }> {
    return client.get<IntelligenceData>(`/recommendation/intelligence?projectId=${projectId}&range=${range}`)
  },
}
