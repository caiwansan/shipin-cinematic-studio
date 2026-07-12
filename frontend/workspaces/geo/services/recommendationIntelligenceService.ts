/**
 * Recommendation Intelligence Service — Unified API Integration
 *
 * GET /api/geo/recommendation/intelligence?projectId=&range=
 * Returns: { score, tasks, roadmap, timeline, summary }
 *
 * This service replaces the client-side recommendation generation
 * with a real backend intelligence API call.
 */
import { geoApi } from './api'

// ── Types from backend intelligence API ──

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

export interface RoadmapResponse {
  currentScore: number
  tiers: RoadmapTier[]
}

export interface TimelinePoint {
  date: string
  overall: number
  visibility?: number
  authority?: number
  content?: number
  website?: number
  knowledge?: number
}

export interface IntelligenceResponse {
  score: ScoreExplainability
  tasks: TaskWithROI[]
  roadmap: RoadmapResponse
  timeline: TimelinePoint[]
  summary: string
}

// ── API call ──

export async function fetchIntelligence(
  projectId: string,
  range: '7d' | '30d' | '90d' | '1y' = '7d',
): Promise<IntelligenceResponse> {
  const raw = await geoApi<{ success: boolean; data: IntelligenceResponse; error?: string }>(
    `recommendation/intelligence?projectId=${projectId}&range=${range}`,
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || 'Failed to fetch intelligence data')
  }
  return raw.data
}

export async function fetchRoadmap(projectId: string): Promise<RoadmapResponse> {
  const raw = await geoApi<{ success: boolean; data: RoadmapResponse; error?: string }>(
    `recommendation/roadmap?projectId=${projectId}`,
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || 'Failed to fetch roadmap')
  }
  return raw.data
}

export async function fetchTimeline(
  projectId: string,
  range: '7d' | '30d' | '90d' | '1y' = '7d',
): Promise<TimelinePoint[]> {
  const raw = await geoApi<{ success: boolean; data: TimelinePoint[]; error?: string }>(
    `recommendation/timeline?projectId=${projectId}&range=${range}`,
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || 'Failed to fetch timeline')
  }
  return raw.data
}

// ── Explain API ──

export interface ExplainData {
  type: string
  id: string
  summary: string
  evidence: Array<{
    label: string
    value: string
    source?: string
    confidence?: number
  }>
  timeline: Array<{
    date: string
    value: number
    label: string
  }>
  confidence: number
  origin: string
  metadata?: Record<string, unknown>
}

export async function fetchExplain(type: string, id: string): Promise<ExplainData> {
  const raw = await geoApi<{ success: boolean; data: ExplainData; error?: string }>(
    `explain/${type}/${id}`,
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || `Failed to fetch explain for ${type}/${id}`)
  }
  return raw.data
}

// ── Mission creation API ──

export interface CreateMissionResponse {
  id: string
  brandId: string
  title: string
  status: string
  createdAt: string
}

export async function createMissionFromRecommendation(
  projectId: string,
  title: string = '基于 Discovery 的品牌优化',
  taskTitles: string[] = [],
): Promise<CreateMissionResponse> {
  const raw = await geoApi<{ success: boolean; data: CreateMissionResponse; error?: string }>(
    'missions/center',
    {
      method: 'POST',
      body: {
        brandId: projectId,
        title,
        description: `基于 Discovery 扫描和优化建议创建的 Mission`,
        tasks: taskTitles,
        source: 'RecommendationsPage',
      },
    },
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || 'Failed to create mission')
  }
  // Navigate to mission center
  if (typeof window !== 'undefined') {
    window.location.href = '/workspace/geo/mission-center'
  }
  return raw.data
}
