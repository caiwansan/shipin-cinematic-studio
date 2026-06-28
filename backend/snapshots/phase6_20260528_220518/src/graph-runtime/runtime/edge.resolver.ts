/**
 * Graph Runtime v1 — Data Flow Resolver
 *
 * Given a node's incoming edges and the execution context,
 * resolves the actual input values for the node executor.
 */

import type { GraphEdge } from '../core/graph.types.js'
import { ExecutionContext } from './context.js'

export interface EdgeData {
  edgeId: string
  sourceNodeId: string
  sourcePort: string
  targetPort: string
  value: any
  transform?: string
  conditionMet: boolean
}

export function resolveIncomingEdges(
  nodeId: string,
  edges: GraphEdge[],
  ctx: ExecutionContext,
): EdgeData[] {
  const incoming = edges.filter(e => e.target.nodeId === nodeId)
  const result: EdgeData[] = []

  for (const edge of incoming) {
    const sourceValue = ctx.getOutput(edge.source.nodeId)

    // Check condition
    const conditionMet = evaluateEdgeCondition(edge, ctx)

    result.push({
      edgeId: edge.id,
      sourceNodeId: edge.source.nodeId,
      sourcePort: edge.source.port,
      targetPort: edge.target.port,
      value: conditionMet ? sourceValue : undefined,
      transform: edge.semantic.transform,
      conditionMet,
    })
  }

  return result
}

function evaluateEdgeCondition(edge: GraphEdge, ctx: ExecutionContext): boolean {
  if (!edge.condition || edge.condition.type === 'always') return true

  const sourceValue = ctx.getOutput(edge.source.nodeId)
  if (!sourceValue) return false

  switch (edge.condition.type) {
    case 'success':
      return sourceValue._status === 'success' || sourceValue._status === 'succeeded'
    case 'failed':
      return sourceValue._status === 'failed' || sourceValue._status === 'error'
    case 'drift':
      const drift = sourceValue._driftScore ?? 0
      return drift >= 0 && drift <= (edge.condition.maxThreshold ?? 1)
    case 'cost':
      const cost = sourceValue._cost ?? Infinity
      return cost <= (edge.condition.max ?? Infinity)
    case 'threshold':
      const metric = sourceValue[edge.condition.metric] ?? 0
      switch (edge.condition.operator) {
        case 'gt': return metric > edge.condition.value
        case 'lt': return metric < edge.condition.value
        case 'gte': return metric >= edge.condition.value
        case 'lte': return metric <= edge.condition.value
      }
      return false
    default:
      return true
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

