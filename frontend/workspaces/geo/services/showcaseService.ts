/**
 * GEO Showcase Service — AI Visibility Showcase Data
 *
 * Endpoints:
 *   GET /api/v1/geo/showcase — Showcase aggregated data
 */
import { ofetch } from 'ofetch'

const API_BASE = '/api/v1/geo'

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = window.localStorage?.getItem('auth_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const showcaseApi = ofetch.create({
  baseURL: API_BASE,
  onRequest({ options }) {
    const headers = getAuthHeaders()
    if (headers.Authorization) {
      options.headers = { ...options.headers, ...headers }
    }
  },
})

// ── Types ──

export interface ShowcaseProvider {
  name: string
  displayName: string
  status: 'supported' | 'in-progress' | 'coming-soon'
  group: 'international' | 'china'
}

export interface ShowcaseStory {
  industry: string
  duration: string
  adiImprovement: number
  visibilityImprovement: number
  recommendationIncrease: number
  knowledgeCoverageIncrease: number
}

export interface ShowcaseTrending {
  topic: string
  mentions: number
  trend: 'up' | 'stable' | 'down'
}

export interface ShowcaseInsight {
  title: string
  description: string
  link: string
}

export interface ShowcaseResponse {
  overview: {
    brandsMonitored: number
    activeProjects: number
    verifiedCitations: number
    recommendationAppearances: number
    knowledgeAssetsManaged: number
    verificationReportsCompleted: number
  }
  providers: ShowcaseProvider[]
  stories: ShowcaseStory[]
  trending: ShowcaseTrending[]
  insights: ShowcaseInsight[]
}

export async function getShowcaseData(): Promise<ShowcaseResponse> {
  const res = await showcaseApi<{ success: boolean; data: ShowcaseResponse }>('/showcase')
  return res.data
}
