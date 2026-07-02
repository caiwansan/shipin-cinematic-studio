// ─────────────────────────────────────────────────
// Decision Intelligence — Canonical Entity Types
// A1.1 Issue Graph — FROZEN
// ─────────────────────────────────────────────────

export type IssueKind = 'schema' | 'content' | 'authority' | 'technical' | 'unknown'
export type IssueStatus = 'detected' | 'accepted' | 'in_progress' | 'resolved' | 'ignored'
export type DependencyRelationship = 'causes' | 'blocks' | 'duplicates' | 'related' | 'depends_on'
export type RootCauseStrategyId = 'graph' | 'ai' | 'hybrid'

export interface Issue {
  id: string
  kind: IssueKind
  title: string
  description: string
  severity: number           // 1-10
  confidence: number         // 0-1
  status: IssueStatus
  source: string             // 'discovery' | 'explain' | 'verification' | 'knowledge_hub'
  category: string           // 兼容旧分类
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
  rootCauses: string[]           // IDs of root-cause issues
  strategy: RootCauseStrategyId
  summary: GraphSummary
  cachePolicy: CachePolicy
}

export interface GraphSummary {
  total: number
  critical: number              // severity >= 8
  major: number                 // severity >= 5
  minor: number                 // severity < 5
  rootCauseCount: number
  longestChain: number          // longest dependency path
  severityDistribution: Record<string, number>
}

export interface CachePolicy {
  ttl: number                   // ms
  invalidateOn: string[]        // event types
  cachedAt: string | null
}

export interface RootCauseStrategy {
  readonly id: RootCauseStrategyId
  identify(nodes: Issue[], edges: IssueEdge[]): string[]
}
