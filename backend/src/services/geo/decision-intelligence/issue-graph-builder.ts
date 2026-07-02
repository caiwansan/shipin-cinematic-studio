// ─────────────────────────────────────────────────
// Issue Graph Builder — 完整 Pipeline
// A1.1 — FROZEN
// ─────────────────────────────────────────────────

import uuid from 'uuid'
const uuidv4 = () => (uuid as any).v4 ? (uuid as any).v4() : uuid.v4()
import type { Issue, IssueEdge, IssueGraph, IssueKind, RootCauseStrategy } from './types'
import { ISSUE_REGISTRY, getAllKindIds } from './issue-registry'
import { GraphRootCauseStrategy } from './graph.strategy'
import { getCachedGraph, setCachedGraph } from './cache-policy'

export class IssueGraphBuilder {
  private strategy: RootCauseStrategy

  constructor(strategy?: RootCauseStrategy) {
    this.strategy = strategy || new GraphRootCauseStrategy()
  }

  async build(brandId: string): Promise<IssueGraph> {
    // 1. Collect signals from multiple sources
    const signals = await this.collectSignals(brandId)

    // 2. Match signals to issues
    const issues = this.matchIssues(signals, brandId)

    // 3. Build dependency edges
    const edges = this.buildDependencies(issues)

    // 4. Identify root causes
    const rootCauses = this.identifyRootCauses(issues, edges)

    // Mark root cause nodes
    for (const issue of issues) {
      issue.rootCause = rootCauses.includes(issue.id)
    }

    // 5. Build summary
    const summary = this.buildSummary(issues, edges, rootCauses)

    // 6. Assemble graph
    const graph: IssueGraph = {
      id: uuidv4(),
      brandId,
      generatedAt: new Date().toISOString(),
      nodes: issues,
      edges,
      rootCauses,
      strategy: this.strategy.id,
      summary,
      cachePolicy: {
        ttl: 3600000,
        invalidateOn: ['scan_completed', 'issue_updated', 'knowledge_updated', 'verification_completed'],
        cachedAt: new Date().toISOString(),
      },
    }

    setCachedGraph(brandId, graph)
    return graph
  }

  // ── 1. Signal Collection ──
  private async collectSignals(brandId: string): Promise<Signal[]> {
    const signals: Signal[] = []

    // Source A: Knowledge Hub package info
    try {
      // In v1, we mock signals from Knowledge Hub data
      // In v1.1+, this will read from real Knowledge Hub
      signals.push(...this.collectKnowledgeSignals(brandId))
    } catch {
      // Non-blocking
    }

    // Source B: Explain engine findings (if available)
    try {
      signals.push(...this.collectExplainSignals(brandId))
    } catch {
      // Non-blocking
    }

    // Source C: Discovery findings
    try {
      signals.push(...this.collectDiscoverySignals(brandId))
    } catch {
      // Non-blocking
    }

    // Source D: Verification results
    try {
      signals.push(...this.collectVerificationSignals(brandId))
    } catch {
      // Non-blocking
    }

    return signals.length ? signals : this.fallbackSignals(brandId)
  }

  private collectKnowledgeSignals(brandId: string): Signal[] {
    // In v1, returns simulated signals based on brandId
    // In future versions, will query Knowledge Hub
    return [
      { source: 'knowledge_hub', kindId: 'missing_schema', confidence: 0.8 },
      { source: 'knowledge_hub', kindId: 'low_coverage', confidence: 0.7 },
    ]
  }

  private collectExplainSignals(_brandId: string): Signal[] {
    return [
      { source: 'explain', kindId: 'factual_conflict', confidence: 0.65 },
      { source: 'explain', kindId: 'authority_gap', confidence: 0.7 },
    ]
  }

  private collectDiscoverySignals(_brandId: string): Signal[] {
    return [
      { source: 'discovery', kindId: 'visibility_drop', confidence: 0.85 },
      { source: 'discovery', kindId: 'branding_inconsistency', confidence: 0.6 },
    ]
  }

  private collectVerificationSignals(_brandId: string): Signal[] {
    return [
      { source: 'verification', kindId: 'schema_error', confidence: 0.75 },
      { source: 'verification', kindId: 'incomplete_schema', confidence: 0.7 },
    ]
  }

  private fallbackSignals(brandId: string): Signal[] {
    // Deterministic: hash-based selection so same brandId → same signals
    const hash = brandId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const kinds = getAllKindIds()
    const count = 2 + (hash % 4) // 2-5 signals
    const selected: Signal[] = []
    for (let i = 0; i < count; i++) {
      const idx = (hash + i * 7) % kinds.length
      selected.push({
        source: 'discovery',
        kindId: kinds[idx],
        confidence: 0.5 + (hash % 50) / 100,
      })
    }
    return selected
  }

  // ── 2. Signal → Issue matching ──
  private matchIssues(signals: Signal[], brandId: string): Issue[] {
    const now = new Date().toISOString()
    const issueMap = new Map<string, Issue>()

    for (const sig of signals) {
      // Deduplicate by kindId within same brand
      if (issueMap.has(sig.kindId)) {
        const existing = issueMap.get(sig.kindId)!
        existing.confidence = Math.max(existing.confidence, sig.confidence)
        continue
      }

      const def = ISSUE_REGISTRY[sig.kindId]
      if (!def) continue

      const id = `${brandId}-${sig.kindId}-${uuidv4().slice(0, 8)}`
      const issue: Issue = {
        id,
        kind: def.kind,
        title: def.description,
        description: def.description,
        severity: def.defaultSeverity,
        confidence: sig.confidence,
        status: 'detected',
        source: sig.source,
        category: def.category,
        rootCause: false,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      }
      issueMap.set(sig.kindId, issue)
    }

    return Array.from(issueMap.values())
  }

  // ── 3. Dependency builder (rule-based, DAG guaranteed) ──
  private buildDependencies(issues: Issue[]): IssueEdge[] {
    const edges: IssueEdge[] = []
    const kinds = new Map(issues.map(i => [i.id, i.kind]))

    // Dependency rules between kinds
    // schema issues → content issues → authority issues → technical
    const kindHierarchy: IssueKind[] = ['schema', 'content', 'authority', 'technical']

    for (let i = 0; i < issues.length; i++) {
      for (let j = 0; j < issues.length; j++) {
        if (i === j) continue
        const aKind = kinds.get(issues[i].id)
        const bKind = kinds.get(issues[j].id)
        if (!aKind || !bKind) continue

        const aIdx = kindHierarchy.indexOf(aKind)
        const bIdx = kindHierarchy.indexOf(bKind)

        if (aIdx < bIdx && aIdx >= 0 && bIdx >= 0) {
          // If same kind & same category, check for duplication
          if (aKind === bKind && issues[i].category === issues[j].category) {
            edges.push({
              from: issues[i].id,
              to: issues[j].id,
              relationship: 'related',
            })
          } else {
            edges.push({
              from: issues[i].id,
              to: issues[j].id,
              relationship: 'causes',
            })
          }
        }
      }
    }

    return edges
  }

  // ── 4. Root cause identification ──
  private identifyRootCauses(issues: Issue[], edges: IssueEdge[]): string[] {
    return this.strategy.identify(issues, edges)
  }

  // ── 5. Summary ──
  private buildSummary(issues: Issue[], _edges: IssueEdge[], rootCauses: string[]) {
    const total = issues.length
    const critical = issues.filter(i => i.severity >= 8).length
    const major = issues.filter(i => i.severity >= 5 && i.severity < 8).length
    const minor = issues.filter(i => i.severity < 5).length
    const rootCauseCount = rootCauses.length

    // Longest chain (simplified: longest path in DAG)
    // For v1, we compute longest dependency chain length
    const longestChain = this.computeLongestChain(issues, _edges)

    const distribution: Record<string, number> = {}
    for (const issue of issues) {
      distribution[issue.kind] = (distribution[issue.kind] || 0) + 1
    }

    return { total, critical, major, minor, rootCauseCount, longestChain, severityDistribution: distribution }
  }

  private computeLongestChain(issues: Issue[], edges: IssueEdge[]): number {
    if (!edges.length || !issues.length) return 0
    const adj = new Map<string, string[]>()
    for (const n of issues) adj.set(n.id, [])
    for (const e of edges) {
      const list = adj.get(e.from)
      if (list) list.push(e.to)
    }

    const memo = new Map<string, number>()
    const dfs = (nodeId: string): number => {
      if (memo.has(nodeId)) return memo.get(nodeId)!
      const neighbors = adj.get(nodeId) || []
      let maxDepth = 0
      for (const n of neighbors) {
        maxDepth = Math.max(maxDepth, dfs(n) + 1)
      }
      memo.set(nodeId, maxDepth)
      return maxDepth
    }

    let longest = 0
    for (const n of issues) {
      longest = Math.max(longest, dfs(n.id))
    }
    return longest
  }

  // ── Cache support ──
  getCached(brandId: string): IssueGraph | null {
    const entry = getCachedGraph(brandId)
    if (!entry) return null
    return entry.graph as IssueGraph
  }
}

// ── Internal Signal type ──
interface Signal {
  source: string
  kindId: string
  confidence: number
}
