/**
 * b0-closure-test.ts — Phase B-0 语义闭包投影端到端测试
 *
 * 不测"对不对"。
 * 只测"在扰动空间中，语义结构是否闭合"。
 *
 * 宪法：
 *   1. 不引入评分逻辑
 *   2. 不引入准确率指标
 *   3. 不引入统计分析
 *   4. 不引入 heuristic fallback
 */

import { generatePerturbationSpace, getReferencePath } from './perturbation-space-generator.js'
import { mapReference } from './execution-mapper.js'
import { projectClosure } from './proof-verifier.js'
import { traceToEquivalenceClass } from './semantic-isomorphism-checker.js'

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  B-0 Semantic Closure Test')
  console.log('  语义闭包投影测试（不是验证测试）')
  console.log('═══════════════════════════════════════════\n')

  const testInput = '深圳 300万 买房'

  // Step 1: 构造扰动空间
  console.log('📦 Step 1: 构造扰动空间 P(x)')
  const space = generatePerturbationSpace(testInput, undefined, undefined, 42)
  console.log(`  输入: "${testInput}"`)
  console.log(`  领域: ${space.domain ?? 'auto-detect'}`)
  console.log(`  扰动路径总数: ${space.pathCount}`)
  console.log(`  单层路径: ${space.paths.filter(p => p.ops.length === 1).length}`)
  console.log(`  跨层路径: ${space.paths.filter(p => p.ops.length > 1).length}\n`)

  // Step 2: 执行参考路径（零扰动）
  console.log('▶️  Step 2: 执行参考路径 x → Trace(x)')
  const refResult = await mapReference(testInput)
  console.log(`  参考路径: ${refResult.pathId}`)
  console.log(`  Trace ID: ${refResult.trace.traceId}`)
  console.log(`  状态: ${refResult.trace.status}`)
  console.log(`  用时: ${refResult.durationMs}ms\n`)

  // 参考等价类
  const refEquiv = traceToEquivalenceClass(refResult.trace)
  console.log(`🔷 参考等价类:`)
  console.log(`  Frame:       ${refEquiv?.frame ?? 'none'}`)
  console.log(`  Evaluation:  ${refEquiv?.evaluation ?? 'none'}`)
  console.log(`  Decision:    ${refEquiv?.decision ?? 'none'}\n`)

  // Step 3: 执行扰动路径并投影闭包
  console.log('🔄 Step 3: 投影闭包')
  console.log(`  执行 ${space.paths.length} 条扰动路径...`)

  // 构建 ExecutionMappingSpace（只跑前 5 条路径以减少耗时）
  const samplePaths = space.paths.slice(0, 5)
  const { mapPerturbed } = await import('./execution-mapper.js')

  const perturbedResults = []
  for (const path of samplePaths) {
    const result = await mapPerturbed(testInput, path)
    perturbedResults.push(result)
    console.log(`    ✔ ${path.id.padEnd(18)} ${result.hasError ? '❌ ERROR' : '✅ done'} (${result.durationMs}ms)`)
  }

  const mappingSpace = {
    totalPaths: samplePaths.length + 1,
    succeededCount: perturbedResults.filter(r => !r.hasError).length + (refResult.hasError ? 0 : 1),
    failedCount: perturbedResults.filter(r => r.hasError).length + (refResult.hasError ? 1 : 0),
    reference: refResult,
    perturbedResults,
    createdAt: Date.now(),
  }

  // Step 4: 闭包投影
  console.log('\n📊 Step 4: 闭包投影分析')
  const report = projectClosure(mappingSpace)

  console.log(`\n🔷 Frame 闭包:                `)
  console.log(`   SAME_CLASS: ${report.frameClosureSummary.sameClass}`)
  console.log(`   CROSS_CLASS: ${report.frameClosureSummary.crossClass}`)
  console.log(`   UNMAPPABLE:  ${report.frameClosureSummary.unmappable}`)

  console.log(`\n🔷 Evaluation 闭包:            `)
  console.log(`   ORDER_PRESERVED:     ${report.evaluationClosureSummary.orderPreserved}`)
  console.log(`   MONOTONIC_RELAXED:   ${report.evaluationClosureSummary.monotonicRelaxed}`)
  console.log(`   ORDER_BROKEN:        ${report.evaluationClosureSummary.orderBroken}`)

  console.log(`\n🔷 Decision 闭包:             `)
  console.log(`   GRAPH_ISOMORPHIC:    ${report.decisionClosureSummary.graphIsomorphic}`)
  console.log(`   MINOR_DEFORMATION:   ${report.decisionClosureSummary.minorDeformation}`)
  console.log(`   NON_ISOMORPHIC:      ${report.decisionClosureSummary.nonIsomorphic}`)

  console.log(`\n🔷 字典序闭包等级分布:`)
  const levels = report.pathProjections.reduce((acc, p) => {
    acc[p.overallClosure] = (acc[p.overallClosure] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  for (const [level, count] of Object.entries(levels)) {
    console.log(`   ${level}: ${count}`)
  }

  console.log(`\n🔷 详细路径投影:`)
  for (const p of report.pathProjections) {
    const causalInfo = p.causalIntegrity
      ? `[因果: ${p.causalIntegrity.edgeCount}边 ${p.causalIntegrity.usable ? '✅可用' : '❌不可用'}]`
      : '[因果: 无]'
    console.log(`   ${p.pathId.padEnd(20)} F=${p.frameClosure.padEnd(14)} E=${p.evaluationClosure.padEnd(20)} D=${p.decisionClosure.padEnd(20)} => ${p.overallClosure} ${causalInfo}`)
  }

  console.log(`\n🔷 因果完整性汇总:`)
  console.log(`   ✅ 可用: ${report.causalSummary.usableCount}`)
  console.log(`   ❌ 不可用: ${report.causalSummary.unusableCount}`)
  console.log(`   平均因果边数: ${report.causalSummary.avgEdgeCount}`)
  if (report.causalSummary.commonIssues.length > 0) {
    console.log(`   常见问题:`)
    for (const { issue, count } of report.causalSummary.commonIssues) {
      console.log(`     - ${issue} (${count}次)`)
    }
  } else {
    console.log(`   无因果图问题 ✅`)
  }

  console.log(`\n═══════════════════════════════════════════`)
  console.log('  B-0 Semantic Closure Test 完成')
  console.log(`  参考等价类: ${refEquiv ? '(有效)' : '(无效)'}`)
  console.log('  本测试不输出"通过/不通过"结论')
  console.log('  ——只报告等价类映射分布')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
