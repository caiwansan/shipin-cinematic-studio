/**
 * b45-internal-logic-test.ts — Phase B-4.5 Internal Logic 验证测试
 *
 * ============================================================
 * B-4.5 验证目标
 * ============================================================
 *
 * 1. proof 可表达命题（proposition）
 * 2. 真值可计算（true / false / unknown）
 * 3. P ⊢ Q 蕴含可判定
 * 4. category → logic 桥接有效
 * 5. 真值是内部对象（不在范畴外定义）
 *
 * 本质变化：
 *   B-4: P1 → P2（结构关系）
 *   B-4.5: P ⊢ Q（逻辑蕴含）
 */

import { DecisionRuntime } from './../../runtime/decision-runtime.js'
import { frameResolver } from './../../frame/frame-resolver.js'
import { causalCompiler } from './../../causality/causal-compiler.js'
import { witnessBuilder } from './../b1/witness-builder.js'
import { propositionEvaluator } from './proposition.js'
import { entailmentEngine } from './entailment.js'
import { InternalLogic } from './internal-logic.js'

async function buildProof(input: string) {
  const runtime = new DecisionRuntime()
  const trace = await runtime.run(input)
  const causalGraph = causalCompiler.compile(trace)
  const invariant = frameResolver.resolve(trace, causalGraph)
  const { witness, proofSteps } = witnessBuilder.build(invariant, trace, causalGraph)
  return { frameInvariant: invariant, witness, proofSteps, createdAt: Date.now() }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  B-4.5 Internal Logic Test')
  console.log('  Category → Logic Bridge')
  console.log('═══════════════════════════════════════════\n')

  const proofs = [
    await buildProof('深圳 300万 买房'),
    await buildProof('上海 300万 买房'),
    await buildProof('深圳 500万 买房'),
    await buildProof('北京 200万 投资房'),
  ]

  // ===== Test 1: 命题系统 =====
  console.log('─── Test 1: 命题系统 ───')
  for (const p of proofs) {
    const prop = propositionEvaluator.evaluate(p)
    console.log(`  ${propositionEvaluator.describe(prop)}`)
    console.log(`    stable: ${prop.evidence.stable}, consistent: ${prop.evidence.consistent}`)
  }
  console.log()

  // ===== Test 2: 蕴含判定 =====
  console.log('─── Test 2: 蕴含判定 (P ⊢ Q) ───')
  for (let i = 0; i < proofs.length; i++) {
    for (let j = 0; j < proofs.length; j++) {
      const entail = entailmentEngine.entails(proofs[i], proofs[j])
      const status = entail.holds ? '⊢' : '⊬'
      console.log(`  P${i} ${status} P${j}: ${entail.expression}`)
    }
  }
  console.log()

  // ===== Test 3: Internal Logic System =====
  console.log('─── Test 3: Internal Logic System ───')
  const logic = new InternalLogic('intuitionistic')
  for (const p of proofs) {
    logic.register(p)
  }
  console.log(logic.describe())
  console.log()

  // ===== Test 4: 逻辑系统内部蕴含 =====
  console.log('─── Test 4: 内部蕴含 ───')
  for (let i = 0; i < proofs.length; i++) {
    for (let j = 0; j < proofs.length; j++) {
      const entail = logic.entails(proofs[i], proofs[j])
      if (entail.holds) {
        console.log(`  ✅ ${entail.expression}`)
      }
    }
  }
  console.log()

  // ===== Test 5: 逻辑-范畴桥接 =====
  console.log('─── Test 5: 逻辑-范畴桥接验证 ───')
  const bridge = logic.validateBridge()

  console.log(`  Objects = Propositions:   ${bridge.objectsArePropositions ? '✅' : '❌'}`)
  console.log(`  Identity = Tautology:      ${bridge.identityIsTautology ? '✅' : '❌'}`)
  console.log(`  Composition = Transitivity: ${bridge.compositionIsTransitivity ? '✅' : '❌'}`)
  console.log(`  Truth is Internal:         ${bridge.truthIsInternal ? '✅' : '❌'}`)
  console.log(`  All passed:                ${bridge.allPassed ? '✅' : '❌'}`)
  console.log()

  // ===== 汇总 =====
  console.log('─'.repeat(50))
  console.log('\n📊 汇总:')

  const allProps = proofs.map(p => propositionEvaluator.evaluate(p))

  const results = [
    { name: '所有 proof 可表达命题', passed: allProps.every(p => p.expression.startsWith('P(')) },
    { name: '真值内部可计算', passed: allProps.every(p => ['true', 'false', 'unknown'].includes(p.truth)) },
    { name: '自反蕴含 (P ⊢ P)', passed: entailmentEngine.entails(proofs[0], proofs[0]).holds },
    { name: '同构蕴含 (P ≅ Q → P ⊢ Q)', passed: entailmentEngine.entails(proofs[0], proofs[1]).holds },
    { name: 'Internal Logic 注册', passed: logic.context.propositions.size > 0 },
    { name: 'Truth Object 内部存在', passed: logic.context.truthObject.TRUE.length > 0 || logic.context.truthObject.FALSE.length > 0 },
    { name: '逻辑-范畴桥接', passed: bridge.allPassed },
  ]

  let passed = 0
  let failed = 0
  for (const r of results) {
    const status = r.passed ? '✅' : '❌'
    if (r.passed) passed++
    else failed++
    console.log(`  ${status} ${r.name}`)
  }

  console.log(`\n  ✅通过: ${passed}  ❌失败: ${failed}`)

  if (failed === 0) {
    console.log(`\n  ✅ B-4.5 Internal Logic 验证通过.`)
    console.log('  Category → Logic 桥接完成')
    console.log('  Proof 不再只是结构，携带逻辑语义')
  }

  console.log(`\n═══════════════════════════════════════════`)
  console.log('  B-4.5 关键跃迁验证')
  console.log('  P ⊢ Q (蕴含可计算)')
  console.log('  truth 是内部对象')
  console.log('  objects = propositions')
  console.log('  morphisms = implication proofs')
  console.log('  identity = tautology')
  console.log('  composition = transitivity')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Test failed:', err.message)
  process.exit(1)
})
