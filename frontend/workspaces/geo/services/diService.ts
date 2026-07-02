// ── Decision Intelligence Service ──
// API client for A1.1 Issue Graph endpoints

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

function baseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.API_BASE || 'https://aigc.fushtn.com'
}

/**
 * Fetch or generate the issue graph for a brand.
 * POST to generate (fresh), GET returns cached.
 */
export async function fetchIssueGraph(brandId: string): Promise<IssueGraph> {
  const res = await fetch(`${baseUrl()}/api/geo/recommendation/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to generate issue graph: ${res.status} ${text.slice(0, 100)}`)
  }
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Unknown error')
  return json.data
}

/**
 * Get cached issue graph for a brand.
 */
export async function getCachedIssueGraph(brandId: string): Promise<IssueGraph | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/geo/recommendation/issues/${encodeURIComponent(brandId)}`)
    if (!res.ok) return null
    const json = await res.json()
    if (!json.success) return null
    return json.data
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
  const res = await fetch(
    `${baseUrl()}/api/geo/recommendation/issues/${encodeURIComponent(brandId)}/${encodeURIComponent(issueId)}/dependencies`
  )
  if (!res.ok) throw new Error(`Failed to get dependencies: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Unknown error')
  return json.data
}
