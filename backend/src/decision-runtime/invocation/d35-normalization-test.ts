/**
 * d35-normalization-test.ts — Phase D-3.5 Evaluation Normalization 验证
 *
 * 测试目标：
 *   ✔ 指标标准化（所有指标 ∈ [0,1]）
 *   ✔ 基线定义与匹配
 *   ✔ 投影评分（trace → score vector）
 *   ✔ 汇总统计（平均/分布/偏差）
 *
 * 不测试：
 *   ❌ 不改系统结构
 *   ❌ 不增加能力
 *   ❌ 不做真实 Benchmark
 */

import {
  NormalizationLayer, normalizationLayer,
  MetricCanonicalizer,
  Baseline, BaselineQuery,
  ScoreProjector,
  NormalizedMetrics, NormalizedReport,
  ProjectedScore,
  BaselineDefinition,
} from './d35-normalization.js'
import type { ExecutionTrace } from './d3-observatory.js'

// ============================================================
// Test
// ============================================================

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`)
    failed++
  }
}

function makeTrace(
  queryId: string,
  input: string,
  embeddingType: string,
  truth: 'true' | 'false' | 'unknown',
  trusted: boolean,
  matchCount: number
): ExecutionTrace {
  return {
    queryId,
    input,
    embeddingType,
    embeddingValue: input,
    matchedProofSignatures: matchCount > 0 ? ['sig-' + queryId] : [],
    decisionValue: `DECISION-${queryId}`,
    truth,
    entailmentChain: matchCount > 0 ? [`sig-${queryId} ⊢ sig-${queryId}`] : [],
    timestamp: Date.now(),
    trusted,
  }
}

// ─── Setup ───
console.log('═══════════════════════════════════════════')
console.log('  Phase D-3.5 Evaluation Normalization')
console.log('  Metric Canonicalization')
console.log('═══════════════════════════════════════════')
console.log('')

// ─── Test 1: Metric Canonicalization ───
console.log('─── Test 1: Metric Canonicalization ───')

const canon = new MetricCanonicalizer()

// 理想 trace
const idealTrace = makeTrace('t1', 'signature=p-sig-001', 'exact_signature', 'true', true, 3)
const idealMetrics = canon.canonicalize(idealTrace)
assert('ideal stability = 1.0', idealMetrics.stability === 1.0)
assert('ideal fidelity = 1.0', idealMetrics.fidelity === 1.0)
assert('ideal driftResistance = 1.0', idealMetrics.driftResistance === 1.0)
assert('ideal consistency = 1.0', idealMetrics.consistency === 1.0)
assert('ideal trustRate = 1.0', idealMetrics.trustRate === 1.0)

// 糟糕 trace
const badTrace = makeTrace('t2', 'random stuff', 'partial_frame', 'unknown', false, 0)
const badMetrics = canon.canonicalize(badTrace)
assert('bad stability = 0.5', badMetrics.stability === 0.5)
assert('bad fidelity = 0.0', badMetrics.fidelity === 0.0)
assert('bad driftResistance = 0.2', badMetrics.driftResistance === 0.2)
assert('bad consistency = 0.0', badMetrics.consistency === 0.0)
assert('bad trustRate = 0.0', badMetrics.trustRate === 0.0)

// 所有指标 ∈ [0,1]
assert('所有指标 ∈ [0,1]',
  Object.values(idealMetrics).every(v => v >= 0 && v <= 1) &&
  Object.values(badMetrics).every(v => v >= 0 && v <= 1)
)

// ─── Test 2: Composite Score & Grade ───
console.log('')
console.log('─── Test 2: Composite Score & Grade ───')

const idealComposite = canon.computeComposite(idealMetrics)
const badComposite = canon.computeComposite(badMetrics)

assert('ideal composite >= 0.95', idealComposite >= 0.95)
assert('bad composite < 0.40', badComposite < 0.40)
assert('ideal grade = AAA', canon.grade(idealComposite) === 'AAA')
assert('bad grade = C or lower',
  ['C', 'D', 'F'].includes(canon.grade(badComposite))
)

// ─── Test 3: Baseline ───
console.log('')
console.log('─── Test 3: Baseline ───')

const refQueries: BaselineQuery[] = [
  { input: 'Is company X reliable?', expectedDecision: 'DECISION-t1', expectedTruth: 'true', category: 'trust' },
  { input: 'Compare A vs B', expectedDecision: 'DECISION-t2', expectedTruth: 'true', category: 'comparison' },
]

const goldenDecisions: Record<string, string> = {
  'Is company X reliable?': 'DECISION-t1',
  'Compare A vs B': 'DECISION-t2',
}

const frozenExpectations: Record<string, Partial<NormalizedMetrics>> = {
  'sig-t1': { stability: 1.0, fidelity: 1.0, consistency: 1.0 },
}

const baseline = new Baseline(refQueries, goldenDecisions, frozenExpectations)
const def = baseline.getDefinition()

assert('baseline has ref queries', def.referenceQueries.length === 2)
assert('baseline goldenDecision match', baseline.matchGolden('Is company X reliable?', 'DECISION-t1'))
assert('baseline goldenDecision no match', !baseline.matchGolden('Is company X reliable?', 'wrong'))
assert('baseline has expected metrics', Object.keys(def.frozenExpectations).includes('sig-t1'))

// ─── Test 4: Score Projector ───
console.log('')
console.log('─── Test 4: Score Projection ───')

const projector = new ScoreProjector()
const projection = projector.project(idealTrace, baseline)

assert('projection has raw metrics', projection.raw.stability > 0)
assert('projection has composite', projection.composite > 0)
assert('projection has grade', projection.grade.length > 0)
assert('projection has baselineDelta', projection.baselineDelta !== undefined)
assert('baselineDelta values are numbers',
  typeof projection.baselineDelta!.stability === 'number'
)

// ─── Test 5: NormalizationLayer ───
console.log('')
console.log('─── Test 5: Normalization Layer ───')

const report = normalizationLayer.evaluateTrace(idealTrace, baseline)
assert('report has traceId', report.traceId === 't1')
assert('report has metrics', report.metrics.stability > 0)
assert('report has composite', report.compositeScore > 0)
assert('report has grade', report.grade.length > 0)

// ─── Test 6: Summary ───
console.log('')
console.log('─── Test 6: Summary ───')

const traces = [
  makeTrace('t3', 'query 1', 'exact_signature', 'true', true, 2),
  makeTrace('t4', 'query 2', 'intent_class', 'true', true, 1),
  makeTrace('t5', 'query 3', 'partial_frame', 'unknown', false, 0),
]
const projections = projector.projectAll(traces)
const summary = normalizationLayer.summarize(projections)

assert('summary has totalProcessed', summary.totalProcessed === 3)
assert('summary has averageComposite', summary.averageComposite > 0)
assert('summary has gradeDistribution', Object.keys(summary.gradeDistribution).length > 0)
assert('summary has averageMetrics', summary.averageMetrics.stability > 0)

// ─── Test 7: Empty Summary ───
console.log('')
console.log('─── Test 7: Empty Summary ───')

const emptySummary = normalizationLayer.summarize([])
assert('empty summary total = 0', emptySummary.totalProcessed === 0)
assert('empty summary grade dist empty',
  Object.keys(emptySummary.gradeDistribution).length === 0
)

// ─── Summary ───
console.log('')
console.log('──────────────────────────────────────────────────')
console.log('')
console.log('📊 D-3.5 验证结果:')
console.log(`  ✅通过: ${passed}  ❌失败: ${failed}`)
console.log('')

if (failed === 0) {
  console.log('  ✅ Phase D-3.5 验证通过.')
  console.log('  系统具备科学评估能力.')
  console.log('')
  console.log('  三件事全部完成：')
  console.log('  ✔ Metric Canonicalization — 指标统一 ∈ [0,1]')
  console.log('  ✔ Baseline Definition — 基线已建立')
  console.log('  ✔ Score Projection — trace → score vector')
}

console.log('')
console.log('═══════════════════════════════════════════')
console.log('  Phase D-3.5 Evaluation Normalization Layer')
console.log('  Modifications: 0 (existing systems untouched)')
console.log('  Pure normalization layer')
console.log('  散点观测 → 科学坐标系')
console.log('═══════════════════════════════════════════')
