/**
 * Graph Runtime v1 — Edge Contract builder
 *
 * Creates typed semantic edges with validation rules.
 */

import type { GraphEdge, EdgeRelation, EdgeCondition } from './graph.types.js'
import { randomUUID } from 'crypto'

// ============================================================
// Edge Builder
// ============================================================

export interface EdgeContractInput {
  sourceNodeId: string
  sourcePort: string
  sourceType: string
  targetNodeId: string
  targetPort: string
  targetType: string
  relation?: EdgeRelation
  transform?: string
  strict?: boolean
  allowCast?: boolean
  condition?: EdgeCondition
}

export function buildEdge(input: EdgeContractInput): GraphEdge {
  return {
    id: input.sourceNodeId && input.targetNodeId
      ? `edge_${input.sourceNodeId}_${input.targetNodeId}_${randomUUID().slice(0, 8)}`
      : `edge_${randomUUID()}`,
    source: {
      nodeId: input.sourceNodeId,
      port: input.sourcePort,
      type: input.sourceType,
    },
    target: {
      nodeId: input.targetNodeId,
      port: input.targetPort,
      type: input.targetType,
    },
    semantic: {
      relation: input.relation ?? 'dataflow',
      transform: input.transform,
    },
    validation: {
      strict: input.strict ?? true,
      allowCast: input.allowCast ?? false,
    },
    condition: input.condition ?? { type: 'always' },
  }
}

/**
 * Quick semantic dataflow edge:
 *   source node's default output → target node's default input
 */
export function buildDataflowEdge(
  sourceNodeId: string,
  sourceType: string,
  targetNodeId: string,
  targetType: string,
  transform?: string,
): GraphEdge {
  return buildEdge({
    sourceNodeId,
    sourcePort: 'default',
    sourceType,
    targetNodeId,
    targetPort: 'default',
    targetType,
    relation: 'dataflow',
    transform,
  })
}

/**
 * Quick fallback edge:
 *   activates only when upstream fails
 */
export function buildFallbackEdge(
  sourceNodeId: string,
  sourceType: string,
  targetNodeId: string,
  targetType: string,
): GraphEdge {
  return buildEdge({
    sourceNodeId,
    sourcePort: 'default',
    sourceType,
    targetNodeId,
    targetPort: 'default',
    targetType,
    relation: 'condition',
    condition: { type: 'failed' },
  })
}

/**
 * Quick condition edge:
 *   activates only when upstream drift is below threshold
 */
export function buildConditionEdge(
  sourceNodeId: string,
  sourceType: string,
  targetNodeId: string,
  targetType: string,
  maxDrift: number,
): GraphEdge {
  return buildEdge({
    sourceNodeId,
    sourcePort: 'default',
    sourceType,
    targetNodeId,
    targetPort: 'default',
    targetType,
    relation: 'condition',
    condition: { type: 'drift', maxThreshold: maxDrift },
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

