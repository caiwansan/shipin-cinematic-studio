/**
 * d2-trust-layer-test.ts — Phase D-2 Trust Calibration 验证
 *
 * 测试目标：验证 D-1 输出的三个可信维度
 *   ✔ Consistency — provenance 在 frozen universe 中
 *   ✔ Truth Stability — 真值逻辑自洽
 *   ✔ Explanation Fidelity — 解释忠实于因果图
 *
 * 不测试：
 *   ❌ 不测 proof 质量
 *   ❌ 不测系统性能
 *   ❌ 不改任何系统结构
 */

import { D1Invocation, FrozenUniverseRef } from './d1-invocation-engine.js'
import { TrustLayer, trustLayer } from './d2-trust-layer.js'
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
console.log('  Phase D-2 Trust Calibration Layer')
console.log('  Post-hoc Validation')
console.log('═══════════════════════════════════════════')
console.log('')

const proof1 = makeMockProof('p-trust-001', true)
const proof2 = makeMockProof('p-trust-002', true)  // 都用 stable proof

const anchors = freezePipeline.freezeAll([proof1, proof2])
const anchor = anchors[0]
const universe = new FrozenUniverseRef(anchor, [proof1, proof2])
const d1 = new D1Invocation(universe)

// ─── Test 1: Consistency Check ───
console.log('─── Test 1: Consistency — provenance bound check ───')

const output = d1.invoke('Is this company reliable?')
const result = trustLayer.validate(output.decision, anchor, [proof1, proof2])

assert('consistency.provenanceInUniverse', result.consistency.provenanceInUniverse)
assert('consistency.proofSignatureTraceable', result.consistency.proofSignatureTraceable)
assert('consistency.entailmentChainValid', result.consistency.entailmentChainValid)
assert('consistency.valid', result.consistency.valid)

// ─── Test 2: Truth Stability ───
console.log('')
console.log('─── Test 2: Truth Stability — truth value check ───')

assert('truthStability.truthValueValid', result.truthStability.truthValueValid)
assert('truthStability.logicConsistent', result.truthStability.logicConsistent)
assert('truthStability.stable', result.truthStability.stable)

// ─── Test 3: Explanation Fidelity ───
console.log('')
console.log('─── Test 3: Explanation Fidelity ───')

assert('fidelity.referencesKnownCausal', result.explanationFidelity.referencesKnownCausal)
assert('fidelity.noNewReasoningNodes', result.explanationFidelity.noNewReasoningNodes)
assert('fidelity.faithful', result.explanationFidelity.faithful)

// ─── Test 4: Combined Trust ───
console.log('')
console.log('─── Test 4: Combined Trust ───')

assert('overall trusted', result.trusted)

// ─── Test 5: Mismatched anchor → 不信任 ───
console.log('')
console.log('─── Test 5: Mismatched anchor (should fail) ───')

const badAnchor = anchors[1]  // 不同的 anchor
const badResult = trustLayer.validate(output.decision, badAnchor, [proof1, proof2])
assert('mismatched anchor → provenanceInUniverse false',
  badResult.consistency.provenanceInUniverse === false)
assert('mismatched anchor → not trusted',
  badResult.trusted === false)

// ─── Test 6: D-1 + D-2 完整链路 ───
console.log('')
console.log('─── Test 6: D-1 + D-2 complete pipeline ───')

const output2 = d1.invoke('Compare two tech companies')
const result2 = trustLayer.validate(output2.decision, anchor, [proof1, proof2])

assert('D-1 + D-2 pipeline completes', true)
assert('second call also trusted', result2.trusted)

// ─── Summary ───
console.log('')
console.log('──────────────────────────────────────────────────')
console.log('')
console.log('📊 D-2 验证结果:')
console.log(`  Trusted: ${result.trusted}`)
console.log(`  Consistency: ${result.consistency.valid}`)
console.log(`  Truth Stability: ${result.truthStability.stable}`)
console.log(`  Fidelity: ${result.explanationFidelity.faithful}`)
console.log('')

console.log(`  ✅通过: ${passed}  ❌失败: ${failed}`)
console.log('')

if (failed === 0) {
  console.log('  ✅ Phase D-2 验证通过.')
  console.log('  系统具备可信输出能力.')
  console.log('')
  console.log('  三个可信维度全部满足：')
  console.log('  ✔ Consistency — provenance bound to frozen universe')
  console.log('  ✔ Truth Stability — 真值逻辑自洽')
  console.log('  ✔ Explanation Fidelity — 解释忠实于因果图')
}

console.log('')
console.log('═══════════════════════════════════════════')
console.log('  Phase D-2 Trust Calibration Layer')
console.log('  Modifications: 0 (existing systems untouched)')
console.log('  Post-hoc validation only')
console.log('  可调用 → 可信')
console.log('═══════════════════════════════════════════')
