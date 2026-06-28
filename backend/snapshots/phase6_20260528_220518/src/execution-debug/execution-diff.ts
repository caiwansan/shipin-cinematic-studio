/**
 * execution-debug/execution-diff.ts — 执行对比引擎
 *
 * 对比两条 trace 的差异（成功 vs 失败 / 快 vs 慢）。
 */

import type { ExecutionTrace } from '../execution-trace/index.js'

export interface DiffResult {
  /** 基本信息差异 */
  providerDiff: [string, string]
  modelDiff: [string, string]
  /** 耗时差异（b - a） */
  latencyDiffMs: number
  /** 步数差异 */
  stepCountDiff: [number, number]
  /** 独有步骤 */
  onlyInA: string[]
  onlyInB: string[]
  /** 状态差异 */
  statusDiff: [string, string]
  /** 错误差异 */
  errorDiff: [string | undefined, string | undefined]
}

export function diffTraces(a: ExecutionTrace, b: ExecutionTrace): DiffResult {
  const stepNamesA = a.steps.map(s => s.name)
  const stepNamesB = b.steps.map(s => s.name)

  return {
    providerDiff: [a.provider, b.provider],
    modelDiff: [a.model, b.model],
    latencyDiffMs: ((b.endTime ?? 0) - (b.startTime ?? 0)) - ((a.endTime ?? 0) - (a.startTime ?? 0)),
    stepCountDiff: [a.steps.length, b.steps.length],
    onlyInA: stepNamesA.filter(s => !stepNamesB.includes(s)),
    onlyInB: stepNamesB.filter(s => !stepNamesA.includes(s)),
    statusDiff: [a.status, b.status],
    errorDiff: [a.error, b.error],
  }
}

export function formatDiff(d: DiffResult): string {
  const lines: string[] = []
  lines.push(`Provider: ${d.providerDiff[0]} → ${d.providerDiff[1]}`)
  lines.push(`Model: ${d.modelDiff[0]} → ${d.modelDiff[1]}`)
  lines.push(`Status: ${d.statusDiff[0]} → ${d.statusDiff[1]}`)
  lines.push(`Latency diff: ${d.latencyDiffMs >= 0 ? '+' : ''}${d.latencyDiffMs}ms`)
  lines.push(`Steps: ${d.stepCountDiff[0]} → ${d.stepCountDiff[1]}`)
  if (d.onlyInA.length > 0) lines.push(`Only in A: ${d.onlyInA.join(', ')}`)
  if (d.onlyInB.length > 0) lines.push(`Only in B: ${d.onlyInB.join(', ')}`)
  if (d.errorDiff[0]) lines.push(`A error: ${d.errorDiff[0]}`)
  if (d.errorDiff[1]) lines.push(`B error: ${d.errorDiff[1]}`)
  return lines.join('\n')
}
