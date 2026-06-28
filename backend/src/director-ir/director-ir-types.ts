/**
 * Director IR — Unified Kernel Types
 * 统一导演语言内核类型定义
 *
 * 核心原则：
 *   所有东西都是 DirectorIRNode
 *   区别只是 interpretation pass
 *   一个 IR + 三个 Compile Pass = 系统终态
 */

// ─── 节点类型 ─────────────────────────────────

export type DirectorIRNodeType =
  | 'shot'
  | 'motion'
  | 'emotion'
  | 'grammar'
  | 'character'
  | 'temporal'
  | 'narrative_marker'
  | 'scene'

export type LayerOrigin = 'execution' | 'causal' | 'narrative'

// ─── Node state 分层 ─────────────────────────

export interface NodeRuntimeState {
  /** 镜头文本描述 */
  text?: string
  /** 执行状态 */
  executed?: boolean
  /** render 结果 */
  renderUrl?: string
  /** 时间戳 */
  timestamp?: number
  /** 运行时元信息 */
  [key: string]: any
}

export interface NodeCausalState {
  /** 因果传播后的张力值 */
  tension?: number
  /** 是否脏 */
  dirty?: boolean
  /** 依赖链 */
  dependencies?: string[]
  /** 影响范围 */
  influenceRange?: [number, number]
  [key: string]: any
}

export interface NodeNarrativeState {
  /** 叙事角色 */
  arcRole?: 'build' | 'peak' | 'release' | 'transition' | 'none'
  /** 合法性状态 */
  valid?: boolean
  /** 违反的约束 */
  violations?: string[]
  /** 推荐的修复 */
  repairSuggestion?: string
  [key: string]: any
}

// ─── 单一 Node Model ─────────────────────────

export type DirectorIRNode = {
  id: string
  type: DirectorIRNodeType
  layerOrigin: LayerOrigin

  /** 所属 scene/segment 索引 */
  sceneIndex: number
  /** 镜头在时间轴上的位置 */
  shotIndex: number

  /** 三态状态（分层但不分裂） */
  state: {
    runtime: NodeRuntimeState
    causal: NodeCausalState
    narrative: NodeNarrativeState
  }

  meta: {
    layerOrigin: LayerOrigin
    createdAt: number
    mutable: boolean
    version: number
  }
}

// ─── Unified Edge System ─────────────────────

export type DirectorIREdgeType =
  | 'causal'
  | 'temporal'
  | 'semantic'
  | 'narrative_constraint'
  | 'derivation'

export type DirectorIREdge = {
  id: string
  from: string
  to: string
  type: DirectorIREdgeType
  weight: number
  constraint?: {
    hard: boolean
    ruleId?: string
  }
  metadata?: Record<string, any>
}

// ─── Compile Pass 标识 ──────────────────────

export type CompilePass = 'narrative' | 'causal' | 'execution'

// ─── 单一 Graph IR ──────────────────────────

export type DirectorIRGraph = {
  id: string
  nodes: Map<string, DirectorIRNode>
  edges: DirectorIREdge[]
  version: number
  compiledPasses: Set<CompilePass>
  lastPassRun: CompilePass | null

  // 全局元数据
  metadata: {
    title?: string
    createdAt: number
    updatedAt: number
    shotCount: number
    sceneCount: number
    /** 场景名映射: sceneIndex → sceneName */
    sceneNames?: Record<number, string>
  }
}

// ─── Pass Pipeline ───────────────────────────

export type PassResult = {
  pass: CompilePass
  success: boolean
  affectedNodes: string[]
  errors: string[]
  timestamp: number
}

// ─── Compile Pipeline 结果 ──────────────────

export type CompileResult = {
  success: boolean
  passResults: PassResult[]
  finalGraph: DirectorIRGraph
  duration: number
}

// ─── Factory ─────────────────────────────────

export function createEmptyIR(title = 'untitled'): DirectorIRGraph {
  return {
    id: `dir-${Date.now().toString(36)}`,
    nodes: new Map(),
    edges: [],
    version: 0,
    compiledPasses: new Set(),
    lastPassRun: null,
    metadata: {
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shotCount: 0,
      sceneCount: 0,
    },
  }
}

export function createIRNode(params: {
  id: string
  type: DirectorIRNodeType
  sceneIndex: number
  shotIndex: number
  runtime?: NodeRuntimeState
  causal?: NodeCausalState
  narrative?: NodeNarrativeState
  mutable?: boolean
}): DirectorIRNode {
  return {
    id: params.id,
    type: params.type,
    layerOrigin: 'execution',
    sceneIndex: params.sceneIndex,
    shotIndex: params.shotIndex,
    state: {
      runtime: params.runtime ?? {},
      causal: params.causal ?? {},
      narrative: params.narrative ?? {},
    },
    meta: {
      layerOrigin: 'execution',
      createdAt: Date.now(),
      mutable: params.mutable ?? true,
      version: 1,
    },
  }
}

/**
 * 从当前三层系统迁移到 DirectorIRGraph
 * 这是收敛的关键：将 Execution/Causal/Narrative 各层的现有数据
 * 统一映射到新 IR 结构
 */
export function migrateFromLegacy(legacyData: {
  traceEvents?: any[]
  causalGraph?: any
  narrativeConstraint?: any
}): DirectorIRGraph {
  const graph = createEmptyIR('migrated')

  // 1. 迁移 trace events → execution nodes
  const events = legacyData.traceEvents ?? []
  for (const event of events) {
    const shotIdx = event.shotIndex ?? event.payload?.shotIndex ?? 0
    const sceneIdx = Math.floor(shotIdx / 5) // 每 5 镜一个 scene

    const nodeId = `${shotIdx}_${(event.type || 'unknown').toLowerCase()}`
    const node = createIRNode({
      id: nodeId,
      type: mapEventTypeToNodeType(event.type),
      sceneIndex: sceneIdx,
      shotIndex: shotIdx,
      runtime: {
        text: event.payload?.text || event.payload?.description,
        timestamp: event.timestamp,
      },
    })
    node.layerOrigin = 'execution'
    graph.nodes.set(nodeId, node)
  }

  // 2. 迁移 causal graph → causal state
  const cg = legacyData.causalGraph
  if (cg) {
    const cgNodes = cg.nodes ?? new Map()
    for (const [id, cn] of cgNodes) {
      const existing = graph.nodes.get(id)
      if (existing) {
        existing.state.causal = {
          tension: cn.state?.tension ?? existing.state.causal.tension,
          dirty: cn.meta?.dirty ?? false,
        }
        existing.meta.layerOrigin = 'causal'
      }
    }

    // 迁移 edges
    for (const ce of (cg.edges ?? [])) {
      graph.edges.push({
        id: `causal_${ce.from}→${ce.to}`,
        from: ce.from,
        to: ce.to,
        type: 'causal',
        weight: ce.weight ?? 0.5,
      })
    }
  }

  // 3. 记录约束信息
  if (legacyData.narrativeConstraint) {
    graph.metadata.title = 'migrated-with-narrative'
  }

  graph.metadata.updatedAt = Date.now()
  return graph
}

function mapEventTypeToNodeType(eventType: string): DirectorIRNodeType {
  const map: Record<string, DirectorIRNodeType> = {
    SHOT_COMPILED: 'shot',
    SHOT_COMPILE_START: 'shot',
    BATCH_COMPILE_START: 'shot',
    GRAMMAR_INIT: 'grammar',
    SHOT_GRAMMAR_RESOLVED: 'grammar',
    EMOTION_COMPUTED: 'emotion',
    TRANSITION_MATCHED: 'grammar',
    MOTION_INIT: 'motion',
    MOTION_INTENT_COMPUTED: 'motion',
    PHYSICS_VALIDATED: 'motion',
    CHARACTER_IDENTITY_LOADED: 'character',
    DRIFT_CHECKED: 'character',
    STABILIZATION_APPLIED: 'character',
    PERSISTENCE_INIT: 'character',
    TEMPORAL_INIT: 'temporal',
    CONTINUITY_RESOLVED: 'temporal',
  }
  return map[eventType] ?? 'shot'
}
