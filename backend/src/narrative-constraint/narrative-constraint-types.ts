/**
 * Narrative Constraint Types
 * 叙事约束类型定义 — 整个 Narrative Governance 系统的基础协议层
 *
 * 这些类型定义了一个"好故事"应该长什么样
 * Causal Graph IR 保证计算正确
 * Narrative Constraint 保证叙事正确
 */

// ─── Arc 类型 ─────────────────────────────────

export type NarrativeArcType =
  | 'rise_fall'
  | 'build_peak_release'
  | 'flat_arc'
  | 'multi_peak'
  | 'inverse_arc'

export type ArcStage = 'build' | 'peak' | 'release'

/** 张力曲线 — 归一化 0→1 的数组，每个元素代表一个时间片段的张力值 */
export type TensionCurve = number[]

// ─── 禁止转换规则 ────────────────────────────

export type ViolationReason =
  | 'arc_violation'
  | 'tension_break'
  | 'character_inconsistency'
  | 'forbidden_transition'
  | 'missing_required_stage'
  | 'peak_count_violation'
  | 'continuity_break'

export type ForbiddenTransitionRule = {
  from: string
  to: string
  reason: ViolationReason
  description?: string
}

// ─── 约束定义 ─────────────────────────────────

export interface NarrativeConstraint {
  arcType: NarrativeArcType

  /** 全局张力曲线的理想形态 */
  tensionCurve: TensionCurve

  /** 峰值数量约束 */
  maxPeaks: number
  minPeaks: number

  /** 必须包含的故事阶段 */
  mustContainStages: ArcStage[]

  /** 角色弧线锁定（防止角色状态被意外修改） */
  characterArcLock: boolean

  /** 禁止的镜头/情感状态转换 */
  forbiddenTransitions: ForbiddenTransitionRule[]

  /** 严格模式：true=阻止编辑，false=仅警告 */
  strictMode: boolean

  /** 张力曲线最大跳变（默认 0.6） */
  maxTensionDelta: number

  /** 曲线方差阈值（用于 flat_arc 判断） */
  flatArcVarianceThreshold: number
}

// ─── 验证结果 ─────────────────────────────────

export interface ConstraintViolation {
  ruleId: string
  reason: ViolationReason
  nodeId?: string
  shotIndex?: number
  message: string
  severity: 'error' | 'warning'
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  violations: ConstraintViolation[]
  score: number // 0-1 叙事一致性评分
  tensionCurve: TensionCurve
  peakPositions: number[]
  suggestedRepair?: string
}

// ─── 模拟结果 ─────────────────────────────────

export interface SimulationResult {
  wouldPass: boolean
  predictedViolations: ConstraintViolation[]
  score: number
}

// ─── 修复策略 ─────────────────────────────────

export type RepairStrategyKind =
  | 'soften_tension'
  | 'shift_peak'
  | 'reassign_transition'
  | 'insert_transition'
  | 'remove_node'
  | 'do_nothing'

export interface RepairStrategy {
  kind: RepairStrategyKind
  description: string
  confidence: number // 0-1
  nodeId?: string
  targetValue?: any
}

// ─── 缺省约束工厂 ────────────────────────────

export function createDefaultConstraint(arcType: NarrativeArcType = 'build_peak_release'): NarrativeConstraint {
  const base: Partial<NarrativeConstraint> = {
    maxPeaks: 2,
    minPeaks: 1,
    characterArcLock: false,
    maxTensionDelta: 0.6,
    flatArcVarianceThreshold: 0.05,
    strictMode: true,
  }

  switch (arcType) {
    case 'rise_fall':
      return {
        ...base,
        arcType,
        tensionCurve: generateRiseFallCurve(),
        mustContainStages: ['build', 'peak', 'release'],
        forbiddenTransitions: [
          { from: 'peak', to: 'build', reason: 'arc_violation', description: '峰值后不能回到上升段' },
          { from: 'release', to: 'peak', reason: 'arc_violation', description: '释放后不能回到峰值' },
        ],
      } as NarrativeConstraint

    case 'build_peak_release':
      return {
        ...base,
        arcType,
        tensionCurve: generateBuildPeakReleaseCurve(),
        mustContainStages: ['build', 'peak', 'release'],
        forbiddenTransitions: [
          { from: 'peak', to: 'build', reason: 'arc_violation', description: '峰值后不能回到上升段' },
        ],
      } as NarrativeConstraint

    case 'flat_arc':
      return {
        ...base,
        arcType,
        tensionCurve: Array(10).fill(0.4),
        mustContainStages: [],
        forbiddenTransitions: [],
        flatArcVarianceThreshold: 0.08,
      } as NarrativeConstraint

    case 'multi_peak':
      return {
        ...base,
        arcType,
        tensionCurve: generateMultiPeakCurve(),
        mustContainStages: ['build', 'peak', 'release'],
        minPeaks: 2,
        maxPeaks: 5,
        forbiddenTransitions: [
          { from: 'peak', to: 'build', reason: 'arc_violation', description: '峰值后不能直接回到上升段' },
        ],
      } as NarrativeConstraint

    case 'inverse_arc':
      return {
        ...base,
        arcType,
        tensionCurve: generateInverseCurve(),
        mustContainStages: ['release', 'build'],
        forbiddenTransitions: [
          { from: 'build', to: 'release', reason: 'arc_violation', description: '逆弧中上升段不能跳转到释放' },
        ],
      } as NarrativeConstraint

    default:
      return createDefaultConstraint('build_peak_release')
  }
}

// ── Curves ────────────────────────────────────

function generateRiseFallCurve(length = 10): TensionCurve {
  return Array.from({ length }, (_, i) => {
    const t = i / (length - 1)
    return t <= 0.5 ? t * 2 : 2 - t * 2 // 三角形波
  })
}

function generateBuildPeakReleaseCurve(length = 10): TensionCurve {
  // 高保真"上升→峰值→释放"曲线
  const mid = Math.floor(length * 0.65)
  return Array.from({ length }, (_, i) => {
    if (i <= mid) return Math.pow(i / mid, 0.8) * 0.8 + 0.1
    return 0.9 - Math.pow((i - mid) / (length - 1 - mid), 1.2) * 0.8
  })
}

function generateMultiPeakCurve(length = 12): TensionCurve {
  const peaks = [0.3, 0.85, 0.5, 0.9]
  return Array.from({ length }, (_, i) => {
    const pi = (i / length) * peaks.length
    const idx = Math.floor(pi)
    const frac = pi - idx
    const p0 = peaks[Math.min(idx, peaks.length - 1)]
    const p1 = peaks[Math.min(idx + 1, peaks.length - 1)]
    return p0 + (p1 - p0) * frac
  })
}

function generateInverseCurve(length = 10): TensionCurve {
  return Array.from({ length }, (_, i) => {
    const t = i / (length - 1)
    return 0.9 - t * 0.8 // 线性下降
  })
}
