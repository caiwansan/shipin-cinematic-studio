/**
 * metrics-framework.ts — AG-V1.2: 统一评测指标框架
 *
 * 8 项指标 + 聚合统计
 */

/** 单条测试结果 */
export interface SingleBenchmarkResult {
  query: string
  expectedIntent: string
  expectedDomain: string

  // 实际结果
  actualIntent: string
  actualDomain: string
  evidenceKeywords: string[]
  evidenceCount: number
  clusterCount: number
  dominanceScore: number
  confidenceLabel: string
  coverageGap: boolean
  budgetExhausted: boolean
  coverageConfidence?: number
  durationMs: number
  timeout: boolean
  error?: string
}

/** 聚合指标 */
export interface AggregatedMetrics {
  // 意图准确率
  intentAccuracy: number
  // 证据精确率 — 每条证据命中预期关键词的比例
  evidencePrecision: number
  // 证据覆盖率 — 至少命中1个关键词的用例占比
  evidenceCoverage: number
  // 簇纯度 — cluster数量与意图是否匹配
  clusterPurity: number
  // 主导稳定性 — cross-cluster interaction 后的 dominance 集中度
  dominanceStability: number
  // 置信校准 — confidenceLabel 与实际精度的相关性
  confidenceCalibration: number
  // 覆盖感知 — coverageGap 触发率
  coverageAwareness: number
  // 预算耗尽率
  exhaustionRate: number
}

/** 打分辅助 */
function scorePrecision(actual: string[], expected: string[]): number {
  if (actual.length === 0 && expected.length === 0) return 1
  if (actual.length === 0) return 0
  // 每个预期关键词是否出现在实际证据中
  const matched = expected.filter(kw => actual.some(a => a.toLowerCase().includes(kw.toLowerCase())))
  return expected.length > 0 ? matched.length / expected.length : 1
}

/** 计算聚合指标 */
export function computeAggregatedMetrics(results: SingleBenchmarkResult[]): AggregatedMetrics {
  const n = results.filter(r => !r.timeout).length
  if (n === 0) return {
    intentAccuracy: 0, evidencePrecision: 0, evidenceCoverage: 0, clusterPurity: 0,
    dominanceStability: 0, confidenceCalibration: 0, coverageAwareness: 0, exhaustionRate: 0,
  }

  const valid = results.filter(r => !r.timeout)

  // Intent Accuracy
  const correctIntents = valid.filter(r => r.actualIntent === r.expectedIntent).length
  const intentAccuracy = correctIntents / n

  // Evidence Precision — 每条结果的 precision 平均
  let totalPrecision = 0
  let totalCovered = 0
  let totalClusterPurity = 0
  let totalDominance = 0

  for (const r of valid) {
    const prec = scorePrecision(r.evidenceKeywords, r.expectedEvidenceKeywords)
    totalPrecision += prec
    if (prec > 0) totalCovered++
    totalClusterPurity += r.clusterCount === 1 ? 1 : 1 / r.clusterCount
    totalDominance += r.dominanceScore
  }

  const evidencePrecision = totalPrecision / n
  const evidenceCoverage = totalCovered / n
  const clusterPurity = totalClusterPurity / n
  const dominanceStability = totalDominance / n

  // Confidence Calibration — confidenceLabel 与 precision 是否一致
  // 简化：confidenceLabel 高(high_medium)且 precision>0.5 算校准好
  const calibrated = valid.filter(r => {
    const highConf = r.confidenceLabel === 'high' || r.confidenceLabel === 'medium'
    const goodPrec = scorePrecision(r.evidenceKeywords, r.expectedEvidenceKeywords) > 0.5
    return highConf === goodPrec
  }).length
  const confidenceCalibration = calibrated / n

  const coverageAwareness = valid.filter(r => r.coverageGap).length / n
  const exhaustionRate = valid.filter(r => r.budgetExhausted).length / n

  return {
    intentAccuracy: round(intentAccuracy),
    evidencePrecision: round(evidencePrecision),
    evidenceCoverage: round(evidenceCoverage),
    clusterPurity: round(clusterPurity),
    dominanceStability: round(dominanceStability),
    confidenceCalibration: round(confidenceCalibration),
    coverageAwareness: round(coverageAwareness),
    exhaustionRate: round(exhaustionRate),
  }
}

/** 领域分组统计 */
export function computeDomainMetrics(results: SingleBenchmarkResult[]): Record<string, AggregatedMetrics> {
  const domains = [...new Set(results.map(r => r.expectedDomain))]
  const domainMetrics: Record<string, AggregatedMetrics> = {}
  for (const domain of domains) {
    const domainResults = results.filter(r => r.expectedDomain === domain)
    domainMetrics[domain] = computeAggregatedMetrics(domainResults)
  }
  return domainMetrics
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000
}
