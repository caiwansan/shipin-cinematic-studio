/**
 * d1-invocation-test.ts — Phase D-1 Invocation Engine 验证
 *
 * 测试目标（只测三个指标）：
 *   ✔ Query enters system
 *   ✔ Lookup returns from frozen universe
 *   ✔ DecisionArtifact is produced
 *
 * 不测试：
 *   ❌ 不测 proof 质量
 *   ❌ 不测引擎效率
 *   ❌ 不测多轮对话
 */

import { D1Invocation, FrozenUniverseRef, QueryIngestor, BridgeExecutor, DecisionRenderer, InvocationOutput } from './d1-invocation-engine.js'
import { FreezePipeline, freezePipeline } from '../proofs/b46/freeze-pipeline.js'
import { semanticAnchor, isAnchorFrozen } from '../proofs/b46/semantic-anchor.js'
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

function makeMockProof(sig: string): ProofKernel {
  return {
    frameInvariant: makeMockFrame(sig),
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

// ─── Setup: 构造 frozen universe ───
console.log('═══════════════════════════════════════════')
console.log('  Phase D-1 Minimal Invocation Engine')
console.log('  First Projection Event')
console.log('═══════════════════════════════════════════')
console.log('')

const proof1 = makeMockProof('p-sig-001')
const proof2 = makeMockProof('p-sig-002')

const anchors = freezePipeline.freezeAll([proof1, proof2])
const anchor = anchors[0]

// ─── Test 1: FrozenUniverseRef ───
console.log('─── Test 1: FrozenUniverseRef ───')

const universe = new FrozenUniverseRef(anchor, [proof1, proof2])
assert('universe integrity check', universe.checkIntegrity())
assert('universe has signature', universe.getSignature().length > 0)

// ─── Test 2: Query Ingestion ───
console.log('')
console.log('─── Test 2: Query Ingestion ───')

const ingestor = new QueryIngestor()
const query1 = ingestor.ingest('Is this company reliable?')
const query2 = ingestor.ingest('Compare company A vs company B')
const query3 = ingestor.ingest('signature=p-sig-001')

assert('query1 has queryId', query1.queryId.length > 0)
assert('query1 has naturalInput', query1.naturalInput === 'Is this company reliable?')
assert('query1 embedding type', query1.embedding.type === 'partial_frame')
assert('query1 domain', query1.context?.domain === 'business_intel')
assert('query2 embedding type (comparison)', query2.embedding.type === 'intent_class')
assert('query2 embedding value (comparison)', query2.embedding.value === 'comparison')
assert('query3 embedding type (exact sig)', query3.embedding.type === 'exact_signature')
assert('query3 embedding value (exact sig)', query3.embedding.value === 'p-sig-001')

// ─── Test 3: Bridge Execution ───
console.log('')
console.log('─── Test 3: Bridge Execution ───')

const executor = new BridgeExecutor()
const lookup1 = executor.execute(query1, universe)

assert('lookup has queryId', lookup1.queryId === query1.queryId)
assert('lookup has matched proofs', lookup1.matchedProofs.length > 0)
assert('lookup has entailment', lookup1.entailment.holds === true)
assert('lookup has category alignment', lookup1.categoryAlignment.bestMatch.length > 0)
assert('lookup has anchorSignature', lookup1.anchorSignature.length > 0)

// ─── Test 4: Decision Rendering ───
console.log('')
console.log('─── Test 4: Decision Rendering ───')

const renderer = new DecisionRenderer()
const decision1 = renderer.render(query1.queryId, lookup1)

assert('decision has queryId', decision1.queryId === query1.queryId)
assert('decision has value', decision1.value.length > 0)
assert('decision has confidence', decision1.confidence > 0)
assert('decision has truth', decision1.truth === 'true')
assert('decision has provenance', decision1.provenance.frameInvariantSignature.length > 0)
assert('decision has provenance anchorSignature', decision1.provenance.anchorSignature.length > 0)
assert('decision has explainability', decision1.explainability.entailmentChain.length > 0)
assert('decision has createdAt', decision1.createdAt > 0)

// ─── Test 5: D-1 Full Invocation ───
console.log('')
console.log('─── Test 5: D-1 Full Invocation ───')

const d1 = new D1Invocation(universe)
const output = d1.invoke('Is this tech company innovative?')

assert('output has query', output.query.queryId.length > 0)
assert('output has lookup', output.lookup.matchedProofs.length > 0)
assert('output has decision', output.decision.value.length > 0)
assert('output has timestamp', output.timestamp > 0)
assert('output has universeSignature', output.universeSignature.length > 0)
assert('output.decision.truth', output.decision.truth === 'true')
assert('output.lookup.entailment holds', output.lookup.entailment.holds === true)
assert('output.lookup.category aligned', output.lookup.categoryAlignment.isIsomorphic === true)

// ─── Test 6: Repeated Invocation (同一引擎不同问题) ───
console.log('')
console.log('─── Test 6: Repeated Invocation ───')

const output2 = d1.invoke('Compare two companies')
assert('second output different queryId', output2.query.queryId !== output.query.queryId)
assert('second output has decision', output2.decision.value.length > 0)
assert('second output truth', output2.decision.truth !== undefined)

// ─── Summary ───
console.log('')
console.log('──────────────────────────────────────────────────')
console.log('')
console.log('📊 D-1 Invocation 结果:')
assert('Query enters system', output.query.queryId.length > 0)
assert('Lookup returns from frozen universe', output.lookup.matchedProofs.length > 0)
assert('DecisionArtifact is produced', output.decision.value.length > 0)

console.log('')
console.log(`  ✅通过: ${passed}  ❌失败: ${failed}`)
console.log('')

if (failed === 0) {
  console.log('  ✅ Phase D-1 验证通过.')
  console.log('  Frozen universe 发生第一次外部投影事件.')
  console.log('  系统状态: 数学对象 → 可调用对象')
  console.log('')
  console.log('  三个成功标准全部满足：')
  console.log('  ✔ Query enters system')
  console.log('  ✔ Lookup returns from frozen universe')
  console.log('  ✔ DecisionArtifact is produced')
} else {
  console.log('  ❌ Phase D-1 未通过.')
}

console.log('')
console.log('═══════════════════════════════════════════')
console.log('  Phase D-1 First Projection Event')
console.log('  Modifications: 0 (B system untouched)')
console.log('  Bridge: contract only (no logic expansion)')
console.log('  Single path: query → lookup → decision')
console.log('═══════════════════════════════════════════')
