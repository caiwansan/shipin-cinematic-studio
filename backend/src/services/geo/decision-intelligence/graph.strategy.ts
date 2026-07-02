// ─────────────────────────────────────────────────
// GraphRootCauseStrategy — 基于入度 + Severity 的根因识别
// A1.1 — FROZEN
// ─────────────────────────────────────────────────

import type { Issue, IssueEdge, RootCauseStrategy } from './types'

export class GraphRootCauseStrategy implements RootCauseStrategy {
  readonly id = 'graph' as const

  identify(nodes: Issue[], edges: IssueEdge[]): string[] {
    if (!nodes.length) return []

    // 1. 计算入度
    const inDegree = new Map<string, number>()
    for (const n of nodes) inDegree.set(n.id, 0)
    for (const e of edges) {
      if (inDegree.has(e.to)) {
        inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
      }
    }

    // 2. 入度 0 的节点 → 根因候选
    const candidates = nodes.filter(n => (inDegree.get(n.id) || 0) === 0)

    if (!candidates.length) {
      // 无入度 0 节点 → 取 severity 最高
      const maxSeverity = Math.max(...nodes.map(n => n.severity))
      return nodes.filter(n => n.severity === maxSeverity).map(n => n.id)
    }

    // 3. 按 severity 排序，选 top N
    const sorted = candidates.sort((a, b) => b.severity - a.severity)
    const threshold = Math.max(1, Math.ceil(sorted.length * 0.4))
    return sorted.slice(0, threshold).map(n => n.id)
  }
}
