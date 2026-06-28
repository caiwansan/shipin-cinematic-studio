#!/usr/bin/env node

/**
 * run-benchmark.mjs — npm run benchmark 入口
 *
 * 用法：
 *   npm run benchmark
 *
 * 自动执行全部 200 条 Benchmark → 输出 benchmark-report.json
 */

import { runBenchmark } from './replay-runner.js'

async function main() {
  console.log('========================================')
  console.log('  AG-V1 Benchmark Runner')
  console.log('========================================')
  console.log()

  const { summary, domainMetrics } = await runBenchmark()

  console.log()
  console.log('========================================')
  console.log('  结果摘要')
  console.log('========================================')
  console.log()

  console.log('--- 全系统指标 ---')
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k}: ${v}`)
  }

  console.log()
  console.log('--- 各领域指标 ---')
  for (const [domain, metrics] of Object.entries(domainMetrics)) {
    console.log(`  [${domain}]`)
    for (const [k, v] of Object.entries(metrics)) {
      console.log(`    ${k}: ${v}`)
    }
  }
}

main().catch(err => {
  console.error('[AG-V1] Benchmark 失败:', err)
  process.exit(1)
})
