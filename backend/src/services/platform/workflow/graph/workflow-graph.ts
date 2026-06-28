// ============================================================
// Workflow Graph Engine (KMKI-PLAT-011)
// DAG parsing, validation, and traversal
// ============================================================

import type { DagDefinition, DagNode, DagEdge, WorkflowDefinition } from '../types.js'
import { NodeType, NODE_TYPES } from '../types.js'
import { ContractError } from '@platform/errors/platform-errors'

// ─── Parse ───

export function parseGraph(definition: WorkflowDefinition): { nodes: DagNode[]; edges: DagEdge[] } {
  const graphStr = typeof definition.graph === 'string' ? definition.graph : JSON.stringify(definition.graph)
  const graph: DagDefinition = JSON.parse(graphStr)

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    throw new ContractError('Invalid graph definition: nodes must be an array')
  }
  if (!graph.edges || !Array.isArray(graph.edges)) {
    throw new ContractError('Invalid graph definition: edges must be an array')
  }

  return { nodes: graph.nodes, edges: graph.edges }
}

// ─── Validation ───

export interface GraphValidationResult {
  valid: boolean
  errors: GraphValidationError[]
  warnings: string[]
}

export interface GraphValidationError {
  type: 'cycle' | 'disconnected' | 'invalid_type' | 'missing_start' | 'missing_end' | 'orphan_node' | 'duplicate_id' | 'invalid_edge'
  message: string
  nodeId?: string
  edgeId?: string
}

export function validateGraph(nodes: DagNode[], edges: DagEdge[]): GraphValidationResult {
  const errors: GraphValidationError[] = []
  const warnings: string[] = []

  // 1. Check for at least one Start node
  const startNodes = nodes.filter(n => n.type === NodeType.Start)
  if (startNodes.length === 0) {
    errors.push({ type: 'missing_start', message: 'Graph must have at least one Start node' })
  } else if (startNodes.length > 1) {
    warnings.push(`Graph has ${startNodes.length} Start nodes; only the first will be used`)
  }

  // 2. Check for at least one End node
  const endNodes = nodes.filter(n => n.type === NodeType.End)
  if (endNodes.length === 0) {
    errors.push({ type: 'missing_end', message: 'Graph must have at least one End node' })
  }

  // 3. Validate node types
  const validTypes = new Set(NODE_TYPES)
  for (const node of nodes) {
    if (!validTypes.has(node.type as NodeType)) {
      errors.push({
        type: 'invalid_type',
        message: `Node "${node.id}" has invalid type: "${node.type}"`,
        nodeId: node.id,
      })
    }
  }

  // 4. Check for duplicate node IDs
  const nodeIds = new Set<string>()
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({ type: 'duplicate_id', message: `Duplicate node ID: "${node.id}"`, nodeId: node.id })
    }
    nodeIds.add(node.id)
  }

  // 5. Check edge references
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        type: 'invalid_edge',
        message: `Edge "${edge.id}" references unknown source node: "${edge.source}"`,
        edgeId: edge.id,
      })
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        type: 'invalid_edge',
        message: `Edge "${edge.id}" references unknown target node: "${edge.target}"`,
        edgeId: edge.id,
      })
    }
  }

  // 6. Check for orphan nodes (disconnected)
  const connectedNodes = new Set<string>()
  for (const edge of edges) {
    if (nodeIds.has(edge.source)) connectedNodes.add(edge.source)
    if (nodeIds.has(edge.target)) connectedNodes.add(edge.target)
  }

  // Start and End nodes are valid even if no edges
  for (const node of nodes) {
    if (!connectedNodes.has(node.id) && node.type !== NodeType.Start && node.type !== NodeType.End) {
      warnings.push(`Node "${node.id}" (${node.type}) is disconnected (orphan)`)
    }
  }

  // 7. Cycle detection using DFS
  const cycle = detectCycle(nodes, edges)
  if (cycle) {
    errors.push({
      type: 'cycle',
      message: `Cycle detected: ${cycle.join(' → ')}`,
    })
  }

  // 8. Connectivity check: from Start to all reachable nodes
  if (startNodes.length > 0) {
    const reachable = getReachableNodes(startNodes[0].id, edges)
    const unreachable = nodes.filter(n => n.type !== NodeType.Start && !reachable.has(n.id))
    for (const node of unreachable) {
      warnings.push(`Node "${node.id}" (${node.type}) is unreachable from Start`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── Cycle Detection ───

function detectCycle(nodes: DagNode[], edges: DagEdge[]): string[] | null {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    const list = adjacency.get(edge.source)
    if (list) list.push(edge.target)
  }

  const visited = new Set<string>()
  const recStack = new Set<string>()
  const parent: string[] = []

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    recStack.add(nodeId)
    parent.push(nodeId)

    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (recStack.has(neighbor)) {
        // Found cycle
        const cycleStart = parent.indexOf(neighbor)
        const cycle = parent.slice(cycleStart)
        cycle.push(neighbor)
        parent.length = 0
        return true
      }
    }

    parent.pop()
    recStack.delete(nodeId)
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return [...parent]
    }
  }

  return null
}

// ─── Reachable Nodes ───

function getReachableNodes(startId: string, edges: DagEdge[]): Set<string> {
  const visited = new Set<string>()
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    adjacency.get(edge.source)!.push(edge.target)
  }

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      dfs(neighbor)
    }
  }

  dfs(startId)
  return visited
}

// ─── Dependency Resolution ───

export function resolveDependencies(nodeId: string, edges: DagEdge[]): string[] {
  return edges
    .filter(e => e.target === nodeId)
    .map(e => e.source)
}

// ─── Entry Nodes ───

export function getEntryNodes(nodes: DagNode[]): DagNode[] {
  return nodes.filter(n => n.type === NodeType.Start)
}

// ─── Next Nodes ───

export function getNextNodes(
  currentNodeId: string,
  edges: DagEdge[],
  variables?: Record<string, any>,
): DagEdge[] {
  const outgoingEdges = edges.filter(e => e.source === currentNodeId)

  // If no condition, return all outgoing edges
  if (!outgoingEdges.some(e => e.condition)) {
    return outgoingEdges
  }

  // Evaluate conditions
  return outgoingEdges.filter(edge => {
    if (!edge.condition) return true
    try {
      return evaluateCondition(edge.condition, variables || {})
    } catch {
      return false
    }
  })
}

// ─── Condition Evaluation ───

function evaluateCondition(expression: string, variables: Record<string, any>): boolean {
  // Simple condition interpreter: supports basic comparisons
  // Format: "${varName} == 'value'" or "${varName} > 5" or "${varName}"
  try {
    const resolved = expression.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const parts = key.trim().split('.')
      let value: any = variables
      for (const part of parts) {
        if (value === undefined || value === null) return 'undefined'
        value = value[part]
      }
      return value !== undefined ? String(value) : 'undefined'
    })

    // eslint-disable-next-line no-new-func
    return new Function(`return (${resolved})`)()
  } catch {
    return false
  }
}

// ─── Topological Sort ───

export function topologicalSort(nodes: DagNode[], edges: DagEdge[]): DagNode[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId)
  }

  const sorted: DagNode[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodes.find(n => n.id === nodeId)
    if (node) sorted.push(node)

    for (const neighbor of adjacency.get(nodeId) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return sorted
}

// ─── Get nodes by depth level (for layered visualization) ───

export function getNodeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  const levels = new Map<string, number>()
  const queue: Array<{ id: string; level: number }> = []

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push({ id: nodeId, level: 0 })
      levels.set(nodeId, 0)
    }
  }

  while (queue.length > 0) {
    const { id, level } = queue.shift()!
    for (const neighbor of adjacency.get(id) || []) {
      const newLevel = level + 1
      const existingLevel = levels.get(neighbor)
      if (existingLevel === undefined || newLevel > existingLevel) {
        levels.set(neighbor, newLevel)
      }
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push({ id: neighbor, level: levels.get(neighbor) || 0 })
      }
    }
  }

  return levels
}

export { evaluateCondition }
