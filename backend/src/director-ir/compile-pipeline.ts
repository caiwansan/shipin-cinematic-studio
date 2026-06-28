/**
 * Director IR — Compile Pass Pipeline
 * 编译流水线调度器 — 单个 IR + 三个 Pass 的编排引擎
 *
 * 核心转变：
 *   从「三层系统各自运行」到「一个 IR 的三个编译 Pass」
 *
 * Pass 顺序（定死的）：
 *   NARRATIVE PASS → CAUSAL PASS → EXECUTION PASS
 *
 * 不可逆约束：
 *   - Narrative 不能直接修改 Execution state
 *   - Execution 不能影响 Narrative state
 *   - 所有 mutation 通过 IR → Pass pipeline
 */

import {
  DirectorIRGraph,
  DirectorIRNode,
  DirectorIREdge,
  DirectorIREdgeType,
  CompilePass,
  PassResult,
  CompileResult,
  LayerOrigin,
} from './director-ir-types.js'

export interface PipelineOptions {
  /** 是否全量编译（默认只跑 dirty 节点） */
  fullRebuild: boolean
  /** 是否跳过叙事 Pass（紧急模式） */
  skipNarrative: boolean
  /** 是否跳过因果 Pass */
  skipCausal: boolean
}

const DEFAULT_OPTIONS: PipelineOptions = {
  fullRebuild: false,
  skipNarrative: false,
  skipExecution: false,
}

/**
 * 编译流水线 — 入口
 * 输入：修改后的 IR Graph
 * 输出：编译后的 IR Graph + Pass 结果
 */
export function compilePipeline(
  graph: DirectorIRGraph,
  options: PipelineOptions = DEFAULT_OPTIONS,
): CompileResult {
  const startTime = Date.now()
  const passResults: PassResult[] = []

  // Pass 1: Narrative Compilation
  if (!options.skipNarrative) {
    const pass1 = narrativePass(graph)
    passResults.push(pass1)
    if (!pass1.success) {
      return finalize(graph, passResults, startTime, false)
    }
  }

  // Pass 2: Causal Compilation
  if (!options.skipCausal) {
    const pass2 = causalPass(graph)
    passResults.push(pass2)
    if (!pass2.success) {
      return finalize(graph, passResults, startTime, false)
    }
  }

  // Pass 3: Execution Compilation
  if (!options.skipExecution) {
    const pass3 = executionPass(graph)
    passResults.push(pass3)
    if (!pass3.success) {
      return finalize(graph, passResults, startTime, false)
    }
  }

  return finalize(graph, passResults, startTime, true)
}

/**
 * 🟦 PASS 1: Narrative Compilation
 * 叙事约束编译 — 只做合法性标注，不改结构
 *
 * 任务：
 *   - 节点标注 arcRole（build/peak/release/transition）
 *   - 检查 arc shape
 *   - 标记违反约束的节点（narrative.violations）
 *   - 添加 narrative_constraint 类型的边
 */
function narrativePass(graph: DirectorIRGraph): PassResult {
  const errors: string[] = []
  const affected: string[] = []
  const startTs = Date.now()

  for (const [id, node] of graph.nodes) {
    const role = computeArcRole(graph, node)
    const oldRole = node.state.narrative.arcRole

    node.state.narrative.arcRole = role

    // 如果角色发生变化，标记受影响
    if (role !== oldRole) {
      affected.push(id)
    }

    // 张力跳变检查
    const tension = node.state.causal?.tension ?? node.state.runtime?.tension ?? 0.5
    const nextNode = findNextNode(graph, node)
    if (nextNode) {
      const nextTension = nextNode.state.causal?.tension ?? nextNode.state.runtime?.tension ?? 0.5
      if (Math.abs(nextTension - tension) > 0.6) {
        node.state.narrative.violations = [
          ...(node.state.narrative.violations ?? []),
          `tension_jump: ${tension.toFixed(2)}→${nextTension.toFixed(2)}`,
        ]
        node.state.narrative.valid = false
        errors.push(`[narrative] tension jump at ${id}: ${tension.toFixed(2)}→${nextTension.toFixed(2)}`)
      }
    }

    // 非法转换检测
    const inEdges = graph.edges.filter(e => e.to === id && e.type === 'narrative_constraint')
    for (const edge of inEdges) {
      if (edge.constraint?.hard) {
        node.state.narrative.violations = [
          ...(node.state.narrative.violations ?? []),
          `hard_constraint: ${edge.from}→${edge.to}`,
        ]
        node.state.narrative.valid = false
        errors.push(`[narrative] hard constraint violation: ${edge.id}`)
      }
    }
  }

  // 添加 narrative_constraint 边
  addNarrativeEdges(graph)

  graph.lastPassRun = 'narrative'
  graph.compiledPasses.add('narrative')

  return {
    pass: 'narrative',
    success: errors.length === 0,
    affectedNodes: affected,
    errors,
    timestamp: Date.now() - startTs,
  }
}

/**
 * 🟩 PASS 2: Causal Compilation
 * 因果编译 — 结构变换 + 传播计算
 *
 * 任务：
 *   - 构建因果关系链
 *   - 标记 dirty 节点
 *   - 传播影响（forward/backward）
 *   - 重新计算依赖的因果状态
 */
function causalPass(graph: DirectorIRGraph): PassResult {
  const errors: string[] = []
  const affected: string[] = []
  const startTs = Date.now()

  // 1. 构建 forward 依赖链
  for (const edge of graph.edges) {
    if (edge.type !== 'causal' && edge.type !== 'temporal') continue

    const fromNode = graph.nodes.get(edge.from)
    const toNode = graph.nodes.get(edge.to)
    if (!fromNode || !toNode) continue

    // 注册依赖
    fromNode.state.causal.dependencies = [
      ...new Set([
        ...(fromNode.state.causal.dependencies ?? []),
        toNode.id,
      ]),
    ]

    // 传播影响
    const fromTension = fromNode.state.causal?.tension ?? fromNode.state.runtime?.tension ?? 0.5
    const weight = edge.weight ?? 0.5

    // 只有权重足够时才传播
    if (weight > 0.3) {
      const propagated = fromTension * weight + toNode.state.causal?.tension ?? fromNode.state.runtime?.tension ?? 0.5 * (1 - weight)
      const oldTension = toNode.state.causal.tension

      toNode.state.causal.tension = Math.min(1, Math.max(0, propagated))

      if (toNode.state.causal.tension !== oldTension) {
        affected.push(toNode.id)
      }
    }
  }

  // 2. 建立影响范围
  for (const [, node] of graph.nodes) {
    if (node.state.causal.dependencies && node.state.causal.dependencies.length > 0) {
      const deps = node.state.causal.dependencies
      const indices = deps
        .map(id => graph.nodes.get(id))
        .filter(n => n !== undefined)
        .map(n => n!.shotIndex)

      if (indices.length > 0) {
        node.state.causal.influenceRange = [
          Math.min(...indices, node.shotIndex),
          Math.max(...indices, node.shotIndex),
        ]
      }
    }
  }

  graph.lastPassRun = 'causal'
  graph.compiledPasses.add('causal')

  return {
    pass: 'causal',
    success: errors.length === 0,
    affectedNodes: affected,
    errors,
    timestamp: Date.now() - startTs,
  }
}

/**
 * 🟨 PASS 3: Execution Compilation
 * 执行编译 — 将 IR 具体化为运行时状态
 *
 * 任务：
 *   - 将 IR 节点的 runtime state 具体化
 *   - 生成镜头执行时间线
 *   - 更新 graph metadata
 */
function executionPass(graph: DirectorIRGraph): PassResult {
  const errors: string[] = []
  const affected: string[] = []
  const startTs = Date.now()

  let maxShotIndex = 0
  let maxSceneIndex = 0

  for (const [id, node] of graph.nodes) {
    // 标记已执行
    node.state.runtime.executed = true
    node.state.runtime.timestamp = Date.now()

    // 更新索引
    maxShotIndex = Math.max(maxShotIndex, node.shotIndex)
    maxSceneIndex = Math.max(maxSceneIndex, node.sceneIndex)

    // 标记受影响（执行 pass 对所有节点都有影响）
    affected.push(id)
  }

  // 更新 graph 元数据
  graph.metadata.shotCount = maxShotIndex + 1
  graph.metadata.sceneCount = maxSceneIndex + 1
  graph.metadata.updatedAt = Date.now()

  graph.lastPassRun = 'execution'
  graph.compiledPasses.add('execution')
  graph.version++

  // 清理脏标记
  for (const [, node] of graph.nodes) {
    node.state.causal.dirty = false
  }

  return {
    pass: 'execution',
    success: errors.length === 0,
    affectedNodes: affected,
    errors,
    timestamp: Date.now() - startTs,
  }
}

// ── 工具函数 ──

/**
 * 计算节点在叙事弧线中的角色
 */
function computeArcRole(
  graph: DirectorIRGraph,
  node: DirectorIRNode,
): 'build' | 'peak' | 'release' | 'transition' | 'none' {
  const tension = node.state.causal?.tension ?? node.state.runtime?.tension ?? 0.5

  // 没有上下文，按张力值估算
  if (tension > 0.7) return 'peak'
  if (tension > 0.4) return 'build'
  if (tension < 0.3) return 'release'

  // 相邻节点比较
  const prevNode = findPrevNode(graph, node)
  const nextNode = findNextNode(graph, node)

  if (prevNode && nextNode) {
    const prevT = prevNode.state.causal?.tension ?? 0
    const nextT = nextNode.state.causal?.tension ?? 0
    if (tension > prevT && tension > nextT) return 'peak'
    if (tension > prevT && tension < nextT) return 'build'
    if (tension < prevT && tension < nextT) return 'transition'
    if (tension < prevT && tension > nextT) return 'release'
  }

  return 'none'
}

function findPrevNode(graph: DirectorIRGraph, node: DirectorIRNode): DirectorIRNode | undefined {
  let prev: DirectorIRNode | undefined
  for (const [, n] of graph.nodes) {
    if (n.shotIndex < node.shotIndex) {
      if (!prev || n.shotIndex > prev.shotIndex) prev = n
    }
  }
  return prev
}

function findNextNode(graph: DirectorIRGraph, node: DirectorIRNode): DirectorIRNode | undefined {
  let next: DirectorIRNode | undefined
  for (const [, n] of graph.nodes) {
    if (n.shotIndex > node.shotIndex) {
      if (!next || n.shotIndex < next.shotIndex) next = n
    }
  }
  return next
}

/**
 * 添加叙事约束边
 */
function addNarrativeEdges(graph: DirectorIRGraph): void {
  const existingNarrative = new Set(
    graph.edges
      .filter(e => e.type === 'narrative_constraint')
      .map(e => `${e.from}→${e.to}`),
  )

  for (const [id, node] of graph.nodes) {
    if (node.state.narrative.arcRole === 'peak') {
      // 从 peak 节点添加硬约束到相邻节点
      const nextNode = findNextNode(graph, node)
      if (nextNode && !existingNarrative.has(`${id}→${nextNode.id}`)) {
        graph.edges.push({
          id: `nc_${id}→${nextNode.id}`,
          from: id,
          to: nextNode.id,
          type: 'narrative_constraint',
          weight: 0.8,
          constraint: { hard: true, ruleId: 'peak_protection' },
        })
      }
    }
  }
}

function finalize(
  graph: DirectorIRGraph,
  passResults: PassResult[],
  startTime: number,
  success: boolean,
): CompileResult {
  return {
    success,
    passResults,
    finalGraph: graph,
    duration: Date.now() - startTime,
  }
}
