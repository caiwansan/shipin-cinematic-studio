/**
 * Director IR — Runtime
 * IR 运行时环境 — 在 IR 上执行变异操作 + 触发编译流水线
 *
 * 核心原则：
 *   - 所有编辑操作必须在 IR 上执行
 *   - 不允许直接修改 Eecution/Causal/Narrative 的原始数据
 *   - 编辑 = IR mutation → 重新编译
 */

import {
  DirectorIRGraph,
  DirectorIRNode,
  DirectorIREdge,
  DirectorIREdgeType,
  CompilePass,
  CompileResult,
} from './director-ir-types.js'
import { compilePipeline, PipelineOptions } from '../compile-pipeline.js'

export type IRMutation = {
  kind: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'remove_edge'
  node?: DirectorIRNode
  nodeId?: string
  edge?: DirectorIREdge
  edgeId?: string
  statePath?: string
  newValue?: any
}

/**
 * 在 IR 上执行变异，然后重新编译
 *
 * 这是所有编辑操作的统一入口
 * 以前：分别调用 causal-api / narrative-api / execution-api
 * 现在：IR.mutate → IR.compile
 */
export function mutateAndCompile(
  graph: DirectorIRGraph,
  mutations: IRMutation | IRMutation[],
  options?: PipelineOptions,
): CompileResult {
  const mutationsArray = Array.isArray(mutations) ? mutations : [mutations]

  for (const mutation of mutationsArray) {
    applyMutation(graph, mutation)
  }

  return compilePipeline(graph, options)
}

function applyMutation(graph: DirectorIRGraph, mutation: IRMutation): void {
  switch (mutation.kind) {
    case 'add_node':
      if (mutation.node) {
        graph.nodes.set(mutation.node.id, mutation.node)
      }
      break

    case 'update_node':
      if (mutation.nodeId) {
        const existing = graph.nodes.get(mutation.nodeId)
        if (existing && mutation.statePath && mutation.newValue !== undefined) {
          // 按 path 更新指定 state 域
          setNestedState(existing, mutation.statePath, mutation.newValue)
          existing.meta.version++
        }
      }
      break

    case 'remove_node':
      if (mutation.nodeId) {
        graph.nodes.delete(mutation.nodeId)
        // 清理指向该节点的边
        graph.edges = graph.edges.filter(
          e => e.from !== mutation.nodeId && e.to !== mutation.nodeId,
        )
      }
      break

    case 'add_edge':
      if (mutation.edge) {
        graph.edges.push(mutation.edge)
      }
      break

    case 'remove_edge':
      if (mutation.edgeId) {
        graph.edges = graph.edges.filter(e => e.id !== mutation.edgeId)
      }
      break
  }
}

/**
 * 按点分隔路径设置嵌套状态
 * 如 'causal.tension' 设置 node.state.causal.tension
 */
function setNestedState(
  node: DirectorIRNode,
  path: string,
  value: any,
): void {
  const parts = path.split('.')
  if (parts.length < 2) return

  const [stateType, ...rest] = parts

  let target: any
  switch (stateType) {
    case 'runtime':
      target = node.state.runtime
      break
    case 'causal':
      target = node.state.causal
      break
    case 'narrative':
      target = node.state.narrative
      break
    default:
      return
  }

  // 遍历剩余的路径
  let current = target
  for (let i = 0; i < rest.length - 1; i++) {
    if (current[rest[i]] === undefined) {
      current[rest[i]] = {}
    }
    current = current[rest[i]]
  }

  const lastKey = rest[rest.length - 1]
  current[lastKey] = value
}

/**
 * 获取图的状态快照
 */
export function getIRSnapshot(graph: DirectorIRGraph): any {
  return {
    id: graph.id,
    version: graph.version,
    lastPassRun: graph.lastPassRun,
    compiledPasses: Array.from(graph.compiledPasses),
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    metadata: graph.metadata,
    nodes: Array.from(graph.nodes.values()).map(n => ({
      id: n.id,
      type: n.type,
      shotIndex: n.shotIndex,
      sceneIndex: n.sceneIndex,
      arcRole: n.state.narrative.arcRole,
      tension: n.state.causal.tension,
      dirty: n.state.causal.dirty,
    })),
    edges: graph.edges.map(e => ({
      id: e.id,
      from: e.from,
      to: e.to,
      type: e.type,
      weight: e.weight,
    })),
  }
}
