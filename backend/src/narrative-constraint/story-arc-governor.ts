/**
 * Story Arc Governor
 * 故事弧线总督 — 验证因果图的 arc 形状是否符合约束
 *
 * 核心职能：
 *   arc shape validation — 曲线的整体形状
 *   structural checks — 确保有/无某些叙事阶段
 *   peak detection — 峰值数量和位置
 */

import {
  NarrativeConstraint,
  NarrativeArcType,
  ValidationResult,
  ConstraintViolation,
  TensionCurve,
  CausalNode,
} from './narrative-constraint-types.js'
// Note: DirectorCausalGraph is used via Dynamic import pattern

/**
 * 验证因果图的叙事弧线
 */
export function validateArc(
  graph: any, // DirectorCausalGraph
  constraint: NarrativeConstraint,
): ValidationResult {
  const violations: ConstraintViolation[] = []

  // 1. 从因果图中提取张力曲线
  const tensionCurve = extractTensionCurve(graph)
  const peakPositions = detectPeaks(tensionCurve)

  // 2. ARc 形状验证
  const arcViolations = validateArcShape(tensionCurve, constraint)
  violations.push(...arcViolations)

  // 3. 峰值数量验证
  const peakViolations = validatePeakCount(peakPositions, constraint)
  violations.push(...peakViolations)

  // 4. 必须包含的阶段
  const stageViolations = validateRequiredStages(tensionCurve, peakPositions, constraint)
  violations.push(...stageViolations)

  // 5. 非法转换验证（需要图边信息）
  const transitionViolations = validateForbiddenTransitions(graph, constraint)
  violations.push(...transitionViolations)

  // 6. 计算一致性评分
  const score = computeCoherenceScore(tensionCurve, constraint, violations)

  // 7. 建议修复
  const suggestion = violations.length > 0
    ? suggestRepair(constraint, violations, tensionCurve)
    : undefined

  return {
    valid: violations.length === 0,
    violations,
    score,
    tensionCurve,
    peakPositions,
    suggestedRepair: suggestion,
  }
}

/**
 * 从 DAG 中提取张力曲线
 * 遍历所有 emotion 节点 -> 排序 -> 取 tension
 */
function extractTensionCurve(graph: any): TensionCurve {
  if (!graph || !graph.nodes) return []

  const tensionMap: Map<number, number> = new Map()

  for (const [id, node] of graph.nodes) {
    if (!node || node.layer !== 'emotion') continue
    const tension = node.state?.tension ?? 0.5
    const shotIndex = node.shotIndex ?? 0
    const existing = tensionMap.get(shotIndex) ?? 0
    tensionMap.set(shotIndex, Math.max(existing, tension))
  }

  // 按 shotIndex 排序
  const sorted = [...tensionMap.entries()].sort((a, b) => a[0] - b[0])
  return sorted.map(([, t]) => t)
}

/**
 * 峰值检测
 * 一个点比两边都高则视为峰值
 */
function detectPeaks(curve: TensionCurve): number[] {
  const peaks: number[] = []
  for (let i = 1; i < curve.length - 1; i++) {
    if (curve[i] > curve[i - 1] && curve[i] > curve[i + 1]) {
      peaks.push(i)
    }
  }
  // 端点检查
  if (curve.length >= 2 && curve[0] > curve[1]) peaks.unshift(0)
  if (curve.length >= 2 && curve[curve.length - 1] > curve[curve.length - 2]) peaks.push(curve.length - 1)
  return peaks
}

/**
 * 弧线形状验证
 */
function validateArcShape(
  curve: TensionCurve,
  constraint: NarrativeConstraint,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (curve.length < 2) {
    violations.push({
      ruleId: 'arc-shape-001',
      reason: 'arc_violation',
      message: `曲线长度不足（${curve.length}），无法验证 arc shape`,
      severity: 'error',
    })
    return violations
  }

  switch (constraint.arcType) {
    case 'flat_arc': {
      const mean = curve.reduce((a, b) => a + b, 0) / curve.length
      const variance = curve.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / curve.length
      if (variance > constraint.flatArcVarianceThreshold) {
        violations.push({
          ruleId: 'arc-shape-002',
          reason: 'arc_violation',
          message: `flat_arc 方差 ${variance.toFixed(4)} 超过阈值 ${constraint.flatArcVarianceThreshold}`,
          severity: constraint.strictMode ? 'error' : 'warning',
        })
      }
      break
    }

    case 'rise_fall': {
      // 必须有一个上升段和一个下降段
      const peakIdx = curve.indexOf(Math.max(...curve))
      if (peakIdx === 0) {
        violations.push({
          ruleId: 'arc-shape-003',
          reason: 'arc_violation',
          message: 'rise_fall arc 峰值不能在起点',
          severity: 'error',
        })
      }
      if (peakIdx === curve.length - 1) {
        violations.push({
          ruleId: 'arc-shape-004',
          reason: 'arc_violation',
          message: 'rise_fall arc 没有下降段',
          severity: 'error',
        })
      }
      break
    }

    case 'build_peak_release': {
      const peakIdx = curve.indexOf(Math.max(...curve))
      const midLow = Math.floor(curve.length * 0.35)
      const midHigh = Math.ceil(curve.length * 0.8)
      if (peakIdx < midLow || peakIdx > midHigh) {
        violations.push({
          ruleId: 'arc-shape-005',
          reason: 'arc_violation',
          message: `build_peak_release 峰值位置 ${peakIdx} 不在预期范围 [${midLow}, ${midHigh}]`,
          severity: constraint.strictMode ? 'error' : 'warning',
          suggestion: `建议将峰值移至第 ${Math.floor((midLow + midHigh) / 2)} 镜附近`,
        })
      }
      break
    }

    case 'inverse_arc': {
      const first = curve[0]
      const last = curve[curve.length - 1]
      if (first <= last) {
        violations.push({
          ruleId: 'arc-shape-006',
          reason: 'arc_violation',
          message: 'inverse_arc 应为下降趋势（起点 > 终点）',
          severity: 'error',
        })
      }
      break
    }

    case 'multi_peak': {
      const peaks = detectPeaks(curve)
      if (peaks.length < constraint.minPeaks) {
        violations.push({
          ruleId: 'arc-shape-007',
          reason: 'arc_violation',
          message: `multi_peak 峰值数 ${peaks.length} 不足最小要求 ${constraint.minPeaks}`,
          severity: 'error',
        })
      }
      break
    }
  }

  return violations
}

/**
 * 峰值数量验证
 */
function validatePeakCount(
  peaks: number[],
  constraint: NarrativeConstraint,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (peaks.length < constraint.minPeaks) {
    violations.push({
      ruleId: 'peak-count-001',
      reason: 'peak_count_violation',
      message: `峰值数 ${peaks.length} 低于最小值 ${constraint.minPeaks}`,
      severity: 'error',
    })
  }
  if (peaks.length > constraint.maxPeaks) {
    violations.push({
      ruleId: 'peak-count-002',
      reason: 'peak_count_violation',
      message: `峰值数 ${peaks.length} 超过最大值 ${constraint.maxPeaks}`,
      severity: constraint.strictMode ? 'error' : 'warning',
    })
  }
  return violations
}

/**
 * 必须包含的叙事阶段验证
 */
function validateRequiredStages(
  curve: TensionCurve,
  peaks: number[],
  constraint: NarrativeConstraint,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (constraint.mustContainStages.length === 0) return violations

  const hasRise = curve.length > 1 && curve[curve.length - 1] > curve[0]
  const hasFall = curve.length > 1 && curve[curve.length - 1] < curve[0]
  const hasPeak = peaks.length > 0

  const stageMap: Record<string, boolean> = {
    build: hasRise || (hasPeak && curve[0] < curve[peaks[0]]),
    peak: hasPeak,
    release: hasFall || (hasPeak && curve[peaks[peaks.length - 1]] > curve[curve.length - 1]),
  }

  for (const stage of constraint.mustContainStages) {
    if (!stageMap[stage]) {
      violations.push({
        ruleId: 'required-stage-001',
        reason: 'missing_required_stage',
        message: `缺少必要的叙事阶段: ${stage}`,
        severity: constraint.strictMode ? 'error' : 'warning',
        suggestion: `建议在曲线中插入 ${stage} 阶段`,
      })
    }
  }

  return violations
}

/**
 * 禁止转换验证
 */
function validateForbiddenTransitions(
  graph: any,
  constraint: NarrativeConstraint,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (constraint.forbiddenTransitions.length === 0) return violations

  for (const edge of constraint.forbiddenTransitions) {
    // 在因果图中搜索匹配的转换
    if (!graph.edges) continue
    for (const graphEdge of graph.edges) {
      const fromNode = graph.nodes.get(graphEdge.from)
      const toNode = graph.nodes.get(graphEdge.to)
      if (!fromNode || !toNode) continue

      // 检查是否匹配禁止模式
      if (matchTransitionPattern(fromNode, toNode, edge.from, edge.to)) {
        violations.push({
          ruleId: `forbidden-trans-${edge.from}→${edge.to}`,
          reason: edge.reason,
          nodeId: toNode.id,
          shotIndex: toNode.shotIndex,
          message: `禁止的转换: ${graphEdge.from} → ${graphEdge.to} (${edge.description ?? ''})`,
          severity: 'error',
          suggestion: `建议插入过渡节点`,
        })
      }
    }
  }

  return violations
}

/**
 * 匹配转换模式
 */
function matchTransitionPattern(
  fromNode: any,
  toNode: any,
  fromPattern: string,
  toPattern: string,
): boolean {
  const fromState = fromNode.state ?? {}
  const toState = toNode.state ?? {}

  const fromVal = fromState.grammarType ?? fromState.mood ?? fromState.motionStyle ?? 'unknown'
  const toVal = toState.grammarType ?? toState.mood ?? toState.motionStyle ?? 'unknown'

  return fromVal === fromPattern && toVal === toPattern
}

/**
 * 计算叙事一致性评分
 */
function computeCoherenceScore(
  curve: TensionCurve,
  constraint: NarrativeConstraint,
  violations: ConstraintViolation[],
): number {
  let score = 1.0

  // 违规扣分
  score -= violations.length * 0.15
  violations.forEach(v => {
    if (v.severity === 'error') score -= 0.1
  })

  // 弧类型适合度
  const peakIdx = curve.indexOf(Math.max(...curve))
  const idealPeakRatio = 0.65
  const actualRatio = curve.length > 0 ? peakIdx / curve.length : 0.5
  score -= Math.abs(actualRatio - idealPeakRatio) * 0.2

  // 张力曲线平滑度（跳变多的扣分）
  let jumps = 0
  for (let i = 1; i < curve.length; i++) {
    if (Math.abs(curve[i] - curve[i - 1]) > constraint.maxTensionDelta) {
      jumps++
    }
  }
  score -= jumps * 0.05

  return Math.max(0, Math.min(1, score))
}

/**
 * 建议修复策略
 */
function suggestRepair(
  constraint: NarrativeConstraint,
  violations: ConstraintViolation[],
  curve: TensionCurve,
): string {
  for (const v of violations) {
    switch (v.reason) {
      case 'arc_violation':
        if (curve.length > 2) {
          const peakIdx = curve.indexOf(Math.max(...curve))
          const targetIdx = Math.floor(curve.length * 0.65)
          return `建议将峰值从第 ${peakIdx} 镜移至第 ${targetIdx} 镜附近`
        }
        break
      case 'tension_break':
        return '建议平滑张力跳变：在跳变点之间插入过渡镜头'
      case 'missing_required_stage':
        return `缺少 ${v.message.split(':')[1]?.trim() ?? '必要阶段'}，检查是否需要插入该阶段`
      case 'peak_count_violation':
        return '检查峰值数量，考虑合并或分离峰值阶段'
      case 'forbidden_transition':
        return '检测到非法转换，建议在两者之间插入过渡'
    }
  }
  return '暂无自动修复建议'
}
