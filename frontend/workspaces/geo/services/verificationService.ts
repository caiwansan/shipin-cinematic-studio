/**
 * GEO Verification Service — Real API Implementation
 *
 * GET /api/v1/geo/verification/{projectId}
 *
 * API Returns: { success, data: { summary, beforeAfter, evidence, aiVisibility, coverage, status, history } }
 * Mapped to: VerificationData (Product Language)
 */
import { geoApi } from './api'

export interface VerificationOutcome {
  outcome: 'verified' | 'pending' | 'failed'
  confidence: number
  proofLevel: 'evidenced' | 'needs-evidence'
  trustScore: number
}

export interface DimensionScores {
  overall: number
  dimensions: {
    visibility: number
    authority: number
    content: number
    website: number
    knowledge: number
  }
}

export interface BeforeAfterChanges {
  overall: number
  visibility: number
  authority: number
  content: number
  website: number
  knowledge: number
}

export interface BeforeAfter {
  before: DimensionScores & { overall: number }
  after: DimensionScores & { overall: number }
  changes: BeforeAfterChanges
}

export interface VerificationEvidence {
  total: number
  items: Array<{
    id: string
    title: string
    source: string
    status: string
    createdAt?: string
  }>
}

export interface AiVisibilityInfo {
  keywordCount: number
  entityCount: number
  claimCount: number
}

export interface VerificationCoverage {
  schemas: number
  faqs: number
  evidences: number
}

export interface VerificationHistoryItem {
  date: string
  score: number
}

export interface VerificationData {
  summary: VerificationOutcome
  beforeAfter: BeforeAfter
  evidence: VerificationEvidence
  aiVisibility: AiVisibilityInfo
  coverage: VerificationCoverage
  status: string
  history: VerificationHistoryItem[]
  // Derived for backward compatibility
  outcome: {
    beforeScore: number
    afterScore: number
    delta: number
  }
  confidence: Array<{
    item: string
    complete: boolean
  }>
  proof: Array<{
    name: string
    before: string | number
    after: string | number
    delta: number
    suffix?: string
    isUnavailable?: boolean
    learnContent?: string
  }>
  trust: {
    message: string
  }
}

export async function fetchVerification(projectId: string): Promise<VerificationData> {
  const raw = await geoApi<{ success: boolean; data: any }>(`verification/${projectId}`)
  const d = raw.data

  const beforeScore = d.beforeAfter?.before?.overall ?? 0
  const afterScore = d.beforeAfter?.after?.overall ?? 0

  // Build trust message
  const delta = afterScore - beforeScore
  let trustMessage = ''
  if (delta > 10) trustMessage = `Your brand improved significantly (+${delta} points). Great progress!`
  else if (delta > 0) trustMessage = `Your brand improved by ${delta} points. Keep going!`
  else if (delta === 0) trustMessage = 'No change detected. Try new recommendations.'
  else trustMessage = `Your brand decreased by ${Math.abs(delta)} points. Review recommendations.`

  // Build proof items from dimension changes
  const dimChanges = d.beforeAfter?.changes ?? {}
  const dims = ['visibility', 'authority', 'content', 'website', 'knowledge']
  const dimLabels: Record<string, string> = {
    visibility: 'AI Visibility',
    authority: 'Authority',
    content: 'Content Quality',
    website: 'Website Health',
    knowledge: 'Knowledge Coverage',
  }

  return {
    summary: {
      outcome: d.summary?.outcome ?? 'pending',
      confidence: d.summary?.confidence ?? 0,
      proofLevel: d.summary?.proofLevel ?? 'needs-evidence',
      trustScore: d.summary?.trustScore ?? 0,
    },
    beforeAfter: {
      before: {
        overall: d.beforeAfter?.before?.overall ?? 0,
        dimensions: d.beforeAfter?.before?.dimensions ?? { visibility: 0, authority: 0, content: 0, website: 0, knowledge: 0 },
      },
      after: {
        overall: d.beforeAfter?.after?.overall ?? 0,
        dimensions: d.beforeAfter?.after?.dimensions ?? { visibility: 0, authority: 0, content: 0, website: 0, knowledge: 0 },
      },
      changes: {
        overall: dimChanges?.overall ?? 0,
        visibility: dimChanges?.visibility ?? 0,
        authority: dimChanges?.authority ?? 0,
        content: dimChanges?.content ?? 0,
        website: dimChanges?.website ?? 0,
        knowledge: dimChanges?.knowledge ?? 0,
      },
    },
    evidence: d.evidence ?? { total: 0, items: [] },
    aiVisibility: d.aiVisibility ?? { keywordCount: 0, entityCount: 0, claimCount: 0 },
    coverage: d.coverage ?? { schemas: 0, faqs: 0, evidences: 0 },
    status: d.status ?? 'verified',
    history: d.history ?? [],
    // Derived for backward compatibility with existing store
    outcome: { beforeScore, afterScore, delta },
    confidence: dims.filter(dim => d.beforeAfter?.before?.dimensions?.[dim] !== undefined).map(dim => ({
      item: dimLabels[dim] ?? dim,
      complete: (dimChanges?.[dim] ?? 0) > 0 || afterScore > 0,
    })),
    proof: dims.filter(dim => d.beforeAfter?.before?.dimensions?.[dim] !== undefined).map(dim => ({
      name: dimLabels[dim] ?? dim,
      before: d.beforeAfter?.before?.dimensions?.[dim] ?? 0,
      after: d.beforeAfter?.after?.dimensions?.[dim] ?? 0,
      delta: dimChanges?.[dim] ?? 0,
      suffix: '/100',
      isUnavailable: false,
      learnContent: dimChanges?.[dim] > 0 ? `+${dimChanges[dim]} improvement in ${dimLabels[dim] ?? dim}` : undefined,
    })),
    trust: { message: trustMessage },
  }
}
