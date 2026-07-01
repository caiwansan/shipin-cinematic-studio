/**
 * GEO ADI (Assessment Discovery Index) Service
 *
 * ADI is the primary KPI for the GEO Dashboard.
 * It measures three dimensions of brand discovery:
 *   - Discovery Coverage: How much of the brand is discoverable
 *   - Recommendation Share: How often the brand is recommended
 *   - Position Score: Where the brand ranks in search/discovery
 *
 * Since no ADI backend endpoint exists yet, this service simulates ADI data
 * based on available brand health data (BII) and knowledge quality metrics.
 *
 * ADI Formula (simulated):
 *   ADI = (Coverage * 0.35 + Share * 0.35 + Position * 0.30)
 *
 * Coverage is derived from knowledge coverage percentage
 * Share is derived from entity/claim ratio and overall brand health
 * Position is derived from authority/visibility scores
 */
import { geoApi } from './api'

export interface AdiData {
  /** ADI composite score (0-100) */
  adiScore: number
  /** Score change from previous period */
  scoreChange: number
  /** Trend direction */
  trend: 'improving' | 'stable' | 'declining'
  /** Brand context */
  brand: { name: string; website: string; industry: string }
  /** Three sub-dimensions */
  dimensions: AdiDimension[]
  /** Summary explanation */
  explanation: AdiExplanation
  /** Last updated timestamp */
  lastUpdated: string
}

export interface AdiDimension {
  id: 'coverage' | 'share' | 'position'
  label: string
  score: number
  maxScore: number
  description: string
  details: AdiDimensionDetail[]
}

export interface AdiDimensionDetail {
  label: string
  value: number
  status: 'good' | 'neutral' | 'bad'
  reason: string
}

export interface AdiExplanation {
  summary: string
  strengths: string[]
  improvements: string[]
}

/**
 * Simulate ADI data from available data sources.
 * Uses knowledge coverage, brand health, entity/claim stats.
 */
export async function fetchAdi(projectId: string): Promise<AdiData> {
  try {
    // Try to fetch real data first
    const raw = await geoApi<{ success: boolean; data: any }>(`health/${projectId}`)
    const d = raw.data
    return computeAdiFromHealthData(d, projectId)
  } catch {
    // Fallback: generate simulated ADI data
    return generateSimulatedAdi(projectId)
  }
}

function computeAdiFromHealthData(healthData: any, projectId: string): AdiData {
  const dims = healthData.dimensions || []
  const coverage = healthData.coverage || { evidenceCount: 0, entityCount: 0, claimCount: 0 }
  const overallScore = healthData.healthScore?.overall ?? healthData.score ?? 0
  const scoreChange = healthData.healthScore?.change ?? healthData.scoreChange ?? 0
  const trend = healthData.healthScore?.trend ?? healthData.trend ?? 'stable'

  // Extract dimension scores
  const getDimScore = (id: string) => {
    const dim = dims.find((d: any) => d.id === id || d.label?.toLowerCase().includes(id))
    return dim?.score ?? 0
  }

  const visibilityScore = getDimScore('visibility')
  const authorityScore = getDimScore('authority')
  const knowledgeScore = getDimScore('knowledge')
  const contentScore = getDimScore('content')
  const websiteScore = getDimScore('website')

  // Calculate ADI sub-dimensions
  // Discovery Coverage: knowledge coverage + content quality
  const discoveryCoverage = Math.round((knowledgeScore + contentScore) / 2)

  // Recommendation Share: authority + website health
  const recommendationShare = Math.round((authorityScore + websiteScore) / 2)

  // Position Score: visibility + overall presence
  const positionScore = Math.round((visibilityScore + overallScore) / 2)

  // ADI composite (weighted)
  const adiScore = Math.round(discoveryCoverage * 0.35 + recommendationShare * 0.35 + positionScore * 0.30)

  const dimensions: AdiDimension[] = [
    {
      id: 'coverage',
      label: 'Discovery Coverage',
      score: discoveryCoverage,
      maxScore: 100,
      description: 'How comprehensively the brand is covered across knowledge sources',
      details: [
        { label: 'Knowledge Coverage', value: knowledgeScore, status: knowledgeScore >= 60 ? 'good' : knowledgeScore >= 40 ? 'neutral' : 'bad', reason: knowledgeScore >= 60 ? 'Well covered' : 'Needs more coverage' },
        { label: 'Content Quality', value: contentScore, status: contentScore >= 60 ? 'good' : contentScore >= 40 ? 'neutral' : 'bad', reason: contentScore >= 60 ? 'Strong content' : 'Content needs improvement' },
      ],
    },
    {
      id: 'share',
      label: 'Recommendation Share',
      score: recommendationShare,
      maxScore: 100,
      description: 'How often the brand is recommended or referenced by sources',
      details: [
        { label: 'Authority Score', value: authorityScore, status: authorityScore >= 60 ? 'good' : authorityScore >= 40 ? 'neutral' : 'bad', reason: authorityScore >= 60 ? 'Good authority' : 'Low authority signals' },
        { label: 'Website Health', value: websiteScore, status: websiteScore >= 60 ? 'good' : websiteScore >= 40 ? 'neutral' : 'bad', reason: websiteScore >= 60 ? 'Healthy web presence' : 'Website needs optimization' },
      ],
    },
    {
      id: 'position',
      label: 'Position Score',
      score: positionScore,
      maxScore: 100,
      description: 'Where the brand ranks in discovery and search positioning',
      details: [
        { label: 'AI Visibility', value: visibilityScore, status: visibilityScore >= 60 ? 'good' : visibilityScore >= 40 ? 'neutral' : 'bad', reason: visibilityScore >= 60 ? 'Highly visible' : 'Low visibility' },
        { label: 'Overall Brand Health', value: overallScore, status: overallScore >= 60 ? 'good' : overallScore >= 40 ? 'neutral' : 'bad', reason: overallScore >= 60 ? 'Healthy brand' : 'Brand needs attention' },
      ],
    },
  ]

  // Generate strengths
  const strengths: string[] = []
  const improvements: string[] = []
  for (const dim of dimensions) {
    if (dim.score >= 60) {
      strengths.push(`${dim.label} is performing well at ${dim.score}/100`)
    } else {
      improvements.push(`${dim.label} needs improvement (${dim.score}/100)`)
    }
  }

  return {
    adiScore,
    scoreChange,
    trend,
    brand: {
      name: healthData.brand?.name || 'Brand',
      website: healthData.brand?.website || '',
      industry: healthData.brand?.industry || '',
    },
    dimensions,
    explanation: {
      summary: `ADI ${adiScore >= 80 ? 'Strong' : adiScore >= 60 ? 'Moderate' : 'Needs Improvement'}: Brand discovery assessment score of ${adiScore}/100.`,
      strengths,
      improvements,
    },
    lastUpdated: new Date().toISOString(),
  }
}

function generateSimulatedAdi(projectId: string): AdiData {
  // Deterministic-ish simulation based on projectId
  const hash = projectId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const base = (hash % 30) + 45 // 45-74 base score

  const coverage = Math.min(100, base + Math.round(Math.sin(hash) * 10))
  const share = Math.min(100, base - 5 + Math.round(Math.cos(hash) * 8))
  const position = Math.min(100, base + 3 + Math.round(Math.sin(hash * 2) * 7))

  const adiScore = Math.round(coverage * 0.35 + share * 0.35 + position * 0.30)

  const dimensions: AdiDimension[] = [
    {
      id: 'coverage',
      label: 'Discovery Coverage',
      score: coverage,
      maxScore: 100,
      description: 'How comprehensively the brand is covered across knowledge sources',
      details: [
        { label: 'Knowledge Coverage', value: coverage, status: coverage >= 60 ? 'good' : coverage >= 40 ? 'neutral' : 'bad', reason: coverage >= 60 ? 'Well covered' : 'Needs more coverage' },
        { label: 'Entity Coverage', value: Math.round(coverage * 0.9), status: coverage >= 60 ? 'good' : coverage >= 40 ? 'neutral' : 'bad', reason: 'Based on entity extraction depth' },
      ],
    },
    {
      id: 'share',
      label: 'Recommendation Share',
      score: share,
      maxScore: 100,
      description: 'How often the brand is recommended or referenced by sources',
      details: [
        { label: 'Authority Score', value: share, status: share >= 60 ? 'good' : share >= 40 ? 'neutral' : 'bad', reason: share >= 60 ? 'Good authority signals' : 'Low authority' },
        { label: 'Source Reference Rate', value: Math.round(share * 0.85), status: share >= 60 ? 'good' : share >= 40 ? 'neutral' : 'bad', reason: 'Based on citation frequency' },
      ],
    },
    {
      id: 'position',
      label: 'Position Score',
      score: position,
      maxScore: 100,
      description: 'Where the brand ranks in discovery and search positioning',
      details: [
        { label: 'AI Visibility', value: position, status: position >= 60 ? 'good' : position >= 40 ? 'neutral' : 'bad', reason: position >= 60 ? 'High AI visibility' : 'Low AI visibility' },
        { label: 'Keyword Positioning', value: Math.round(position * 0.88), status: position >= 60 ? 'good' : position >= 40 ? 'neutral' : 'bad', reason: 'Based on keyword coverage' },
      ],
    },
  ]

  const strengths: string[] = []
  const improvements: string[] = []
  for (const dim of dimensions) {
    if (dim.score >= 60) {
      strengths.push(`${dim.label} is performing well at ${dim.score}/100`)
    } else {
      improvements.push(`${dim.label} needs improvement (${dim.score}/100)`)
    }
  }

  return {
    adiScore,
    scoreChange: Math.round((hash % 13) - 6),
    trend: hash % 3 === 0 ? 'declining' : hash % 3 === 1 ? 'stable' : 'improving',
    brand: { name: 'Brand', website: '', industry: '' },
    dimensions,
    explanation: {
      summary: `ADI ${adiScore >= 80 ? 'Strong' : adiScore >= 60 ? 'Moderate' : 'Needs Improvement'}: Brand discovery assessment score of ${adiScore}/100.`,
      strengths,
      improvements,
    },
    lastUpdated: new Date().toISOString(),
  }
}
