/**
 * replay-runner.ts — AG-V1.3: Benchmark Replay Runner
 *
 * 自动执行 200 条测试用例 → 输出 benchmark-report.json
 * 支持 Resume（断点续跑）+ 实时统计（每 10 条）
 *
 * 用法：
 *   npx tsx src/decision-runtime/ag-v1/run-benchmark.ts          # 从头开始
 *   npx tsx src/decision-runtime/ag-v1/run-benchmark.ts --resume # 续跑
 *   npx tsx src/decision-runtime/ag-v1/run-benchmark.ts --case=42 # 单条调试
 */

import { BENCHMARK_CASES, BenchmarkCase } from './benchmark-dataset.js'
import { computeAggregatedMetrics, computeDomainMetrics, SingleBenchmarkResult } from './metrics-framework.js'
import fs from 'fs'
import path from 'path'

const CHECKPOINT_PATH = 'benchmark-checkpoint.json'
const REPORT_PATH = 'benchmark-report.json'

interface GatewayResponse {
  _pipeline?: {
    evidenceCount: number
    clusterCount: number
    durationMs: number
    coverageGap: boolean
    budgetExhausted: boolean
    coverageConfidence: number
  }
  _explanation?: { confidenceLabel: string; conclusion: string }
  _reasoning?: { primaryCluster: string; primaryScore: number; dominanceRatio: number }
  _interaction?: { giniCoefficient: number; edgeCount: number }
  metrics?: { dominantIntent?: string; dominantDomain?: string }
  error?: string
}

interface CheckpointData {
  lastCompleted: number
  results: SingleBenchmarkResult[]
  startTime: number
}

function loadCheckpoint(): CheckpointData | null {
  try {
    if (fs.existsSync(CHECKPOINT_PATH)) {
      const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch {}
  return null
}

function saveCheckpoint(results: SingleBenchmarkResult[], completed: number, startTime: number): void {
  const data: CheckpointData = { lastCompleted: completed, results, startTime }
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data), 'utf-8')
}

function printRealtimeStats(results: SingleBenchmarkResult[], total: number): void {
  const valid = results.filter(r => !r.timeout && !r.error)
  const errors = results.filter(r => r.timeout || r.error)
  const nv = valid.length

  if (nv === 0) {
    console.log(`  [快照] 0 valid / ${results.length} total — 全部失败或超时`)
    return
  }

  const avgEv = valid.reduce((s, r) => s + r.evidenceCount, 0) / nv
  const avgCl = valid.reduce((s, r) => s + r.clusterCount, 0) / nv
  const covGap = valid.filter(r => r.coverageGap).length / nv
  const avgCovConf = valid.reduce((s, r) => s + (r.coverageConfidence || 0), 0) / nv
  const highConf = valid.filter(r => r.confidenceLabel === 'high' || r.confidenceLabel === 'medium').length / nv
  const clustersLe2 = valid.filter(r => r.clusterCount <= 2).length / nv

  // Per-domain
  const domains: Record<string, SingleBenchmarkResult[]> = {}
  for (const r of valid) {
    const d = r.expectedDomain || 'unknown'
    if (!domains[d]) domains[d] = []
    domains[d].push(r)
  }

  const domainSummary = Object.entries(domains).map(([d, cases]) => {
    const n = cases.length
    const ev = cases.reduce((s, c) => s + c.evidenceCount, 0) / n
    const gap = cases.filter(c => c.coverageGap).length / n
    return `${d}:${n}cases ev=${ev.toFixed(1)} gap=${(gap*100).toFixed(0)}%`
  }).join(' | ')

  console.log(`  [快照] ${nv}/${total} valid | evAvg=${avgEv.toFixed(1)} clAvg=${avgCl.toFixed(1)} purity=${(clustersLe2*100).toFixed(0)}% gap=${(covGap*100).toFixed(0)}% confHi=${(highConf*100).toFixed(0)}% | ${domainSummary}`)
}

export async function runBenchmark(
  gatewayUrl: string = 'http://127.0.0.1:4002/api/p0/gateway',
  reportPath: string = REPORT_PATH,
  opts?: { resume?: boolean; singleCase?: number }
): Promise<{
  results: SingleBenchmarkResult[]
  summary: Record<string, unknown>
  domainMetrics: Record<string, unknown>
}> {
  const resume = opts?.resume === true
  const singleCase = opts?.singleCase

  if (singleCase !== undefined) {
    console.log(`[AG-V1] 单条调试模式: Case #${singleCase + 1}`)
    if (singleCase < 0 || singleCase >= BENCHMARK_CASES.length) {
      throw new Error(`Case index ${singleCase} out of range (0-${BENCHMARK_CASES.length - 1})`)
    }
    const tc = BENCHMARK_CASES[singleCase]
    console.log(`[AG-V1] Query: ${tc.query}`)
    console.log(`[AG-V1] Expected: intent=${tc.expectedIntent} domain=${tc.expectedDomain}`)
    const result = await runSingleCase(gatewayUrl, tc)
    console.log(`[AG-V1] Result: ev=${result.evidenceCount} cl=${result.clusterCount} gap=${result.coverageGap} dur=${result.durationMs}ms conf=${result.confidenceLabel}`)
    if (result.timeout) console.log(`[AG-V1] ⚠️ TIMEOUT`)
    if (result.error) console.log(`[AG-V1] ❌ ERROR: ${result.error}`)
    return { results: [result], summary: {} as any, domainMetrics: {} as any }
  }

  let results: SingleBenchmarkResult[] = []
  let startTime = Date.now()
  let completed = 0

  if (resume) {
    const cp = loadCheckpoint()
    if (cp) {
      results = cp.results
      completed = cp.lastCompleted
      startTime = cp.startTime
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      console.log(`[AG-V1] 续跑模式: 已有 ${completed}/${BENCHMARK_CASES.length} 条 (${elapsed}s)`)
    } else {
      console.log('[AG-V1] 未找到检查点，从头开始')
    }
  }

  console.log(`[AG-V1] ${resume ? '续跑' : '开始'} Benchmark：${BENCHMARK_CASES.length} 条用例`)
  console.log(`[AG-V1] 目标URL: ${gatewayUrl}`)
  console.log(`[AG-V1] 预计耗时: ~${(BENCHMARK_CASES.length * 8 / 60).toFixed(0)} 分钟`)

  for (let i = completed; i < BENCHMARK_CASES.length; i++) {
    const tc = BENCHMARK_CASES[i]
    const result = await runSingleCase(gatewayUrl, tc)
    results.push(result)
    completed = i + 1

    // 实时统计：每 10 条
    if (completed % 10 === 0 || completed === BENCHMARK_CASES.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      console.log(`[AG-V1] ${completed}/${BENCHMARK_CASES.length} (${elapsed}s)`)
      printRealtimeStats(results, completed)
    }

    // 每 25 条保存检查点
    if (completed % 25 === 0) {
      saveCheckpoint(results, completed, startTime)
    }

    await new Promise(r => setTimeout(r, 100)) // 100ms spacing
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log(`[AG-V1] 完成！总耗时 ${totalTime}s`)

  // Clean up checkpoint
  try { fs.unlinkSync(CHECKPOINT_PATH) } catch {}

  const summary = computeAggregatedMetrics(results) as any
  const domMetrics = computeDomainMetrics(results) as any

  const report = {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    totalTimeSeconds: parseFloat(totalTime),
    timeoutCount: results.filter(r => r.timeout).length,
    errorCount: results.filter(r => r.error).length,
    summary,
    domainMetrics: domMetrics,
    results: results.map(r => ({
      query: r.query,
      expectedIntent: r.expectedIntent,
      expectedDomain: r.expectedDomain,
      actualIntent: r.actualIntent,
      actualDomain: r.actualDomain,
      evidenceCount: r.evidenceCount,
      clusterCount: r.clusterCount,
      dominanceScore: r.dominanceScore,
      confidenceLabel: r.confidenceLabel,
      coverageGap: r.coverageGap,
      budgetExhausted: r.budgetExhausted,
      durationMs: r.durationMs,
      timeout: r.timeout,
      error: r.error,
    })),
  }

  const reportDir = path.dirname(reportPath)
  if (reportDir !== '.' && !fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`[AG-V1] 报告已写入: ${reportPath}`)

  return { results, summary, domainMetrics: domMetrics }
}

async function runSingleCase(gatewayUrl: string, tc: BenchmarkCase): Promise<SingleBenchmarkResult> {
  const start = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: tc.query }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return makeErrorResult(tc, `HTTP ${response.status}`)
    }

    const data: GatewayResponse = await response.json()
    const durMs = Date.now() - start
    const pipeline = data._pipeline

    if (!pipeline) {
      return makeErrorResult(tc, 'no pipeline')
    }

    return {
      query: tc.query,
      expectedIntent: tc.expectedIntent,
      expectedDomain: tc.expectedDomain,
      actualIntent: data.metrics?.dominantIntent || data._reasoning?.primaryCluster || 'unknown',
      actualDomain: data.metrics?.dominantDomain || 'unknown',
      evidenceKeywords: [],
      evidenceCount: pipeline.evidenceCount ?? 0,
      clusterCount: pipeline.clusterCount ?? 0,
      dominanceScore: data._reasoning?.primaryScore ?? 0,
      confidenceLabel: data._explanation?.confidenceLabel || 'low',
      coverageGap: !!pipeline.coverageGap,
      budgetExhausted: !!pipeline.budgetExhausted,
      coverageConfidence: pipeline.coverageConfidence ?? 0,
      durationMs: pipeline.durationMs || durMs,
      timeout: false,
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return makeErrorResult(tc, 'timeout')
    return makeErrorResult(tc, err.message?.substring(0, 80) || String(err))
  }
}

function makeErrorResult(tc: BenchmarkCase, error: string): SingleBenchmarkResult {
  return {
    query: tc.query,
    expectedIntent: tc.expectedIntent,
    expectedDomain: tc.expectedDomain,
    actualIntent: 'error',
    actualDomain: 'error',
    evidenceKeywords: [],
    evidenceCount: 0, clusterCount: 0, dominanceScore: 0, confidenceLabel: 'low',
    coverageGap: false, budgetExhausted: false, coverageConfidence: 0, durationMs: 0,
    timeout: error === 'timeout',
    error,
  }
}
