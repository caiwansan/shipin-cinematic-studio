/**
 * Constraint Physics Engine
 *
 * 将 constraintField 从静态数据转化为可计算的约束相互作用系统。
 * 三个核心能力：
 * 1. buildConflictGraph() — 根据 weight/mode 构建冲突图
 * 2. resolveConflicts() — weighted_tradeoff 解算
 * 3. allocateSlack() — 将 creative_slack 分配到低优先约束
 * 4. resolve() — v3.6 统一接入层
 */

import type {
  ConstraintPhysicsInput,
  ConstraintPhysicsOutput,
  ConflictGraph,
  ConflictEdge,
  ResolutionResult,
  ConflictResolution,
  SlackAllocationOutput,
  SlackAllocation,
  ResolvedConstraintField,
  DominantForce,
  PhysicallyValidatedDirectorUnderstanding,
} from './types.js'

// ============================================================
// 预定义冲突关系
// ============================================================

/**
 * 已知约束间冲突关系矩阵
 * 值 > 0 表示有冲突张力，越高冲突越强
 */
const DEFAULT_CONFLICT_MATRIX: Record<string, Record<string, number>> = {
  characterIdentity: {
    cameraFreedom: 0.8,
    temporalFlexibility: 0.6,
    visualConsistency: 0.3,
    colorPaletteFidelity: 0.2,
  },
  cameraFreedom: {
    characterIdentity: 0.8,
    visualConsistency: 0.7,
    colorPaletteFidelity: 0.5,
    temporalFlexibility: 0.2,
  },
  visualConsistency: {
    cameraFreedom: 0.7,
    temporalFlexibility: 0.4,
    colorPaletteFidelity: 0.3,
    characterIdentity: 0.3,
  },
  temporalFlexibility: {
    characterIdentity: 0.6,
    visualConsistency: 0.4,
    colorPaletteFidelity: 0.3,
    cameraFreedom: 0.2,
  },
  colorPaletteFidelity: {
    cameraFreedom: 0.5,
    visualConsistency: 0.3,
    temporalFlexibility: 0.3,
    characterIdentity: 0.2,
  },
}

// ============================================================
// 1. Conflict Graph Builder
// ============================================================

/**
 * 根据 constraintField 构建冲突图
 * 只包含 weight > 0 的节点
 */
export function buildConflictGraph(input: ConstraintPhysicsInput): ConflictGraph {
  const field = input.constraintField
  const nodes = Object.keys(field).filter(k => field[k].weight > 0)
  const edges: ConflictEdge[] = []

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const matrixTension = DEFAULT_CONFLICT_MATRIX[a]?.[b]
        ?? DEFAULT_CONFLICT_MATRIX[b]?.[a]
        ?? 0.1

      // 实际 tension = 矩阵张力 × 两者 weight 的平均值
      const avgWeight = (field[a].weight + field[b].weight) / 2
      const tension = Math.round(matrixTension * avgWeight * 100) / 100

      if (tension > 0.05) {
        edges.push({
          a,
          b,
          tension,
          description: `${a} ↔ ${b}: tension ${tension}`,
        })
      }
    }
  }

  // 排序，最高 tension 优先
  edges.sort((a, b) => b.tension - a.tension)

  const totalTension = edges.reduce((sum, e) => sum + e.tension, 0)
  const maxTensionEdges = edges.filter(e => e.tension === edges[0]?.tension)

  return { nodes, edges, totalTension, maxTensionEdges }
}

// ============================================================
// 2. Conflict Resolver
// ============================================================

/**
 * 解算单条冲突
 * 规则：
 * - hard vs soft → hard wins
 * - hard vs hard → domain priority
 * - soft_hard vs soft → soft_hard wins
 * - soft vs soft → weighted interpolation
 */
function resolveSingleConflict(
  aKey: string,
  aWeight: number,
  aMode: string,
  bKey: string,
  bWeight: number,
  bMode: string,
): ResolutionResult {
  const conflictKey = `${aKey}↔${bKey}`
  const modePriority: Record<string, number> = {
    hard: 3,
    soft_hard: 2,
    soft: 1,
  }

  const aPriority = modePriority[aMode] ?? 1
  const bPriority = modePriority[bMode] ?? 1

  let resolution: ConflictResolution
  let finalAWeight: number
  let finalBWeight: number

  if (aPriority > bPriority) {
    // a wins — a 保持原值，b 让步
    resolution = 'a_wins'
    finalAWeight = aWeight
    finalBWeight = Math.max(0, bWeight - 0.2) // 让步 0.2
  } else if (bPriority > aPriority) {
    resolution = 'b_wins'
    finalAWeight = Math.max(0, aWeight - 0.2)
    finalBWeight = bWeight
  } else if (aPriority === 3) {
    // hard vs hard — 按 domain 优先级
    resolution = 'weighted_tradeoff'
    // 相同 mode 时 weight 高的赢
    if (aWeight > bWeight) {
      finalAWeight = aWeight
      finalBWeight = bWeight * 0.8
      resolution = 'a_wins'
    } else {
      finalAWeight = aWeight * 0.8
      finalBWeight = bWeight
      resolution = 'b_wins'
    }
  } else {
    // soft vs soft — weighted interpolation
    resolution = 'weighted_tradeoff'
    const total = aWeight + bWeight
    if (total === 0) {
      finalAWeight = 0
      finalBWeight = 0
    } else {
      const ratio = aWeight / total
      finalAWeight = aWeight * (0.5 + ratio / 2)
      finalBWeight = bWeight * (1.5 - ratio / 2)
    }
  }

  const deviation = Math.round(
    Math.abs(finalAWeight - aWeight) + Math.abs(finalBWeight - bWeight) * 100,
  ) / 100

  return {
    conflictKey,
    resolution,
    aWeight: Math.round(finalAWeight * 100) / 100,
    bWeight: Math.round(finalBWeight * 100) / 100,
    deviation,
    reason: describeResolution(conflictKey, resolution, aMode, bMode, aWeight, bWeight),
  }
}

function describeResolution(
  key: string,
  resolution: ConflictResolution,
  aMode: string,
  bMode: string,
  aWeight: number,
  bWeight: number,
): string {
  const labels: Record<string, string> = {
    a_wins: `${aMode}(${aWeight}) 优先级高于 ${bMode}(${bWeight})，约束 b 让步`,
    b_wins: `${bMode}(${bWeight}) 优先级高于 ${aMode}(${aWeight})，约束 a 让步`,
    weighted_tradeoff: `同优先级约束 ${key}，按 ${aWeight}:${bWeight} 加权折衷`,
    equal_compromise: `等权约束平均处理`,
  }
  return labels[resolution] ?? '未知决议'
}

/**
 * 对冲突图执行解算
 */
export function resolveConflicts(graph: ConflictGraph): ResolutionResult[] {
  const seen = new Set<string>()

  return graph.edges.map(edge => {
    // 避免同一对重复解算
    const canonicalKey = [edge.a, edge.b].sort().join('↔')
    if (seen.has(canonicalKey)) return null
    seen.add(canonicalKey)

    return resolveSingleConflict(
      edge.a, 1.0, 'hard',  // placeholder — real weight/mode from field needed
      edge.b, 1.0, 'hard',
    )
  }).filter((r): r is ResolutionResult => r !== null)
}

/**
 * 带权重的冲突解算 — 接收原始 constraintField
 */
export function resolveConflictsWithField(
  graph: ConflictGraph,
  field: Record<string, { weight: number; mode: string }>,
): ResolutionResult[] {
  const seen = new Set<string>()

  return graph.edges.map(edge => {
    const canonicalKey = [edge.a, edge.b].sort().join('↔')
    if (seen.has(canonicalKey)) return null
    seen.add(canonicalKey)

    const aEntry = field[edge.a] ?? { weight: 0.5, mode: 'soft' }
    const bEntry = field[edge.b] ?? { weight: 0.5, mode: 'soft' }

    return resolveSingleConflict(
      edge.a, aEntry.weight, aEntry.mode,
      edge.b, bEntry.weight, bEntry.mode,
    )
  }).filter((r): r is ResolutionResult => r !== null)
}

// ============================================================
// 3. Slack Allocator
// ============================================================

/**
 * 计算 creative_slack
 */
export function computeCreativeSlack(
  field: Record<string, { weight: number; mode: string }>,
): number {
  const nonHardWeights = Object.values(field)
    .filter(e => e.mode !== 'hard' && e.weight > 0)
    .map(e => e.weight)

  if (nonHardWeights.length === 0) return 0

  const avgWeight = nonHardWeights.reduce((a, b) => a + b, 0) / nonHardWeights.length
  return Math.round((1 - avgWeight) * 100) / 100
}

/**
 * 分配 creative_slack 到"柔性约束"
 *
 * 分配策略：
 * - weight 最低的 soft 约束获得最大 slack
 * - soft_hard 获得中等 slack
 * - hard 不参与分配
 */
export function allocateSlack(
  field: Record<string, { weight: number; mode: string; description?: string }>,
  slacks: number,
): SlackAllocationOutput {
  // 可分配的目标 = 非 hard 且 weight < 1.0 的约束
  const targets = Object.entries(field)
    .filter(([_, e]) => e.mode !== 'hard' && e.weight < 1.0)
    .sort((a, b) => a[1].weight - b[1].weight) // weight 低优先

  if (targets.length === 0 || slacks <= 0) {
    return { creativeSlack: slacks, allocations: [], unallocated: slacks, timestamp: Date.now() }
  }

  const allocations: SlackAllocation[] = []
  let remaining = slacks

  for (const [key, entry] of targets) {
    if (remaining <= 0) break

    // soft 获得 60% 剩余，soft_hard 获得 40%
    const share = entry.mode === 'soft' ? 0.6 : 0.4
    const amount = Math.round(remaining * share * 100) / 100
    const clamped = Math.min(amount, 1.0 - entry.weight) // 不超过 1.0

    if (clamped > 0.01) {
      allocations.push({
        target: key,
        allocatedSlack: clamped,
        reason: `${entry.mode} 约束 "${key}" 获得 ${clamped} slack（原始 weight: ${entry.weight}）`,
      })
      remaining = Math.round((remaining - clamped) * 100) / 100
    }
  }

  return {
    creativeSlack: slacks,
    allocations,
    unallocated: remaining,
    timestamp: Date.now(),
  }
}

// ============================================================
// 4. 统一入口
// ============================================================

/**
 * 约束相互作用引擎统一入口
 *
 * 一步完成：
 * 1. 构建冲突图
 * 2. 解算冲突
 * 3. 计算 slack + 分配
 */
export function evaluateConstraints(input: ConstraintPhysicsInput): ConstraintPhysicsOutput {
  const field = input.constraintField as Record<string, { weight: number; mode: string; description?: string }>

  // Step 1: 冲突图
  const conflictGraph = buildConflictGraph(input)

  // Step 2: 冲突解算
  const resolutions = resolveConflictsWithField(
    conflictGraph,
    field as Record<string, { weight: number; mode: string }>,
  )

  // Step 3: Slack 计算和分配
  const creativeSlack = computeCreativeSlack(field as Record<string, { weight: number; mode: string }>)
  const slackAllocation = allocateSlack(field, creativeSlack)

  return {
    conflictGraph,
    resolutions,
    slackAllocation,
    creativeSlack,
    timestamp: Date.now(),
  }
}

// ============================================================
// 5. v3.6 统一接入层 — resolve()
// ============================================================

/**
 * 将 directorUnderstanding 转化为 physics-validated 约束系统。
 * 这是 production pipeline 的唯一接入入口。
 *
 * 物理层职责：
 * 1. 从 directorUnderstanding.constraintField 构建冲突图并解算
 * 2. 生成 resolvedConstraintField（每个约束的 original/resolved weight）
 * 3. 生成 conflictDecisions 日志
 * 4. 生成 slackAllocationMap
 * 5. 计算 dominantForces（谁在主导当前场景）
 *
 * 消费约定：
 * - 所有下游 Agent（Character / Shot / Atmosphere / Rhythm）
 *   必须消费 resolvedConstraintField，不得直接读 raw constraintField
 * - raw directorUnderstanding 保留在 .directorUnderstanding 字段中供 audit
 */
export function resolve(
  directorUnderstanding: any,
): PhysicallyValidatedDirectorUnderstanding {
  const rawField = directorUnderstanding.constraintField || {}
  const fieldKeys = Object.keys(rawField)

  if (fieldKeys.length === 0) {
    // 无 constraintField 时返回空物理层
    return {
      directorUnderstanding,
      resolvedConstraintField: {},
      conflictDecisions: [],
      slackAllocationMap: {
        creativeSlack: 0,
        allocations: [],
        unallocated: 0,
        timestamp: Date.now(),
      },
      dominantForces: [],
      physicsReport: {
        totalTension: 0,
        edgeCount: 0,
        slack: 0,
        decisions: ['⚠️ 未配置 constraintField — 物理层无操作'],
      },
    }
  }

  // Step 1: 运行引擎
  const physics = evaluateConstraints({
    constraintField: rawField,
  })

  // Step 2: 构建 resolvedConstraintField
  // 为每个约束求得冲突解算后的最终 weight
  const resolvedField: ResolvedConstraintField = {}

  // 从 conflictDecisions 中提取每个约束被影响的值
  const conflictAdjustments: Record<string, number> = {}
  for (const decision of physics.resolutions) {
    const aKey = decision.conflictKey.split('↔')[0]
    const bKey = decision.conflictKey.split('↔')[1]
    // 记录约束被调整后的值（min 跟踪 — 取最低）
    if (decision.aWeight !== undefined) {
      const origA = rawField[aKey]?.weight ?? 1.0
      const diffA = decision.aWeight - origA
      conflictAdjustments[aKey] = Math.min(conflictAdjustments[aKey] ?? 0, diffA)
    }
    if (decision.bWeight !== undefined) {
      const origB = rawField[bKey]?.weight ?? 1.0
      const diffB = decision.bWeight - origB
      conflictAdjustments[bKey] = Math.min(conflictAdjustments[bKey] ?? 0, diffB)
    }
  }

  // 同时考虑 slack 分配（正向调整）
  const slackAdjustments: Record<string, number> = {}
  for (const alloc of physics.slackAllocation.allocations) {
    slackAdjustments[alloc.target] = alloc.allocatedSlack
  }

  for (const key of fieldKeys) {
    const entry = rawField[key]
    const conflictAdj = conflictAdjustments[key] ?? 0
    const slackAdj = slackAdjustments[key] ?? 0
    const resolved = Math.max(0, Math.min(1, entry.weight + conflictAdj + slackAdj))

    resolvedField[key] = {
      original: entry.weight,
      resolved: Math.round(resolved * 100) / 100,
      mode: entry.mode,
      description: entry.description || '',
      deviation: Math.round((resolved - entry.weight) * 100) / 100,
    }
  }

  // Step 3: 计算 dominantForces
  const dominantForces: DominantForce[] = fieldKeys
    .map(key => ({
      key,
      resolvedWeight: resolvedField[key].resolved,
      conflictsWon: physics.resolutions.filter(
        r => r.conflictKey.startsWith(key + '↔') || r.conflictKey.includes('↔' + key),
      ).length,
    }))
    .sort((a, b) => b.resolvedWeight - a.resolvedWeight)

  // Step 4: 构建人类可读报告
  const decisions = physics.resolutions.map(r =>
    `${r.conflictKey}: ${r.resolution} (deviation ${r.deviation})`,
  )

  return {
    directorUnderstanding,
    resolvedConstraintField: resolvedField,
    conflictDecisions: physics.resolutions,
    slackAllocationMap: physics.slackAllocation,
    dominantForces,
    physicsReport: {
      totalTension: physics.conflictGraph.totalTension ?? 0,
      edgeCount: physics.conflictGraph.edges.length,
      slack: physics.creativeSlack,
      decisions,
    },
  }
}
