/**
 * d3-observatory-test.ts — Phase D-3 System Observatory 验证
 *
 * 测试目标：系统能"看见自己"
 *   ✔ 执行记录（trace）
 *   ✔ 一致性分析（同样输入是否同样输出）
 *   ✔ 偏差分析（哪些 pattern 漂移）
 *   ✔ 解释保真度（proof → decision 一致）
 *   ✔ 系统摘要（自我理解）
 *
 * 不测试：
 *   ❌ 不测系统功能
 *   ❌ 不改系统结构
 *   ❌ 不增加能力
 */

import { D1Invocation, FrozenUniverseRef } from './d1-invocation-engine.js'
import { TrustLayer, trustLayer } from './d2-trust-layer.js'
import {
  SystemObservatory, systemObservatory,
  ConsistencyAnalyzer, BiasAnalyzer, FidelityAnalyzer,
  ExecutionTrace,
} from './d3-observatory.js'
import { FreezePipeline, freezePipeline } from '../proofs/b46/freeze-pipeline.js'
import type { ProofKernel } from '../proofs/b1/proof-kernel.js'
import type { FrameInvariant } from '../../frame/frame-invariant.js'

// ============================================================
// Helpers
// ============================================================

function makeMockFrame(sig: string, stable = true): FrameInvariant {
  return {
    signature: sig,
    equivalenceClass: 'SAME_CLASS',
    frameId: 'frame-' + sig,
    lineage: { requirement: 'r1', world: 'w1', scoring: 's1' },
    constraints: {},
    confidence: 0.85,
    provable: true,
    stable,
  }
}

function makeMockProof(sig: string, stable = true): ProofKernel {
  return {
    frameInvariant: makeMockFrame(sig, stable),
    witness: {
      requirement: null,
      world: null,
      evidence: [],
      scoring: null,
      recommendation: null,
      report: null,
    },
    proofSteps: [],
    createdAt: Date.now(),
  } as ProofKernel
}

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

// ─── Setup ───
console.log('═══════════════════════════════════════════')
console.log('  Phase D-3 System Observatory Kernel')
console.log('  System Self-Observation')
console.log('═══════════════════════════════════════════')
console.log('')

const proof1 = makeMockProof('p-obs-001')
const proof2 = makeMockProof('p-obs-002')

const anchors = freezePipeline.freezeAll([proof1, proof2])
const anchor = anchors[0]
const universe = new FrozenUniverseRef(anchor, [proof1, proof2])
const d1 = new D1Invocation(universe)
const tl = trustLayer

// ─── Test 1: Execution Recording ───
console.log('─── Test 1: Execution Recording ───')

const obs = new SystemObservatory()

const out1 = d1.invoke('Is this company reliable?')
const v1 = tl.validate(out1.decision, anchor, [proof1, proof2])

const trace1: ExecutionTrace = {
  queryId: out1.query.queryId,
  input: out1.query.naturalInput,
  embeddingType: out1.query.embedding.type,
  embeddingValue: out1.query.embedding.value,
  matchedProofSignatures: out1.lookup.matchedProofs.map(p => p.frameInvariant.signature),
  decisionValue: out1.decision.value,
  truth: out1.decision.truth,
  entailmentChain: out1.decision.explainability.entailmentChain,
  timestamp: out1.timestamp,
  trusted: v1.trusted,
}

obs.record(trace1)

assert('trace recorded', obs.getTraces().length === 1)
assert('trace has queryId', trace1.queryId.length > 0)
assert('trace has input', trace1.input === 'Is this company reliable?')
assert('trace has decision', trace1.decisionValue.length > 0)
assert('trace has timestamp', trace1.timestamp > 0)

// ─── Test 2: Multiple Executions ───
console.log('')
console.log('─── Test 2: Multiple Executions ───')

// 记录更多 trace
for (let i = 0; i < 3; i++) {
  const out = d1.invoke(`query ${i} about tech company`)
  const v = tl.validate(out.decision, anchor, [proof1, proof2])
  obs.record({
    queryId: out.query.queryId,
    input: out.query.naturalInput,
    embeddingType: out.query.embedding.type,
    embeddingValue: out.query.embedding.value,
    matchedProofSignatures: out.lookup.matchedProofs.map(p => p.frameInvariant.signature),
    decisionValue: out.decision.value,
    truth: out.decision.truth,
    entailmentChain: out.decision.explainability.entailmentChain,
    timestamp: out.timestamp,
    trusted: v.trusted,
  })
}

assert('4 traces total', obs.getTraces().length === 4)

// ─── Test 3: Consistency Analysis ───
console.log('')
console.log('─── Test 3: Consistency Analysis ───')

const consistency = obs.analyzeConsistency(trace1.queryId)
assert('consistency has queryId', consistency.queryId === trace1.queryId)
assert('consistency deterministic', consistency.deterministic === true)
assert('consistency variance 0 for single', consistency.varianceScore === 0)
assert('consistency drift not detected', consistency.driftDetected === false)

// ─── Test 4: Bias Analysis ───
console.log('')
console.log('─── Test 4: Bias Analysis ───')

const biasReport = obs.analyzeBias('company')
assert('bias pattern matches', biasReport.totalTraces >= 1)

const biasReport2 = obs.analyzeBias('nonexistent')
assert('bias no match', biasReport2.totalTraces === 0)

// ─── Test 5: Fidelity Analysis ───
console.log('')
console.log('─── Test 5: Fidelity Analysis ───')

const fidelity = obs.analyzeFidelity(trace1.queryId)
assert('fidelity has queryId', fidelity.queryId === trace1.queryId)
assert('fidelity entailmentChainValid', fidelity.entailmentChainValid)
assert('fidelity decisionTruthAlignment', fidelity.decisionTruthAlignment)
assert('fidelity chainProofAlignment', fidelity.chainProofAlignment)
assert('fidelity overall is high', fidelity.overallFidelity === 'high')

// ─── Test 6: Fidelity for unknown query ───
console.log('')
console.log('─── Test 6: Unknown query fidelity ───')

const unknownFid = obs.analyzeFidelity('nonexistent-id')
assert('unknown query fidelity low', unknownFid.overallFidelity === 'low')

// ─── Test 7: System Summary ───
console.log('')
console.log('─── Test 7: System Summary ───')

const summary = obs.summary()
assert('summary has totalExecutions', summary.totalExecutions === 4)
assert('summary has trustRate', summary.trustRate > 0)
assert('summary has observedSince', summary.observedSince > 0)
assert('summary has observedUntil', summary.observedUntil >= summary.observedSince)

// ─── Summary ───
console.log('')
console.log('──────────────────────────────────────────────────')
console.log('')
console.log('📊 D-3 验证结果:')

const allTraces = obs.getTraces()
console.log(`  Traces recorded: ${allTraces.length}`)
console.log(`  Trust rate: ${(summary.trustRate * 100).toFixed(0)}%`)
console.log(`  Fidelity (high): ${(summary.highFidelityRate * 100).toFixed(0)}%`)
console.log(`  Detected bias patterns: ${summary.detectedPatterns.length > 0 ? summary.detectedPatterns.join(', ') : 'none'}`)
console.log('')

console.log(`  ✅通过: ${passed}  ❌失败: ${failed}`)
console.log('')

if (failed === 0) {
  console.log('  ✅ Phase D-3 验证通过.')
  console.log('  系统具备自我观测能力.')
  console.log('')
  console.log('  三个核心问题全部可回答：')
  console.log('  ✔ 它稳定吗？ → Consistency Analyzer')
  console.log('  ✔ 它偏差在哪里？ → Bias Analyzer')
  console.log('  ✔ 它解释可靠吗？ → Fidelity Analyzer')
  console.log('')
  console.log('  系统状态：')
  console.log('  可构造 → 可冻结 → 可调用 → 可信 → 可观测')
}

console.log('')
console.log('═══════════════════════════════════════════')
console.log('  Phase D-3 System Observatory Kernel')
console.log('  Modifications: 0 (existing systems untouched)')
console.log('  Pure observation layer')
console.log('  系统已获得镜子 🪞')
console.log('═══════════════════════════════════════════')
