// ── Decision Intelligence Service ──
// ★ Fix: uses geoApi (authenticated) instead of raw fetch (no auth)
// A1.1 — FROZEN

import { geoApi } from './api'
import type { Issue, IssueEdge, IssueGraph } from './types'

export interface GraphSummary {
  total: number
  critical: number
  major: number
  minor: number
  rootCauseCount: number
  longestChain: number
  severityDistribution: Record<string, number>
}

// Re-export for component use
export type { Issue, IssueEdge, IssueGraph }

/**
 * Fetch or generate the issue graph for a brand.
 */
export async function fetchIssueGraph(brandId: string): Promise<IssueGraph> {
  const res = await geoApi.post<{ success: boolean; data: IssueGraph }>('/recommendation/issues', { brandId })
  if (!res.data.success) throw new Error((res.data as any).error || 'Unknown error')
  return res.data.data
}

/**
 * Get cached issue graph for a brand.
 */
export async function getCachedIssueGraph(brandId: string): Promise<IssueGraph | null> {
  try {
    const res = await geoApi.get<{ success: boolean; data: IssueGraph }>(`/recommendation/issues/${encodeURIComponent(brandId)}`)
    if (!res.data.success) return null
    return res.data.data
  } catch {
    return null
  }
}

/**
 * Get dependencies for a specific issue.
 */
export async function getIssueDependencies(
  brandId: string,
  issueId: string
): Promise<IssueEdge[]> {
  const res = await geoApi.get<{ success: boolean; data: IssueEdge[] }>(
    `/recommendation/issues/${encodeURIComponent(brandId)}/${encodeURIComponent(issueId)}/dependencies`
  )
  if (!res.data.success) throw new Error((res.data as any).error || 'Unknown error')
  return res.data.data
}
