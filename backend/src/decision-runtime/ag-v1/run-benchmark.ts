#!/usr/bin/env tsx
/**
 * run-benchmark.ts — AG-V1 Benchmark 入口
 *
 * 用法:
 *   npx tsx src/decision-runtime/ag-v1/run-benchmark.ts          # 从头开始
 *   npx tsx src/decision-runtime/ag-v1/run-benchmark.ts --resume # 续跑
 *   npx tsx src/decision-runtime/ag-v1/run-benchmark.ts --case=73 # 单条调试
 */

import { runBenchmark } from './replay-runner.js'

async function main() {
  const args = process.argv.slice(2)
  const resume = args.includes('--resume')
  const caseIdxArg = args.find(a => a.startsWith('--case='))
  const singleCase = caseIdxArg ? parseInt(caseIdxArg.split('=')[1], 10) : undefined

  console.log('========================================')
  console.log('  AG-V1 Benchmark Runner')
  console.log('========================================\n')

  if (singleCase !== undefined) {
    console.log(`  模式: 单条调试 (Case #${singleCase + 1})`)
  } else if (resume) {
    console.log('  模式: 续跑')
  } else {
    console.log('  模式: 全量评测 (200条)')
  }
  console.log()

  const { summary, domainMetrics } = await runBenchmark(
    'http://127.0.0.1:4002/api/p0/gateway',
    'benchmark-report.json',
    { resume, singleCase }
  )

  // 单条调试模式不需要打印完整报告
  if (singleCase !== undefined) return

  console.log('\n========================================')
  console.log('  最终报告摘要')
  console.log('========================================\n')

  console.log('--- 全系统指标 ---')
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
  }

  console.log('\n--- 各领域指标 ---')
  for (const [domain, metrics] of Object.entries(domainMetrics)) {
    console.log(`  [${domain}]`)
    for (const [k, v] of Object.entries(metrics)) {
      console.log(`    ${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
    }
  }
}

main().catch(err => {
  console.error('[AG-V1] Benchmark 失败:', err)
  process.exit(1)
})
