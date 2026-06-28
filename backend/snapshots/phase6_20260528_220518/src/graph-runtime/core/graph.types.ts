/**
 * Graph Runtime v1 — Core DSL Types
 *
 * The "language" of the graph execution system.
 * Nodes become functions, edges become data contracts.
 */

// ============================================================
// Graph Model — Top-level graph structure
// ============================================================

export type Graph = {
  id: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata?: {
    version: string
    createdAt: number
  }
}

// ============================================================
// Node IO Schema — makes a node a typed function
// ============================================================

export type NodeIOSchema = {
  inputs: Record<string, {
    type: string
    required: boolean
    description?: string
  }>
  outputs: Record<string, {
    type: string
    description?: string
  }>
  runtime: 'sync' | 'async' | 'stream'
}

// ============================================================
// Graph Node — executable function node
// ============================================================

export type GraphNode = {
  id: string
  type: string
  label?: string
  position: { x: number; y: number }
  schema: NodeIOSchema
  config: Record<string, any>

  // Semantic overlay
  driftScore?: number
  cost?: number
}

// ============================================================
// Edge Semantic — the contract that gives edges meaning
// ============================================================

export type EdgeRelation = 'dataflow' | 'control' | 'condition' | 'reference'
export type EdgeTypeV1 = 'semantic' | 'fallback' | 'condition'

export type GraphEdge = {
  id: string
  source: {
    nodeId: string
    port: string
    type: string        // output type at source
  }
  target: {
    nodeId: string
    port: string
    type: string        // input type at target
  }
  semantic: {
    relation: EdgeRelation
    transform?: string  // data transformer key
  }
  validation: {
    strict: boolean
    allowCast: boolean
  }

  // Runtime metadata
  condition?: EdgeCondition
}

// ============================================================
// Edge Condition — determines whether an edge activates
// ============================================================

export type EdgeCondition =
  | { type: 'always' }
  | { type: 'success' }
  | { type: 'failed' }
  | { type: 'cost'; max: number }
  | { type: 'drift'; maxThreshold: number }
  | { type: 'threshold'; metric: string; operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number }

// ============================================================
// Validation Result
// ============================================================

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationWarning {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

