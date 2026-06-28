/**
 * Director IR — API Handler
 * 统一 IR API — 所有操作收敛到这里
 */

import { createEmptyIR, migrateFromLegacy } from './director-ir-types.js'
import { compilePipeline } from './compile-pipeline.js'
import { mutateAndCompile, getIRSnapshot } from './runtime/ir-runtime.js'

// ── 内存中的 IR graph 缓存 ──
const irCache = new Map<string, ReturnType<typeof createEmptyIR>>()

/**
 * 创建新的 IR Graph
 */
export function handleCreateIR(params: { title?: string }) {
  const graph = createEmptyIR(params.title)
  irCache.set(graph.id, graph)
  return { success: true, irId: graph.id }
}

/**
 * 执行变异 + 编译
 */
export function handleCompile(params: {
  irId: string
  mutations: any[]
  options?: any
}) {
  const graph = irCache.get(params.irId)
  if (!graph) return { success: false, error: 'IR not found' }

  const result = mutateAndCompile(graph, params.mutations, params.options)
  return {
    success: result.success,
    passResults: result.passResults.map(p => ({
      pass: p.pass,
      success: p.success,
      affectedNodes: p.affectedNodes,
      errors: p.errors,
    })),
    snapshot: getIRSnapshot(graph),
    duration: result.duration,
  }
}

/**
 * 获取 IR Snapshot
 */
export function handleGetIR(params: { irId: string }) {
  const graph = irCache.get(params.irId)
  if (!graph) return { success: false, error: 'IR not found' }
  return { success: true, graph: getIRSnapshot(graph) }
}

/**
 * 从遗留系统迁移
 */
export function handleMigrateFromLegacy(params: {
  traceId: string
  causalGraph?: any
}) {
  const graph = migrateFromLegacy({
    traceEvents: [],
    causalGraph: params.causalGraph,
  })
  irCache.set(graph.id, graph)
  return { success: true, irId: graph.id, graph: getIRSnapshot(graph) }
}

/**
 * 清空缓存
 */
export function handleClearIR(irId?: string) {
  if (irId) {
    irCache.delete(irId)
    return { success: true, removed: irId }
  }
  const count = irCache.size
  irCache.clear()
  return { success: true, removed: count }
}
