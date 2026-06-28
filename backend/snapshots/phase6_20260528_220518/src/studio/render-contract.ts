/**
 * AI Studio — UI Contract Freeze
 *
 * 在写一行前端代码之前，定义所有 UI 层的 Render Contract。
 * 这些类型就是 Vue Flow / WebGL / Replay 与 Runtime 之间的边界协议。
 *
 * ⚠️ 前端实现必须先实现这些 Contract，再选择渲染库
 * ⚠️ Semantic Layer V2 的运行时数据必须对齐这里的接口
 */

import type { NodeType, TimelineEvent, PipelineNode, PipelineEdge } from './graph.model.js'
import type { SemanticEdge, SemanticNodeStatus, DriftSignal } from './semantic-layer.js'

// ============================================================
// 🔴 Contract 1: Semantic Flow Node （UI 侧看到的节点）
// ============================================================

export interface RenderFlowNode {
  // —— 结构身份 ——
  id: string
  label: string
  type: NodeType

  // —— 运行时状态（来自 Semantic Layer）——
  status: SemanticNodeStatus
  progress: number          // 0-100 (运行中)
  driftScore: number        // 0-1（来自 Drift Engine）
  cost: number              // 累计成本
  latency: number           // ms

  // —— 语义层解释数据（来自 Semantic Layer V2）——
  decision: string          // "fallback" | "cost-opt" | "drift-reroute" | "normal"
  explain: string[]         // 解释数组，如 ["drift 0.26 > 0.2 threshold", "fallback → runway"]
  fallbackChain: string[]   // fallback 路径 ID 链

  // —— Replay 绑定 ——
  replaySessionId?: number
  replayFrameId?: number

  // —— UI 仅用（不传给 runtime）——
  position: { x: number; y: number }
  width: number
  height: number
}

// ============================================================
// 🔵 Contract 2: Semantic Flow Edge（UI 侧看到的边）
// ============================================================

export type RenderEdgeType =
  | 'normal'            // 实线：正常数据依赖
  | 'fallback'          // 虚线+脉冲：降级路径
  | 'condition'         // 分支符号：条件边
  | 'drift-reroute'     // 动画线：漂移触发重路由

export interface RenderFlowEdge {
  id: string
  source: string
  target: string
  type: RenderEdgeType
  animated: boolean

  // 语义元数据
  conditionLabel?: string         // "if success" / "if cost < ¥1"
  fallback?: boolean
  weight?: number                 // 0-1 权重（可视化粗细）

  // 漂移传播（动画脉冲方向）
  driftPropagation?: {
    fromScore: number
    toScore: number
  }
}

// ============================================================
// 🟡 Contract 3: Semantic Overlay（叠加在节点上的语义层）
// ============================================================

export type OverlayType =
  | 'drift-heat'        // 漂移热度：红色渐变
  | 'cost-glow'         // 成本异常：橙色光晕
  | 'fallback-state'    // 降级状态：琥珀脉冲
  | 'condition-branch'  // 条件分支：分支符号
  | 'retry-badge'       // 重试标记：徽章数字

export interface SemanticOverlay {
  nodeId: string
  overlayType: OverlayType
  level: 'none' | 'minor' | 'moderate' | 'critical'

  // 具体数值
  value: number
  label: string
}

// ============================================================
// 🟣 Contract 4: Replay Frame（时间维度的快照）
// ============================================================

export interface ReplayFrameState {
  timestamp: number         // ms
  nodes: {
    nodeId: string
    status: SemanticNodeStatus
    driftScore: number
    cost: number
    decision: string
  }[]
  edges: {
    edgeId: string
    active: boolean
    animated: boolean
  }[]
}

// ============================================================
// 🔴 Contract 5: Explain Payload（解释层数据）
// ============================================================

export interface ExplainPayload {
  nodeId: string
  nodeLabel: string
  nodeType: NodeType

  // —— 为什么是这个状态 ——
  statusReason: string
  decisionPath: {
    step: string
    detail: string
    icon?: string
  }[]

  // —— 因果链（向上追溯）——
  causeChain: {
    nodeId: string
    label: string
    cause: string         // "drift propagated from upstream" / "fallback triggered"
    severity: 'info' | 'warning' | 'error'
  }[]

  // —— 下游影响 ——
  downstreamImpact: string[]

  // —— 补救建议 ——
  suggestions: string[]
}

// ============================================================
// 🟢 Contract 6: 节点侧边栏配置（运行时 mutations）
// ============================================================

export interface RuntimeMutation {
  nodeId: string
  field: 'modelId' | 'fallbackModelId' | 'costThreshold' | 'driftThreshold' | 'maxRetries'
  newValue: string | number
}

// ============================================================
// 🧠 UI Layer 架构映射（4 层定义完成）
// ============================================================

export interface UISceneState {
  // 当前场景
  scene: 'view' | 'replay' | 'compare' | 'edit'

  // L1: Structural Graph（当前布局）
  nodes: RenderFlowNode[]
  edges: RenderFlowEdge[]

  // L2: Semantic Overlays
  overlays: SemanticOverlay[]

  // L3: Temporal Frames（Replay）
  replayFrames: ReplayFrameState[]
  currentFrameIndex: number

  // L4: Explain
  selectedNodeId: string | null
  explainPayload: ExplainPayload | null
}

// Helper: PipelineNode → RenderFlowNode
export function mapNodeToRender(
  node: PipelineNode,
  status: SemanticNodeStatus,
  driftScore: number,
  cost: number,
  decision: string,
  explain: string[]
): RenderFlowNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    status,
    progress: status === 'running' ? 50 : status === 'succeeded' ? 100 : 0,
    driftScore,
    cost,
    latency: 0,
    decision,
    explain,
    fallbackChain: [],
    position: node.position ?? { x: 0, y: 0 },
    width: 180,
    height: 60,
  }
}

// Helper: PipelineEdge → RenderFlowEdge
export function mapEdgeToRender(
  edge: PipelineEdge,
  semanticEdge?: SemanticEdge,
  execResult?: { driftScore: number; cost: number; success: boolean }
): RenderFlowEdge {
  if (semanticEdge?.condition) {
    return {
      id: `render_${edge.id}`,
      source: edge.source,
      target: edge.target,
      type: 'condition',
      animated: false,
      conditionLabel: conditionLabel(semanticEdge.condition),
      fallback: semanticEdge.fallback,
    }
  }
  if (semanticEdge?.fallback) {
    return {
      id: `render_${edge.id}`,
      source: edge.source,
      target: edge.target,
      type: 'fallback',
      animated: true,
      fallback: true,
    }
  }
  return {
    id: `render_${edge.id}`,
    source: edge.source,
    target: edge.target,
    type: 'normal',
    animated: false,
  }
}

function conditionLabel(cond: { type: string; max?: number; maxThreshold?: number }): string {
  switch (cond.type) {
    case 'success': return '✅ success'
    case 'failed': return '❌ failed'
    case 'cost': return `¥${cond.max ?? '?'}`
    case 'drift': return `drift < ${cond.maxThreshold ?? '?'}`
    default: return cond.type
  }
}
