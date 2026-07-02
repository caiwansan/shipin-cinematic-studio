// ── Decision Intelligence — Shared Types ──

export type IssueKind = 'schema' | 'content' | 'authority' | 'technical' | 'unknown'
export type IssueStatus = 'detected' | 'accepted' | 'in_progress' | 'resolved' | 'ignored'
export type DependencyRelationship = 'causes' | 'blocks' | 'duplicates' | 'related' | 'depends_on'

export interface Issue {
  id: string
  kind: IssueKind
  title: string
  description: string
  severity: number
  confidence: number
  status: IssueStatus
  source: string
  category: string
  rootCause: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface IssueEdge {
  from: string
  to: string
  relationship: DependencyRelationship
}

export interface IssueGraph {
  id: string
  brandId: string
  generatedAt: string
  nodes: Issue[]
  edges: IssueEdge[]
  rootCauses: string[]
  strategy: string
  summary: GraphSummary
  cachePolicy: CachePolicy
}

export interface GraphSummary {
  total: number
  critical: number
  major: number
  minor: number
  rootCauseCount: number
  longestChain: number
  severityDistribution: Record<string, number>
}

export interface CachePolicy {
  ttl: number
  invalidateOn: string[]
  cachedAt: string | null
}
