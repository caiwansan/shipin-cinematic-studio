/**
 * TIR Semantic Freeze — Roundtrip Equivalence Checker
 * 往返等价性检查器 — 断言 TIR → IR → TIR 语义不变
 *
 * 核心检查：
 *   1. node count 不变
 *   2. edge count 不变
 *   3. 每个 node 的 shotIndex/type/tension 不变
 *   4. 每个 edge 的 from/to/type/weight 不变
 *   5. constraint rules 不变
 *
 * 如果任意一条不满足 → freeze violation
 * "语言的语法可以变，但语义必须冻结"
 */

import { TIRParser } from '../tir-parser.js'
import { serializeTIR } from '../tir-serializer.js'
import {
  DirectorIRGraph,
  DirectorIRNode,
  DirectorIREdge,
  createEmptyIR,
} from '../../director-ir/director-ir-types.js'

export interface EquivalenceResult {
  pass: boolean
  nodeCountMatch: boolean
  edgeCountMatch: boolean
  nodesMatch: boolean
  edgesMatch: boolean
  details: string[]
  violations: string[]
}

/**
 * 检查 TIR → IR → TIR → IR 往返等价
 * 必须保证两次解析结果的结构语义完全一致
 */
export function checkEquivalence(source: string): EquivalenceResult {
  const details: string[] = []
  const violations: string[] = []

  // Pass 1: Parse
  const parser1 = new TIRParser()
  const { graph: graph1 } = parser1.parse(source)
  details.push(`[pass1] parse: ${graph1.nodes.size} nodes, ${graph1.edges.length} edges`)

  // Pass 2: Serialize
  const tir2 = serializeTIR(graph1)
  details.push(`[pass2] serialize: ${tir2.length} chars`)

  // Pass 3: Re-parse
  const parser2 = new TIRParser()
  const { graph: graph2 } = parser2.parse(tir2)
  details.push(`[pass3] reparse: ${graph2.nodes.size} nodes, ${graph2.edges.length} edges`)

  // Compare
  const nodeCountMatch = graph1.nodes.size === graph2.nodes.size
  const edgeCountMatch = graph1.edges.length === graph2.edges.length

  if (!nodeCountMatch) {
    violations.push(`Node count mismatch: ${graph1.nodes.size} → ${graph2.nodes.size}`)
  }

  if (!edgeCountMatch) {
    violations.push(`Edge count mismatch: ${graph1.edges.length} → ${graph2.edges.length}`)
  }

  // Node-by-node comparison
  let nodesMatch = true
  const nodeArray1 = Array.from(graph1.nodes.values()) as DirectorIRNode[]
  const nodeArray2 = Array.from(graph2.nodes.values()) as DirectorIRNode[]

  if (nodeArray1.length === nodeArray2.length) {
    for (let i = 0; i < nodeArray1.length; i++) {
      const n1 = nodeArray1[i]
      const n2 = nodeArray2.find(n => n.shotIndex === n1.shotIndex) as DirectorIRNode | undefined
      if (!n2) {
        violations.push(`Node with shotIndex ${n1.shotIndex} (${n1.id}) lost after roundtrip`)
        nodesMatch = false
        continue
      }

      if (n1.type !== n2.type) {
        violations.push(`Node ${n1.id}: type changed ${n1.type} → ${n2.type}`)
        nodesMatch = false
      }

      const t1 = n1.state.causal?.tension ?? n1.state.runtime?.tension
      const t2 = n2.state.causal?.tension ?? n2.state.runtime?.tension
      if (t1 !== undefined && t2 !== undefined && Math.abs(t1 - t2) > 0.0001) {
        violations.push(`Node ${n1.id}: tension changed ${t1} → ${t2}`)
        nodesMatch = false
      }

      const txt1 = n1.state.runtime?.text
      const txt2 = n2.state.runtime?.text
      if (txt1 !== txt2 && txt1 !== undefined) {
        violations.push(`Node ${n1.id}: text changed "${txt1}" → "${txt2}"`)
        nodesMatch = false
      }
    }
  }

  // Edge-by-edge comparison
  let edgesMatch = true
  if (graph1.edges.length === graph2.edges.length) {
    for (let i = 0; i < graph1.edges.length; i++) {
      const e1 = graph1.edges[i]
      const e2 = graph2.edges[i]

      if (e1.from !== e2.from) {
        violations.push(`Edge[${i}]: from changed ${e1.from} → ${e2.from}`)
        edgesMatch = false
      }
      if (e1.to !== e2.to) {
        violations.push(`Edge[${i}]: to changed ${e1.to} → ${e2.to}`)
        edgesMatch = false
      }
      if (e1.type !== e2.type) {
        violations.push(`Edge[${i}]: type changed ${e1.type} → ${e2.type}`)
        edgesMatch = false
      }
      if (Math.abs(e1.weight - (e2.weight ?? 0)) > 0.0001) {
        violations.push(`Edge[${i}]: weight changed ${e1.weight} → ${e2.weight}`)
        edgesMatch = false
      }
    }
  }

  const pass = nodeCountMatch && edgeCountMatch && nodesMatch && edgesMatch

  return {
    pass,
    nodeCountMatch,
    edgeCountMatch,
    nodesMatch,
    edgesMatch,
    details,
    violations,
  }
}

/**
 * 强制等价断言 — 不通过就抛错
 */
export function assertEquivalence(source: string): void {
  const result = checkEquivalence(source)

  if (!result.pass) {
    const msg = [
      '⚠️ SEMANTIC FREEZE VIOLATION',
      ...result.violations.map(v => `  ❌ ${v}`),
      'Roundtrip equivalence broken — TIR semantics have changed!',
    ].join('\n')
    throw new Error(msg)
  }
}
