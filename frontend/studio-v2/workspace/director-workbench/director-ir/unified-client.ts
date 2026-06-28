/**
 * Director IR — Frontend Unified Client
 * 前端统一 IR 客户端 — 将三层（Replay/Causal/Narrative）在前端收敛成一个 IR
 *
 * 核心转变：
 *   原来：3 个 store + 3 种 API 调用
 *   现在：1 个 IR + mutate → compile 模式
 */

export type DirectorNodeType =
  | 'shot' | 'motion' | 'emotion' | 'grammar' | 'character' | 'temporal'

export type EdgeType =
  | 'causal' | 'temporal' | 'semantic' | 'narrative_constraint' | 'derivation'

export type CompileResult = {
  success: boolean
  passResults: {
    pass: 'narrative' | 'causal' | 'execution'
    success: boolean
    affectedNodes: string[]
    errors: string[]
  }[]
  duration: number
}

export interface IRNode {
  id: string
  type: DirectorNodeType
  layerOrigin: 'execution' | 'causal' | 'narrative'
  shotIndex: number
  sceneIndex: number
  state: {
    runtime: Record<string, any>
    causal: Record<string, any>
    narrative: Record<string, any>
  }
}

export interface IREdge {
  id: string
  from: string
  to: string
  type: EdgeType
  weight: number
  constraint?: { hard: boolean; ruleId?: string }
}

export interface IRGraph {
  id: string
  nodes: IRNode[]
  edges: IREdge[]
  version: number
  compiledPasses: string[]
  lastPassRun: string | null
  metadata: {
    title: string
    shotCount: number
    sceneCount: number
  }
}

/**
 * Unified Compile: 发送所有 mutation 到后端 → 一次性编译
 * 替代原来的分多次调用 causal/edit, narrative/gate, ... 
 */
export async function unifiedCompile(
  baseUrl: string,
  mutations: Array<{
    kind: 'update_node' | 'add_node' | 'remove_node'
    nodeId?: string
    statePath?: string
    newValue?: any
  }>,
  options?: { skipNarrative?: boolean; skipCausal?: boolean },
): Promise<CompileResult> {
  const res = await fetch(`${baseUrl}/api/workbench/director-ir/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations, options }),
  })

  if (!res.ok) {
    return {
      success: false,
      passResults: [],
      duration: 0,
    }
  }

  const data = await res.json()
  return data.payload ?? data
}

/**
 * 将后端返回的 IR Snapshot 映射到前端可消费的 Timeline/Graph 数据
 * 这是 IR → UI 的编译过程
 */
export function irToTimeline(irGraph: IRGraph): Record<string, any>[] {
  const shotMap = new Map<number, Record<string, any>>()

  for (const node of irGraph.nodes) {
    if (!shotMap.has(node.shotIndex)) {
      shotMap.set(node.shotIndex, {
        shotIndex: node.shotIndex,
        text: node.state.runtime?.text ?? '',
        description: node.state.runtime?.text ?? '',
        tension: node.state.causal?.tension ?? 0.5,
        motionStyle: node.state.runtime?.motionStyle ?? '',
        grammarType: node.state.runtime?.grammarType ?? '',
        arcRole: node.state.narrative?.arcRole ?? 'none',
        valid: node.state.narrative?.valid ?? true,
      })
    } else {
      // 合并同一镜头的不同层信息
      const existing = shotMap.get(node.shotIndex)!
      existing.tension = node.state.causal?.tension ?? existing.tension
      existing.arcRole = node.state.narrative?.arcRole ?? existing.arcRole
      if (node.state.runtime?.text) {
        existing.text = node.state.runtime.text
        existing.description = node.state.runtime.text
      }
    }
  }

  return Array.from(shotMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
}

/**
 * IR → Graph View（DAG 可视化数据）
 */
export function irToGraph(irGraph: IRGraph): {
  nodes: Array<{ id: string; type: string; tension: number }>
  edges: Array<{ source: string; target: string; type: string }>
} {
  return {
    nodes: irGraph.nodes.map(n => ({
      id: n.id,
      type: n.type,
      tension: n.state.causal?.tension ?? 0.5,
    })),
    edges: irGraph.edges.map(e => ({
      source: e.from,
      target: e.to,
      type: e.type,
    })),
  }
}

/**
 * IR → Emotion Arc
 */
export function irToEmotionArc(irGraph: IRGraph): Array<{ shotIndex: number; tension: number; mood: string }> {
  const emotionMap = new Map<number, { tension: number; mood: string }>()

  for (const node of irGraph.nodes) {
    if (node.type === 'emotion') {
      emotionMap.set(node.shotIndex, {
        tension: node.state.causal?.tension ?? node.state.runtime?.tension ?? 0.5,
        mood: node.state.runtime?.mood ?? 'neutral',
      })
    }
  }

  return Array.from(emotionMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([shotIndex, data]) => ({ shotIndex, ...data }))
}
