/**
 * Benchmark Runner — 分层 Benchmark 执行引擎
 *
 * ═══════════════════════════════════════════════════════════════
 * A4.5 P1.2: Benchmark Runner
 *
 * 支持：
 *   ① 分层执行（compiler / graph / planner / full / production）
 *   ② 标准化 Benchmark Report
 *   ③ Baseline Compare（与上一次 Baseline 对比差异）
 *   ④ 按 Dataset 组合执行
 * ═══════════════════════════════════════════════════════════════
 */

import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { compileFromV3 } from './film-ir-compiler.js'
import { buildFromFilmIR } from './semantic-graph-builder.js'
import { planFromGraph } from './capability-planner.js'
import { negotiate } from './capability-negotiator.js'
import { buildExecutionDAG } from './execution-planner.js'
import { bridgeDAG } from './worker-runtime-bridge.js'
import { MetricsCollector, computeSPS } from './pipeline-metrics.js'
import type { FilmLanguageIR } from './film-language-ir.js'
import type { GraphRuntime } from './graph-runtime.js'
import type { ExecutableCapabilityPlan } from './capability-negotiator.js'
import type { ExecutionDAG } from './execution-planner.js'

// ─── 类型定义 ──────────────────────────────────────────

export type BenchmarkStage = 'compiler' | 'graph' | 'planner' | 'full' | 'production'

export interface BenchmarkOptions {
  datasetPath: string         // Dataset 目录绝对路径
  stage: BenchmarkStage       // 执行阶段
  projectId?: string          // 项目 ID
  userId?: string             // 用户 ID
  baselinePath?: string       // Baseline 目录（可选，用于 compare）
}

/**
 * Benchmark Report — 每次 Benchmark 运行的标准输出
 */
export interface BenchmarkReport {
  benchmarkId: string
  timestamp: string
  dataset: {
    id: string
    level: string
    name: string
    shots: number
    capabilities: string[]
    complexity: { characters: number; locations: number; shots: number; interactions: number }
  }
  stage: BenchmarkStage
  status: 'success' | 'partial' | 'failed'
  metrics: {
    duration: number          // 总执行耗时
    sps: number               // Semantic Preservation Score
    capabilityCoverage: number // 能力覆盖率
    compilerHashConsistency: number
    driftCount: number
  }
  fingerprint: {
    compilerHash: string
    graphHash: string
    dagHash: string
    traceHash: string
    plannerHash: string       // Capability Plan Hash
    negotiatorHash: string    // ExecutableCapabilityPlan Hash
  }
  diagnostics: {
    warnings: number
    errors: number
    warningDetail: string[]
    errorDetail: string[]
  }
}

export interface BaselineDiff {
  benchmarkId: string
  datasetId: string
  previousBaselinePath: string
  changes: Array<{
    metric: string
    before: number | string
    after: number | string
    change: 'improved' | 'regressed' | 'unchanged' | 'new'
    threshold?: number
  }>
  regressions: Array<{ metric: string; before: number; after: number; threshold: number }>
}

// ─── File path conventions ────────────────────────────

const BENCHMARKS_DIR = path.resolve(process.cwd(), 'benchmarks')
const DATASETS_DIR = path.join(BENCHMARKS_DIR, 'datasets')
const BASELINES_DIR = path.join(BENCHMARKS_DIR, 'baselines')
const REPORTS_DIR = path.join(BENCHMARKS_DIR, 'reports')

// ─── Dataset Loader ───────────────────────────────────

export interface BenchmarkDataset {
  id: string
  level: string
  name: string
  metadata: Record<string, any>
  expectations: Record<string, any>
  tags: Record<string, any>
  narrative: any       // narrative.json
  v3: any              // v3.json
  complexity: { characters: number; locations: number; shots: number; interactions: number }
}

function loadYaml(filePath: string): Record<string, any> {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return yaml.load(raw) as Record<string, any>
}

function loadJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

export function loadDataset(datasetId: string): BenchmarkDataset {
  const dir = path.join(DATASETS_DIR, datasetId)
  if (!fs.existsSync(dir)) throw new Error(`Dataset not found: ${datasetId} at ${dir}`)

  const metadata = loadYaml(path.join(dir, 'metadata.yaml'))
  const expectations = loadYaml(path.join(dir, 'expectations.yaml'))
  const tags = loadYaml(path.join(dir, 'tags.yaml'))
  const narrative = loadJson(path.join(dir, 'input', 'narrative.json'))
  const v3 = loadJson(path.join(dir, 'input', 'v3.json'))

  // 从 metadata 中提取复杂度（如果没填，自动计算）
  const caps = (tags?.capabilities ?? {}) as Record<string, boolean>
  const capabilityList = Object.entries(caps)
    .filter(([_, v]) => v === true)
    .map(([k]) => k)

  const characters = metadata.characters ?? countCharacters(v3)
  const shots = metadata.shots ?? countShots(v3)

  const complexity = {
    characters,
    locations: metadata.locations ?? countLocations(v3),
    shots,
    interactions: metadata.interactions ?? countInteractions(narrative),
  }

  return {
    id: datasetId,
    level: String(metadata.level ?? 'L0'),
    name: String(metadata.name ?? datasetId),
    metadata,
    expectations,
    tags,
    narrative,
    v3,
    complexity,
  }
}

// ─── 辅助：从数据中自动推算复杂度 ─────────────────────────

function countCharacters(v3: any): number {
  return v3?.characters?.length ?? 0
}

function countShots(v3: any): number {
  let count = 0
  for (const scene of v3?.scenes ?? []) {
    count += scene?.shots?.length ?? 0
  }
  return count
}

function countLocations(v3: any): number {
  const locations = new Set<string>()
  for (const scene of v3?.scenes ?? []) {
    if (scene.description) locations.add(scene.description.slice(0, 20))
  }
  return locations.size || 1
}

function countInteractions(narrative: any): number {
  let count = 0
  for (const scene of narrative?.scenes ?? []) {
    for (const shot of scene?.shots ?? []) {
      if ((shot.dialogues?.length ?? 0) > 0) count++
    }
  }
  return count || 1
}

// ─── Hash 计算 ────────────────────────────────────────

function simpleHash(obj: any): string {
  const json = JSON.stringify(obj, Object.keys(obj).sort())
  let hash = 0
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash  // Convert to 32bit integer
  }
  return `sh${Math.abs(hash).toString(36).padStart(8, '0')}`
}

// ─── 主 Runner ────────────────────────────────────────

/**
 * 运行一次 Benchmark。
 */
export function runBenchmark(options: BenchmarkOptions): BenchmarkReport | null {
  let dataset: BenchmarkDataset
  try {
    dataset = loadDataset(path.basename(options.datasetPath.replace(/\/$/, '')))
  } catch (e: any) {
    console.error('[Benchmark] Failed to load dataset:', e.message)
    return null
  }
  const collector = new MetricsCollector(
    `bench_${dataset.id}_${options.stage}`,
    options.projectId ?? 'benchmark',
    options.userId ?? 'benchmark-runner',
  )

  const diagnostics = { warnings: 0, errors: 0 }
  const warningDetail: string[] = []
  const errorDetail: string[] = []

  let succeeded = true
  let ir: FilmLanguageIR | null = null
  let graph: GraphRuntime | null = null
  let plan: any = null
  let execPlan: ExecutableCapabilityPlan | null = null
  let dag: ExecutionDAG | null = null
  let trace: any = null

  // ═══ Stage: Compiler ═══
  if (['compiler', 'graph', 'planner', 'full', 'production'].includes(options.stage)) {
    const finish = collector.start('Normalizer')
    try {
      const normalized = dataset.v3
      finish({ inputSize: JSON.stringify(dataset.v3).length, outputSize: JSON.stringify(normalized).length, diagnostics: { warnings: 0, errors: 0 } })
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`Normalizer: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  if (['compiler', 'graph', 'planner', 'full', 'production'].includes(options.stage)) {
    const finish = collector.start('Compiler')
    try {
      ir = compileFromV3(dataset.v3)
      finish({
        inputSize: JSON.stringify(dataset.v3).length,
        outputSize: JSON.stringify(ir).length,
        diagnostics: { warnings: 0, errors: 0 },
      })
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`Compiler: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  // ═══ Stage: Graph ═══
  if (['graph', 'planner', 'full', 'production'].includes(options.stage) && ir) {
    const finish = collector.start('GraphBuilder')
    try {
      const built = buildFromFilmIR(ir)
      graph = built.graph
      finish({
        inputSize: JSON.stringify(ir).length,
        outputSize: JSON.stringify(graph).length,
        diagnostics: { warnings: built.validation.warnings.length, errors: built.validation.errors.length },
      })
      if (built.validation.errors.length > 0) {
        diagnostics.errors += built.validation.errors.length
        built.validation.errors.forEach((e: string) => errorDetail.push(`GraphValidator: ${e}`))
        succeeded = false
      }
      if (built.validation.warnings.length > 0) {
        diagnostics.warnings += built.validation.warnings.length
        built.validation.warnings.forEach((w: string) => warningDetail.push(`GraphValidator: ${w}`))
      }
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`GraphBuilder: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  // ═══ Stage: Planner ═══
  if (['planner', 'full', 'production'].includes(options.stage) && graph) {
    const finish = collector.start('CapabilityPlanner')
    try {
      plan = planFromGraph(graph)
      finish({ inputSize: JSON.stringify(graph).length, outputSize: JSON.stringify(plan).length, diagnostics: { warnings: 0, errors: 0 } })
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`CapabilityPlanner: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  if (['planner', 'full', 'production'].includes(options.stage) && plan) {
    const finish = collector.start('CapabilityNegotiator')
    try {
      execPlan = negotiate(plan, { environmentId: 'benchmark', capabilities: {} })
      finish({ inputSize: JSON.stringify(plan).length, outputSize: JSON.stringify(execPlan).length, diagnostics: { warnings: 0, errors: 0 } })
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`CapabilityNegotiator: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  // ═══ Stage: Full ═══
  if (['full', 'production'].includes(options.stage) && execPlan) {
    const finish = collector.start('ExecutionPlanner')
    try {
      const built = buildExecutionDAG(execPlan)
      dag = built.dag
      if (!built.contract.valid) {
        diagnostics.errors += built.contract.violations.length
        built.contract.violations.forEach((v: any) => errorDetail.push(`ExecutionContract: ${v.violation ?? JSON.stringify(v)}`))
        succeeded = false
      }
      finish({ inputSize: JSON.stringify(execPlan).length, outputSize: JSON.stringify(dag).length, diagnostics: { warnings: 0, errors: built.contract.violations.length } })
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`ExecutionPlanner: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  if (['full', 'production'].includes(options.stage) && dag) {
    const finish = collector.start('Bridge')
    try {
      const bridged = bridgeDAG(dag, options.projectId ?? 'benchmark', options.userId ?? 'benchmark-runner')
      trace = bridged.trace
      if (!bridged.diagnostics.success) {
        diagnostics.warnings++
        warningDetail.push(`Bridge: ${bridged.diagnostics.unmappedNodes.length} unmapped nodes`)
      }
      finish({ inputSize: JSON.stringify(dag).length, outputSize: JSON.stringify(bridged.trace).length, diagnostics: { warnings: bridged.diagnostics.warnings.length, errors: 0 } })
    } catch (e: any) {
      diagnostics.errors++
      errorDetail.push(`Bridge: ${e.message}`)
      succeeded = false
      finish({ diagnostics: { warnings: 0, errors: 1 } })
    }
  }

  // ═══ Compute Metrics ═══
  const capabilityCoverageMap: Record<string, { requested: number; negotiated: number; executed: number; succeeded: number }> = {}
  const spsInput: Record<string, 'full' | 'partial' | 'none'> = {}
  const spsOutput: Record<string, 'full' | 'partial' | 'none'> = {}

  if (plan) {
    for (const shot of plan.shots ?? []) {
      for (const cap of shot.capabilities ?? []) {
        const id = String(cap.capabilityId)
        spsInput[id] = cap.level
        if (!capabilityCoverageMap[id]) {
          capabilityCoverageMap[id] = { requested: 0, negotiated: 0, executed: 0, succeeded: 0 }
        }
        capabilityCoverageMap[id].requested++
      }
    }
  }

  if (execPlan) {
    for (const shot of execPlan.shots ?? []) {
      for (const cap of shot.capabilities ?? []) {
        spsOutput[cap.capabilityId] = cap.resolved
        if (capabilityCoverageMap[cap.capabilityId]) {
          capabilityCoverageMap[cap.capabilityId].negotiated++
        }
      }
    }
  }

  if (dag) {
    for (const node of dag.nodes) {
      for (const capId of node.requiredCapabilities) {
        if (capabilityCoverageMap[capId]) {
          capabilityCoverageMap[capId].executed++
        }
      }
    }
  }

  const spsResult = computeSPS(spsInput, spsOutput)
  const sps = spsResult.overallRetentionRate

  const coverageTotal = Object.values(capabilityCoverageMap).reduce(
    (sum, c) => sum + (c.requested > 0 ? c.executed / c.requested : 1),
    0,
  )
  const coverageAvg = Object.keys(capabilityCoverageMap).length > 0
    ? coverageTotal / Object.keys(capabilityCoverageMap).length
    : 0

  // 计算 Hash
  const report = collector.buildReport({
    capabilityCoverage: capabilityCoverageMap,
    sps: spsResult,
    stability: {
      compilerDeterminism: { runs: 1, hashConsistent: 1, hashConsistencyRate: 1, lastHash: '' },
    },
    architecture: { driftStats: { ssotViolations: 0, kernelLeaks: 0, mutations: 0, businessAdapterLeaks: 0 } },
  })

  const fingerprint = {
    compilerHash: ir ? simpleHash(ir) : '',
    graphHash: graph ? simpleHash(graph) : '',
    plannerHash: plan ? simpleHash(plan) : '',
    negotiatorHash: execPlan ? simpleHash(execPlan) : '',
    dagHash: dag ? simpleHash(dag) : '',
    traceHash: trace ? simpleHash(trace) : '',
  }

  // ═══ Build Report ═══
  const benchmarkReport: BenchmarkReport = {
    benchmarkId: `bench_${dataset.id}_${options.stage}_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    dataset: {
      id: dataset.id,
      level: dataset.level,
      name: dataset.name,
      shots: dataset.complexity.shots,
      capabilities: Object.keys(dataset.tags?.capabilities ?? {}).filter(
        (k: string) => dataset.tags?.capabilities?.[k] === true,
      ),
      complexity: dataset.complexity,
    },
    stage: options.stage,
    status: succeeded ? 'success' : diagnostics.errors > 0 ? 'failed' : 'partial',
    metrics: {
      duration: report.summary.totalDuration,
      sps,
      capabilityCoverage: coverageAvg,
      compilerHashConsistency: report.summary.compilerHashConsistency,
      driftCount: report.summary.driftCount,
    },
    fingerprint,
    diagnostics: {
      warnings: diagnostics.warnings,
      errors: diagnostics.errors,
      warningDetail,
      errorDetail,
    },
  }

  // 保存 Report
  ensureDir(REPORTS_DIR)
  const reportPath = path.join(REPORTS_DIR, `${benchmarkReport.benchmarkId}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(benchmarkReport, null, 2), 'utf-8')

  return benchmarkReport
}
// ─── Baseline Compare ────────────────────────────────

/**
 * 与 Baseline 对比当前 Report。
 *
 * Baseline 文件位于：benchmarks/baselines/<baseline-name>/<datasetId>.fingerprint.yaml
 */
export function compareWithBaseline(report: BenchmarkReport, baselinePath?: string): BaselineDiff {
  const bp = baselinePath ?? path.join(BASELINES_DIR, 'CURRENT')
  const baselineFile = path.join(bp, `${report.dataset.id}.fingerprint.yaml`)

  if (!fs.existsSync(baselineFile)) {
    // 没有 Baseline，保存当前为新的 Baseline
    ensureDir(path.dirname(baselineFile))
    fs.writeFileSync(baselineFile, yaml.dump(report.fingerprint as any), 'utf-8')
    return {
      benchmarkId: report.benchmarkId,
      datasetId: report.dataset.id,
      previousBaselinePath: baselineFile,
      changes: [],
      regressions: [],
    }
  }

  const baseline = loadYaml(baselineFile)

  const thresholds: Record<string, number> = {
    sps: 0.05,
    capabilityCoverage: 0.05,
    compilerHashConsistency: 0.01,
    driftCount: 0,
  }

  const changes: BaselineDiff['changes'] = []
  const regressions: BaselineDiff['regressions'] = []

  const metricsToCompare: Array<{ key: string; label: string; numeric: boolean }> = [
    { key: 'sps', label: 'SPS', numeric: true },
    { key: 'capabilityCoverage', label: 'Capability Coverage', numeric: true },
    { key: 'compilerHashConsistency', label: 'Compiler Hash Consistency', numeric: true },
    { key: 'driftCount', label: 'Drift Count', numeric: true },
  ]

  for (const m of metricsToCompare) {
    const before = (baseline as any)[m.key] ?? (baseline as any).metrics?.[m.key]
    const after = (report.metrics as any)[m.key] ?? 0
    if (before === undefined) {
      changes.push({ metric: m.label, before: 'N/A', after, change: 'new' })
      continue
    }
    if (before === after) {
      changes.push({ metric: m.label, before, after, change: 'unchanged' })
      continue
    }

    if (m.numeric) {
      const bNum = Number(before)
      const aNum = Number(after)
      const threshold = thresholds[m.key] ?? 0
      const diff = aNum - bNum

      if (m.key === 'driftCount') {
        // driftCount: 越低越好
        if (aNum <= bNum) {
          changes.push({ metric: m.label, before: bNum, after: aNum, change: 'improved' })
        } else {
          changes.push({ metric: m.label, before: bNum, after: aNum, change: 'regressed', threshold })
          regressions.push({ metric: m.label, before: bNum, after: aNum, threshold })
        }
      } else {
        // 其他: 越高越好
        if (diff >= threshold || aNum >= bNum) {
          changes.push({ metric: m.label, before: bNum, after: aNum, change: diff > 0 ? 'improved' : 'unchanged' })
        } else {
          changes.push({ metric: m.label, before: bNum, after: aNum, change: 'regressed', threshold })
          regressions.push({ metric: m.label, before: bNum, after: aNum, threshold })
        }
      }
    }
  }

  // 更新 Baseline 文件
  ensureDir(path.dirname(baselineFile))
  fs.writeFileSync(baselineFile, yaml.dump(report.fingerprint as any), 'utf-8')

  return {
    benchmarkId: report.benchmarkId,
    datasetId: report.dataset.id,
    previousBaselinePath: baselineFile,
    changes,
    regressions,
  }
}

// ─── 工具函数 ──────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── CLI 入口 ──────────────────────────────────────────

/**
 * CLI 调用方式：
 *
 *   # 编译验证
 *   node run-benchmark.js --dataset L0-001 --stage compiler
 *
 *   # Graph 验证
 *   node run-benchmark.js --dataset L1-001 --stage graph
 *
 *   # 全链路
 *   node run-benchmark.js --dataset L0-001 --stage full
 *
 *   # 全链路 + 与 Baseline 对比
 *   node run-benchmark.js --dataset L1-001 --stage full --baseline benchmarks/baselines/v1.0
 */
export async function main(args: string[]): Promise<BenchmarkReport | null> {
  const parsed: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true'
      parsed[key] = val
    }
  }

  const datasetId = parsed['dataset'] ?? 'L0-001'
  const stage = (parsed['stage'] ?? 'compiler') as BenchmarkStage
  const baselinePath = parsed['baseline']

  const datasetPath = path.join(DATASETS_DIR, datasetId)
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found: ${datasetId}`)
    return null
  }

  console.log(`[Benchmark] Running ${stage} on ${datasetId}...`)

  const report = runBenchmark({
    datasetPath,
    stage,
    projectId: 'benchmark',
    userId: 'benchmark-runner',
  })

  if (!report) {
    console.error('[Benchmark] Failed to generate report')
    return null
  }

  console.log(`[Benchmark] Status: ${report.status}`)
  console.log(`[Benchmark] SPS: ${(report.metrics.sps * 100).toFixed(1)}%`)
  console.log(`[Benchmark] Capability Coverage: ${(report.metrics.capabilityCoverage * 100).toFixed(1)}%`)
  console.log(`[Benchmark] Duration: ${report.metrics.duration}ms`)
  console.log(`[Benchmark] Fingerprint: ${JSON.stringify(report.fingerprint)}`)

  if (baselinePath) {
    const diff = compareWithBaseline(report, baselinePath)
    if (diff.regressions.length > 0) {
      console.warn('[Benchmark] ⚠️ Regressions detected:')
      for (const r of diff.regressions) {
        console.warn(`  ${r.metric}: ${r.before} → ${r.after} (threshold: ${r.threshold})`)
      }
    } else {
      console.log('[Benchmark] ✅ No regressions vs baseline')
    }
  }

  return report
}

// 如果直接执行
if (process.argv[1]?.includes('run-benchmark')) {
  main(process.argv.slice(2)).then(() => process.exit(0))
}
