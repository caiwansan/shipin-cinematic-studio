/**
 * Causal Graph IR Types
 * 因果图 IR 类型定义 — 整个 Causal Editing 系统的基础数据结构
 */

export type CausalLayer =
  | 'shot'
  | 'grammar'
  | 'motion'
  | 'emotion'
  | 'character'
  | 'temporal'

export type EdgeRelation =
  | 'causes'       // A 导致 B
  | 'refines'      // A 细化 B
  | 'constrains'   // A 约束 B
  | 'triggers'     // A 触发 B
  | 'contradicts'  // A 与 B 冲突

export type NodeType = 'shot' | 'motion_intent' | 'grammar_type' | 'emotion_state' | 'character_state' | 'temporal_state'

export interface CausalNode {
  id: string
  layer: CausalLayer
  type: NodeType
  /** 所属镜头索引（用于跨层连接） */
  shotIndex: number
  /** 节点状态数据 */
  state: Record<string, any>
  /** 元数据 */
  meta: {
    createdAt: number       // trace 时间戳
    traceSeq: number        // 对应的 trace seq
    mutable: boolean        // 是否可编辑
    dirty: boolean          // 是否已脏（待重算）
  }
}

export interface CausalEdge {
  id: string
  from: string
  to: string
  relation: EdgeRelation
  weight: number // 0-1 影响强度
  metadata?: Record<string, any>
}

export interface DirectorCausalGraph {
  nodes: Map<string, CausalNode>
  edges: CausalEdge[]
  /** 每个镜头对应的节点集合索引 */
  shotIndex: Map<number, string[]>
  /** 图构建时间 */
  createdAt: number
  /** 图版本号（每次编辑递增） */
  version: number
}

export type PatchType = 'ADD_NODE' | 'REMOVE_NODE' | 'UPDATE_NODE' | 'ADD_EDGE' | 'REMOVE_EDGE' | 'UPDATE_EDGE'

export interface CausalPatch {
  type: PatchType
  node?: CausalNode
  edge?: CausalEdge
  nodeId?: string
  edgeId?: string
  oldState?: Record<string, any>
  newState?: Record<string, any>
}

/**
 * 空图工厂
 */
export function createEmptyGraph(): DirectorCausalGraph {
  return {
    nodes: new Map(),
    edges: [],
    shotIndex: new Map(),
    createdAt: Date.now(),
    version: 0,
  }
}
