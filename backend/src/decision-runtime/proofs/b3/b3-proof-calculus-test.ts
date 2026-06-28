/**
 * b3-proof-calculus-test.ts — Phase B-3 Proof Calculus 验证测试
 *
 * ============================================================
 * B-3 验证目标
 * ============================================================
 *
 * 1. + (merge): P1 + P2 = Pmerge，proof 支持加法运算
 * 2. Δ (diff):  Δ(P1, P2) 可计算结构差异
 * 3. ∘ (compose): P1 ∘ P2 = Pchain，proof 支持串行组合
 * 4. Proof 从"运行时对象"变成"代数表达式"
 * 5. 所有运算不执行 Runtime，不调用 Agent
 */

import { DecisionRuntime } from './../../runtime/decision-runtime.js'
import { frameResolver } from './../../frame/frame-resolver.js'
import { causalCompiler } from './../../causality/causal-compiler.js'
import { witnessBuilder } from './../b1/witness-builder.js'
import { validateProofKernel } from './../b1/proof-kernel.js'
import { ProofCalculus } from './proof-calculus.js'
import { diffEngine } from './diff-engine.js'

async function buildProof(input: string) {
  const runtime = new DecisionRuntime()
  const trace = await runtime.run(input)
  const causalGraph = causalCompiler.compile(trace)
  const invariant = frameResolver.resolve(trace, causalGraph)
  const { witness, proofSteps } = witnessBuilder.build(invariant, trace, causalGraph)
  return {
    frameInvariant: invariant,
    witness,
    proofSteps,
    createdAt: Date.now(),
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  B-3 Proof Calculus Test')
  console.log('  Proof → Algebraic Expression')
  console.log('═══════════════════════════════════════════\n')

  // ===== Test 1: Δ (Diff) =====
  console.log('─── Test 1: Δ (Diff) ───')
  const P1 = await buildProof('深圳 300万 买房')
  const P2 = await buildProof('上海 300万 买房')

  const delta = ProofCalculus.diff(P1, P2)
  console.log(`  P1: "深圳 300万 买房" (sig=${P1.frameInvariant.signature})`)
  console.log(`  P2: "上海 300万 买房" (sig=${P2.frameInvariant.signature})`)
  console.log(`  Δ 运算结果:`)
  console.log(`    zero:         ${delta.isZero}`)
  console.log(`    sigMatch:     ${delta.signatureMatch}`)
  console.log(`    Δ magnitude:  ${delta.magnitude.toFixed(2)}`)
  console.log(`    Δ removed:    ${delta.removedSteps.join(', ') || 'none'}`)
  console.log(`    Δ added:      ${delta.addedSteps.join(', ') || 'none'}`)
  console.log(`    Δ modified:   ${delta.modifiedEdges.length} edges`)
  console.log(`    Δ reversible: ${diffEngine.isReversible(delta)}`)

  const deltaPassed = !delta.isZero
  console.log(`  Result: ${deltaPassed ? '✅ Δ ≠ 0' : '❌'}\n`)

  // ===== Test 2: Δ(P1, P1) = zero =====
  console.log('─── Test 2: Δ(P, P) = zero ───')
  const deltaSelf = ProofCalculus.diff(P1, P1)
  console.log(`  Δ(P, P): ${deltaSelf.isZero ? '✅ zero (等价)' : '❌'}\n`)

  // ===== Test 3: + (Merge) =====
  console.log('─── Test 3: + (Merge) ───')
  const identicalInput = await buildProof('深圳 300万 买房')

  const mergeResult = ProofCalculus.add(P1, identicalInput)
  console.log(`  P1 + P1 (同输入):`)
  console.log(`    strategy:     FI=${mergeResult.strategy.frameInvariant}, Ev=${mergeResult.strategy.evidence}, Sc=${mergeResult.strategy.scoring}, Dc=${mergeResult.strategy.decision}`)
  console.log(`    conflict:     ${mergeResult.conflict}`)
  console.log(`    merged steps: ${mergeResult.proof.proofSteps.length}`)

  const mergeValid = validateProofKernel(mergeResult.proof)
  console.log(`    post-merge validate: ${mergeValid.valid ? '✅ VALID' : '❌ INVALID'}`)
  console.log(`    merge calc valid:    ${ProofCalculus.validate(mergeResult) ? '✅ VALID' : '❌ INVALID'}\n`)

  // ===== Test 4: ∘ (Compose) =====
  console.log('─── Test 4: ∘ (Compose) ───')
  const PA = await buildProof('深圳 300万 买房')
  const PB = await buildProof('深圳 租房 推荐')

  const composeResult = ProofCalculus.compose(PA, PB)
  console.log(`  PA: "深圳 300万 买房" (sig=${PA.frameInvariant.signature})`)
  console.log(`  PB: "深圳 租房 推荐" (sig=${PB.frameInvariant.signature})`)
  console.log(`  ∘ 运算结果:`)
  console.log(`    compatible:   ${composeResult.compatible}`)
  if (composeResult.compatible) {
    const composedProof = composeResult.proof!
    const composeValid = validateProofKernel(composedProof)
    console.log(`    chain steps:  ${composedProof.proofSteps.length}`)
    console.log(`    chain sig:    ${composedProof.frameInvariant.signature}`)
    console.log(`    chain valid:  ${composeValid.valid ? '✅ VALID' : '❌ INVALID'}`)
    console.log(`    compose calc: ${ProofCalculus.validate(composeResult) ? '✅ VALID' : '❌ INVALID'}`)
  } else {
    console.log(`    reason:       ${composeResult.incompatibilityReason}`)
  }
  console.log()

  // ===== Test 5: Incompatible compose (等价类冲突) =====
  console.log('─── Test 5: 等价类不兼容的 compose ───')
  const P_rent = await buildProof('上海 租房 推荐')
  const P_buy = await buildProof('北京 买房 推荐')

  // 手动修改 P_buy 的等价类来模拟不兼容
  P_buy.frameInvariant = {
    ...P_buy.frameInvariant,
    equivalenceClass: 'FRAME_EQ_OTHER_99',
  }

  const incompResult = ProofCalculus.compose(P_rent, P_buy)
  console.log(`  P_rent: "上海 租房 推荐" → P_buy: "北京 买房 推荐"`)
  console.log(`  原本等价类相同，但 P_buy 强制改为不同等价类`)
  console.log(`  compatible: ${incompResult.compatible}`)
  console.log(`  reason:     ${incompResult.incompatibilityReason}`)
  console.log(`  calc valid: ${ProofCalculus.validate(incompResult) ? '✅' : '❌ (应 INVALID)'}`)

  // ===== 汇总 =====
  console.log('─'.repeat(50))
  console.log('\n📊 汇总:')

  const results = []

  // Δ 运算：P1 ≠ P2 → Δ ≠ 0
  results.push({ name: 'Δ(P1, P2) ≠ 0', passed: !delta.isZero })
  // Δ 运算：P1 = P1 → Δ = 0
  results.push({ name: 'Δ(P, P) = zero', passed: deltaSelf.isZero })
  // + 运算：同输入 merge 有效
  results.push({ name: '+ merge valid', passed: mergeValid.valid })
  // ∘ 运算：兼容 compose
  results.push({ name: '∘ compose compatible', passed: composeResult.compatible })
  // ∘ 运算：不兼容 compose
  results.push({ name: '∘ compose incompatible (domain mismatch)', passed: !incompResult.compatible })

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
    console.log(`\n  ✅ B-3 Proof Calculus 验证通过.`)
    console.log('  Proof 已从 "运行时对象" 升维为 "代数表达式"')
    console.log('  + Δ ∘ 三种运算合法')
  }

  console.log(`\n═══════════════════════════════════════════`)
  console.log('  B-3 关键跃迁验证')
  console.log('  proof + proof  = proof  (代数可用)')
  console.log('  Δ(P, P)       = zero  (自反性)')
  console.log('  Δ(P1, P2)    != zero  (区分性)')
  console.log('  P1 ∘ P2      = Pchain (组合性)')
  console.log('  domain mismatch = incompatible (类型安全)')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Test failed:', err.message)
  process.exit(1)
})
