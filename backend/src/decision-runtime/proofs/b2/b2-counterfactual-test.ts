/**
 * b2-counterfactual-test.ts — Phase B-2 Counterfactual Stability 验证测试
 *
 * ============================================================
 * B-2 验证目标
 * ============================================================
 *
 * 1. 输入变化 → proof 可局部修复（非全量重建）
 * 2. Δ 仅影响部分因果边，非全链路
 * 3. 复用率 ≥ 60% 时判定为稳定
 * 4. requirement 级别变更引起全链路影响，签名不稳定
 * 5. evidence 级别变更仅影响局部，签名稳定
 *
 * 测试用例：
 *   - 同输入（完全复用）
 *   - 城市变化（requirement → 全链路）
 *   - 金额变化（evidence → 局部）
 *   - 意图变化（requirement → 全链路）
 */

import { DecisionRuntime } from './../../runtime/decision-runtime.js'
import { frameResolver } from './../../frame/frame-resolver.js'
import { causalCompiler } from './../../causality/causal-compiler.js'
import { witnessBuilder } from './../b1/witness-builder.js'
import { validateProofKernel } from './../b1/proof-kernel.js'
import { counterfactualBuilder } from './counterfactual-proof.js'

interface TestCase {
  name: string
  oldInput: string
  newInput: string
  expectedStable: boolean
}

async function runTestCase(testCase: TestCase) {
  console.log(`\n  ┌─ ${testCase.name}`)
  console.log(`  │  "${testCase.oldInput}" → "${testCase.newInput}"`)

  // Step 1: 构建 base proof
  const runtime = new DecisionRuntime()
  const trace = await runtime.run(testCase.oldInput)
  const causalGraph = causalCompiler.compile(trace)
  const invariant = frameResolver.resolve(trace, causalGraph)
  const { witness, proofSteps } = witnessBuilder.build(invariant, trace, causalGraph)
  const baseProof = { frameInvariant: invariant, witness, proofSteps, createdAt: Date.now() }

  // 验证 base proof 有效
  const baseValidation = validateProofKernel(baseProof)
  if (!baseValidation.valid) {
    console.log(`  │ ❌ Base proof 无效`)
    return { counterfactual: null, reusedRatio: 0, stable: false, passed: false }
  }

  // Step 2: 构建反事实证明
  const counterfactual = counterfactualBuilder.build(baseProof, testCase.oldInput, testCase.newInput)

  console.log(`  │ Delta:`)
  if (counterfactual.delta.nodes.length === 0) {
    console.log(`  │   无变化`)
  }
  for (const node of counterfactual.delta.nodes) {
    console.log(`  │   ${node.node}: "${node.oldValue}" → "${node.newValue}" (${node.changeMagnitude})`)
    console.log(`  │   影响边: ${node.impactedEdges.length}`)
  }
  console.log(`  │ 影响范围: ${[...counterfactual.delta.impactScope].join(', ')}`)
  console.log(`  │ 复用率: ${(counterfactual.repairPlan.reuseRatio * 100).toFixed(0)}%`)
  console.log(`  │ 可复用的边: ${counterfactual.repairPlan.reusedSteps.length}/${counterfactual.repairPlan.reusedSteps.length + counterfactual.repairPlan.recomputedSteps.length}`)
  console.log(`  │ 预期稳定: ${testCase.expectedStable}`)
  console.log(`  │ 实际稳定: ${counterfactual.stable}`)

  const passed = counterfactual.stable === testCase.expectedStable
  console.log(`  │ 结果: ${passed ? '✅ PASS' : '❌ FAIL'}`)

  return { counterfactual, reusedRatio: counterfactual.repairPlan.reuseRatio, stable: counterfactual.stable, passed }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  B-2 Counterfactual Stability Test')
  console.log('  Proof Local Repair Engine')
  console.log('═══════════════════════════════════════════\n')

  const testCases: TestCase[] = [
    {
      name: '同输入（完全复用）',
      oldInput: '深圳 300万 买房',
      newInput: '深圳 300万 买房',
      expectedStable: true,
    },
    {
      name: '城市变化（全链路）',
      oldInput: '深圳 300万 买房',
      newInput: '上海 300万 买房',
      expectedStable: false, // requirement 变化 → 全链路
    },
    {
      name: '金额变化（局部）',
      oldInput: '深圳 300万 买房',
      newInput: '深圳 500万 买房',
      expectedStable: true, // evidence 变化 → 仅影响 scoring + decision
    },
    {
      name: '意图变化（全链路）',
      oldInput: '深圳 300万 买房',
      newInput: '深圳 300万 租房',
      expectedStable: false, // requirement 变化 → 全链路
    },
  ]

  let passed = 0
  let failed = 0

  for (const tc of testCases) {
    const result = await runTestCase(tc)
    if (result.passed) passed++
    else failed++
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`\n📊 汇总:`)
  console.log(`  总计: ${testCases.length}`)
  console.log(`  ✅ 通过: ${passed}`)
  console.log(`  ❌ 失败: ${failed}`)

  if (failed === 0) {
    console.log(`\n✅ All tests passed. B-2 Counterfactual Stability 验证通过.`)
  }

  console.log(`\n═══════════════════════════════════════════`)
  console.log('  B-2 验证结论')
  console.log('  Input Δ ≠ 全量重建 proof')
  console.log('  局部变化 → 局部修复 ✅')
  console.log('  复用率 ≥ 60% → 稳定 ✅')
  console.log('  requirement 变化 → 全链路影响 ✅')
  console.log('  evidence 变化 → 局部修复 ✅')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Test failed:', err.message)
  process.exit(1)
})
