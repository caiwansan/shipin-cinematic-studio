/**
 * d35-normalization.ts — Phase D-3.5 Evaluation Normalization Layer
 *
 * ============================================================
 * 这是评价归一化层。
 *
 * 不做：
 *   ❌ 不改系统结构
 *   ❌ 不增加能力
 *   ❌ 不做 Benchmark
 *
 * 只做一件事：
 *   把 D-3 的观测结果变成"可比较的指标空间"
 * ============================================================
 *
 * 三个核心：
 *   1. Metric Canonicalization — 指标统一到 [0,1] 空间
 *   2. Baseline Definition — 基线建立
 *   3. Score Projection — trace → score vector
 */

import type { ExecutionTrace, SystemSummary } from './d3-observatory.js'

// ============================================================
// 1. 指标标准化空间
// ============================================================

/**
 * 所有指标统一到 [0,1] 空间
 * 0 = 最差，1 = 最佳
 */
export interface NormalizedMetrics {
  /** 稳定性：相同输入 → 相同输出 */
  stability: number
  /** 解释保真度：proof → decision 一致 */
  fidelity: number
  /** 漂移检测：无漂移 = 1，完全漂移 = 0 */
  driftResistance: number
  /** 一致性：provenance 绑定稳定性 */
  consistency: number
  /** 信任率：D-2 通过率 */
  trustRate: number
}

export interface NormalizedReport {
  traceId: string
  metrics: NormalizedMetrics
  /** 综合分数 */
  compositeScore: number
  /** 等级评定 */
  grade: 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'F'
}

// ============================================================
// 2. 基线定义
// ============================================================

export interface BaselineDefinition {
  /** 参考查询集 */
  referenceQueries: BaselineQuery[]
  /** 黄金决策集 */
  goldenDecisions: Record<string, string>
  /** 冻结预期 trace */
  frozenExpectations: Record<string, Partial<NormalizedMetrics>>
  /** 基线创建时间 */
  createdAt: number
}

export interface BaselineQuery {
  input: string
  expectedDecision: string
  expectedTruth: 'true' | 'false' | 'unknown'
  category: string
}

export class Baseline {
  private definition: BaselineDefinition

  constructor(
    referenceQueries: BaselineQuery[],
    goldenDecisions: Record<string, string>,
    frozenExpectations: Record<string, Partial<NormalizedMetrics>>
  ) {
    this.definition = {
      referenceQueries,
      goldenDecisions,
      frozenExpectations,
      createdAt: Date.now(),
    }
  }

  getDefinition(): Readonly<BaselineDefinition> {
    return this.definition
  }

  /**
   * matchGolden(decisionValue): 检查决策是否匹配黄金决策
   */
  matchGolden(queryInput: string, decisionValue: string): boolean {
    const expected = this.definition.goldenDecisions[queryInput]
    if (!expected) return false
    return decisionValue === expected
  }

  /**
   * getExpectedMetrics(signature): 获取期望指标
   */
  getExpectedMetrics(signature: string): Partial<NormalizedMetrics> {
    return this.definition.frozenExpectations[signature] ?? {}
  }
}

// ============================================================
// 3. Metric Canonicalization — 指标统一
// ============================================================

export class MetricCanonicalizer {
  /**
   * canonicalize(trace): 单条 trace → 标准化指标
   */
  canonicalize(trace: ExecutionTrace): NormalizedMetrics {
    // 稳定性 = 嵌入类型一致性（精确签名 = 1.0，无匹配 = 0.5）
    const stability = trace.embeddingType === 'exact_signature'
      ? 1.0
      : trace.embeddingType === 'intent_class'
        ? 0.8
        : trace.embeddingType === 'equivalence_class'
          ? 0.9
          : 0.5

    // 保真度 = 解释链有效 + 决策路径清晰
    const fidelity = trace.entailmentChain.length > 0 ? 1.0 : 0.0

    // 漂移抵抗 = 真值不是 unknown → 无漂移
    const driftResistance = trace.truth === 'true' ? 1.0
      : trace.truth === 'false' ? 0.8
        : 0.2

    // 一致性 = 匹配到 proof 的数量 > 0
    const consistency = trace.matchedProofSignatures.length > 0 ? 1.0 : 0.0

    // 信任率 = D-2 的 trusted 值
    const trustRate = trace.trusted ? 1.0 : 0.0

    return { stability, fidelity, driftResistance, consistency, trustRate }
  }

  /**
   * computeComposite(metrics): 计算综合分数
   *
   * 权重：
   *   stability:       0.25
   *   fidelity:        0.25
   *   driftResistance: 0.20
   *   consistency:     0.15
   *   trustRate:       0.15
   */
  computeComposite(metrics: NormalizedMetrics): number {
    return (
      metrics.stability * 0.25 +
      metrics.fidelity * 0.25 +
      metrics.driftResistance * 0.20 +
      metrics.consistency * 0.15 +
      metrics.trustRate * 0.15
    )
  }

  /**
   * grade(score): 综合分数 → 等级
   */
  grade(score: number): 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 0.95) return 'AAA'
    if (score >= 0.85) return 'AA'
    if (score >= 0.75) return 'A'
    if (score >= 0.60) return 'B'
    if (score >= 0.40) return 'C'
    if (score >= 0.20) return 'D'
    return 'F'
  }
}

// ============================================================
// 4. Score Projection — 投影评分
// ============================================================

export interface ProjectedScore {
  raw: NormalizedMetrics
  composite: number
  grade: string
  baselineDelta?: NormalizedMetrics
}

export class ScoreProjector {
  private canonicalizer: MetricCanonicalizer

  constructor() {
    this.canonicalizer = new MetricCanonicalizer()
  }

  /**
   * project(trace, baseline?): trace → 投影评分
   */
  project(trace: ExecutionTrace, baseline?: Baseline): ProjectedScore {
    const raw = this.canonicalizer.canonicalize(trace)
    const composite = this.canonicalizer.computeComposite(raw)
    const grade = this.canonicalizer.grade(composite)

    let baselineDelta: NormalizedMetrics | undefined
    if (baseline) {
      const expected = baseline.getExpectedMetrics(trace.matchedProofSignatures[0] ?? 'unknown')
      baselineDelta = {
        stability: expected.stability !== undefined ? raw.stability - expected.stability : 0,
        fidelity: expected.fidelity !== undefined ? raw.fidelity - expected.fidelity : 0,
        driftResistance: expected.driftResistance !== undefined ? raw.driftResistance - expected.driftResistance : 0,
        consistency: expected.consistency !== undefined ? raw.consistency - expected.consistency : 0,
        trustRate: expected.trustRate !== undefined ? raw.trustRate - expected.trustRate : 0,
      }
    }

    return { raw, composite, grade, baselineDelta }
  }

  /**
   * projectAll(traces, baseline?): 批量投影
   */
  projectAll(traces: ExecutionTrace[], baseline?: Baseline): ProjectedScore[] {
    return traces.map(t => this.project(t, baseline))
  }
}

// ============================================================
// 5. Evaluation Normalization Layer — 评价归一化层
// ============================================================

export interface NormalizationSummary {
  /** 处理 trace 数 */
  totalProcessed: number
  /** 平均综合分数 */
  averageComposite: number
  /** 最高分数 */
  maxComposite: number
  /** 最低分数 */
  minComposite: number
  /** 等级分布 */
  gradeDistribution: Record<string, number>
  /** 各指标平均值 */
  averageMetrics: NormalizedMetrics
  /** 基线偏差（如果有） */
  baselineDeviation?: NormalizedMetrics
}

export class NormalizationLayer {
  private canonicalizer: MetricCanonicalizer
  private projector: ScoreProjector

  constructor() {
    this.canonicalizer = new MetricCanonicalizer()
    this.projector = new ScoreProjector()
  }

  /**
   * evaluateTrace(trace, baseline?): 单条评估
   */
  evaluateTrace(trace: ExecutionTrace, baseline?: Baseline): NormalizedReport {
    const projected = this.projector.project(trace, baseline)
    return {
      traceId: trace.queryId,
      metrics: projected.raw,
      compositeScore: projected.composite,
      grade: projected.grade,
    }
  }

  /**
   * summarize(projections): 汇总统计
   */
  summarize(projections: ProjectedScore[]): NormalizationSummary {
    if (projections.length === 0) {
      return {
        totalProcessed: 0,
        averageComposite: 0,
        maxComposite: 0,
        minComposite: 0,
        gradeDistribution: {},
        averageMetrics: {
          stability: 0, fidelity: 0, driftResistance: 0,
          consistency: 0, trustRate: 0,
        },
      }
    }

    // 基本统计
    const composites = projections.map(p => p.composite)
    const average = composites.reduce((a, b) => a + b, 0) / composites.length
    const max = Math.max(...composites)
    const min = Math.min(...composites)

    // 等级分布
    const distribution: Record<string, number> = {}
    for (const p of projections) {
      distribution[p.grade] = (distribution[p.grade] || 0) + 1
    }

    // 平均指标
    const sumMetrics = (key: keyof NormalizedMetrics): number => {
      return projections.reduce((s, p) => s + p.raw[key], 0) / projections.length
    }

    return {
      totalProcessed: projections.length,
      averageComposite: average,
      maxComposite: max,
      minComposite: min,
      gradeDistribution: distribution,
      averageMetrics: {
        stability: sumMetrics('stability'),
        fidelity: sumMetrics('fidelity'),
        driftResistance: sumMetrics('driftResistance'),
        consistency: sumMetrics('consistency'),
        trustRate: sumMetrics('trustRate'),
      },
    }
  }
}

/**
 * 单例 NormalizationLayer
 */
export const normalizationLayer = new NormalizationLayer()
