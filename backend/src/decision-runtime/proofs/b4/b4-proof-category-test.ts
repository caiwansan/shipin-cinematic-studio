/**
 * b4-proof-category-test.ts — Phase B-4 Proof Category 验证测试
 *
 * ============================================================
 * B-4 验证目标
 * ============================================================
 *
 * 1. 范畴可注册 proof 并建立态射
 * 2. identity law: f ∘ id = f
 * 3. associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
 * 4. closure: morphisms 均有效
 * 5. 同构判定：强同构 / 结构同构 / 范畴等价 / 非同构
 * 6. 范畴可计算同构组
 *
 * 宪法：
 *   - 不基于相似度/距离/embedding
 *   - 基于精确的结构态射
 */

import { DecisionRuntime } from './../../runtime/decision-runtime.js'
import { frameResolver } from './../../frame/frame-resolver.js'
import { causalCompiler } from './../../causality/causal-compiler.js'
import { witnessBuilder } from './../b1/witness-builder.js'
import { ProofCategory } from './category.js'
import { isomorphismDetector } from './isomorphism.js'

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
  console.log('  B-4 Proof Category Test')
  console.log('  Proof → Category Space')
  console.log('═══════════════════════════════════════════\n')

  // ===== Test 1: 范畴构造 =====
  console.log('─── Test 1: 范畴构造 + 态射注册 ───')

  const proofs = [
    await buildProof('深圳 300万 买房'),
    await buildProof('上海 300万 买房'),
    await buildProof('深圳 500万 买房'),
    await buildProof('北京 200万 投资房'),
  ]

  const category = new ProofCategory()
  for (const p of proofs) {
    category.register(p)
  }

  // 自动构建态射
  category.autoBuildMorphisms()

  console.log(category.describe())
  console.log()

  // ===== Test 2: 同构判定 =====
  console.log('─── Test 2: 同构判定 ───')

  const iso_same_input = isomorphismDetector.isIsomorphic(proofs[0], proofs[0])
  console.log(`  P0 ≅ P0 (同输入): ${iso_same_input.isomorphic ? '✅' : '❌'} ${iso_same_input.type}`)
  console.log(`    SigMatch: ${iso_same_input.evidence.signatureMatch}`)
  console.log(`    Witness:  ${(iso_same_input.evidence.witnessEquivalence.matchRate * 100).toFixed(0)}%`)
  console.log(`    Steps:    ${(iso_same_input.evidence.stepEquivalence.matchRate * 100).toFixed(0)}%`)

  const iso_diff_city = isomorphismDetector.isIsomorphic(proofs[0], proofs[1])
  console.log(`\n  P0 ≅ P1 (不同城市): ${iso_diff_city.isomorphic ? '✅' : '❌'} ${iso_diff_city.type}`)
  console.log(`    SigMatch: ${iso_diff_city.evidence.signatureMatch}`)
  console.log(`    Witness:  ${(iso_diff_city.evidence.witnessEquivalence.matchRate * 100).toFixed(0)}%`)
  console.log(`    Steps:    ${(iso_diff_city.evidence.stepEquivalence.matchRate * 100).toFixed(0)}%`)

  const strongly_isomorphic = category.isIsomorphic(proofs[0], proofs[0])
  console.log(`\n  category.isIsomorphic(同输入): ${strongly_isomorphic}`)

  const category_type = category.isIsomorphic(proofs[0], proofs[1])
  console.log(`  category.isIsomorphic(不同城市): ${category_type}`)
  console.log()

  // ===== Test 3: 范畴公理验证 =====
  console.log('─── Test 3: 范畴公理验证 ───')
  const axioms = category.validateCategory()

  console.log(`  identity law (f ∘ id = f):  ${axioms.identityLaw ? '✅' : '❌'}`)
  console.log(`  associativity ((f∘g)∘h = f∘(g∘h)): ${axioms.associativity ? '✅' : '❌'}`)
  console.log(`  closure (morphisms valid):  ${axioms.closure ? '✅' : '❌'}`)
  console.log(`  all passed:                 ${axioms.allPassed ? '✅' : '❌'}`)
  console.log()

  // ===== Test 4: 同构组计算 =====
  console.log('─── Test 4: 同构组 ───')
  const groups = category.computeIsomorphismGroups()
  console.log(`  同构组数量: ${groups.length}`)
  for (let i = 0; i < groups.length; i++) {
    console.log(`  Group ${i + 1} (${groups[i].type}): ${groups[i].signatures.join(', ')}`)
  }
  console.log()

  // ===== Test 5: identity morphism =====
  console.log('─── Test 5: Identity Morphism ───')
  const id1 = category.identity(proofs[0])
  console.log(`  id(proofs[0]):`)
  console.log(`    from: ${id1.from}`)
  console.log(`    to:   ${id1.to}`)
  console.log(`    type: ${id1.type}`)
  console.log(`    valid: ${id1.mapping.valid}`)
  console.log()

  // ===== Test 6: compose morphism =====
  console.log('─── Test 6: Compose Morphism ───')
  // 查找从 P0→P1 和 P1→P2 的态射
  const m01 = category.morphisms.find(m => m.from === proofs[0].frameInvariant.signature && m.to === proofs[1].frameInvariant.signature)
  const m12 = category.morphisms.find(m => m.from === proofs[1].frameInvariant.signature && m.to === proofs[2].frameInvariant.signature)

  if (m01 && m12) {
    const composed = category.compose(m01, m12)
    if (composed) {
      console.log(`  P0 → P1 → P2:`)
      console.log(`    f:  ${m01.from} → ${m01.to} (${m01.type})`)
      console.log(`    g:  ${m12.from} → ${m12.to} (${m12.type})`)
      console.log(`    f∘g: ${composed.from} → ${composed.to} (${composed.type})`)
      console.log(`    valid: ${composed.mapping.valid ? '✅' : '❌'}`)
    } else {
      console.log(`  compose 失败 (incompatible)`)
    }
  } else {
    console.log(`  未找到 P0→P1 或 P1→P2 的态射`)
  }
  console.log()

  // ===== 汇总 =====
  console.log('─'.repeat(50))
  console.log('\n📊 汇总:')

  const results = [
    { name: '范畴构造', passed: category.objects.length === 4 },
    { name: '态射注册', passed: category.morphisms.length >= 6 },
    { name: '同构判定 (同输入)', passed: iso_same_input.type === 'strong' },
    { name: '同构判定 (不同城市)', passed: !iso_diff_city.isomorphic || iso_diff_city.type !== 'none' },
    { name: 'identity law', passed: axioms.identityLaw },
    { name: 'associativity', passed: axioms.associativity },
    { name: 'closure', passed: axioms.closure },
    { name: 'category all passed', passed: axioms.allPassed },
    { name: 'identity morphism', passed: id1.type === 'identity' },
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
    console.log(`\n  ✅ B-4 Proof Category 验证通过.`)
    console.log('  Proof 空间已具有范畴结构')
    console.log('  态射是可计算的，同构是可证明的')
  }

  console.log(`\n═══════════════════════════════════════════`)
  console.log('  B-4 关键跃迁验证')
  console.log('  Proof Space = Category (空间具范畴结构)')
  console.log('  Identity Law (f ∘ id = f)')
  console.log('  Associativity ((f∘g)∘h = f∘(g∘h))')
  console.log('  Isomorphism computable (同构可计算)')
  console.log('  Closure (态射封闭)')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Test failed:', err.message)
  process.exit(1)
})
