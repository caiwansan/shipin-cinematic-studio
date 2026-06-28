/**
 * Long Run Stability Test Runner
 *
 * 自动编排 30 分钟长期稳定性测试：
 *   1. 启动仿真引擎
 *   2. 每 2s 采集行为数据点
 *   3. 每 30s 运行一次漂移分析
 *   4. 每 60s 输出稳定性评分
 *   5. 结束时生成完整报告
 *   6. 自动清理仿真数据
 *
 * 启动方式:
 *   node dist/simulation/long-run-runner.js
 *
 * 生产就绪门槛（Phase 6D Gate）：
 *   - 10分钟无 drift（stability > 80）
 *   - queue slope ≈ 0
 *   - worker efficiency stable
 *   - cost curve linear
 *   - no PID oscillation
 */

import { DriftAnalyzer, DriftAnalysis } from './drift-analyzer.js'
import { computeStabilityScore, StabilityScore } from './stability-score.js'
import { getBackpressureStatus, startBackpressureController, stopBackpressureController } from './backpressure-controller.js'
import { ensureIsolationTables, startSimWorker, stopSimWorker } from './isolation-layer.js'
import { startSimulation, stopSimulation } from './event-generator.js'
import { timerRegistry, pushGlobalEvent, initializeRuntimeSafety } from '../services/lifecycle-manager.js'
import { persistMetricsBulk } from '../observability/timeseries.js'
import { startSnapshotCollector, stopSnapshotCollector } from '../observability/collector.js'
import { createSession, completeSession, cancelSession, recordDegradationEvent, getCurrentPhase, DEFAULT_PHASES, PhaseDef } from './session-manager.js'
import { BackpressureState, CollectorState } from '../utils/redis-state.js'
import type { DriftPoint } from './drift-analyzer.js'

// ============================================================
// 配置
// ============================================================

export interface LongRunConfig {
  durationSec: number           // 测试总时长（30min=1800）
  sampleIntervalMs: number      // 采样间隔（2000ms）
  analysisIntervalMs: number    // 分析间隔（30000ms）
  reportIntervalMs: number      // 报告间隔（60000ms）
  pattern: 'steady' | 'burst' | 'wave' | 'chaos'
  workerCount: number
  workerProcessTimeMs: number
  workerFailRate: number
  backpressureConfig: {
    highWaterMark: number
    lowWaterMark: number
    maxRate: number
    initialRate: number
    emergencyThreshold: number
  }
}

const DEFAULT_CONFIG: LongRunConfig = {
  durationSec: 1800,
  sampleIntervalMs: 2000,
  analysisIntervalMs: 30000,
  reportIntervalMs: 60000,
  pattern: 'wave',
  workerCount: 5,
  workerProcessTimeMs: 200,
  workerFailRate: 0.1,
  backpressureConfig: {
    highWaterMark: 100,
    lowWaterMark: 20,
    maxRate: 15,
    initialRate: 10,
    emergencyThreshold: 500,
  },
}

// ============================================================
// 报告数据结构
// ============================================================

export interface LongRunReport {
  sessionId?: number
  config: LongRunConfig
  startTime: number
  endTime: number
  actualDurationSec: number
  samples: number
  analyses: number
  stabilityScores: {
    timeSec: number
    score: StabilityScore
  }[]
  finalScore: StabilityScore
  productionGate: {
    passed: boolean
    checks: {
      name: string
      passed: boolean
      actual: number
      threshold: string
    }[]
  }
}

// ============================================================
// Runner
// ============================================================

export class LongRunRunner {
  private config: LongRunConfig
  private analyzer: DriftAnalyzer
  private report: LongRunReport
  private startTime = 0
  private running = false
  private sessionId: number | null = null
  private currentPhase: PhaseDef | null = null
  private sampleTimer: ReturnType<typeof setInterval> | null = null
  private analysisTimer: ReturnType<typeof setInterval> | null = null
  private reportTimer: ReturnType<typeof setInterval> | null = null

  // 当次分析间的累计数据
  private scoreHistory: LongRunReport['stabilityScores'] = []

  constructor(config: Partial<LongRunConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.analyzer = new DriftAnalyzer(this.config.sampleIntervalMs)
    this.report = this.createEmptyReport()
  }

  /**
   * 启动长期测试
   */
  async start(): Promise<LongRunReport> {
    if (this.running) {
      throw new Error('Long run test already in progress')
    }
    this.running = true
    this.startTime = Date.now()
    this.scoreHistory = []
    this.report = this.createEmptyReport()

    // 创建稳定性 Session
    const session = await createSession(`Long Run #${Math.floor(Date.now() / 1000)}`)
    this.sessionId = session.id
    this.report.sessionId = session.id

    initializeRuntimeSafety()
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 Long Run Stability Test Starting`)
    console.log(`   Duration: ${this.config.durationSec}s (${(this.config.durationSec / 60).toFixed(0)}min)`)
    console.log(`   Pattern: ${this.config.pattern}`)
    console.log(`   Workers: ${this.config.workerCount} @ ${this.config.workerProcessTimeMs}ms`)
    console.log(`${'='.repeat(60)}\n`)

    pushGlobalEvent('longrun.started', { config: this.config })

    // 1. 初始化隔离表
    await ensureIsolationTables()

    // 2. 启动 worker
    startSimWorker({
      concurrency: this.config.workerCount,
      processTimeMs: this.config.workerProcessTimeMs,
      failRate: this.config.workerFailRate,
    })

    // 3. 启动背压控制器
    startBackpressureController(this.config.backpressureConfig)

    // 4. 启动事件生成器
    startSimulation({
      userCount: 4,
      durationSeconds: this.config.durationSec,
      pattern: this.config.pattern as any,
      chaosChance: 0.3,
      bridgeEnabled: true,
    })

    // 5. 启动采集管道 + 物理采样
    startSnapshotCollector()
    this.sampleTimer = timerRegistry.setInterval(async () => {
      const bp = await getBackpressureStatus()
      this.analyzer.recordPoint({
        queueLength: bp.queueLength ?? 0,
        queuePressure: bp.queuePressure ?? 0,
        workerThroughput: (bp as any).workerThroughput || 0,
        workerCompleted: ((bp as any).workerThroughput || 0) * ((bp as any).queueLength + 1) || 0,
        pidRate: (bp as any).currentRate || 0,
        ses: (bp as any).ses ?? 1,
      })
    }, this.config.sampleIntervalMs)

    // 6. 定期分析 + 阶段检测 + 退化事件检测
    this.analysisTimer = timerRegistry.setInterval(async () => {
      const elapsed = (Date.now() - this.startTime) / 1000
      const analysis = this.analyzer.analyze()
      const score = computeStabilityScore(analysis)

      this.scoreHistory.push({
        timeSec: Math.round(elapsed),
        score,
      })

      // 检测当前阶段
      const { phase } = getCurrentPhase(elapsed)
      if (phase.name !== this.currentPhase?.name) {
        this.currentPhase = phase
        console.log(`\n  🔶 Phase Transition: ${phase.name} → ${phase.description} (intensity=${phase.intensity})\n`)
        pushGlobalEvent('longrun.phase', {
          phase: phase.name,
          description: phase.description,
          elapsedSec: Math.round(elapsed),
          intensity: phase.intensity,
        })
      }

      // 每 60s 输出健康日志
      const points = this.analyzer['history'].length
      console.log(
        `[${elapsed.toFixed(0)}s] ` +
        `score=${score.total}(${score.grade}) ` +
        `queue=${analysis.queueGrowthStability} ` +
        `mem=${analysis.memoryGrowthSlope.toFixed(3)}MB/s ` +
        `pts=${points}`
      )

      pushGlobalEvent('longrun.analysis', {
        elapsedSec: Math.round(elapsed),
        score: score.total,
        grade: score.grade,
        warnings: analysis.warningFlags,
      })

      // 退化事件检测
      if (this.sessionId && analysis.warningFlags.length > 0) {
        const bp = await getBackpressureStatus()
        for (const flag of analysis.warningFlags) {
          let eventType = 'unknown'
          let severity: 'warning' | 'critical' | 'emergency' = 'warning'

          if (flag.includes('oscillation')) {
            eventType = 'pid_oscillation'
            severity = score.total < 60 ? 'emergency' : score.total < 80 ? 'critical' : 'warning'
          } else if (flag.includes('divergence') || flag.includes('diverging')) {
            eventType = 'queue_divergence'
            severity = 'critical'
          } else if (flag.includes('worker') || flag.includes('fatigue')) {
            eventType = 'worker_fatigue'
            severity = score.total < 60 ? 'critical' : 'warning'
          } else if (flag.includes('memory') || flag.includes('leak')) {
            eventType = 'memory_leak'
            severity = 'critical'
          }

          if (eventType !== 'unknown') {
            recordDegradationEvent(this.sessionId, eventType, severity, flag, {
              queueLength: bp.queueLength,
              queuePressure: bp.queuePressure,
              memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
              score: score.total,
            }).catch(() => {})
          }
        }
      }
    }, this.config.analysisIntervalMs)

    // 7. 自动停止定时器
    timerRegistry.setTimeout(() => {
      this.stop().catch(err => console.error('Long run auto-stop error:', err))
    }, this.config.durationSec * 1000)

    // 简要报告
    this.reportTimer = timerRegistry.setInterval(() => {
      this.printBriefReport()
    }, this.config.reportIntervalMs)

    return this.report
  }

  /**
   * 停止测试并生成报告
   */
  async stop(): Promise<LongRunReport> {
    if (!this.running) return this.report

    this.running = false
    this.stopTimers()

    const endTime = Date.now()
    const actualDurationSec = (endTime - this.startTime) / 1000

    // 最终分析
    const finalAnalysis = this.analyzer.analyze(endTime)
    const finalScore = computeStabilityScore(finalAnalysis)

    // 保存
    this.report.endTime = endTime
    this.report.actualDurationSec = Math.round(actualDurationSec * 100) / 100
    this.report.samples = this.analyzer['history'].length
    this.report.analyses = this.scoreHistory.length
    this.report.stabilityScores = this.scoreHistory
    this.report.finalScore = finalScore
    this.report.productionGate = this.evaluateGate(finalScore, finalAnalysis)

    // 完成稳定性 Session（写入指纹数据）
    if (this.sessionId) {
      await completeSession(this.sessionId, finalScore.total, finalScore.grade)
    }

    // 持久化采样数据到 DB
    stopSnapshotCollector()
    const allPoints = this.analyzer['history'].getAll() as DriftPoint[]
    if (allPoints.length > 0) {
      const written = await persistMetricsBulk(allPoints)
      console.log(`[LongRun] Persisted ${written}/${allPoints.length} samples to system_metrics`)
    }

    // 清理
    stopSimulation()
    stopSimWorker()
    stopBackpressureController()

    // 输出报告
    this.printFinalReport()

    pushGlobalEvent('longrun.completed', {
      durationSec: actualDurationSec,
      finalScore: finalScore.total,
      grade: finalScore.grade,
      gatePassed: this.report.productionGate.passed,
    })

    return this.report
  }

  getStatus(): { running: boolean; elapsedSec: number; report?: LongRunReport } {
    return {
      running: this.running,
      elapsedSec: this.running ? (Date.now() - this.startTime) / 1000 : 0,
      report: this.report.finalScore ? this.report : undefined,
    }
  }

  // ============================================================
  // Private
  // ============================================================

  private stopTimers(): void {
    if (this.sampleTimer) { timerRegistry.clearInterval(this.sampleTimer); this.sampleTimer = null }
    if (this.analysisTimer) { timerRegistry.clearInterval(this.analysisTimer); this.analysisTimer = null }
    if (this.reportTimer) { timerRegistry.clearInterval(this.reportTimer); this.reportTimer = null }
  }

  private createEmptyReport(): LongRunReport {
    return {
      config: this.config,
      startTime: 0,
      endTime: 0,
      actualDurationSec: 0,
      samples: 0,
      analyses: 0,
      stabilityScores: [],
      finalScore: {
        total: 0,
        grade: 'F',
        dimensions: {} as any,
        recommendation: 'no_data',
        productionReady: false,
      },
      productionGate: {
        passed: false,
        checks: [],
      },
    }
  }

  private evaluateGate(score: StabilityScore, analysis: DriftAnalysis): LongRunReport['productionGate'] {
    const checks = [
      {
        name: 'stability_score_a',
        passed: score.grade === 'A',
        actual: score.total,
        threshold: '≥ 90 (A grade)',
      },
      {
        name: 'no_queue_growth',
        passed: analysis.queueGrowthStability !== 'growing',
        actual: analysis.queueGrowthRate,
        threshold: 'queue growth rate < 0.1/s',
      },
      {
        name: 'no_worker_degradation',
        passed: analysis.workerEfficiencyTrend >= -0.1,
        actual: analysis.workerEfficiencyTrend,
        threshold: 'worker trend ≥ -0.1',
      },
      {
        name: 'no_memory_leak',
        passed: !analysis.memoryGrowthWarning,
        actual: analysis.memoryGrowthSlope,
        threshold: 'memory slope < 0.5 MB/s',
      },
      {
        name: 'no_pid_oscillation',
        passed: !analysis.pidOscillating,
        actual: analysis.pidOscillationAmplitude,
        threshold: 'oscillation amplitude < 2.0',
      },
      {
        name: 'ses_stable',
        passed: !analysis.sesDegraded,
        actual: analysis.sesTrend,
        threshold: 'SES not degrading',
      },
    ]

    return {
      passed: checks.every(c => c.passed),
      checks,
    }
  }

  private printBriefReport(): void {
    const elapsed = (Date.now() - this.startTime) / 1000
    const analysis = this.analyzer.getLastAnalysis()
    const score = analysis ? computeStabilityScore(analysis) : null
    if (!score) return

    console.log(`\n📊 [${elapsed.toFixed(0)}s] Score: ${score.total}/${score.grade} | ${analysis!.warningFlags.length > 0 ? `⚠ ${analysis!.warningFlags.join(', ')}` : '✅ clean'}`)
  }

  private printFinalReport(): void {
    const s = this.report.finalScore
    const g = this.report.productionGate

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📋 Long Run Stability Test — FINAL REPORT`)
    console.log(`${'='.repeat(60)}`)
    console.log(`   Duration:    ${this.report.actualDurationSec.toFixed(0)}s (${(this.report.actualDurationSec / 60).toFixed(1)}min)`)
    console.log(`   Samples:     ${this.report.samples}`)
    console.log(`   Analyses:    ${this.report.analyses}`)
    console.log(`   Pattern:     ${this.config.pattern}`)
    console.log(``)
    console.log(`🏆 FINAL STABILITY SCORE: ${s.total}/100 — Grade ${s.grade}`)
    console.log(``)
    console.log(`   Dimensions:`)
    console.log(`     Queue:  ${s.dimensions.queue.score}/${s.dimensions.queue.max} — ${s.dimensions.queue.detail}`)
    console.log(`     Worker: ${s.dimensions.worker.score}/${s.dimensions.worker.max} — ${s.dimensions.worker.detail}`)
    console.log(`     Memory: ${s.dimensions.memory.score}/${s.dimensions.memory.max} — ${s.dimensions.memory.detail}`)
    console.log(`     PID:    ${s.dimensions.pid.score}/${s.dimensions.pid.max} — ${s.dimensions.pid.detail}`)
    console.log(`     SES:    ${s.dimensions.ses.score}/${s.dimensions.ses.max} — ${s.dimensions.ses.detail}`)
    console.log(``)
    console.log(`🔒 PRODUCTION READINESS GATE:`)
    console.log(`   Result: ${g.passed ? '✅ PASSED' : '❌ BLOCKED'}`)
    for (const check of g.checks) {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}: ${check.actual} (expect ${check.threshold})`)
    }
    console.log(``)
    console.log(`   Recommended action: ${s.recommendation}`)
    console.log(`${'='.repeat(60)}\n`)
  }
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main() {
  const durationStr = process.argv[2] || '600'  // default 10min
  const pattern = (process.argv[3] || 'wave') as LongRunConfig['pattern']
  const durationSec = parseInt(durationStr, 10)

  const runner = new LongRunRunner({
    durationSec,
    pattern,
    workerCount: 5,
    workerProcessTimeMs: 200,
    workerFailRate: 0.1,
    backpressureConfig: {
      highWaterMark: 100,
      lowWaterMark: 20,
      maxRate: 15,
      initialRate: 10,
      emergencyThreshold: 500,
    },
  })

  await runner.start()

  // Keep alive — the runner auto-stops at durationSec
  process.on('SIGINT', async () => {
    console.log('\nSIGINT — stopping test...')
    await runner.stop()
    process.exit(0)
  })
}

// 直接运行时启动
if (process.argv[1]?.endsWith('long-run-runner.js') || process.argv[1]?.endsWith('long-run-runner.ts')) {
  main().catch(err => {
    console.error('❌ Long run runner fatal:', err)
    process.exit(1)
  })
}

export { LongRunRunner as default }
