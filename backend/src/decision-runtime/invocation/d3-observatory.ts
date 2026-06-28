/**
 * d3-observatory.ts — Phase D-3 System Observatory Kernel
 *
 * ============================================================
 * 这不是系统扩展。
 * 不是 pipeline 优化。
 * 不是 query 增强。
 *
 * 这是：
 *   给系统加一面镜子——让系统"看见自己"
 * ============================================================
 *
 * 三个核心问题：
 *   1. 它稳定吗？（同样输入 → 同样输出？）
 *   2. 它偏差在哪里？（哪些 query pattern 会漂移？）
 *   3. 它解释可靠吗？（proof → decision 是否一致？）
 *
 * 宪法：
 *   ❌ 不改 proof system
 *   ❌ 不改 bridge
 *   ❌ 不改 invocation
 *   ❌ 不增加能力
 *   ✅ 只记录、分析、报告
 */

import type { QueryContract, LookupResult, DecisionArtifact } from '../bridge/bridge-protocol.js'
import type { TruthValue } from '../proofs/b45/proposition.js'

// ============================================================
// 1. Execution Trace — 执行记录
// ============================================================

export interface ExecutionTrace {
  /** 查询唯一标识 */
  queryId: string
  /** 原始输入 */
  input: string
  /** 嵌入类型 */
  embeddingType: string
  /** 嵌入值 */
  embeddingValue: string
  /** 匹配到的 proof 签名列表 */
  matchedProofSignatures: string[]
  /** 决策值 */
  decisionValue: string
  /** 真值 */
  truth: TruthValue
  /** 演绎推理链 */
  entailmentChain: string[]
  /** 时间戳 */
  timestamp: number
  /** 整体可信度 */
  trusted: boolean
}

// ============================================================
// 2. Consistency Analysis — 一致性分析
// ============================================================

export interface ConsistencyReport {
  /** 分析的 queryId */
  queryId: string
  /** 是否确定性稳定 */
  deterministic: boolean
  /** 方差分（0 = 完全一致，越高越不稳定） */
  varianceScore: number
  /** 是否检测到漂移 */
  driftDetected: boolean
  /** 漂移详情 */
  driftDetails?: string[]
  /** 重复次数 */
  runCount: number
  /** 一致的次数 */
  consistentRuns: number
}

export class ConsistencyAnalyzer {
  /**
   * analyze(traces, repeatQueryId): 分析同一 query 的多次执行一致性
   *
   * 不改变系统，只分析已有 trace。
   */
  analyze(traces: ExecutionTrace[], repeatQueryId: string): ConsistencyReport {
    const sameQuery = traces.filter(t => t.queryId === repeatQueryId)
    const runCount = sameQuery.length

    if (runCount < 2) {
      return {
        queryId: repeatQueryId,
        deterministic: true,
        varianceScore: 0,
        driftDetected: false,
        runCount,
        consistentRuns: runCount,
      }
    }

    // 检查决策一致性
    const decisions = sameQuery.map(t => t.decisionValue)
    const uniqueDecisions = new Set(decisions)
    const consistentRuns = decisions.filter(d => d === decisions[0]).length
    const varianceScore = 1 - (consistentRuns / runCount)

    // 检查漂移
    const drifts: string[] = []
    if (uniqueDecisions.size > 1) {
      drifts.push(`Decision value changed: ${[...uniqueDecisions].join(' vs ')}`)
    }

    // 检查 embedding 是否发生变化
    const embeddingTypes = new Set(sameQuery.map(t => t.embeddingType))
    if (embeddingTypes.size > 1) {
      drifts.push(`Embedding type changed: ${[...embeddingTypes].join(', ')}`)
    }

    // 检查证明链是否一致
    const chainLengths = new Set(sameQuery.map(t => t.entailmentChain.length))
    if (chainLengths.size > 1) {
      drifts.push(`Entailment chain length varied: ${[...chainLengths].join(', ')}`)
    }

    return {
      queryId: repeatQueryId,
      deterministic: uniqueDecisions.size <= 1 && drifts.length === 0,
      varianceScore,
      driftDetected: drifts.length > 0,
      driftDetails: drifts.length > 0 ? drifts : undefined,
      runCount,
      consistentRuns,
    }
  }
}

// ============================================================
// 3. Bias Analyzer — 偏差分析
// ============================================================

export interface BiasReport {
  /** 分析的 query pattern */
  pattern: string
  /** 匹配到的 trace 数 */
  totalTraces: number
  /** 不信任的 trace 数 */
  untrustedCount: number
  /** 漂移检测次数 */
  driftCount: number
  /** 最常出现的决策值 */
  dominantDecision: string
  /** 决策分布 */
  decisionDistribution: Record<string, number>
  /** 是否检测到模式偏差 */
  biasDetected: boolean
}

export class BiasAnalyzer {
  /**
   * analyzePattern(traces, pattern): 分析特定 query pattern 下的偏差
   *
   * pattern 是输入字符串中的关键词
   * 不做语义理解，只做模式匹配
   */
  analyzePattern(traces: ExecutionTrace[], pattern: string): BiasReport {
    const matched = traces.filter(t =>
      t.input.toLowerCase().includes(pattern.toLowerCase())
    )

    const untrustedCount = matched.filter(t => !t.trusted).length
    const driftCount = matched.filter(t => t.truth === 'unknown').length

    // 决策分布
    const distribution: Record<string, number> = {}
    for (const t of matched) {
      distribution[t.decisionValue] = (distribution[t.decisionValue] || 0) + 1
    }

    // 主导决策
    let dominantDecision = 'none'
    let maxCount = 0
    for (const [val, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count
        dominantDecision = val
      }
    }

    return {
      pattern,
      totalTraces: matched.length,
      untrustedCount,
      driftCount,
      dominantDecision,
      decisionDistribution: distribution,
      biasDetected: untrustedCount > 0 || driftCount > 0,
    }
  }
}

// ============================================================
// 4. Fidelity Analyzer — 解释一致性分析
// ============================================================

export interface FidelityReport {
  /** 分析的 queryId */
  queryId: string
  /** 解释链是否有效 */
  entailmentChainValid: boolean
  /** 决策值与真值是否一致 */
  decisionTruthAlignment: boolean
  /** 解释链长度与证明匹配度 */
  chainProofAlignment: boolean
  /** 总体解释质量 */
  overallFidelity: 'high' | 'medium' | 'low'
}

export class FidelityAnalyzer {
  /**
   * analyze(trace): 分析单条 trace 的解释一致性
   */
  analyze(trace: ExecutionTrace): FidelityReport {
    // 决策与真值对齐
    const decisionTruthAlignment: boolean = trace.truth !== 'unknown' || trace.decisionValue === 'NO_DECISION'

    // 解释链长度合理性（1-5 为合理）
    const chainProofAlignment = trace.entailmentChain.length >= 1 && trace.entailmentChain.length <= 10

    // 解释链有效性（链中每个条目都包含 proof 签名）
    const entailmentChainValid = trace.entailmentChain.every(expr =>
      expr.includes('⊢') || expr.includes('≅')
    )

    // 总体评分
    const scores = [entailmentChainValid, decisionTruthAlignment, chainProofAlignment]
    const trueCount = scores.filter(Boolean).length
    let overallFidelity: 'high' | 'medium' | 'low'
    if (trueCount >= 3) overallFidelity = 'high'
    else if (trueCount >= 1) overallFidelity = 'medium'
    else overallFidelity = 'low'

    return {
      queryId: trace.queryId,
      entailmentChainValid,
      decisionTruthAlignment,
      chainProofAlignment,
      overallFidelity,
    }
  }
}

// ============================================================
// 5. System Observatory — 系统观测仪
// ============================================================

export interface SystemSummary {
  /** 总执行次数 */
  totalExecutions: number
  /** 信任率 */
  trustRate: number
  /** 确定性率 */
  deterministicRate: number
  /** 解释高保真率 */
  highFidelityRate: number
  /** 检测到的偏差模式 */
  detectedPatterns: string[]
  /** 时间窗 */
  observedSince: number
  observedUntil: number
}

export class SystemObservatory {
  private traces: ExecutionTrace[] = []
  private consistencyAnalyzer: ConsistencyAnalyzer
  private biasAnalyzer: BiasAnalyzer
  private fidelityAnalyzer: FidelityAnalyzer

  constructor() {
    this.consistencyAnalyzer = new ConsistencyAnalyzer()
    this.biasAnalyzer = new BiasAnalyzer()
    this.fidelityAnalyzer = new FidelityAnalyzer()
  }

  /**
   * record(trace): 记录一次执行
   */
  record(trace: ExecutionTrace): void {
    this.traces.push(trace)
  }

  /**
   * getTraces(): 获取所有记录
   */
  getTraces(): ReadonlyArray<ExecutionTrace> {
    return this.traces
  }

  /**
   * analyzeConsistency(queryId): 分析一致性
   */
  analyzeConsistency(queryId: string): ConsistencyReport {
    return this.consistencyAnalyzer.analyze(this.traces, queryId)
  }

  /**
   * analyzeBias(pattern): 分析偏差
   */
  analyzeBias(pattern: string): BiasReport {
    return this.biasAnalyzer.analyzePattern(this.traces, pattern)
  }

  /**
   * analyzeFidelity(queryId): 分析解释一致性
   */
  analyzeFidelity(queryId: string): FidelityReport {
    const trace = this.traces.find(t => t.queryId === queryId)
    if (!trace) {
      return {
        queryId,
        entailmentChainValid: false,
        decisionTruthAlignment: false,
        chainProofAlignment: false,
        overallFidelity: 'low',
      }
    }
    return this.fidelityAnalyzer.analyze(trace)
  }

  /**
   * summary(): 系统摘要
   */
  summary(): SystemSummary {
    const total = this.traces.length
    if (total === 0) {
      return {
        totalExecutions: 0, trustRate: 0, deterministicRate: 0,
        highFidelityRate: 0, detectedPatterns: [],
        observedSince: 0, observedUntil: 0,
      }
    }

    const trusted = this.traces.filter(t => t.trusted).length
    const highFidelity = this.traces.filter(t => {
      const r = this.fidelityAnalyzer.analyze(t)
      return r.overallFidelity === 'high'
    }).length

    // 检测偏差模式
    const biasPatterns = ['company', 'tech', 'risk', 'compare', 'market']
    const detectedPatterns: string[] = []
    for (const pattern of biasPatterns) {
      const report = this.biasAnalyzer.analyzePattern(this.traces, pattern)
      if (report.biasDetected && report.totalTraces > 0) {
        detectedPatterns.push(pattern)
      }
    }

    return {
      totalExecutions: total,
      trustRate: trusted / total,
      deterministicRate: this.traces.filter(t => t.embeddingType === 'exact_signature').length / total,
      highFidelityRate: highFidelity / total,
      detectedPatterns,
      observedSince: this.traces[0]?.timestamp ?? 0,
      observedUntil: this.traces[this.traces.length - 1]?.timestamp ?? 0,
    }
  }
}

/**
 * 单例 SystemObservatory
 */
export const systemObservatory = new SystemObservatory()
