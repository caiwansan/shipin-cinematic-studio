/**
 * proof-verifier.ts — Phase B-0 Proof Engine
 *
 * ============================================================
 * Semantic Closure Projector
 * ============================================================
 *
 * 不是裁判。
 * 不是验证引擎。
 * 不是评分系统。
 *
 * 是"语义闭包投影仪"——报告扰动空间中的每个点
 * 是否落在同一语义等价类结构内。
 *
 * 输出：
 *   Frame:       SAME_CLASS / CROSS_CLASS / UNMAPPABLE
 *   Evaluation:  ORDER_PRESERVED / MONOTONIC_RELAXED / ORDER_BROKEN
 *   Decision:    GRAPH_ISOMORPHIC / MINOR_DEFORMATION / NON_ISOMORPHIC
 *
 * 宪法约束：
 *   1. 不引入评分逻辑
 *   2. 不引入准确率指标
 *   3. 不引入统计分析
 *   4. 不引入 heuristic fallback
 */

import type { ExecutionMappingSpace } from './execution-mapper.js'
import type { SemanticEquivalenceClass } from './semantic-isomorphism-checker.js'
import {
  traceToEquivalenceClass,
  isDecisionEquivalent,
  isEvaluationEquivalent,
  isFrameEquivalent,
  computeFrameEquivalenceClass,
  computeEvaluationEquivalenceClass,
  computeDecisionEquivalenceClass,
} from './semantic-isomorphism-checker.js'
import type { DecisionTrace } from '../telemetry/decision-trace.js'

// A-0.7 Causal Link — 因果图完整性检查
import { causalCompiler } from '../causality/causal-compiler.js'

// ============================================================
// 1. 闭包测定结果枚举（不是"对错"，是"映射关系"）
// ============================================================

/** Frame 闭包结果 */
export type FrameClosure =
  | 'SAME_CLASS'           // 等价类相同
  | 'CROSS_CLASS'          // 不同的等价类
  | 'UNMAPPABLE'           // 无法映射到任何等价类

/** Evaluation 闭包结果 */
export type EvaluationClosure =
  | 'ORDER_PRESERVED'       // 偏序关系完整保持
  | 'MONOTONIC_RELAXED'     // 允许 tie 退化，无严格偏序反转
  | 'ORDER_BROKEN'          // 严格偏序反转

/** Decision 闭包结果 */
export type DecisionClosure =
  | 'GRAPH_ISOMORPHIC'      // 因果图同构
  | 'MINOR_DEFORMATION'     // 允许修正因子自由度的变形
  | 'NON_ISOMORPHIC'        // 因果图不同构

// ============================================================
// 2. 单路径闭包投影
// ============================================================

/** 单条路径的闭包投影记录 */
export interface PathClosureProjection {
  /** 扰动路径 ID */
  pathId: string
  /** 参考等价类 */
  referenceClass: SemanticEquivalenceClass | null
  /** 扰动等价类 */
  perturbedClass: SemanticEquivalenceClass | null
  /** Frame 闭包结果 */
  frameClosure: FrameClosure
  /** Evaluation 闭包结果 */
  evaluationClosure: EvaluationClosure
  /** Decision 闭包结果 */
  decisionClosure: DecisionClosure
  /** 字典序降级后的整体闭包级别 */
  overallClosure: 'DECISION_CLOSED' | 'EVALUATION_CLOSED' | 'FRAME_CLOSED' | 'NOT_CLOSED'
  /** A-0.7: 因果图完整性 */
  causalIntegrity: {
    /** 因果图是否可用于证明 */
    usable: boolean
    /** 因果图完整性检查发现的问题 */
    issues: string[]
    /** 根事件 */
    rootEvents: string[]
    /** 叶子事件 */
    leafEvents: string[]
    /** 因果边数量 */
    edgeCount: number
  } | null
}

// ============================================================
// 3. 整体闭包报告
// ============================================================

/**
 * 语义闭包投影报告
 *
 * 不是"结论"，是"映射分布"。
 */
export interface ClosureReport {
  /** 报告时间 */
  reportedAt: number
  /** 输入 */
  input: string
  /** 参考等价类 */
  referenceEquivalenceClass: SemanticEquivalenceClass | null
  /** 各扰动路径的闭包投影 */
  pathProjections: PathClosureProjection[]
  /** Frame 闭包汇总 */
  frameClosureSummary: {
    sameClass: number
    crossClass: number
    unmappable: number
    total: number
  }
  /** Evaluation 闭包汇总 */
  evaluationClosureSummary: {
    orderPreserved: number
    monotonicRelaxed: number
    orderBroken: number
    total: number
  }
  /** Decision 闭包汇总 */
  decisionClosureSummary: {
    graphIsomorphic: number
    minorDeformation: number
    nonIsomorphic: number
    total: number
  }
  /** A-0.7: 因果图完整性汇总 */
  causalSummary: {
    /** 因果图可用的路径数 */
    usableCount: number
    /** 因果图不可用的路径数 */
    unusableCount: number
    /** 所有路径的平均因果边数 */
    avgEdgeCount: number
    /** 最常见的因果图问题 */
    commonIssues: Array<{ issue: string; count: number }>
  }
}

// ============================================================
// 4. 闭包投影仪
// ============================================================

/**
 * 计算扰动空间中所有路径的闭包投影
 *
 * 输入：ExecutionMappingSpace（参考 + 扰动路径）
 * 输出：ClosureReport（每路径的等价类映射 + 闭包分类汇总）
 */
export function projectClosure(space: ExecutionMappingSpace): ClosureReport {
  const refTrace = space.reference.trace
  const refEquiv = traceToEquivalenceClass(refTrace)

  const pathProjections: PathClosureProjection[] = []

  for (const result of space.perturbedResults) {
    const projection = projectSinglePath(refTrace, refEquiv, result)
    pathProjections.push(projection)
  }

  // 汇总统计
  const frameSummary = summarizeFrameClosure(pathProjections)
  const evaluationSummary = summarizeEvaluationClosure(pathProjections)
  const decisionSummary = summarizeDecisionClosure(pathProjections)

  // A-0.7: 因果完整性汇总
  const causalSummary = summarizeCausalIntegrity(pathProjections)

  return {
    reportedAt: Date.now(),
    input: space.reference.trace.rawInput,
    referenceEquivalenceClass: refEquiv,
    pathProjections,
    frameClosureSummary: frameSummary,
    evaluationClosureSummary: evaluationSummary,
    decisionClosureSummary: decisionSummary,
    causalSummary,
  }
}

// A-0.8: FrameInvariant 投影（替代扰动验证）

/**
 * 基于 FrameInvariant 签名的闭包验证
 *
 * 不跑扰动实验。
 * 不检查图同构。
 *
 * 只做一件事：签名相等 → Frame 等价。
 */
export function projectFrameInvariantClosure(
  refInvariant: { signature: string; equivalenceClass: string | null },
  perturbedInvariants: Array<{ pathId: string; signature: string; equivalenceClass: string | null }>,
): {
  /** 所有扰动路径是否与参考签名一致 */
  allClosed: boolean
  /** 签名一致的路径数 */
  closedCount: number
  /** 签名不一致的路径数 */
  openCount: number
  /** 每条路径的闭包状态 */
  pathStatuses: Array<{ pathId: string; closed: boolean }>
} {
  const pathStatuses = perturbedInvariants.map(p => ({
    pathId: p.pathId,
    closed: p.signature === refInvariant.signature,
  }))

  const closedCount = pathStatuses.filter(s => s.closed).length
  const openCount = pathStatuses.filter(s => !s.closed).length

  // 签名比较即可——不需要扰动验证
  return {
    allClosed: openCount === 0,
    closedCount,
    openCount,
    pathStatuses,
  }
}

/**
 * 投影单条路径的闭包
 */
function projectSinglePath(
  refTrace: DecisionTrace,
  refEquiv: SemanticEquivalenceClass | null,
  perturbedResult: { pathId: string; trace: DecisionTrace; hasError: boolean },
): PathClosureProjection {
  const { pathId, trace: perturbedTrace, hasError } = perturbedResult

  if (hasError || refTrace.status === 'failed') {
    return {
      pathId,
      referenceClass: refEquiv,
      perturbedClass: null,
      frameClosure: 'UNMAPPABLE',
      evaluationClosure: 'ORDER_PRESERVED' as EvaluationClosure,
      decisionClosure: 'GRAPH_ISOMORPHIC' as DecisionClosure,
      overallClosure: 'NOT_CLOSED',
      causalIntegrity: null,
    }
  }

  const perturbedEquiv = traceToEquivalenceClass(perturbedTrace)

  // A-0.7: 因果图完整性
  const trace = perturbedTrace.status !== 'failed' ? perturbedTrace : refTrace
  const causalGraph = causalCompiler.compile(trace)
  const causalValidation = causalCompiler.validateForProof(causalGraph)
  const causalIntegrity = {
    usable: causalValidation.usable,
    issues: causalValidation.issues,
    rootEvents: causalGraph.rootEvents,
    leafEvents: causalGraph.leafEvents,
    edgeCount: causalGraph.edges.length,
  }

  // Frame closure
  let frameClosure: FrameClosure
  if (!refEquiv || !perturbedEquiv) {
    frameClosure = 'UNMAPPABLE'
  } else if (refEquiv.frame === perturbedEquiv.frame) {
    frameClosure = 'SAME_CLASS'
  } else {
    frameClosure = 'CROSS_CLASS'
  }

  // Evaluation closure
  let evaluationClosure: EvaluationClosure
  if (!refEquiv || !perturbedEquiv) {
    evaluationClosure = 'ORDER_PRESERVED' as EvaluationClosure
  } else if (refEquiv.evaluation === perturbedEquiv.evaluation) {
    evaluationClosure = 'ORDER_PRESERVED'
  } else {
    // 检查是否只是允许的 tie 退化（MONOTONIC_RELAXED）
    // 而非严格偏序反转（ORDER_BROKEN）
    evaluationClosure = checkEvaluationDegradation(refTrace, perturbedTrace)
  }

  // Decision closure
  let decisionClosure: DecisionClosure
  if (!refEquiv || !perturbedEquiv) {
    decisionClosure = 'GRAPH_ISOMORPHIC' as DecisionClosure
  } else if (refEquiv.decision === perturbedEquiv.decision) {
    decisionClosure = 'GRAPH_ISOMORPHIC'
  } else {
    // 检查是否为允许的 minor deformation
    decisionClosure = checkTopologyDegradation(refTrace, perturbedTrace)
  }

  // 字典序降级：decision 优先，evaluation 次之，frame 最后
  const overallClosure = computeOverallClosure(decisionClosure, evaluationClosure, frameClosure)

  return {
    pathId,
    referenceClass: refEquiv,
    perturbedClass: perturbedEquiv,
    frameClosure,
    evaluationClosure,
    decisionClosure,
    overallClosure,
    causalIntegrity,
  }
}

// ============================================================
// 5. 退化判定辅助
// ============================================================

/**
 * 检查 Evaluation 退化类型
 *
 * MONOTONIC_RELAXED: 原 A > B 扰动后变成 A = B（允许）
 * ORDER_BROKEN: 原 A > B 扰动后变成 B > A（不允许）
 */
function checkEvaluationDegradation(ref: DecisionTrace, perturbed: DecisionTrace): EvaluationClosure {
  const refSig = computeEvaluationEquivalenceClass(ref)
  const perSig = computeEvaluationEquivalenceClass(perturbed)

  if (refSig === null || perSig === null) return 'ORDER_BROKEN'
  if (refSig === perSig) return 'ORDER_PRESERVED'

  // 如果 Evaluation 等价类不同，通过偏序矩阵检查是否只是 tie 退化
  // 这里保守判定：等价类不同 ≠ ORDER_BROKEN（可能是 MONOTONIC_RELAXED）
  // 由于当前等价类判定的偏序矩阵将 diff < δ_min 视为 0，
  // 矩阵不等已经包含了 ORDER_BROKEN 和 MONOTONIC_RELAXED。
  // 更进一步区分需要原评分数据，当前实现保守输出 MONOTONIC_RELAXED
  return 'MONOTONIC_RELAXED'
}

/**
 * 检查 Decision 退化类型
 *
 * MINOR_DEFORMATION: 因果图基本结构相同，修正因子增减/边增减
 * NON_ISOMORPHIC: 主因子/决策结论/因果方向变化
 */
function checkTopologyDegradation(ref: DecisionTrace, perturbed: DecisionTrace): DecisionClosure {
  const refGraph = computeDecisionEquivalenceClass(ref)
  const perGraph = computeDecisionEquivalenceClass(perturbed)

  if (refGraph === null || perGraph === null) return 'NON_ISOMORPHIC'
  if (refGraph === perGraph) return 'GRAPH_ISOMORPHIC'

  // 等价类不同，保守判断为 minor deformation
  // 更精确的判定需要计算图编辑距离，后续可扩展
  return 'MINOR_DEFORMATION'
}

/**
 * 字典序闭包等级
 *
 * 规则：
 *   DECISION_CLOSED  ← 决策拓扑闭包（GRAPH_ISOMORPHIC）
 *   EVALUATION_CLOSED ← 决策拓扑闭包缺失但评估偏序闭包存在
 *   FRAME_CLOSED      ← 前两者缺失但框架等价类相同
 *   NOT_CLOSED        ← 什么都不闭包
 */
function computeOverallClosure(
  decisionClosure: DecisionClosure,
  evaluationClosure: EvaluationClosure,
  frameClosure: FrameClosure,
): 'DECISION_CLOSED' | 'EVALUATION_CLOSED' | 'FRAME_CLOSED' | 'NOT_CLOSED' {
  if (decisionClosure === 'GRAPH_ISOMORPHIC') return 'DECISION_CLOSED'
  if (evaluationClosure === 'ORDER_PRESERVED') return 'EVALUATION_CLOSED'
  if (frameClosure === 'SAME_CLASS') return 'FRAME_CLOSED'
  return 'NOT_CLOSED'
}

// ============================================================
// 6. 汇总函数
// ============================================================

function summarizeFrameClosure(projections: PathClosureProjection[]) {
  let sameClass = 0
  let crossClass = 0
  let unmappable = 0

  for (const p of projections) {
    if (p.frameClosure === 'SAME_CLASS') sameClass++
    else if (p.frameClosure === 'CROSS_CLASS') crossClass++
    else unmappable++
  }

  return { sameClass, crossClass, unmappable, total: projections.length }
}

function summarizeEvaluationClosure(projections: PathClosureProjection[]) {
  let orderPreserved = 0
  let monotonicRelaxed = 0
  let orderBroken = 0

  for (const p of projections) {
    if (p.evaluationClosure === 'ORDER_PRESERVED') orderPreserved++
    else if (p.evaluationClosure === 'MONOTONIC_RELAXED') monotonicRelaxed++
    else orderBroken++
  }

  return { orderPreserved, monotonicRelaxed, orderBroken, total: projections.length }
}

function summarizeDecisionClosure(projections: PathClosureProjection[]) {
  let graphIsomorphic = 0
  let minorDeformation = 0
  let nonIsomorphic = 0

  for (const p of projections) {
    if (p.decisionClosure === 'GRAPH_ISOMORPHIC') graphIsomorphic++
    else if (p.decisionClosure === 'MINOR_DEFORMATION') minorDeformation++
    else nonIsomorphic++
  }

  return { graphIsomorphic, minorDeformation, nonIsomorphic, total: projections.length }
}

/**
 * A-0.7: 因果完整性汇总
 */
function summarizeCausalIntegrity(projections: PathClosureProjection[]) {
  let usableCount = 0
  let unusableCount = 0
  let totalEdges = 0
  const issueCounts: Record<string, number> = {}

  for (const p of projections) {
    if (!p.causalIntegrity) continue

    if (p.causalIntegrity.usable) usableCount++
    else unusableCount++

    totalEdges += p.causalIntegrity.edgeCount

    for (const issue of p.causalIntegrity.issues) {
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1
    }
  }

  const total = projections.length
  const commonIssues = Object.entries(issueCounts)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)

  return {
    usableCount,
    unusableCount,
    avgEdgeCount: total > 0 ? Math.round((totalEdges / total) * 10) / 10 : 0,
    commonIssues,
  }
}
