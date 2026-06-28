/**
 * Phase 6C-3.3 — Backpressure Control Layer
 *
 * 核心目标：将系统从"开环"升级为"闭环控制系统"。
 *
 * 三个关键能力：
 *   ① Queue Pressure Monitor — 实时计算队列压力系数
 *   ② Adaptive Generator Throttle — 根据压力自动调节生成速率
 *   ③ System Equilibrium Controller — 维持系统稳态
 *
 * 设计原则：
 *   - Feedback Loop：worker 完成率 → queue pressure → generator throttle
 *   - PID 风格控制：P（当前压力）+ D（压力变化趋势）+ 慢启动
 *   - 不破坏 Simulation Isolation — 只影响 simulation 内部的 generator
 */

import { emitEvent } from '../services/observability.service.js'
import { timerRegistry, pushGlobalEvent } from '../services/lifecycle-manager.js'
import { getSimTaskStats } from './isolation-layer.js'
import { BackpressureState } from '../utils/redis-state.js'

// ============================================================
// 配置
// ============================================================

interface BackpressureConfig {
  // 队列压力阈值
  highWaterMark: number     // > 此值 → 降速 (default: 100)
  lowWaterMark: number      // < 此值 → 恢复 (default: 20)

  // 速率控制
  minRate: number           // 最小每秒创建数 (default: 1)
  maxRate: number           // 最大每秒创建数 (default: 20)
  initialRate: number       // 启动速率 (default: 10)

  // PID 控制参数
  proportionalGain: number  // P 增益 (default: 0.5)
  derivativeGain: number    // D 增益 (default: 0.2)
  smoothingFactor: number   // 指数平滑系数 (default: 0.3)

  // 安全
  emergencyThreshold: number // 队列 > 此值 → 立即停止 generator (default: 500)
  recoveryCooldownMs: number // 紧急停止后的冷却时间 (default: 5000)
}

const DEFAULT_CONFIG: BackpressureConfig = {
  highWaterMark: 100,
  lowWaterMark: 20,
  minRate: 1,
  maxRate: 20,
  initialRate: 10,
  proportionalGain: 0.5,
  derivativeGain: 0.2,
  smoothingFactor: 0.3,
  emergencyThreshold: 500,
  recoveryCooldownMs: 5000,
}

// ============================================================
// 状态
// ============================================================

interface BackpressureState {
  enabled: boolean
  config: BackpressureConfig

  // 当前速率
  currentRate: number
  targetRate: number

  // 队列状态
  queueLength: number
  queuePressure: number        // 0.0 ~ 1.0
  previousPressure: number
  pressureDerivative: number   // 压力变化率

  // 闭环统计
  totalThrottleEvents: number  // 降速次数
  totalRecoveryEvents: number  // 恢复次数
  totalEmergencyStops: number  // 紧急停止次数
  lastEmergencyAt: number | null
  lastEmitTime: number

  // Worker 吞吐量（每秒完成数）
  workerThroughput: number
  previousCompleted: number

  // SES — System Equilibrium Score
  ses: number                  // workerThroughput / currentRate

  // 历史
  history: {
    time: number
    queueLength: number
    pressure: number
    rate: number
    ses: number
  }[]
  maxHistoryLength: number
}

const state: BackpressureState = {
  enabled: false,
  config: { ...DEFAULT_CONFIG },

  currentRate: DEFAULT_CONFIG.initialRate,
  targetRate: DEFAULT_CONFIG.initialRate,

  queueLength: 0,
  queuePressure: 0,
  previousPressure: 0,
  pressureDerivative: 0,

  totalThrottleEvents: 0,
  totalRecoveryEvents: 0,
  totalEmergencyStops: 0,
  lastEmergencyAt: null,
  lastEmitTime: 0,

  workerThroughput: 0,
  previousCompleted: 0,

  ses: 1.0,

  history: [],
  maxHistoryLength: 100,
}

// ============================================================
// Generator Rate Controller（会被 event-generator 调用的接口）
// ============================================================

let lastSampleTime = 0
let sampleTimer: ReturnType<typeof setInterval> | null = null

/**
 * 启动 Backpressure Controller
 * 每 1s 采样一次队列 + 计算压力 → 调整目标速率
 */
export function startBackpressureController(config?: Partial<BackpressureConfig>) {
  if (state.enabled) return

  if (config) {
    Object.assign(state.config, config)
  }

  state.enabled = true
  state.currentRate = state.config.initialRate
  state.targetRate = state.config.initialRate
  lastSampleTime = Date.now()

  // 每秒采样循环
  sampleTimer = timerRegistry.setInterval(sampleLoop, 1000)

  emitEvent('backpressure.started', {
    highWaterMark: state.config.highWaterMark,
    lowWaterMark: state.config.lowWaterMark,
    initialRate: state.config.initialRate,
  })

  pushGlobalEvent('backpressure.started', {
    config: state.config,
    timestamp: new Date().toISOString(),
  })

  console.log(`[Backpressure] Controller started: initial=${state.config.initialRate}/s range=[${state.config.minRate}..${state.config.maxRate}]`)
}

/**
 * 停止 Backpressure Controller
 */
export function stopBackpressureController() {
  if (!state.enabled) return
  state.enabled = false
  if (sampleTimer) {
    timerRegistry.clearInterval(sampleTimer)
    sampleTimer = null
  }
  pushGlobalEvent('backpressure.stopped', { timestamp: new Date().toISOString() })
  console.log('[Backpressure] Controller stopped')
}

/**
 * 采样循环 — PID 风格压力控制
 */
async function sampleLoop() {
  if (!state.enabled) return

  try {
    // 采样当前队列压力
    const stats = await getSimTaskStats()
    state.queueLength = stats.byStatus['queued'] ?? 0
    const completed = stats.byStatus['completed'] ?? 0

    // 计算 worker 吞吐量
    const deltaCompleted = completed - state.previousCompleted
    state.workerThroughput = Math.max(0, deltaCompleted)
    state.previousCompleted = completed

    // 计算队列压力系数 (0.0 ~ 1.0)
    const rawPressure = state.config.highWaterMark > 0
      ? state.queueLength / state.config.highWaterMark
      : 0
    const clampedPressure = Math.min(1.0, rawPressure)

    // 指数平滑 — 防止抖动
    state.previousPressure = state.queuePressure
    state.queuePressure = state.config.smoothingFactor * clampedPressure
      + (1 - state.config.smoothingFactor) * state.previousPressure

    // 压力导数（变化趋势）
    state.pressureDerivative = state.queuePressure - state.previousPressure

    // ============================================================
    // PID 控制逻辑
    // ============================================================

    // P 项：当前压力偏差（目标压力为 0.3 = moderate）
    const targetPressure = 0.3
    const pError = state.queuePressure - targetPressure

    // D 项：压力变化趋势
    const dError = state.pressureDerivative

    // 控制量（负值 = 降速，正值 = 加速）
    const controlSignal = -(state.config.proportionalGain * pError + state.config.derivativeGain * dError)

    // 计算目标速率
    let newRate = state.currentRate + controlSignal

    // 限制速率范围
    newRate = Math.max(state.config.minRate, Math.min(state.config.maxRate, newRate))

    // 紧急停止
    if (state.queueLength > state.config.emergencyThreshold) {
      newRate = 0
      state.totalEmergencyStops++
      state.lastEmergencyAt = Date.now()
      pushGlobalEvent('backpressure.emergency_stop', {
        queueLength: state.queueLength,
        pressure: state.queuePressure,
      })
    }

    // 紧急停止后的缓慢恢复
    if (state.lastEmergencyAt && state.currentRate === 0) {
      const cooldownElapsed = Date.now() - state.lastEmergencyAt
      if (cooldownElapsed < state.config.recoveryCooldownMs) {
        // 冷却中，保持暂停
      } else {
        newRate = Math.max(state.config.minRate, newRate * 0.5) // 减半恢复
        state.lastEmergencyAt = null
        state.totalRecoveryEvents++
      }
    }

    // 更新速率
    const oldRate = state.currentRate
    state.currentRate = newRate

    // 记录节流/恢复事件
    if (newRate < oldRate && newRate < state.config.initialRate * 0.5) {
      state.totalThrottleEvents++
      pushGlobalEvent('backpressure.throttled', {
        from: oldRate,
        to: newRate,
        queueLength: state.queueLength,
        pressure: state.queuePressure,
      })
    } else if (newRate > oldRate && state.queuePressure < targetPressure * 0.5) {
      state.totalRecoveryEvents++
      pushGlobalEvent('backpressure.recovered', {
        from: oldRate,
        to: newRate,
        queueLength: state.queueLength,
      })
    }

    // 计算 SES（System Equilibrium Score）
    state.ses = state.currentRate > 0
      ? Math.min(1.0, state.workerThroughput / state.currentRate)
      : 0

    // 记录历史
    state.history.push({
      time: Date.now(),
      queueLength: state.queueLength,
      pressure: state.queuePressure,
      rate: state.currentRate,
      ses: state.ses,
    })
    if (state.history.length > state.maxHistoryLength) {
      state.history.splice(0, Math.floor(state.maxHistoryLength * 0.25))
    }

    // 分布式状态同步（写入 Redis，其他进程可读）
    await BackpressureState.setSnapshot({
      running: state.enabled,
      mode: state.lastEmergencyAt ? 'emergency' : state.enabled ? 'running' : 'idle',
      currentRate: state.currentRate,
      queueLength: state.queueLength,
      queuePressure: state.queuePressure,
      workerThroughput: state.workerThroughput,
      ses: state.ses,
    })

    // 发射事件（降低频率—每 3s 一次）
    if (Date.now() - state.lastEmitTime > 3000) {
      emitEvent('backpressure.sample', {
        queueLength: state.queueLength,
        pressure: Math.round(state.queuePressure * 100) / 100,
        rate: Math.round(state.currentRate * 100) / 100,
        ses: Math.round(state.ses * 100) / 100,
        throttled: state.totalThrottleEvents,
        emergencyStops: state.totalEmergencyStops,
      })
      state.lastEmitTime = Date.now()
    }
  } catch (err) {
    console.error('[Backpressure] Sample loop error:', err)
  }
}

// ============================================================
// Generator 速率查询接口（被 event-generator 调用）
// ============================================================

/**
 * 获取当前可用的 Generator 速率
 * event-generator 调用这个来决定每秒创建多少任务
 */
export function getAllowedRate(): number {
  if (!state.enabled || state.lastEmergencyAt) return 0

  // 慢启动：如果最近紧急停止过，按时间线性恢复
  if (state.lastEmergencyAt) {
    const elapsed = Date.now() - state.lastEmergencyAt
    if (elapsed < state.config.recoveryCooldownMs) return 0
    return Math.max(state.config.minRate, state.currentRate * 0.5)
  }

  return Math.max(0, Math.round(state.currentRate))
}

/**
 * 获取当前背压状态（优先本地，降级到 Redis）
 */
export async function getBackpressureStatus() {
  if (state.enabled) {
    return {
      source: 'local',
      enabled: state.enabled,
      config: state.config,
      currentRate: Math.round(state.currentRate * 100) / 100,
      queueLength: state.queueLength,
      queuePressure: Math.round(state.queuePressure * 100) / 100,
      pressureDerivative: Math.round(state.pressureDerivative * 1000) / 1000,
      workerThroughput: state.workerThroughput,
      ses: Math.round(state.ses * 100) / 100,
      totalThrottleEvents: state.totalThrottleEvents,
      totalRecoveryEvents: state.totalRecoveryEvents,
      totalEmergencyStops: state.totalEmergencyStops,
      isInRecovery: state.lastEmergencyAt !== null,
      historyPoints: state.history.length,
    }
  }

  // 降级到 Redis（跨进程读取）
  try {
    const redisSnapshot = await BackpressureState.snapshot()
    return {
      source: 'redis',
      enabled: redisSnapshot.running,
      config: DEFAULT_CONFIG,
      currentRate: redisSnapshot.currentRate,
      queueLength: redisSnapshot.queueLength,
      queuePressure: redisSnapshot.queuePressure,
      pressureDerivative: 0,
      workerThroughput: redisSnapshot.workerThroughput,
      ses: redisSnapshot.ses,
      totalThrottleEvents: 0,
      totalRecoveryEvents: 0,
      totalEmergencyStops: 0,
      isInRecovery: redisSnapshot.mode === 'emergency',
      historyPoints: 0,
    }
  } catch {
    return { source: 'none', enabled: false, currentRate: 0, queueLength: 0, queuePressure: 0, ses: 1 }
  }
}

/**
 * 更新背压配置（运行时调整）
 */
export function updateBackpressureConfig(config: Partial<BackpressureConfig>) {
  Object.assign(state.config, config)
  pushGlobalEvent('backpressure.config_updated', { config, timestamp: new Date().toISOString() })
  console.log('[Backpressure] Config updated:', config)
}

/**
 * 重置背压状态
 */
export function resetBackpressure() {
  state.currentRate = state.config.initialRate
  state.targetRate = state.config.initialRate
  state.queueLength = 0
  state.queuePressure = 0
  state.previousPressure = 0
  state.pressureDerivative = 0
  state.workerThroughput = 0
  state.previousCompleted = 0
  state.ses = 1.0
  state.history = []
  console.log('[Backpressure] State reset')
}
