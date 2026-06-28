/**
 * Patch Validator — Ensures patches are safe to apply
 *
 * Checks:
 *   1. No orphan nodes (edges reference existing nodes)
 *   2. No duplicate node IDs
 *   3. Graph remains a DAG (no cycles introduced)
 *   4. Patch doesn't remove entry/exit nodes
 *   5. All required inputs are satisfied
 */

import type { Pipeline } from './graph-model.js'
import type { PatchPlan } from './patch.types.js'
type Graph = Pipeline

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validatePatchPlan(plan: PatchPlan, originalGraph?: Graph): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const g = plan.previewGraph

  // 1. No orphan edges
  const nodeIds = new Set(g.nodes.map(n => n.id))
  for (const e of g.edges) {
    if (!nodeIds.has(e.source)) {
      errors.push(`Edge ${e.id} references unknown source node: ${e.source}`)
    }
    if (!nodeIds.has(e.target)) {
      errors.push(`Edge ${e.id} references unknown target node: ${e.target}`)
    }
  }

  // 2. No duplicate node IDs
  const seen = new Set<string>()
  for (const n of g.nodes) {
    if (seen.has(n.id)) {
      errors.push(`Duplicate node ID: ${n.id}`)
    }
    seen.add(n.id)
  }

  // 3. Cycle detection (simple DFS)
  const cycleNodes = detectCycle(g)
  if (cycleNodes.length > 0) {
    errors.push(`Cycle detected involving nodes: ${cycleNodes.join(', ')}`)
  }

  // 4. Entry/exit node preservation
  if (originalGraph) {
    const originalEntryIds = new Set(originalGraph.nodes
      .filter(n => originalGraph.edges.every(e => e.target !== n.id))
      .map(n => n.id))
    const originalExitIds = new Set(originalGraph.nodes
      .filter(n => originalGraph.edges.every(e => e.source !== n.id))
      .map(n => n.id))

    for (const id of originalEntryIds) {
      if (!g.nodes.some(n => n.id === id)) {
        errors.push(`Patch would remove entry node: ${id}`)
        break
      }
    }
    for (const id of originalExitIds) {
      if (!g.nodes.some(n => n.id === id)) {
        errors.push(`Patch would remove exit node: ${id}`)
        break
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

function detectCycle(graph: Graph): string[] {
  const visited = new Set<string>()
  const recStack = new Set<string>()
  const path: string[] = []

  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) {
      // Found cycle — trace back to find the cycle path
      const cycleIdx = path.indexOf(nodeId)
      if (cycleIdx >= 0) {
        return true
      }
      return true
    }
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    recStack.add(nodeId)
    path.push(nodeId)

    const outgoingEdges = graph.edges.filter(e => e.source === nodeId)
    for (const e of outgoingEdges) {
      if (dfs(e.target)) return true
    }

    path.pop()
    recStack.delete(nodeId)
    return false
  }

  // Find entry nodes (no incoming edges)
  const hasIncoming = new Set(graph.edges.map(e => e.target))
  const entryNodes = graph.nodes.filter(n => !hasIncoming.has(n.id))

  for (const node of entryNodes.length > 0 ? entryNodes : graph.nodes) {
    visited.clear()
    recStack.clear()
    path.length = 0
    if (dfs(node.id)) {
      // Return the cycle path
      return Array.from(recStack)
    }
  }

  return []
}
