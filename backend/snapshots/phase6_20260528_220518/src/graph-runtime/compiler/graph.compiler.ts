/**
 * Graph Runtime v1 — Graph Compiler
 *
 * Transforms a validated graph into an ExecutionPlan.
 * This is where Graph DSL becomes executable code.
 *
 * Flow:
 *   validate(graph) → compile(graph) → ExecutionPlan → Runtime.execute(plan)
 */

import type {
  Graph,
  GraphNode,
  GraphEdge,
  EdgeCondition,
} from '../core/graph.types.js'
import { getNodeSchema } from '../core/node.schema.js'

// ============================================================
// Execution Plan Types
// ============================================================

export interface ExecutionStep {
  nodeId: string
  nodeType: string
  label: string
  phase: number          // topological phase (parallelizable)
  dependencies: string[] // nodeIds that must complete first
  inputs: ResolvedInput[]
  outputs: string[]      // ports that produce output
  runtime: 'sync' | 'async' | 'stream'

  // Condition routing
  condition?: EdgeCondition
  isFallback?: boolean
  fallbackFor?: string   // nodeId if this is a fallback path
}

export interface ResolvedInput {
  port: string
  type: string
  sourceNodeId: string
  sourcePort: string
  transform?: string
  required: boolean
}

export interface ExecutionPlan {
  pipelineId: string
  steps: ExecutionStep[]
  topologicalLevels: number  // how many parallel levels
  totalSteps: number
  maxParallel: number       // max nodes in a single phase
}

// ============================================================
// Compiler
// ============================================================

export function compileGraph(graph: Graph, pipelineId: string): ExecutionPlan {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
  const edgeMap = new Map(graph.edges.map(e => [`${e.source.nodeId}->${e.target.nodeId}`, e]))

  // 1. Build adjacency + in-degree
  const inEdges = new Map<string, GraphEdge[]>()
  const outEdges = new Map<string, GraphEdge[]>()
  const inDegree = new Map<string, number>()

  for (const n of graph.nodes) {
    inEdges.set(n.id, [])
    outEdges.set(n.id, [])
    inDegree.set(n.id, 0)
  }

  for (const e of graph.edges) {
    inEdges.get(e.target.nodeId)?.push(e)
    outEdges.get(e.source.nodeId)?.push(e)
    inDegree.set(e.target.nodeId, (inDegree.get(e.target.nodeId) ?? 0) + 1)
  }

  // 2. Topological sort (Kahn's algorithm)
  const phases: string[][] = []      // phase → nodeIds
  const nodePhase = new Map<string, number>()
  const visited = new Set<string>()
  let queue: string[] = []

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  while (queue.length > 0) {
    const phase: string[] = []
    const nextQueue: string[] = []

    for (const nodeId of queue) {
      phase.push(nodeId)
      visited.add(nodeId)
      const phaseIdx = phases.length
      nodePhase.set(nodeId, phaseIdx)

      for (const edge of outEdges.get(nodeId) ?? []) {
        const newDeg = (inDegree.get(edge.target.nodeId) ?? 1) - 1
        inDegree.set(edge.target.nodeId, newDeg)
        if (newDeg === 0 && !visited.has(edge.target.nodeId)) {
          nextQueue.push(edge.target.nodeId)
        }
      }
    }

    if (phase.length > 0) phases.push(phase)
    queue = nextQueue
  }

  const hasUnvisited = graph.nodes.some(n => !visited.has(n.id))
  if (hasUnvisited) {
    throw new Error('Graph has a cycle — cannot compile')
  }

  // 3. Build execution steps
  const steps: ExecutionStep[] = []

  for (const node of graph.nodes) {
    const schema = getNodeSchema(node.type) ?? node.schema
    const incoming = inEdges.get(node.id) ?? []
    const outgoing = outEdges.get(node.id) ?? []

    // Resolve inputs from incoming edges
    const inputs: ResolvedInput[] = incoming.map(e => ({
      port: e.target.port,
      type: e.target.type,
      sourceNodeId: e.source.nodeId,
      sourcePort: e.source.port,
      transform: e.semantic.transform,
      required: schema?.inputs[e.target.port]?.required ?? false,
    }))

    // Dependencies = unique source node IDs
    const dependencies = [...new Set(incoming.map(e => e.source.nodeId))]

    // Check if this step is a fallback for any upstream
    let isFallback = false
    let fallbackFor: string | undefined

    for (const e of incoming) {
      if (e.semantic.relation === 'condition') {
        isFallback = true
        fallbackFor = e.source.nodeId
      }
    }

    // Condition from edge (if single incoming condition edge)
    const condition = incoming.length === 1 ? incoming[0].condition : undefined

    steps.push({
      nodeId: node.id,
      nodeType: node.type,
      label: node.label ?? node.id,
      phase: nodePhase.get(node.id) ?? 0,
      dependencies,
      inputs,
      outputs: Object.keys(schema?.outputs ?? {}),
      runtime: schema?.runtime ?? 'async',
      condition,
      isFallback,
      fallbackFor,
    })
  }

  // 4. Calculate parallel metrics
  const maxParallel = Math.max(...phases.map(p => p.length), 1)

  return {
    pipelineId,
    steps,
    topologicalLevels: phases.length,
    totalSteps: steps.length,
    maxParallel,
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

