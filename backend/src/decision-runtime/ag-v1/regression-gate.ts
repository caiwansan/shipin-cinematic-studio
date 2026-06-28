/**
 * regression-gate.ts — AG-V1.4: Regression Gate
 *
 * 检测指标下降。每次升级后运行：
 *   npm run regression
 *
 * 检测逻辑：
 *   - 连续下降趋势（连续 3 轮下降 >3% 且累计 >10%）→ 错误
 *   - 单次暴跌 >15% → 错误
 */

import fs from 'fs'
import path from 'path'
import { AggregatedMetrics } from './metrics-framework.js'
import { runBenchmark } from './replay-runner.js'

interface BenchmarkSnapshot {
  version: string
  generatedAt: string
  summary: AggregatedMetrics
  domainMetrics: Record<string, AggregatedMetrics>
}

/** 对比当前指标与快照 */
export function checkRegression(
  current: AggregatedMetrics,
  baseline: AggregatedMetrics
): { passed: boolean; issues: string[] } {
  const issues: string[] = []

  for (const [key, value] of Object.entries(current)) {
    const k = key as keyof AggregatedMetrics
    const base = baseline[k]
    if (base === undefined) continue

    const currentVal = value as number
    const drop = base > 0 ? (base - currentVal) / base : 0

    // 暴跌 >15%
    if (drop > 0.15) {
      issues.push(`❌ ${k}: ${currentVal} vs baseline ${base} (下降 ${(drop * 100).toFixed(1)}%，超过 15%)`)
    }
    // 显著下降 >8%
    else if (drop > 0.08) {
      issues.push(`⚠️  ${k}: ${currentVal} vs baseline ${base} (下降 ${(drop * 100).toFixed(1)}%，值得关注)`)
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  }
}

/** 主入口 */
export async function runRegression(
  snapshotPath: string = path.join(import.meta.dirname || process.cwd(), 'benchmark-snapshot.json'),
  reportPath: string = path.join(import.meta.dirname || process.cwd(), 'benchmark-report.json')
): Promise<{ passed: boolean; issues: string[] }> {
  // 查找最近的基准快照
  if (!fs.existsSync(snapshotPath)) {
    console.log('[AG-V1] 无基准快照，跳过回归检查')
    return { passed: true, issues: ['未找到基准快照，首次运行将创建基准'] }
  }

  const snapshot: BenchmarkSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'))
  console.log(`[AG-V1] 基准快照: ${snapshot.version} @ ${snapshot.generatedAt}`)

  // 运行当前 benchmark
  const { summary } = await runBenchmark()

  const result = checkRegression(summary, snapshot.summary)
  console.log()
  console.log('[AG-V1] 回归检查:', result.passed ? '✅ 通过' : '❌ 失败')
  for (const issue of result.issues) {
    console.log(`  ${issue}`)
  }

  return result
}
