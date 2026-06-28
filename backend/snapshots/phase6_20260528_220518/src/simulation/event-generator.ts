/**
 * Event Generator — 行为模拟执行器
 * 
 * 接受 User Model + Load Pattern 输入，生成模拟操作事件，
 * 通过现有系统的 API/Scheduler 通道"真实地"注入流量。
 * 
 * 不调 mock 而是真的走系统流程（submit/cancel/retry 都会落到调度器里）。
 */

import { pickUserModel, pickTaskType, UserModel } from './user-models.js'
import { getPatternByName, PatternType, LoadPattern } from './load-patterns.js'
import { randomInjection, clearAllInjections } from './chaos-injector.js'
import { emitEvent } from '../services/observability.service.js'
import { getAllowedRate } from './backpressure-controller.js'
import {
  bridgeSubmit,
  bridgeCancel,
  bridgeRetry,
  bridgeSpamSubmit,
  bridgeRefresh,
  setBridgeConfig,
  getBridgeConfig,
} from './simulation-bridge.js'

// ============================================================
// 模拟运行时状态
// ============================================================

interface SimulationState {
  active: boolean
  startTime: Date | null
  durationSeconds: number
  patternType: PatternType
  userCount: number
  totalSubmitted: number
  totalCancelled: number
  totalRetried: number
  totalInjections: number
  currentConcurrency: number
  peakConcurrency: number
}

let state: SimulationState = {
  active: false,
  startTime: null,
  durationSeconds: 60,
  patternType: 'chaos',
  userCount: 10,
  totalSubmitted: 0,
  totalCancelled: 0,
  totalRetried: 0,
  totalInjections: 0,
  currentConcurrency: 0,
  peakConcurrency: 0,
}

let simulationTimer: ReturnType<typeof setTimeout> | null = null
let activeTasks = new Map<string, { userId: string; model: string; cancelTimer: ReturnType<typeof setTimeout> }>()

// ============================================================
// 模拟运行
// ============================================================

export function startSimulation(params: {
  durationSeconds?: number
  pattern?: PatternType
  userCount?: number
  chaosChance?: number
  bridgeEnabled?: boolean
}) {
  if (state.active) {
    return { error: 'Simulation already running' }
  }

  const durationSeconds = params.durationSeconds ?? 60
  const patternType = params.pattern ?? 'chaos'
  const userCount = params.userCount ?? 10
  const chaosChance = params.chaosChance ?? 0.15
  const bridgeEnabled = params.bridgeEnabled ?? false

  // 启用 Bridge 则模拟流量进入真实系统
  if (bridgeEnabled) {
    setBridgeConfig({ enabled: true, maxConcurrency: userCount * 2 })
  }

  state = {
    active: true,
    startTime: new Date(),
    durationSeconds,
    patternType,
    userCount,
    totalSubmitted: 0,
    totalCancelled: 0,
    totalRetried: 0,
    totalInjections: 0,
    currentConcurrency: 0,
    peakConcurrency: 0,
  }

  const pattern = getPatternByName(patternType)

  emitEvent('simulation.started', {
    pattern: patternType,
    userCount,
    durationSeconds,
    chaosChance,
    bridgeEnabled,
  })

  // 启动模拟循环
  let elapsedSeconds = 0
  const tick = () => {
    if (!state.active || elapsedSeconds >= durationSeconds) {
      stopSimulation()
      return
    }

    // 获取当前时间点的并发目标
    const timeline = pattern.generateTimeline(1)
    const targetConcurrency = timeline[0]

    // 背压节流：检测当前允许的速率，如果接近 0 则跳过这一帧
    const allowedRate = getAllowedRate()
    if (allowedRate <= 0) {
      elapsedSeconds++
      simulationTimer = setTimeout(tick, 1000)
      return
    }

    // 生成用户操作（受背压限制）
    const submitBudget = Math.max(1, Math.round(allowedRate / 2)) // 每帧最多提交 allowedRate/2
    let submittedThisFrame = 0

    for (let i = 0; i < targetConcurrency; i++) {
      // 背压检查：超出预算则跳过
      if (submittedThisFrame >= submitBudget) break

      if (Math.random() < chaosChance) {
        // 混合 cancel/retry 行为
        if (Math.random() < 0.3 && activeTasks.size > 0) {
          simulateCancel()
        } else if (Math.random() < 0.2) {
          simulateRetry()
        }
      }

      simulateSubmit()
      submittedThisFrame++
    }

    // 随机故障注入
    if (Math.random() < chaosChance * 0.3) {
      randomInjection()
      state.totalInjections++
    }

    state.currentConcurrency = targetConcurrency
    if (targetConcurrency > state.peakConcurrency) {
      state.peakConcurrency = targetConcurrency
    }

    elapsedSeconds++

    // 发射 SSE 更新
    emitEvent('simulation.tick', {
      elapsedSeconds,
      targetConcurrency,
      totalSubmitted: state.totalSubmitted,
      totalCancelled: state.totalCancelled,
      totalRetried: state.totalRetried,
    })

    simulationTimer = setTimeout(tick, 1000)
  }

  simulationTimer = setTimeout(tick, 1000)
  return { message: `Simulation started: ${patternType} x ${userCount} users for ${durationSeconds}s` }
}

export function stopSimulation() {
  if (!state.active) return { error: 'No active simulation' }

  state.active = false

  if (simulationTimer) {
    clearTimeout(simulationTimer)
    simulationTimer = null
  }

  // 清除所有任务 cancel 定时器
  for (const [, task] of activeTasks) {
    clearTimeout(task.cancelTimer)
  }
  activeTasks.clear()

  clearAllInjections()
  setBridgeConfig({ enabled: false })

  emitEvent('simulation.stopped', {
    totalSubmitted: state.totalSubmitted,
    totalCancelled: state.totalCancelled,
    totalRetried: state.totalRetried,
    peakConcurrency: state.peakConcurrency,
    duration: state.durationSeconds,
  })

  return { message: 'Simulation stopped' }
}

export function getSimulationState(): SimulationState {
  return { ...state }
}

// ============================================================
// 模拟操作
// ============================================================

function simulateSubmit() {
  const model = pickUserModel()
  const taskType = pickTaskType(model)

  // 通过 Bridge 提交真实任务（如果启用）
  bridgeSubmit(taskType, taskType === 'text_script' ? 'deepseek-chat' : undefined)

  // 模拟 burst submit（C类）
  if (model.burstSubmit) {
    const burstCount = 2 + Math.floor(Math.random() * 3) // 2~4 次连点
    for (let i = 0; i < burstCount; i++) {
      emitEvent('simulation.user.submit', {
        userId: `sim-${model.id}-${Date.now()}`,
        model: model.id,
        taskType,
        burstIndex: i,
      })
      state.totalSubmitted++
    }
  } else {
    emitEvent('simulation.user.submit', {
      userId: `sim-${model.id}-${Date.now()}`,
      model: model.id,
      taskType,
    })
    state.totalSubmitted++
  }

  // 焦虑用户：设置 cancel 定时器
  if (Math.random() < 0.3) {
    const cancelDelay = model.cancelThresholdMs * (0.5 + Math.random() * 0.5)
    const cancelTimer = setTimeout(() => {
      simulateCancel()
    }, cancelDelay)
    activeTasks.set(`task-${Date.now()}-${Math.random()}`, {
      userId: model.id,
      model: model.id,
      cancelTimer,
    })
  }
}

function simulateCancel() {
  state.totalCancelled++

  // 通过 Bridge 取消真实任务
  bridgeCancel()

  // 取消后可能触发刷新 or 重试
  if (Math.random() < 0.5) {
    emitEvent('simulation.user.refresh', {
      trigger: 'cancel_anxiety',
    })
  }

  if (Math.random() < 0.3) {
    simulateRetry()
  }
}

function simulateRetry() {
  state.totalRetried++
  const model = pickUserModel()
  const taskType = pickTaskType(model)

  // 通过 Bridge 重试（重新提交）
  bridgeRetry(taskType)

  emitEvent('simulation.user.retry', {
    userId: `sim-${model.id}-${Date.now()}`,
    model: model.id,
    taskType,
    retryCount: 1 + Math.floor(Math.random() * model.retryMaxCount),
  })
}
