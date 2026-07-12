/**
 * RecommendationRepository — SSOT for Recommendation data
 *
 * Sprint 4-1: Updated to use unified Intelligence API.
 *   GET /recommendation/intelligence?projectId=  → IntelligenceResponse
 *   POST /recommendation/simulate                 → { success, impact }
 *
 * Events emitted on flow:
 *   RECOMMENDATION:GENERATED — When refresh completes with recommendations
 *
 * Events consumed on flow:
 *   DISCOVERY:COMPLETED — Triggers auto-refresh for cross-page flow
 */

import { geoApi } from '../services/api'
import type { Repository, RepositoryState } from './base-repository'
import { createInitialState } from './base-repository'
import { eventBus } from './eventBus'
import type {
  IntelligenceResponse,
  TaskWithROI,
  RoadmapTier,
  TimelinePoint,
} from '../services/recommendationIntelligenceService'

export type { IntelligenceResponse, TaskWithROI, RoadmapTier, TimelinePoint }

export interface RecommendationItem {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact: { label: string; value: number }
  difficulty: 'easy' | 'medium' | 'complex'
  expectedScoreChange: { from: number; to: number }
  category: 'knowledge' | 'visibility' | 'website' | 'comprehensive'
  status: 'ready' | 'running' | 'success' | 'error'
}

export interface RecommendationsSummary {
  total: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
  totalExpectedGain: number
}

export interface RecommendationHistoryItem {
  id?: string
  title: string
  impact: number
  executedAt: string
  status: string
}

export interface RecommendationsData {
  summary: RecommendationsSummary
  recommendations: RecommendationItem[]
  history: RecommendationHistoryItem[]
  currentScore: number
  expectedScore: number
  // Intelligence API fields
  tasks: TaskWithROI[]
  roadmap: RoadmapTier[]
  timeline: TimelinePoint[]
  intelligenceSummary: string
}

let _instance: RecommendationRepository | null = null
const CACHE_TTL = 60_000 // 1 minute

export function getRecommendationRepository(): RecommendationRepository {
  if (!_instance) {
    _instance = new RecommendationRepository()
  }
  return _instance
}

export class RecommendationRepository implements Repository<RecommendationsData> {
  private state: RepositoryState<RecommendationsData> = createInitialState()
  private _projectId: string | null = null

  setProjectId(id: string): void {
    if (this._projectId !== id) {
      this._projectId = id
      this.invalidate()
    }
  }

  getProjectId(): string | null {
    return this._projectId
  }

  get(): RecommendationsData | null {
    return this.state.data
  }

  isLoading(): boolean {
    return this.state.loading
  }

  getError(): string | null {
    return this.state.error
  }

  invalidate(): void {
    this.state = createInitialState()
  }

  isFresh(): boolean {
    return !!(this.state.lastFetched && Date.now() - this.state.lastFetched < CACHE_TTL)
  }

  async refresh(): Promise<RecommendationsData> {
    if (!this._projectId) throw new Error('No project ID set')
    if (this.state.loading && this.state.data) return this.state.data

    this.state.loading = true
    this.state.error = null

    try {
      const pid = this._projectId

      // Call the unified intelligence API
      let intelligence: IntelligenceResponse | null = null
      try {
        const raw = await geoApi<{ success: boolean; data: IntelligenceResponse; error?: string }>(
          `recommendation/intelligence?projectId=${pid}`,
        )
        if (raw.success && raw.data) {
          intelligence = raw.data
        }
      } catch {
        // Fallback: intelligence API not available, use score endpoint
      }

      if (intelligence) {
        // Use intelligence API data
        const tasks = intelligence.tasks
        const recs: RecommendationItem[] = tasks.map((t, idx) => ({
          id: `task-${idx}`,
          title: t.title,
          description: t.description,
          priority: t.priority === 'HIGH' ? 'high' as const : t.priority === 'MEDIUM' ? 'medium' as const : 'low' as const,
          impact: { label: t.category, value: t.impact },
          difficulty: t.effort === 'EASY' ? 'easy' as const : t.effort === 'MEDIUM' ? 'medium' as const : 'complex' as const,
          expectedScoreChange: { from: intelligence.score.overall, to: Math.min(100, intelligence.score.overall + t.impact) },
          category: t.category === 'visibility' ? 'visibility' as const
            : t.category === 'knowledge' ? 'knowledge' as const
            : t.category === 'website' ? 'website' as const
            : 'comprehensive' as const,
          status: 'ready' as const,
        }))

        const data: RecommendationsData = {
          summary: {
            total: recs.length,
            highPriority: recs.filter(r => r.priority === 'high').length,
            mediumPriority: recs.filter(r => r.priority === 'medium').length,
            lowPriority: recs.filter(r => r.priority === 'low').length,
            totalExpectedGain: recs.reduce((s, r) => s + r.impact.value, 0),
          },
          recommendations: recs,
          history: [],
          currentScore: intelligence.score.overall,
          expectedScore: intelligence.score.overall + recs.reduce((s, r) => s + r.impact.value, 0),
          tasks: intelligence.tasks,
          roadmap: intelligence.roadmap.tiers,
          timeline: intelligence.timeline,
          intelligenceSummary: intelligence.summary,
        }

        this.state.data = data
        this.state.lastFetched = Date.now()
        this.state.loading = false

        // Emit event
        if (recs.length > 0) {
          eventBus.emit('RECOMMENDATION:GENERATED', {
            projectId: pid,
            entityId: pid,
            timestamp: new Date().toISOString(),
            source: 'RecommendationRepository',
            recommendationCount: recs.length,
            confidence: 0.85,
          })
        }

        return data
      }

      // Fallback: use score endpoint only
      const raw = await geoApi<{ success: boolean; data: any; error?: string }>(
        `recommendation/score?projectId=${pid}`,
      )
      const d = raw.data
      if (!d) throw new Error(raw.error || 'Failed to fetch recommendations')

      const currentScore = d.overall ?? 0
      const visibility = d.visibility ?? 0
      const authority = d.authority ?? 0
      const content = d.content ?? 0
      const website = d.website ?? 0
      const knowledge = d.knowledge ?? 0

      const recs: RecommendationItem[] = []
      const dimThreshold = 80
      const dims = [
        { id: 'visibility', title: '提升品牌可见度', description: '增加高质量外链和品牌提及，提高 AI 搜索结果中的可见度', priority: 'high' as const, category: 'visibility' as const, score: visibility },
        { id: 'authority', title: '提升品牌权威度', description: '获取权威引用和媒体背书，增强品牌在垂直领域的权威性', priority: 'high' as const, category: 'website' as const, score: authority },
        { id: 'content', title: '优化内容覆盖', description: '增加多格式内容发布（文章、FAQ、产品页），扩大知识覆盖面', priority: 'medium' as const, category: 'knowledge' as const, score: content },
        { id: 'website', title: '优化网站健康度', description: '完善网站结构、Schema 标记和移动端适配', priority: 'medium' as const, category: 'website' as const, score: website },
        { id: 'knowledge', title: '扩展知识覆盖', description: '在百科、问答平台建立品牌知识条目', priority: 'medium' as const, category: 'knowledge' as const, score: knowledge },
      ]

      for (const dim of dims) {
        if (dim.score < dimThreshold) {
          const gain = Math.round((dimThreshold - dim.score) * 0.3)
          recs.push({
            id: dim.id,
            title: dim.title,
            description: dim.description,
            priority: dim.priority,
            impact: { label: dim.id, value: gain },
            difficulty: dim.score < 40 ? 'complex' : dim.score < 60 ? 'medium' : 'easy',
            expectedScoreChange: { from: dim.score, to: Math.min(95, dim.score + gain * 2) },
            category: dim.category,
            status: 'ready',
          })
        }
      }

      const data: RecommendationsData = {
        summary: {
          total: recs.length,
          highPriority: recs.filter(r => r.priority === 'high').length,
          mediumPriority: recs.filter(r => r.priority === 'medium').length,
          lowPriority: recs.filter(r => r.priority === 'low').length,
          totalExpectedGain: recs.reduce((s, r) => s + r.impact.value, 0),
        },
        recommendations: recs,
        history: [],
        currentScore,
        expectedScore: currentScore + recs.reduce((s, r) => s + r.impact.value, 0),
        tasks: [],
        roadmap: [],
        timeline: [],
        intelligenceSummary: '',
      }

      this.state.data = data
      this.state.lastFetched = Date.now()
      this.state.loading = false

      return data
    } catch (err: any) {
      this.state.error = err?.message || 'Unknown error'
      this.state.loading = false
      throw err
    }
  }

  /** Convenience: fetch recommendations for a project */
  async getRecommendations(projectId: string): Promise<RecommendationsData> {
    this.setProjectId(projectId)
    if (this.isFresh() && this.state.data) return this.state.data
    return this.refresh()
  }

  /** Execute one or more recommendations */
  async execute(projectId: string, recommendationIds: string[]): Promise<{ success: boolean; impact: number }> {
    this.setProjectId(projectId)
    const raw = await geoApi<{ success: boolean; data: any }>(
      `recommendation/simulate`,
      { method: 'POST', body: { projectId, scenario: { recommendationIds } } },
    )
    return { success: raw.success ?? false, impact: raw.data?.projectedImpact ?? 0 }
  }
}

/**
 * Bind Discovery completed event → auto-refresh recommendations.
 * Call once during app setup (e.g. in a plugin or layout).
 */
export function bindDiscoveryToRecommendation(discoveryEventBus: { on: (event: string, handler: (p: any) => void) => () => void }): () => void {
  return discoveryEventBus.on('DISCOVERY:COMPLETED', async (payload: any) => {
    const projectId = payload?.projectId || payload?.entityId
    if (!projectId) return

    const repo = getRecommendationRepository()
    repo.invalidate()
    try {
      await repo.getRecommendations(projectId)

      // Auto-emit RECOMMENDATION:GENERATED
      if (typeof (discoveryEventBus as any).emit === 'function') {
        (discoveryEventBus as any).emit('RECOMMENDATION:GENERATED', {
          projectId,
          entityId: payload.entityId || projectId,
          timestamp: new Date().toISOString(),
          source: 'RecommendationRepository',
          recommendationCount: repo.get()?.summary?.total || 0,
          confidence: 0.8,
        })
      }
    } catch {
      // Silent
    }
  })
}
