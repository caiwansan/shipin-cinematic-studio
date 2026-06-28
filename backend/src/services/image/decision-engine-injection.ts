// ============================================================
// decision-engine-injection.ts
//
// 职责：Phase 4.1 — Decision Engine Injection Point（DEIP）
//   让 CDML bias 进入决策图的结构层面，而非数值权重层面
//
// 核心机制：
//   hard bias     → lockNodes：锁定决策节点，禁止变更
//   structural    → rewire：修改决策链路结构
//   soft bias     → adjustEdgeWeights：调整链路权重
//
// 设计原则：
//   - 不修改 rawDecisionGraph（不可变输入）
//   - 输出修改后的副本 d2InputGraph
//   - 不修改 D2 decision-engine.ts（DEIP 是预处理层）
//   - 不执行任何实际决策（只修改图结构）
// ============================================================

import type { DecisionBiasField } from './constraint-decision-mapping.js'

// ─── 决策图类型 ────────────────────────────────────────

export interface DecisionGraphNode {
  id: string
  type: 'domain' | 'constraint' | 'action' | 'gate'
  label: string
  locked: boolean
  metadata?: Record<string, unknown>
}

export interface DecisionGraphEdge {
  from: string
  to: string
  weight: number
  label: string
  active: boolean
}

export interface DecisionGraph {
  nodes: DecisionGraphNode[]
  edges: DecisionGraphEdge[]
  /** 图完整性封印 */
  integritySeal: string
}

// ─── 简单哈希 ──────────────────────────────────────────

function simpleHash(obj: unknown): string {
  const str = JSON.stringify(obj)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// ─── 默认决策图构建 ────────────────────────────────────

/**
 * 构建原始决策图（raw decision graph）
 * D2 领域标准图拓扑：
 *   domain → constraints → actions → gates → output
 */
export function buildRawDecisionGraph(): DecisionGraph {
  const nodes: DecisionGraphNode[] = [
    { id: 'domain:character',  type: 'domain',     label: 'character',  locked: false },
    { id: 'domain:scene',      type: 'domain',     label: 'scene',      locked: false },
    { id: 'domain:storyboard', type: 'domain',     label: 'storyboard', locked: false },
    { id: 'constraint:identity', type: 'constraint', label: 'identity', locked: false },
    { id: 'constraint:lighting', type: 'constraint', label: 'lighting', locked: false },
    { id: 'constraint:spatial',  type: 'constraint', label: 'spatial',  locked: false },
    { id: 'action:accept',     type: 'action',     label: 'accept',     locked: false },
    { id: 'action:retry',      type: 'action',     label: 'retry',      locked: false },
    { id: 'action:regenerate', type: 'action',     label: 'regenerate', locked: false },
    { id: 'action:escalate',   type: 'action',     label: 'escalate',   locked: false },
    { id: 'gate:composite',    type: 'gate',       label: 'final_gate', locked: false },
  ]

  const edges: DecisionGraphEdge[] = [
    { from: 'domain:character',  to: 'constraint:identity', weight: 0.8,  label: 'identity_anchor',   active: true },
    { from: 'domain:character',  to: 'constraint:lighting', weight: 0.5,  label: 'visual_tone',       active: true },
    { from: 'domain:scene',      to: 'constraint:spatial',  weight: 0.7,  label: 'spatial_layout',    active: true },
    { from: 'domain:scene',      to: 'constraint:lighting', weight: 0.4,  label: 'scene_lighting',    active: true },
    { from: 'domain:storyboard', to: 'constraint:spatial',  weight: 0.5,  label: 'shot_composition',  active: true },
    { from: 'constraint:identity', to: 'gate:composite',    weight: 0.5,  label: 'input_to_gate',     active: true },
    { from: 'constraint:lighting', to: 'gate:composite',    weight: 0.5,  label: 'input_to_gate',     active: true },
    { from: 'constraint:spatial',  to: 'gate:composite',    weight: 0.5,  label: 'input_to_gate',     active: true },
    { from: 'gate:composite',     to: 'action:accept',      weight: 0.5,  label: 'default_path',      active: true },
    { from: 'gate:composite',     to: 'action:retry',       weight: 0.2,  label: 'fallback_path',     active: true },
    { from: 'gate:composite',     to: 'action:regenerate',  weight: 0.2,  label: 'rewrite_path',      active: true },
    { from: 'gate:composite',     to: 'action:escalate',    weight: 0.1,  label: 'exception_path',    active: true },
  ]

  return {
    nodes,
    edges,
    integritySeal: simpleHash({ nodes, edges }),
  }
}

// ─── DEIP 核心注入 ─────────────────────────────────────

/**
 * 将 CDML bias field 注入到决策图结构
 *
 * bias injection 规则（按 influenceType）：
 *   hard       → lock 目标节点（node.locked = true）
 *   structural → 调整相关边的权重 + 激活/失活
 *   soft       → 微调边的权重
 *
 * @param graph  原始决策图（不可变）
 * @param biasField  CDML 偏置场
 */
export function injectBiasIntoD2Graph(
  graph: DecisionGraph,
  biasField: DecisionBiasField,
): DecisionGraph {
  // 深拷贝（不可变输入）
  const modifiedNodes: DecisionGraphNode[] = JSON.parse(JSON.stringify(graph.nodes))
  const modifiedEdges: DecisionGraphEdge[] = JSON.parse(JSON.stringify(graph.edges))

  for (const bias of biasField.biases) {
    switch (bias.influenceType) {
      case 'hard': {
        // 锁住相关 domain/constraint 节点
        for (const node of modifiedNodes) {
          if (node.label === bias.source || node.id.includes(bias.source)) {
            node.locked = true
          }
        }
        break
      }

      case 'structural': {
        // 提升相关边权重，降低无关边
        const relevantTargets = bias.source === 'spatial'
          ? ['spatial_layout', 'shot_composition']
          : [bias.source]

        for (const edge of modifiedEdges) {
          if (relevantTargets.includes(edge.label)) {
            edge.weight = Math.min(1, edge.weight + 0.2)
            edge.active = true
          }
        }
        break
      }

      case 'soft': {
        // 微调边权重
        for (const edge of modifiedEdges) {
          if (edge.label.includes(bias.source)) {
            edge.weight = Math.min(1, (edge.weight + 0.1) * bias.weight * 0.5)
          }
        }
        break
      }
    }
  }

  return {
    nodes: modifiedNodes,
    edges: modifiedEdges,
    integritySeal: simpleHash({ nodes: modifiedNodes, edges: modifiedEdges }),
  }
}

// ─── 完整处理管道 ──────────────────────────────────────

export function buildD2InputGraph(biasField: DecisionBiasField): DecisionGraph {
  const rawGraph = buildRawDecisionGraph()
  return injectBiasIntoD2Graph(rawGraph, biasField)
}
