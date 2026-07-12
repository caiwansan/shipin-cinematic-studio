/**
 * KnowledgeBrowserVM — Browser-specific ViewModel
 *
 * Encapsulates all filtering, sorting, and counting logic for the
 * Knowledge Browser card grid. Does NOT call any APIs.
 *
 * IMPORTANT: Score/Status/Insight computation is now done server-side
 * by the Knowledge Intelligence Engine. This VM only passes data through.
 */

import type { useKnowledgeStore } from '../stores/useKnowledgeStore'

// ── Insight types matching the backend Knowledge Intelligence Engine ──

export interface KnowledgeObjectInsight {
  version: '1.0'
  assessment: {
    coverage: {
      score: number
      label: string
      reason: string
    }
    freshness: {
      score: number
      label: string
      reason: string
    }
    authority: {
      score: number
      label: string
      reason: string
    }
    consistency: {
      score: number
      label: string
      reason: string
    }
  }
  quality: {
    score: number
    label: 'A' | 'B' | 'C'
    reason: string
  }
  recommendation: {
    priority: 'High' | 'Medium' | 'Low'
    expectedBenefit: string
    estimatedImpact: string
    reason: string
  }
  evidence: Array<{
    type: string
    source: string
    value: number | string
    confidence: number
  }>
}

export interface KnowledgeObjectVM {
  id: string
  content: string
  category: string
  status: 'verified' | 'pending' | 'outdated'
  insight: KnowledgeObjectInsight
}

export interface KnowledgeBrowserVM {
  allObjects: KnowledgeObjectVM[]
  visibleObjects: KnowledgeObjectVM[]
  counts: {
    total: number
    verified: number
    needsReview: number
    draft: number
    published: number
  }
  searchQuery: string
  activeFilter: string
  activeSort: string
  summary: string
}

// ── Quality helpers (derive from insight, not from content heuristics) ──

function computeQuality(obj: KnowledgeObjectVM): 'A' | 'B' | 'C' {
  return obj.insight?.quality?.label ?? 'C'
}

function reviewLabel(status: string): string {
  if (status === 'verified') return 'Reviewed'
  if (status === 'pending') return 'Needs Review'
  return 'Stale'
}

function aiReadiness(obj: KnowledgeObjectVM): string {
  // AI Readiness is derived from quality — 'Ready' if A or B, 'Needs Improvement' if C
  const label = obj.insight?.quality?.label ?? 'C'
  return label === 'A' || label === 'B' ? 'Ready' : 'Needs Improvement'
}

function nextAction(obj: KnowledgeObjectVM): string {
  // Next action from the recommendation engine
  return obj.insight?.recommendation?.expectedBenefit ?? 'Review content'
}

// ── Filtering & Sorting ──────────────────────────────────────────

function applyFilter(
  objects: KnowledgeObjectVM[],
  filter: string,
): KnowledgeObjectVM[] {
  switch (filter) {
    case 'verified':
      return objects.filter(o => o.status === 'verified')
    case 'needs-review':
      return objects.filter(o => o.status === 'pending')
    case 'draft':
      return objects.filter(o => o.status === 'outdated')
    case 'published':
      return objects.filter(o => o.status === 'verified')
    case 'all':
    default:
      return objects
  }
}

function applySort(
  objects: KnowledgeObjectVM[],
  sort: string,
): KnowledgeObjectVM[] {
  const sorted = [...objects]
  switch (sort) {
    case 'recent':
      sorted.sort((a, b) => b.content.length - a.content.length)
      break
    case 'quality':
      sorted.sort((a, b) => {
        const qa = computeQuality(a)
        const qb = computeQuality(b)
        const order = { A: 0, B: 1, C: 2 } as const
        return (order[qa] ?? 0) - (order[qb] ?? 0)
      })
      break
    case 'alpha':
      sorted.sort((a, b) => a.content.localeCompare(b.content))
      break
    case 'complete':
      sorted.sort((a, b) => b.content.length - a.content.length)
      break
    default:
      break
  }
  return sorted
}

function computeCounts(objects: KnowledgeObjectVM[]) {
  return {
    total: objects.length,
    verified: objects.filter(o => o.status === 'verified').length,
    needsReview: objects.filter(o => o.status === 'pending').length,
    draft: objects.filter(o => o.status === 'outdated').length,
    published: objects.filter(o => o.status === 'verified').length,
  }
}

export function buildBrowserVM(
  store: ReturnType<typeof useKnowledgeStore>,
  filter: string,
  sort: string,
): KnowledgeBrowserVM {
  const allStatements = store.filteredStatements
  const allObjects: KnowledgeObjectVM[] = allStatements.map(s => {
    // Build a minimal insight when the API hasn't provided one yet
    // (statements come from the dashboard /list endpoint which may not have insight)
    const insight: KnowledgeObjectInsight = (s as any).insight ?? {
      version: '1.0',
      assessment: {
        coverage: { score: 0, label: 'C', reason: 'No data' },
        freshness: { score: 0, label: 'C', reason: 'No data' },
        authority: { score: 0, label: 'C', reason: 'No data' },
        consistency: { score: 0, label: 'C', reason: 'No data' },
      },
      quality: { score: 0, label: 'C', reason: 'No insight available' },
      recommendation: {
        priority: 'Low',
        expectedBenefit: 'Review content',
        estimatedImpact: '+0%',
        reason: 'Insufficient data for recommendation',
      },
      evidence: [],
    }

    const obj: KnowledgeObjectVM = {
      id: s.id,
      content: s.content,
      category: s.category,
      status: s.status as 'verified' | 'pending' | 'outdated',
      insight,
    }
    return obj
  })

  const searchQuery = store.searchQuery

  // Apply search inside VM (additional filtering on top of store's search)
  let working = allObjects
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    working = working.filter(o => o.content.toLowerCase().includes(q))
  }

  const filtered = applyFilter(working, filter)
  const visibleObjects = applySort(filtered, sort)
  const counts = computeCounts(allObjects)

  const summary = `Showing ${visibleObjects.length} / ${allObjects.length} · Verified ${counts.verified} · Draft ${counts.draft} · Published ${counts.published}`

  return {
    allObjects,
    visibleObjects,
    counts,
    searchQuery,
    activeFilter: filter,
    activeSort: sort,
    summary,
  }
}

export { computeQuality, reviewLabel, aiReadiness, nextAction }
