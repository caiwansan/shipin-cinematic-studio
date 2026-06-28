/**
 * director-runtime/narrative-graph.ts
 *
 * ⚔️ Phase 2 Implementation — Narrative Graph Builder
 *
 * 职责：
 *   将 DirectorPlan 中的叙事结构转化为事件因果网络（NarrativeGraph）。
 *
 * 规则：
 *   - 纯确定性转换（same input → same graph）
 *   - 不做语义理解
 *   - 基于 sceneSegmentation + narrativeLogic.causeEffectGraph 构建
 *
 * NarrativeGraph ≠ 场景列表
 * NarrativeGraph = 事件因果网络
 *
 * 它回答"为什么故事这样发展"，不回答"画面上出现什么"。
 */

import type { DirectorPlan, NarrativeGraph, NarrativeNode, NarrativeEdge } from './types.js'

// ── 构建器 ──

/**
 * buildNarrativeGraph — DirectorPlan → NarrativeGraph
 *
 * 从 DirectorPlan 中提取叙事结构，构建事件因果网络。
 *
 * 构建策略：
 *   1. sceneSegmentation → 每个场景生成 1-2 个事件节点
 *   2. narrativeLogic.causeEffectGraph → 因果边
 *   3. emotionalArc → 情绪映射
 *   4. narrativeConstraints.climaxPosition → 高潮节点权重
 */
export function buildNarrativeGraph(plan: DirectorPlan): NarrativeGraph {
  const nodes: NarrativeNode[] = []
  const edges: NarrativeEdge[] = []

  // Step 1: 从场景划分生成事件节点
  const scenes = plan.sceneSegmentation
  const sceneCount = scenes.length

  for (let i = 0; i < sceneCount; i++) {
    const scene = scenes[i]
    const position = sceneCount > 1 ? i / (sceneCount - 1) : 0.5

    // 主要事件节点
    nodes.push({
      id: `event_${scene.id}_main`,
      label: scene.summary.length > 40 ? scene.summary.substring(0, 37) + '...' : scene.summary,
      description: scene.narrativePurpose,
      emotion: scene.emotionalTone,
      position,
      weight: position === plan.narrativeConstraints?.climaxPosition ? 1.0 : 0.6 + (1 - Math.abs(position - (plan.narrativeConstraints?.climaxPosition ?? 0.75))) * 0.4,
      sceneId: scene.id,
    })

    // 如果有因果关系，生成额外的转折节点
    if (i > 0 && i < sceneCount - 0.5) {
      nodes.push({
        id: `event_${scene.id}_turn`,
        label: `${scene.emotionalTone}转折`,
        description: `从${scenes[i-1]?.emotionalTone ?? '前态'}转为${scene.emotionalTone}`,
        emotion: scene.emotionalTone,
        position: position - 0.03,
        weight: 0.7,
        sceneId: scene.id,
      })
    }
  }

  // Step 2: 从 causeEffectGraph 生成因果边
  const causeEffect = plan.narrativeLogic.causeEffectGraph

  if (causeEffect.length > 0) {
    for (let i = 0; i < causeEffect.length; i++) {
      const chain = causeEffect[i]

      // 解析 "原因 → 结果" 格式
      const parts = chain.split('→')
      if (parts.length >= 2) {
        const sourceLabel = parts[0].trim()
        const targetLabel = parts[1].trim()

        // 找到对应的 event 节点
        const sourceNode = nodes.find(n =>
          n.label.includes(sourceLabel) || sourceLabel.includes(n.label.substring(0, 6))
        )
        const targetNode = nodes.find(n =>
          n.label.includes(targetLabel) || targetLabel.includes(n.label.substring(0, 6))
        )

        if (sourceNode && targetNode) {
          const relation = i === causeEffect.length - 1 ? 'resolves'
            : i < causeEffect.length / 2 ? 'causes'
            : 'enables'

          edges.push({
            sourceId: sourceNode.id,
            targetId: targetNode.id,
            relation: relation as NarrativeEdge['relation'],
            rationale: chain,
          })
        }
      }
    }
  }

  // Step 3: 如果没有从 causeEffectGraph 生成边，使用顺序因果关系
  if (edges.length === 0) {
    const sortedNodes = [...nodes].sort((a, b) => a.position - b.position)

    for (let i = 0; i < sortedNodes.length - 1; i++) {
      edges.push({
        sourceId: sortedNodes[i].id,
        targetId: sortedNodes[i + 1].id,
        relation: i < sortedNodes.length / 2 ? 'causes' : 'enables',
        rationale: `${sortedNodes[i].emotion} → ${sortedNodes[i+1].emotion}`,
      })
    }
  }

  return { nodes, edges }
}

// ── 图工具函数 ──

export function createEmptyGraph(): NarrativeGraph {
  return { nodes: [], edges: [] }
}

export function addNode(
  graph: NarrativeGraph,
  node: NarrativeNode
): NarrativeGraph {
  return {
    ...graph,
    nodes: [...graph.nodes.filter(n => n.id !== node.id), node],
  }
}

export function addEdge(
  graph: NarrativeGraph,
  edge: NarrativeEdge
): NarrativeGraph {
  const sourceExists = graph.nodes.some(n => n.id === edge.sourceId)
  const targetExists = graph.nodes.some(n => n.id === edge.targetId)

  if (!sourceExists || !targetExists) return graph

  return {
    ...graph,
    edges: [...graph.edges.filter(
      e => !(e.sourceId === edge.sourceId && e.targetId === edge.targetId)
    ), edge],
  }
}

export function getPredecessors(graph: NarrativeGraph, nodeId: string): NarrativeNode[] {
  const sourceIds = new Set(
    graph.edges.filter(e => e.targetId === nodeId).map(e => e.sourceId)
  )
  return graph.nodes.filter(n => sourceIds.has(n.id))
}

export function getSuccessors(graph: NarrativeGraph, nodeId: string): NarrativeNode[] {
  const targetIds = new Set(
    graph.edges.filter(e => e.sourceId === nodeId).map(e => e.targetId)
  )
  return graph.nodes.filter(n => targetIds.has(n.id))
}

export function getCausalPath(graph: NarrativeGraph, startId: string, endId: string): NarrativeNode[] {
  const visited = new Set<string>()
  const path: NarrativeNode[] = []

  function dfs(currentId: string): boolean {
    if (visited.has(currentId)) return false
    visited.add(currentId)

    const node = graph.nodes.find(n => n.id === currentId)
    if (!node) return false

    path.push(node)

    if (currentId === endId) return true

    const nextIds = graph.edges
      .filter(e => e.sourceId === currentId)
      .map(e => e.targetId)

    for (const nextId of nextIds) {
      if (dfs(nextId)) return true
    }

    path.pop()
    return false
  }

  dfs(startId)
  return path
}

export function orderByTimeline(graph: NarrativeGraph): NarrativeNode[] {
  return [...graph.nodes].sort((a, b) => a.position - b.position)
}

export function describeTensionFlow(graph: NarrativeGraph): string[] {
  const ordered = orderByTimeline(graph)
  return ordered.map(n => `位置${n.position.toFixed(2)}→${n.emotion}`)
}

export function describeCausalChains(graph: NarrativeGraph): string[] {
  return graph.edges.map(e => {
    const source = graph.nodes.find(n => n.id === e.sourceId)
    const target = graph.nodes.find(n => n.id === e.targetId)
    const sourceLabel = source?.label ?? e.sourceId
    const targetLabel = target?.label ?? e.targetId
    return `${sourceLabel} → ${targetLabel} (${e.relation})`
  })
}

export function getSceneSubgraph(graph: NarrativeGraph, sceneId: string): NarrativeGraph {
  const sceneNodes = graph.nodes.filter(n => n.sceneId === sceneId)
  const sceneNodeIds = new Set(sceneNodes.map(n => n.id))
  const sceneEdges = graph.edges.filter(
    e => sceneNodeIds.has(e.sourceId) && sceneNodeIds.has(e.targetId)
  )
  return { nodes: sceneNodes, edges: sceneEdges }
}

export function validateNarrativeGraph(graph: unknown): boolean {
  if (!graph || typeof graph !== 'object') return false
  const obj = graph as Record<string, unknown>
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return false

  const forbidden = ['camera', 'shot', 'vfx', 'lighting', 'prompt', 'styleTokens']

  for (const node of obj.nodes as Record<string, unknown>[]) {
    for (const key of Object.keys(node)) {
      if (forbidden.includes(key)) return false
    }
  }

  return true
}
