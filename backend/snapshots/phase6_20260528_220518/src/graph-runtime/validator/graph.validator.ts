/**
 * Graph Runtime v1 — Graph Validator
 *
 * Front gate before compilation. Checks:
 *   1. Edge type compatibility
 *   2. Required inputs are satisfied
 *   3. No cycles (if disallowed)
 *   4. No orphan nodes
 *   5. Runtime mode compatibility
 */

import type { Graph, GraphNode, GraphEdge, ValidationResult, ValidationError, ValidationWarning } from '../core/graph.types.js'
import { getNodeSchema } from '../core/node.schema.js'

export class GraphValidator {
  private errors: ValidationError[] = []
  private warnings: ValidationWarning[] = []

  validate(graph: Graph): ValidationResult {
    this.errors = []
    this.warnings = []

    this.checkEdgeTypeCompatibility(graph)
    this.checkMissingInputs(graph)
    this.checkCycle(graph)
    this.checkOrphanNodes(graph)
    this.checkRuntimeCompatibility(graph)

    return {
      ok: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    }
  }

  // ============================================================
  // ① Edge Type Compatibility
  // ============================================================

  private checkEdgeTypeCompatibility(graph: Graph): void {
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))

    for (const edge of graph.edges) {
      const sourceNode = nodeMap.get(edge.source.nodeId)
      const targetNode = nodeMap.get(edge.target.nodeId)

      if (!sourceNode) {
        this.errors.push({
          code: 'SOURCE_NODE_NOT_FOUND',
          message: `Source node "${edge.source.nodeId}" not found`,
          edgeId: edge.id,
        })
        continue
      }

      if (!targetNode) {
        this.errors.push({
          code: 'TARGET_NODE_NOT_FOUND',
          message: `Target node "${edge.target.nodeId}" not found`,
          edgeId: edge.id,
        })
        continue
      }

      // Type matching
      const outputType = edge.source.type
      const inputType = edge.target.type

      // A port named '*' accepts anything
      if (inputType === 'any' || outputType === 'any') continue

      // Direct match
      if (outputType === inputType) continue

      // Array ← singleton (automatic boxing) — allowed if not strict
      if (inputType.endsWith('[]') && outputType === inputType.replace('[]', '')) {
        if (edge.validation.strict) {
          this.warnings.push({
            code: 'TYPE_CAST_IMPLICIT_BOXING',
            message: `Implicit boxing: ${outputType} → ${inputType}`,
            edgeId: edge.id,
          })
        }
        continue
      }

      // Singleton ← array (unboxing) — error in strict mode
      if (outputType.endsWith('[]') && inputType === outputType.replace('[]', '')) {
        this.errors.push({
          code: 'TYPE_MISMATCH_UNBOXING',
          message: `Cannot unbox array: ${outputType} → ${inputType}`,
          edgeId: edge.id,
        })
        continue
      }

      // Mismatch
      if (edge.validation.strict) {
        this.errors.push({
          code: 'TYPE_MISMATCH_STRICT',
          message: `Type mismatch: "${outputType}" → "${inputType}" on edge ${edge.id}`,
          edgeId: edge.id,
        })
      } else if (edge.validation.allowCast) {
        this.warnings.push({
          code: 'TYPE_MISMATCH_CAST',
          message: `Potential type mismatch with cast: "${outputType}" → "${inputType}"`,
          edgeId: edge.id,
        })
      } else {
        this.errors.push({
          code: 'TYPE_MISMATCH',
          message: `Type mismatch: "${outputType}" → "${inputType}"`,
          edgeId: edge.id,
        })
      }
    }
  }

  // ============================================================
  // ② Required Inputs Check
  // ============================================================

  private checkMissingInputs(graph: Graph): void {
    for (const node of graph.nodes) {
      const schema = getNodeSchema(node.type) ?? node.schema
      if (!schema) {
        this.warnings.push({
          code: 'NO_SCHEMA',
          message: `Node "${node.id}" has no IO schema`,
          nodeId: node.id,
        })
        continue
      }

      // Edges targeting this node
      const incomingEdges = graph.edges.filter(e => e.target.nodeId === node.id)

      for (const [inputName, inputDef] of Object.entries(schema.inputs)) {
        if (!inputDef.required) continue

        const hasInput = incomingEdges.some(e => e.target.port === inputName)
        if (!hasInput) {
          this.errors.push({
            code: 'MISSING_REQUIRED_INPUT',
            message: `Node "${node.label ?? node.id}" is missing required input "${inputName}" (type: ${inputDef.type})`,
            nodeId: node.id,
          })
        }
      }
    }
  }

  // ============================================================
  // ③ Cycle Detection (DFS with visited states)
  // ============================================================

  private checkCycle(graph: Graph): void {
    const adjacency = new Map<string, string[]>()
    for (const n of graph.nodes) adjacency.set(n.id, [])
    for (const e of graph.edges) {
      const targets = adjacency.get(e.source.nodeId) ?? []
      targets.push(e.target.nodeId)
      adjacency.set(e.source.nodeId, targets)
    }

    const WHITE = 0  // unvisited
    const GRAY = 1   // in current DFS path
    const BLACK = 2  // done
    const color = new Map<string, number>()
    for (const n of graph.nodes) color.set(n.id, WHITE)

    function dfs(nodeId: string, path: string[]): boolean {
      color.set(nodeId, GRAY)
      path.push(nodeId)

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const c = color.get(neighbor)
        if (c === GRAY) {
          // Cycle found
          return true
        }
        if (c === BLACK) continue
        if (dfs(neighbor, path)) return true
      }

      color.set(nodeId, BLACK)
      path.pop()
      return false
    }

    for (const n of graph.nodes) {
      if (color.get(n.id) === WHITE) {
        const path: string[] = []
        if (dfs(n.id, path)) {
          const cyclePath = path.join(' → ')
          this.errors.push({
            code: 'CYCLE_DETECTED',
            message: `Cycle detected in graph: ${cyclePath}`,
          })
          return // one cycle is enough
        }
      }
    }
  }

  // ============================================================
  // ④ Orphan Nodes
  // ============================================================

  private checkOrphanNodes(graph: Graph): void {
    for (const node of graph.nodes) {
      const hasIncoming = graph.edges.some(e => e.target.nodeId === node.id)
      const hasOutgoing = graph.edges.some(e => e.source.nodeId === node.id)

      if (!hasIncoming && !hasOutgoing && graph.nodes.length > 1) {
        this.warnings.push({
          code: 'ORPHAN_NODE',
          message: `Node "${node.label ?? node.id}" has no connections`,
          nodeId: node.id,
        })
      }
    }
  }

  // ============================================================
  // ⑤ Runtime Compatibility
  // ============================================================

  private checkRuntimeCompatibility(graph: Graph): void {
    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.source.nodeId)
      const targetNode = graph.nodes.find(n => n.id === edge.target.nodeId)
      if (!sourceNode || !targetNode) continue

      const sourceSchema = getNodeSchema(sourceNode.type) ?? sourceNode.schema
      const targetSchema = getNodeSchema(targetNode.type) ?? targetNode.schema

      if (!sourceSchema || !targetSchema) continue

      // Stream connections — only sync → async is automatic
      if (sourceSchema.runtime === 'stream' && targetSchema.runtime === 'sync') {
        this.warnings.push({
          code: 'STREAM_TO_SYNC',
          message: `Stream node "${sourceNode.label ?? sourceNode.id}" → sync node "${targetNode.label ?? targetNode.id}": output will be buffered`,
          edgeId: edge.id,
        })
      }
    }
  }
}

export function createValidator(): GraphValidator {
  return new GraphValidator()
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

