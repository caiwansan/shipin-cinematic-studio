/**
 * Phase 6C-3 — 24h (Long Run) Stability Simulator
 *
 * 不是压测，是"系统慢性死亡检测"：
 * - Memory Drift（内存泄漏）
 * - Queue Growth Curve（队列堆积趋势）
 * - Cost Drift（成本线性爆炸）
 * - Worker Fatigue（错误率时间衰减）
 * - Recovery Stability（失败→恢复一致性）
 *
 * 每5分钟拍一张"系统快照"，持续24小时（或自定义时长）。
 * 跑完后生成 Stability Score Report。
 */

import { emitEvent } from '../services/observability.service.js'
import { prisma } from '../utils/index.js'
import {
  startSimulation,
  stopSimulation,
} from './event-generator.js'
import { getBridgeConfig, setBridgeConfig, getBridgeState, resetBridgeState } from './simulation-bridge.js'
import { ensureIsolationTables, startSimWorker, stopSimWorker } from './isolation-layer.js'
import { startBackpressureController, stopBackpressureController, resetBackpressure } from './backpressure-controller.js'
import { timerRegistry, BoundedSnapshotHistory, pushGlobalSnapshot, pushGlobalEvent } from '../services/lifecycle-manager.js'

// ============================================================
// 类型定义
// ============================================================

interface Snapshot {
  timestamp: number
  /** 自增编号 */
  seq: number
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
  }
  queue: {
    queued: number
    processing: number
    failed: number
    completed: number
    cancelled: number
  }
  cost: {
    totalEstimatedCost: number
    snapshotCost: number // 本间隔新增
  }
  worker: {
    totalTasks: number
    totalErrors: number
    successRate: number
    avgDuration: number
  }
  bridgeStats: {
    created: number
    cancelled: number
    errors: number
    peakActive: number
  }
}

interface StabilityResult {
  duration: number // 实际跑了的毫秒数
  snapshots: number
  memoryDrift: number // MB（每5分钟增量的线性趋势斜率）
  queueGrowth: number // 每5分钟增量趋势（>0 = 堆积）
  costGrowth: number // 每5分钟成本增量（元）
  workerFatigueRate: number // 成功率每小时下降率
  avgSuccessRate: number
  peakCostPerSnapshot: number
  autoStopTriggered: boolean
  stopReason: string | null
  grade: 'A+' | 'A' | 'B' | 'C' | 'D'
}

// ============================================================
// 运行状态
// ============================================================

const state: {
  running: boolean
  startTime: number
  snapshots: Snapshot[]
  snapshotTimer: ReturnType<typeof setInterval> | null
  durationMs: number
  autoAbort: boolean
  abortReason: string
  lastQueueSize: number
  lastCost: number
  lastErrorCount: number
  peakErrorRate: number
  totalSnapshots: number
  patternIndex: number
  _lastResult: StabilityResult | null
} = {
  running: false,
  startTime: 0,
  snapshots: [],
  snapshotTimer: null,
  durationMs: 0,
  autoAbort: false,
  abortReason: '',
  lastQueueSize: 0,
  lastCost: 0,
  lastErrorCount: 0,
  peakErrorRate: 0,
  totalSnapshots: 0,
  patternIndex: 0,
  _lastResult: null,
}

// ============================================================
// 配置
// ============================================================

interface Config {
  /** 总时长（毫秒），默认 30 分钟 Demo 用 */
  durationMs: number
  /** 快照间隔（毫秒），默认 5 分钟 */
  snapshotIntervalMs: number
  /** 自动熔断：队列堆积超过此阈值 */
  maxQueueGrowth: number
  /** 自动熔断：错误率超过此百分比 */
  maxErrorRate: number
  /** 自动熔断：成本增量超过此阈值（每快照） */
  maxCostPerSnapshot: number
  /** 模拟用户数 */
  userCount: number
  /** 流量模式队列 */
  patternSequence: ('burst' | 'wave' | 'crawl' | 'chaos')[]
  /** 每个模式的持续时间（秒） */
  patternDurationSec: number
}

const config: Config = {
  durationMs: 30 * 60 * 1000,
  snapshotIntervalMs: 1 * 60 * 1000,
  maxQueueGrowth: 500,
  maxErrorRate: 30,
  maxCostPerSnapshot: 100,
  userCount: 8,
  patternSequence: ['burst', 'wave', 'chaos', 'crawl', 'chaos'],
  patternDurationSec: 30,
}

let runtimeConfig: Config = { ...config }
let runtimePatternSequence: ('burst' | 'wave' | 'crawl' | 'chaos')[] = ['burst', 'wave', 'chaos', 'crawl', 'chaos']
let runtimePatternDurationSec = 30

// ============================================================
// 系统快照捕获
// ============================================================

async function captureSnapshot(seq: number): Promise<Snapshot> {
  const now = Date.now()

  // Memory — 从 process 获取
  const mem = process.memoryUsage()

  // Queue — 从 simulation_tasks（隔离表）
  const simRows = await prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(`
    SELECT status, COUNT(*)::int as count FROM simulation_tasks GROUP BY status
  `)
  const simStats: Record<string, number> = {}
  for (const r of simRows) {
    simStats[r.status] = Number(r.count)
  }
  const queued = simStats['queued'] ?? 0
  const processing = simStats['processing'] ?? 0
  const failed = simStats['failed'] ?? 0
  const completed = simStats['completed'] ?? 0
  const cancelled = simStats['cancelled'] ?? 0

  // Worker — 从 simulation_tasks（处理完的任务）
  const workerRows = await prisma.$queryRawUnsafe<{ duration: number; error: string | null }[]>(`
    SELECT COALESCE(duration_ms, 0)::int as duration, error FROM simulation_tasks
    WHERE status IN ('completed', 'failed')
  `)
  const totalWorkerTasks = workerRows.length
  const totalWorkerErrors = workerRows.filter(w => w.error).length
  const avgDuration = totalWorkerTasks > 0
    ? workerRows.reduce((s, w) => s + w.duration, 0) / totalWorkerTasks
    : 0

  // Cost — 从 simulation_costs（隔离成本表）
  const costRows = await prisma.$queryRawUnsafe<{ total: number }[]>(`
    SELECT COALESCE(SUM(estimated_cost), 0)::float as total FROM simulation_costs
  `)
  const totalEstimatedCost = Math.round((costRows[0]?.total ?? 0) * 100) / 100

  // Bridge
  const bridge = getBridgeState()

  const snap: Snapshot = {
    timestamp: now,
    seq,
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
    },
    queue: {
      queued,
      processing,
      failed,
      completed,
      cancelled,
    },
    cost: {
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      snapshotCost: Math.round((totalEstimatedCost - state.lastCost) * 100) / 100,
    },
    worker: {
      totalTasks: totalWorkerTasks,
      totalErrors: totalWorkerErrors,
      successRate: totalWorkerTasks > 0
        ? Math.round((1 - totalWorkerErrors / totalWorkerTasks) * 100)
        : 100,
      avgDuration: Math.round(avgDuration),
    },
    bridgeStats: {
      created: bridge.totalCreated,
      cancelled: bridge.totalCancelled,
      errors: bridge.totalErrors,
      peakActive: bridge.peakActive,
    },
  }

  // 更新追踪值
  state.lastQueueSize = queued
  state.lastCost = totalEstimatedCost
  state.lastErrorCount = totalWorkerErrors

  return snap
}

// ============================================================
// 漂移分析
// ============================================================

function analyzeDrift(snapshots: Snapshot[]): {
  memoryDrift: number
  queueGrowth: number
  costGrowth: number
  workerFatigueRate: number
  avgSuccessRate: number
  peakCostPerSnapshot: number
} {
  if (snapshots.length < 2) {
    return { memoryDrift: 0, queueGrowth: 0, costGrowth: 0, workerFatigueRate: 0, avgSuccessRate: 100, peakCostPerSnapshot: 0 }
  }

  const n = snapshots.length

  // Memory Drift (heapUsed / seq)
  const memValues = snapshots.map(s => s.memory.heapUsed)
  const memX = Array.from({ length: n }, (_, i) => i)
  const memSlope = linearRegression(memX, memValues)

  // Queue Growth (queued / seq)
  const queueValues = snapshots.map(s => s.queue.queued)
  const queueSlope = linearRegression(memX, queueValues)

  // Cost Growth (totalCost / seq)
  const costValues = snapshots.map(s => s.cost.totalEstimatedCost)
  const costSlope = linearRegression(memX, costValues)

  // Worker Fatigue — success rate trend (successRate / seq)
  const srValues = snapshots.map(s => s.worker.successRate)
  const srSlope = linearRegression(memX, srValues)

  const avgSuccessRate = srValues.reduce((a, b) => a + b, 0) / n
  const peakCostPerSnapshot = Math.max(...snapshots.map(s => s.cost.snapshotCost))

  return {
    memoryDrift: Math.round(memSlope * 100) / 100, // MB per snapshot
    queueGrowth: Math.round(queueSlope * 100) / 100,
    costGrowth: Math.round(costSlope * 100) / 100,
    workerFatigueRate: Math.round(srSlope * 100) / 100,
    avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
    peakCostPerSnapshot: Math.round(peakCostPerSnapshot * 100) / 100,
  }
}

/** 最小二乘法线性回归，返回斜率 (y = a + bx) */
function linearRegression(x: number[], y: number[]): number {
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((a, _, i) => a + x[i] * y[i], 0)
  const sumX2 = x.reduce((a, b) => a + b * b, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return slope
}

// ============================================================
// 等级评定
// ============================================================

function calculateGrade(
  analysis: ReturnType<typeof analyzeDrift>,
  snapshots: Snapshot[]
): StabilityResult['grade'] {
  if (snapshots.length < 2) return 'A+'

  // 内存漂移：>= 10 MB/snapshot = 严重泄漏
  if (analysis.memoryDrift >= 10) return 'D'
  if (analysis.memoryDrift >= 5) return 'C'
  if (analysis.memoryDrift >= 2) return 'B'

  // 队列堆积：趋势 >= 50/snapshot
  if (analysis.queueGrowth >= 50) return 'D'
  if (analysis.queueGrowth >= 20) return 'C'
  if (analysis.queueGrowth >= 10) return 'B'

  // 成本增长：>= 50/snapshot
  if (analysis.costGrowth >= 50) return 'D'
  if (analysis.costGrowth >= 20) return 'C'
  if (analysis.costGrowth >= 10) return 'B'

  // Worker疲劳：下降 > 5%/snapshot
  if (analysis.workerFatigueRate <= -5) return 'D'
  if (analysis.workerFatigueRate <= -2) return 'C'
  if (analysis.workerFatigueRate <= -1) return 'B'

  // 平均成功率
  if (analysis.avgSuccessRate < 60) return 'D'
  if (analysis.avgSuccessRate < 80) return 'C'
  if (analysis.avgSuccessRate < 90) return 'B'

  return 'A+'
}

// ============================================================
// 自动熔断检查
// ============================================================

interface AbortCheck {
  shouldAbort: boolean
  reason: string
}

function checkAutoAbort(snap: Snapshot, prev: Snapshot | null): AbortCheck {
  if (!prev) return { shouldAbort: false, reason: '' }

  const queueDelta = snap.queue.queued - prev.queue.queued
  if (queueDelta > runtimeConfig.maxQueueGrowth) {
    return { shouldAbort: true, reason: `Queue growth spike: +${queueDelta} in one interval (max=${runtimeConfig.maxQueueGrowth})` }
  }

  if (snap.worker.successRate < (100 - runtimeConfig.maxErrorRate)) {
    return { shouldAbort: true, reason: `Error rate critical: ${snap.worker.successRate}% success (min=${100 - runtimeConfig.maxErrorRate}%)` }
  }

  if (snap.cost.snapshotCost > runtimeConfig.maxCostPerSnapshot) {
    return { shouldAbort: true, reason: `Cost spike: ¥${snap.cost.snapshotCost} in one interval (max=¥${runtimeConfig.maxCostPerSnapshot})` }
  }

  return { shouldAbort: false, reason: '' }
}

// ============================================================
// 流量模式循环
// ============================================================

let patternIndex = 0
let patternTimer: ReturnType<typeof setTimeout> | null = null

async function cyclePattern() {
  if (!state.running || state.autoAbort) return

  const pattern = runtimePatternSequence[state.patternIndex % runtimePatternSequence.length]
  state.patternIndex++

  startSimulation({
    durationSeconds: runtimePatternDurationSec,
    pattern,
    userCount: runtimeConfig.userCount,
    chaosChance: 0.2,
    bridgeEnabled: true,
  })

  emitEvent('stability.pattern.switch', { pattern, index: patternIndex })

  patternTimer = timerRegistry.setTimeout(cyclePattern, runtimePatternDurationSec * 1000 + 2000)
}

// ============================================================
// 主入口
// ============================================================

export async function startStabilityTest(overrides: Partial<Config> = {}): Promise<{ message: string }> {
  if (state.running) {
    return { message: 'Stability test already running' }
  }

  Object.assign(runtimeConfig, overrides)
  if (overrides.patternSequence) runtimePatternSequence = overrides.patternSequence
  if (overrides.patternDurationSec) runtimePatternDurationSec = overrides.patternDurationSec
  state.running = true
  state.startTime = Date.now()
  state.autoAbort = false
  state.abortReason = ''
  state.snapshots = []
  state.lastQueueSize = 0
  state.lastCost = 0
  state.lastErrorCount = 0
  state.patternIndex = 0
  state.totalSnapshots = 0
  state._lastResult = null

  // 重置 Bridge
  resetBridgeState()
  setBridgeConfig({ enabled: true })

  // 初始化隔离环境
  await ensureIsolationTables()
  startSimWorker({
    concurrency: Math.min(runtimeConfig.userCount, 5),
    processTimeMs: 200,
    failRate: 0.1,
  })

  // 启动背压控制
  resetBackpressure()
  startBackpressureController({
    highWaterMark: 100,
    lowWaterMark: 20,
    maxRate: 15,
    initialRate: 8,
    emergencyThreshold: 500,
  })

  emitEvent('stability.started', {
    durationMs: runtimeConfig.durationMs,
    snapshotIntervalMs: runtimeConfig.snapshotIntervalMs,
    userCount: runtimeConfig.userCount,
    patternSequence: runtimePatternSequence,
    patternDurationSec: runtimePatternDurationSec,
  })

  // 启动流量模式轮转
  cyclePattern()

  // 捕获第一个快照
  const firstSnap = await captureSnapshot(0)
  state.snapshots.push(firstSnap)
  state.totalSnapshots++

  emitEvent('stability.snapshot', {
    seq: 0,
    memory: firstSnap.memory,
    queue: firstSnap.queue,
    cost: firstSnap.cost,
    worker: firstSnap.worker,
  })

  // 定时快照
  state.snapshotTimer = timerRegistry.setInterval(async () => {
    try {
      if (!state.running) {
        timerRegistry.clearInterval(state.snapshotTimer!)
        return
      }

      const seq = state.snapshots.length
      const snap = await captureSnapshot(seq)
      state.snapshots.push(snap)
      pushGlobalSnapshot(snap) // 全局快照历史（带容量上限）
      state.totalSnapshots++

      // 自动熔断检查
      const prev = state.snapshots.length >= 2 ? state.snapshots[state.snapshots.length - 2] : null
      const abort = checkAutoAbort(snap, prev)
      if (abort.shouldAbort) {
        state.autoAbort = true
        state.abortReason = abort.reason
        await stopStabilityTest()
        emitEvent('stability.aborted', { reason: abort.reason, seq })
        return
      }

      emitEvent('stability.snapshot', {
        seq,
        memory: snap.memory,
        queue: snap.queue,
        cost: snap.cost,
        worker: snap.worker,
    })

    // 超时检查
    if (Date.now() - state.startTime >= runtimeConfig.durationMs) {
      await stopStabilityTest()
    }
  } catch (err) {
    console.error('[Stability] Snapshot handler error:', err)
  }
  }, runtimeConfig.snapshotIntervalMs)

  return { message: `Stability test started: ${runtimeConfig.durationMs / 60000}min, snapshot every ${runtimeConfig.snapshotIntervalMs / 1000}s` }
}

export async function stopStabilityTest(): Promise<StabilityResult> {
  if (!state.running) {
    return getLastResult()
  }

  // 停止模拟
  stopSimulation()
  setBridgeConfig({ enabled: false })
  stopSimWorker()

  // 停止定时器
  if (state.snapshotTimer) {
    timerRegistry.clearInterval(state.snapshotTimer)
    state.snapshotTimer = null
  }
  if (patternTimer) {
    timerRegistry.clearTimeout(patternTimer)
    patternTimer = null
  }

  // 确保模拟和 worker 都停止
  try { stopSimulation() } catch {}
  try { setBridgeConfig({ enabled: false }) } catch {}
  try { stopSimWorker() } catch {}
  try { stopBackpressureController() } catch {}

  // 等待最后一个快照完成
  if (state.snapshots.length > 0) {
    const lastSnap = await captureSnapshot(state.snapshots.length)
    state.snapshots.push(lastSnap)
    state.totalSnapshots++
  }

  state.running = false
  state.durationMs = Date.now() - state.startTime

  const analysis = analyzeDrift(state.snapshots)
  const grade = calculateGrade(analysis, state.snapshots)

  const result: StabilityResult = {
    duration: state.durationMs,
    snapshots: state.totalSnapshots,
    ...analysis,
    autoStopTriggered: state.autoAbort,
    stopReason: state.abortReason || 'completed',
    grade,
  }

  // 存最后结果
  state._lastResult = result

  emitEvent('stability.completed', { result })

  return result
}

function getLastResult(): StabilityResult {
  return state._lastResult ?? {
    duration: 0, snapshots: 0,
    memoryDrift: 0, queueGrowth: 0, costGrowth: 0,
    workerFatigueRate: 0, avgSuccessRate: 100,
    peakCostPerSnapshot: 0,
    autoStopTriggered: false, stopReason: 'not_started',
    grade: 'A+',
  }
}

export function getStabilityStatus() {
  return {
    running: state.running,
    elapsedMs: state.running ? Date.now() - state.startTime : 0,
    snapshots: state.totalSnapshots,
    autoAbort: state.autoAbort,
    abortReason: state.abortReason,
    config: runtimeConfig,
    lastResult: state._lastResult,
  }
}
