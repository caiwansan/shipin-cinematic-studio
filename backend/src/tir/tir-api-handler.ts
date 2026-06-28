/**
 * TIR — API Handler
 * TIR 语言端点 — parse / serialize / roundtrip
 */

import { TIRParser, ParseError } from './tir-parser.js'
import { serializeTIR } from './tir-serializer.js'
import { createEmptyIR } from '../director-ir/director-ir-types.js'

export function handleParseTIR(params: { source: string }) {
  try {
    const parser = new TIRParser()
    const { graph, warnings } = parser.parse(params.source)

    return {
      success: true,
      graph: {
        id: graph.id,
        version: graph.version,
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        sceneCount: graph.metadata.sceneCount,
        shotCount: graph.metadata.shotCount,
        nodes: Array.from(graph.nodes.values()).map(n => ({
          id: n.id,
          type: n.type,
          shotIndex: n.shotIndex,
          sceneIndex: n.sceneIndex,
          text: n.state.runtime.text ?? '',
          tension: n.state.causal.tension ?? 0.5,
        })),
        edges: graph.edges.map(e => ({
          id: e.id,
          from: e.from,
          to: e.to,
          type: e.type,
          weight: e.weight,
          hard: e.constraint?.hard ?? false,
        })),
      },
      warnings,
      parseTime: Date.now(),
    }
  } catch (e) {
    const message = e instanceof ParseError ? e.message : `Unknown parse error: ${e}`
    return { success: false, error: message, warnings: [] }
  }
}

export function handleSerializeTIR(params: { source: string }) {
  // Re-parse then serialize (保序重写)
  try {
    const parser = new TIRParser()
    const { graph } = parser.parse(params.source)
    const tir = serializeTIR(graph)

    // 验证 roundtrip
    const parser2 = new TIRParser()
    const { graph: graph2 } = parser2.parse(tir)

    return {
      success: true,
      tir,
      roundtrip: {
        nodeCount: graph2.nodes.size,
        edgeCount: graph2.edges.length,
        match: graph2.nodes.size === graph.nodes.size && graph2.edges.length === graph.edges.length,
      },
    }
  } catch (e) {
    const message = e instanceof ParseError ? e.message : `Serialize error: ${e}`
    return { success: false, error: message }
  }
}

export function handleValidateTIR(params: { source: string }) {
  try {
    const parser = new TIRParser()
    const { graph, warnings } = parser.parse(params.source)

    const issues: string[] = []

    // 检查 shot count
    if (graph.nodes.size === 0) {
      issues.push('No shots defined')
    }

    // 检查 edges 引用
    for (const edge of graph.edges) {
      if (!graph.nodes.has(edge.from)) issues.push(`Edge references unknown node '${edge.from}'`)
      if (!graph.nodes.has(edge.to)) issues.push(`Edge references unknown node '${edge.to}'`)
    }

    // 检查 orphan nodes（无任何边）
    if (graph.nodes.size > 1) {
      const connected = new Set<string>()
      for (const edge of graph.edges) {
        connected.add(edge.from)
        connected.add(edge.to)
      }
      for (const [id] of graph.nodes) {
        if (!connected.has(id)) {
          issues.push(`Node '${id}' has no edges (orphan)`)
        }
      }
    }

    return {
      success: issues.length === 0,
      valid: issues.length === 0,
      issues,
      warnings,
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.length,
    }
  } catch (e) {
    const message = e instanceof ParseError ? e.message : `Validation error: ${e}`
    return { success: false, valid: false, issues: [message], warnings: [] }
  }
}
