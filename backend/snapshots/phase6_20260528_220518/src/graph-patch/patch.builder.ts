/**
 * Patch Builder — Translates OptimizationSuggestion → PatchPlan
 *
 * Takes a graph + an optimization suggestion and produces a full
 * patch plan with preview graph, diff, and validation.
 *
 * Key design: it doesn't mutate anything — it produces a proposal.
 */

import { randomUUID } from 'node:crypto'
import type { Pipeline } from '../studio/graph.model.js'
import type { OptimizationSuggestion } from '../graph-optimization/optimization.types.js'
import type {
  PatchPlan,
  PatchOperation,
  GraphDiff,
  NodeDiff,
  EdgeDiff,
} from './patch.types.js'

// Graph = Pipeline (the actual model)
type Graph = Pipeline

/**
 * Build a PatchPlan from a single optimization suggestion
 */
export function buildPatch(
  runId: string,
  suggestion: OptimizationSuggestion,
  originalGraph: Graph,
): PatchPlan {
  const operations = suggestionToOperations(suggestion)
  const diff = computeDiff(operations, originalGraph)
  const previewGraph = applyDiff(originalGraph, diff)

  const patchId = `patch_${randomUUID().slice(0, 8)}`

  // Validate the resulting graph
  const valid = validateGraph(previewGraph)
  const validationErrors = valid ? undefined : ['Resulting graph has structural issues']

  return {
    patchId,
    runId,
    operations,
    previewGraph,
    diff,
    valid,
    validationErrors,
    expectedGain: {
      latencyPct: suggestion.expectedGain.latencyPct,
      costPct: suggestion.expectedGain.costPct,
    },
    generatedAt: Date.now(),
  }
}

/**
 * Build PatchPlans for all suggestions at once
 */
export function buildAllPatches(
  runId: string,
  suggestions: OptimizationSuggestion[],
  originalGraph: Graph,
): PatchPlan[] {
  return suggestions
    .map(s => buildPatch(runId, s, originalGraph))
    .filter(p => p.valid)
}

// ── Operation mapping ──

function suggestionToOperations(suggestion: OptimizationSuggestion): PatchOperation[] {
  switch (suggestion.action) {
    case 'SPLIT':
      return suggestion.targetNodes.map(nodeId => ({
        type: 'SPLIT' as const,
        nodeId,
        strategy: 'auto',
      }))

    case 'CACHE':
      return suggestion.targetNodes.map(nodeId => ({
        type: 'CACHE' as const,
        nodeId,
      }))

    case 'PARALLELIZE':
      return [{
        type: 'PARALLELIZE' as const,
        nodeIds: suggestion.targetNodes,
      }]

    case 'REPLACE_MODEL':
      return suggestion.targetNodes.map(nodeId => ({
        type: 'REPLACE_MODEL' as const,
        nodeId,
        model: 'cheapest-available',
      }))

    case 'REORDER':
      return [] // REORDER is complex, skip for v1

    default:
      return []
  }
}

// ── Diff computation ──

function computeDiff(operations: PatchOperation[], graph: Graph): GraphDiff {
  const nodeDiffs: NodeDiff[] = []
  const edgeDiffs: EdgeDiff[] = []

  for (const op of operations) {
    switch (op.type) {
      case 'SPLIT':
        computeSplitDiff(op, graph, nodeDiffs, edgeDiffs)
        break
      case 'CACHE':
        computeCacheDiff(op, graph, nodeDiffs)
        break
      case 'PARALLELIZE':
        computeParallelizeDiff(op, graph, nodeDiffs, edgeDiffs)
        break
      case 'REPLACE_MODEL':
        computeReplaceModelDiff(op, graph, nodeDiffs)
        break
    }
  }

  return { nodes: nodeDiffs, edges: edgeDiffs }
}

function computeSplitDiff(
  op: Extract<PatchOperation, { type: 'SPLIT' }>,
  graph: Graph,
  nodeDiffs: NodeDiff[],
  edgeDiffs: EdgeDiff[],
) {
  const original = graph.nodes.find(n => n.id === op.nodeId)
  if (!original) return

  // Mark original as removed
  nodeDiffs.push({
    id: op.nodeId,
    type: 'remove',
    original: { ...original },
  })

  // Create draft + refine nodes (flat fields, no .data)
  const splitAId = `${op.nodeId}_draft`
  const splitBId = `${op.nodeId}_refine`

  nodeDiffs.push({
    id: splitAId,
    type: 'add',
    proposed: {
      id: splitAId,
      type: original.type,
      label: `${original.label}_草稿`,
      prompt: original.prompt ? { ...original.prompt } : undefined,
      status: 'idle',
    },
  })

  nodeDiffs.push({
    id: splitBId,
    type: 'add',
    proposed: {
      id: splitBId,
      type: original.type,
      label: `${original.label}_精修`,
      prompt: original.prompt ? { ...original.prompt, params: { ...original.prompt.params, refine: true, dependsOn: splitAId } } : undefined,
      status: 'idle',
    },
  })

  // Re-wire: incoming edges go to A, A→B edge, outgoing edges from B
  const incomingEdges = graph.edges.filter(e => e.target === op.nodeId)
  const outgoingEdges = graph.edges.filter(e => e.source === op.nodeId)

  for (const e of incomingEdges) {
    edgeDiffs.push({
      id: e.id,
      type: 'modify',
      original: { ...e },
      proposed: { ...e, target: splitAId },
    })
  }

  // New A→B edge
  const newEdgeId = `${splitAId}->${splitBId}`
  edgeDiffs.push({
    id: newEdgeId,
    type: 'add',
    proposed: {
      id: newEdgeId,
      source: splitAId,
      target: splitBId,
      type: 'semantic',
    },
  })

  for (const e of outgoingEdges) {
    edgeDiffs.push({
      id: e.id,
      type: 'modify',
      original: { ...e },
      proposed: { ...e, source: splitBId },
    })
  }
}

function computeCacheDiff(
  op: Extract<PatchOperation, { type: 'CACHE' }>,
  graph: Graph,
  nodeDiffs: NodeDiff[],
) {
  const original = graph.nodes.find(n => n.id === op.nodeId)
  if (!original) return

  nodeDiffs.push({
    id: op.nodeId,
    type: 'modify',
    original: { ...original },
    proposed: {
      ...original,
      cacheEnabled: true,
    },
  })
}

function computeParallelizeDiff(
  op: Extract<PatchOperation, { type: 'PARALLELIZE' }>,
  graph: Graph,
  nodeDiffs: NodeDiff[],
  edgeDiffs: EdgeDiff[],
) {
  const parallelId = `parallel_${op.nodeIds.join('_')}`

  // Add parallel wrapper node
  nodeDiffs.push({
    id: parallelId,
    type: 'add',
    proposed: {
      id: parallelId,
      type: 'parallel',
      label: '并行',
      status: 'idle',
    },
  })

  // Find common ancestors and descendants
  const incomingTargets = new Set(op.nodeIds.map(n => n))
  const outgoingSources = new Set(op.nodeIds.map(n => n))

  for (const e of graph.edges) {
    if (incomingTargets.has(e.target) && !outgoingSources.has(e.source)) {
      edgeDiffs.push({
        id: e.id,
        type: 'modify',
        original: { ...e },
        proposed: { ...e, target: parallelId },
      })
    }
    if (outgoingSources.has(e.source) && !incomingTargets.has(e.target)) {
      edgeDiffs.push({
        id: e.id,
        type: 'modify',
        original: { ...e },
        proposed: { ...e, source: parallelId },
      })
    }
  }

  // New edges from parallel wrapper to each node
  for (const nodeId of op.nodeIds) {
    const newEdgeId = `${parallelId}->${nodeId}`
    edgeDiffs.push({
      id: newEdgeId,
      type: 'add',
      proposed: {
        id: newEdgeId,
        source: parallelId,
        target: nodeId,
        type: 'semantic',
      },
    })
  }
}

function computeReplaceModelDiff(
  op: Extract<PatchOperation, { type: 'REPLACE_MODEL' }>,
  graph: Graph,
  nodeDiffs: NodeDiff[],
) {
  const original = graph.nodes.find(n => n.id === op.nodeId)
  if (!original) return

  nodeDiffs.push({
    id: op.nodeId,
    type: 'modify',
    original: { ...original },
    proposed: {
      ...original,
      slotBinding: original.slotBinding ? { ...original.slotBinding, modelId: op.model } : { modelId: op.model, provider: 'default' },
      totalCost: 0,
    },
  })
}

// ── Apply diff to produce preview ──

function applyDiff(graph: Graph, diff: GraphDiff): Graph {
  let nodes = [...graph.nodes]
  let edges = [...graph.edges]

  // Remove nodes
  for (const nd of diff.nodes) {
    if (nd.type === 'remove') {
      nodes = nodes.filter(n => n.id !== nd.id)
      edges = edges.filter(e => e.source !== nd.id && e.target !== nd.id)
    }
  }

  // Add nodes
  for (const nd of diff.nodes) {
    if (nd.type === 'add' && nd.proposed) {
      nodes.push(nd.proposed as any)
    }
  }

  // Modify nodes
  for (const nd of diff.nodes) {
    if (nd.type === 'modify' && nd.proposed) {
      const idx = nodes.findIndex(n => n.id === nd.id)
      if (idx >= 0) {
        nodes[idx] = nd.proposed as any
      }
    }
  }

  // Remove edges
  for (const ed of diff.edges) {
    if (ed.type === 'remove') {
      edges = edges.filter(e => e.id !== ed.id)
    }
  }

  // Modify edges
  for (const ed of diff.edges) {
    if (ed.type === 'modify' && ed.proposed) {
      const idx = edges.findIndex(e => e.id === ed.id)
      if (idx >= 0) {
        edges[idx] = ed.proposed as any
      }
    }
  }

  // Add edges
  for (const ed of diff.edges) {
    if (ed.type === 'add' && ed.proposed) {
      edges.push(ed.proposed as any)
    }
  }

  return { ...graph, nodes, edges }
}

// ── Validation (basic structure check) ──

function validateGraph(graph: Graph): boolean {
  const nodeIds = new Set(graph.nodes.map(n => n.id))

  // All edge sources and targets must exist
  for (const e of graph.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      return false
    }
  }

  // At least one node
  if (graph.nodes.length === 0) return false

  return true
}
