/**
 * Shot Recompiler
 * 镜头局部重编译器 — 只重算受影响的子图，不重建全图
 *
 * 核心策略：
 *   PARTIAL RECOMPILE: 只重新 dirty 节点的下游节点
 *   PRESERVE UNAFFECTED: 不变的部分不做任何操作
 *   PULL FROM ENGINE: 调用五根支柱的 API 获取最新计算结果
 */

import {
  DirectorCausalGraph,
  CausalNode,
  CausalPatch,
  EdgeRelation,
} from './causal-graph-types'
import { PropagationResult } from './causal-propagation-engine'

export interface RecompileOptions {
  /** 是否保留未受影响的节点 */
  preserveUnaffected: boolean
  /** 是否使用缓存的计算结果 */
  useCache: boolean
  /** 重新计算的镜头范围（如果空则全量） */
  affectedShotIndexes?: number[]
}

const DEFAULT_OPTIONS: RecompileOptions = {
  preserveUnaffected: true,
  useCache: true,
}

export interface RecompileResult {
  patches: CausalPatch[]
  recompiledNodeIds: string[]
  skippedNodeIds: string[]
  recompileTime: number
}

/**
 * 对因果图中受影响的节点执行局部重编译
 * @param graph 因果图
 * @param propagation 传播结果
 * @param options 重编译选项
 */
export function recompileSubgraph(
  graph: DirectorCausalGraph,
  propagation: PropagationResult,
  options: RecompileOptions = DEFAULT_OPTIONS,
): RecompileResult {
  const startTime = Date.now()

  const patches: CausalPatch[] = []
  const recompiled: string[] = []
  const skipped: string[] = []
  const processed = new Set<string>()

  // 按镜头分组受影响节点
  const affectedShots = new Map<number, CausalNode[]>()
  for (const nodeId of propagation.affectedNodeIds) {
    const node = graph.nodes.get(nodeId)
    if (!node) continue

    if (!affectedShots.has(node.shotIndex)) {
      affectedShots.set(node.shotIndex, [])
    }
    affectedShots.get(node.shotIndex)!.push(node)
  }

  // 对每个受影响的镜头执行局部重编译
  for (const [shotIdx, nodes] of affectedShots) {
    for (const node of nodes) {
      if (processed.has(node.id)) continue
      processed.add(node.id)

      const result = recompileNode(graph, node, affectedShots)
      if (result) {
        patches.push(result.patch)
        recompiled.push(node.id)
        result.downstreamPatches.forEach(dp => {
          patches.push(dp)
          recompiled.push(dp.nodeId!)
        })
      } else {
        skipped.push(node.id)
      }
    }

    // 重算镜头内跨层连接（shot → grammar → motion 链）
    const chainResult = recomputeShotChain(graph, shotIdx, nodes)
    chainResult.forEach(p => {
      if (!patches.some(existing => existing.nodeId === p.nodeId)) {
        patches.push(p)
        recompiled.push(p.nodeId!)
      }
    })
  }

  // 清理脏标记
  for (const [, node] of graph.nodes) {
    node.meta.dirty = false
  }

  return {
    patches,
    recompiledNodeIds: recompiled,
    skippedNodeIds: skipped,
    recompileTime: Date.now() - startTime,
  }
}

/**
 * 单个节点的局部重编译
 * 根据节点 layer + type 执行不同的重算逻辑
 */
function recompileNode(
  graph: DirectorCausalGraph,
  node: CausalNode,
  affectedShots: Map<number, CausalNode[]>,
): { patch: CausalPatch; downstreamPatches: CausalPatch[] } | null {
  const oldState = { ...node.state }
  const downstreamPatches: CausalPatch[] = []

  switch (node.layer) {
    case 'shot': {
      // Shot 重算：保持基础描述不变，更新编译属性
      const text = node.state.text ?? node.state.description
      if (text) {
        node.state.camera = deriveCameraFromText(text)
        node.state.shotType = deriveShotTypeFromText(text)
      }
      break
    }

    case 'grammar': {
      // Grammar 重算：基于最新的 shot 类型
      const shotNode = findShotNodeInAffected(graph, node.shotIndex, node)
      if (shotNode) {
        const shotType = shotNode.state.shotType ?? shotNode.state.camera?.type ?? 'medium'
        const grammarMap: Record<string, string> = {
          wide: 'establishing',
          'extreme wide': 'establishing',
          medium: 'build_up',
          'close-up': 'peak',
          closeup: 'peak',
          tracking: 'build_up',
          push_in: 'build_up',
          aerial: 'establishing',
        }
        const newGrammar = grammarMap[shotType.toLowerCase()] ?? node.state.grammarType ?? 'build_up'
        if (newGrammar !== node.state.grammarType) {
          node.state.grammarType = newGrammar
        }
      }
      break
    }

    case 'motion': {
      // Motion 重算：基于 grammar 类型
      const grammarNode = findNodeByLayer(graph, node.shotIndex, 'grammar')
      if (grammarNode) {
        const motionMap: Record<string, any> = {
          establishing: { motionStyle: 'static_observant', pressure: 0.2, instability: 0.1, energyFlow: -0.3 },
          build_up: { motionStyle: 'pressured_tracking', pressure: 0.55, instability: 0.3, energyFlow: 0.4 },
          peak: { motionStyle: 'chaotic_handheld', pressure: 0.85, instability: 0.7, energyFlow: 0.6 },
          release: { motionStyle: 'calm_retreat', pressure: 0.25, instability: 0.15, energyFlow: -0.5 },
          reaction: { motionStyle: 'observant', pressure: 0.3, instability: 0.1, energyFlow: 0 },
        }
        const gt = node.state.grammarType ?? grammarNode.state.grammarType ?? 'build_up'
        const mapped = motionMap[gt]
        if (mapped) {
          Object.assign(node.state, mapped)
          node.state.grammarType = gt
        }
      }
      break
    }

    case 'emotion': {
      // Emotion 重算：基于 grammar + motion
      const grammarNode = findNodeByLayer(graph, node.shotIndex, 'grammar')
      const motionNode = findNodeByLayer(graph, node.shotIndex, 'motion')

      const emotionMap: Record<string, any> = {
        establishing: { mood: 'calm', tension: 0.3 },
        build_up: { mood: 'rising', tension: 0.55 },
        peak: { mood: 'explosive', tension: 0.88 },
        release: { mood: 'resolved', tension: 0.4 },
        reaction: { mood: 'calm', tension: 0.35 },
      }

      const gt = grammarNode?.state?.grammarType ?? node.state.grammarType ?? 'build_up'
      const mapped = emotionMap[gt]
      if (mapped) {
        // 如果运动强烈，调高张力
        const pressure = motionNode?.state?.pressure ?? 0.3
        mapped.tension = Math.min(mapped.tension + pressure * 0.15, 1)
        Object.assign(node.state, mapped)
        node.state.grammarType = gt
      }
      break
    }

    case 'character': {
      // Character 保持已有状态，只清理 dirty
      break
    }

    case 'temporal': {
      // Temporal 只读层，不做重编译
      return null
    }
  }

  const patch: CausalPatch = {
    type: 'UPDATE_NODE',
    nodeId: node.id,
    oldState,
    newState: node.state,
  }

  return { patch, downstreamPatches }
}

/**
 * 重算镜头内跨层 chain（shot_i.all_layers 一致性检查）
 */
function recomputeShotChain(
  graph: DirectorCausalGraph,
  shotIdx: number,
  nodes: CausalNode[],
): CausalPatch[] {
  const patches: CausalPatch[] = []

  // 提取各层状态
  const layers: Record<string, CausalNode> = {}
  for (const n of nodes) layers[n.layer] = n

  // 如果 grammar 说 peak 但 motion 还是 static，修复 motion
  const grammar = layers['grammar']
  const motion = layers['motion']
  if (grammar && motion) {
    const gt = grammar.state.grammarType
    const ms = motion.state.motionStyle

    const expectedMotion: Record<string, string> = {
      establishing: 'static_observant',
      build_up: 'pressured_tracking',
      peak: 'chaotic_handheld',
      release: 'calm_retreat',
    }

    if (gt && expectedMotion[gt] && ms !== expectedMotion[gt]) {
      const oldState = { ...motion.state }
      motion.state.motionStyle = expectedMotion[gt]
      motion.meta.dirty = false
      patches.push({ type: 'UPDATE_NODE', nodeId: motion.id, oldState, newState: motion.state })
    }
  }

  return patches
}

// ── 工具函数 ──

function findShotNodeInAffected(
  graph: DirectorCausalGraph,
  shotIndex: number,
  excludeNode: CausalNode,
): CausalNode | undefined {
  const nodes = graph.shotIndex.get(shotIndex) ?? []
  for (const nid of nodes) {
    if (nid === excludeNode.id) continue
    const n = graph.nodes.get(nid)
    if (n?.layer === 'shot') return n
  }
  return undefined
}

function findNodeByLayer(
  graph: DirectorCausalGraph,
  shotIndex: number,
  layer: string,
): CausalNode | undefined {
  const nodes = graph.shotIndex.get(shotIndex) ?? []
  for (const nid of nodes) {
    const n = graph.nodes.get(nid)
    if (n?.layer === layer) return n
  }
  return undefined
}

function deriveCameraFromText(text: string): { type: string } | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('俯瞰') || lower.includes('远景') || lower.includes('wide') || lower.includes('aerial')) {
    return { type: 'wide' }
  }
  if (lower.includes('特写') || lower.includes('close') || lower.includes('close-up')) {
    return { type: 'close-up' }
  }
  if (lower.includes('跟') || lower.includes('track') || lower.includes('推')) {
    return { type: 'tracking' }
  }
  return { type: 'medium' }
}

function deriveShotTypeFromText(text: string): string | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('全景') || lower.includes('环境') || lower.includes('scene') || lower.includes('俯瞰')) {
    return 'establishing'
  }
  if (lower.includes('走近') || lower.includes('走') || lower.includes('walk') || lower.includes('move')) {
    return 'build_up'
  }
  if (lower.includes('紧张') || lower.includes('爆发') || lower.includes('fight') || lower.includes('打')) {
    return 'peak'
  }
  if (lower.includes('离开') || lower.includes('转身') || lower.includes('leave') || lower.includes('静')) {
    return 'release'
  }
  return 'build_up'
}
