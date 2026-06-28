/**
 * Simulation Task Bridge — 模拟世界接入生产系统
 * 
 * 将 Behavior Simulator 的事件转化为真实的系统调用：
 *   submit     → task.create()            (进入 Scheduler → Worker → Router → Sandbox)
 *   cancel     → task.cancel()             (打到调度器的真实取消逻辑)
 *   retry      → task.requeue()            (真实的重新调度)
 *   refresh    → GET /api/tasks/:id/status (真实的查询压力)
 *   spam       → bulk task.create()        (连点器模式)
 * 
 * 所有模拟任务带 source: "simulation" 标记，
 * Cost Guard 对 simulation 任务不产生真实计费。
 */

import { emitEvent } from '../services/observability.service.js'

// ============================================================
// Bridge 配置
// ============================================================

interface BridgeConfig {
  /** 是否将模拟流量打入真实系统 */
  enabled: boolean
  /** 模拟任务的最大并发数 */
  maxConcurrency: number
  /** 模拟任务注入强度 0.1~1.0 */
  injectionWeight: number
  /** 是否跳过 Cost Guard（默认 true：模拟不花钱） */
  skipCost: boolean
  /** 默认项目 ID（模拟任务挂载到的项目） */
  defaultProjectId: string
  /** 默认用户 ID（模拟行为的虚拟用户） */
  defaultUserId: string
}

const config: BridgeConfig = {
  enabled: false,
  maxConcurrency: 20,
  injectionWeight: 0.5,
  skipCost: true,
  defaultProjectId: '00000000-0000-0000-0000-000000000001',
  defaultUserId: 'simulation-user',
}

// ============================================================
// 运行时状态
// ============================================================

interface BridgeState {
  activeTasks: Map<string, { taskId: string; type: string; createdAt: Date }>
  totalCreated: number
  totalCancelled: number
  totalRetried: number
  totalErrors: number
  peakActive: number
}

const state: BridgeState = {
  activeTasks: new Map(),
  totalCreated: 0,
  totalCancelled: 0,
  totalRetried: 0,
  totalErrors: 0,
  peakActive: 0,
}

// ============================================================
// API Base URL（对内）
// ============================================================

const API_BASE = 'http://127.0.0.1:4000/api'

// ============================================================
// 认证 Token（初始化时获取）
// ============================================================

let authToken: string | null = null

async function ensureToken(): Promise<string> {
  if (authToken) return authToken
  try {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@scs.com', password: 'admin123' }),
    })
    const data = await resp.json() as any
    authToken = data.accessToken
    return authToken!
  } catch (err) {
    state.totalErrors++
    throw err
  }
}

// ============================================================
// 任务类型到 API 端点的映射
// ============================================================

type TaskEndpoint = 'text_script' | 'storyboard' | 'video_gen' | 'character_gen' | 'voiceover'

// ============================================================
// 核心 Bridge 操作
// ============================================================

/**
 * 提交模拟任务 → isolation-layer.createSimTask()
 */
export async function bridgeSubmit(taskType: string, model?: string): Promise<boolean> {
  if (!config.enabled) {
    emitEvent('simulation.bridge.skipped', { taskType, reason: 'bridge_disabled' })
    return false
  }

  try {
    // 走隔离 API（无认证，只写 simulation_tasks 表）
    const resp = await fetch(`${API_BASE}/sim-isolation/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType,
        priority: 3,
        userModel: model,
        payload: {
          prompt: '[SIMULATION] System behavior stress test',
          model: model ?? undefined,
        },
      }),
    })

    if (!resp.ok) {
      state.totalErrors++
      emitEvent('simulation.bridge.error', { taskType, status: resp.status, statusText: resp.statusText })
      return false
    }

    const data = await resp.json() as any
    const taskId = data.task?.id ?? data.id

    state.totalCreated++
    state.activeTasks.set(taskId, { taskId, type: taskType, createdAt: new Date() })
    if (state.activeTasks.size > state.peakActive) {
      state.peakActive = state.activeTasks.size
    }

    emitEvent('simulation.bridge.created', { taskId, taskType })
    return true
  } catch (err) {
    state.totalErrors++
    emitEvent('simulation.bridge.error', { taskType, error: String(err) })
    return false
  }
}

/**
 * 取消模拟任务 → isolation-layer.cancelSimTask()
 */
export async function bridgeCancel(taskId?: string): Promise<boolean> {
  if (!config.enabled) return false

  if (!taskId) {
    if (state.activeTasks.size === 0) return false
    const entries = Array.from(state.activeTasks.entries())
    taskId = entries[Math.floor(Math.random() * entries.length)][0]
  }

  try {
    const resp = await fetch(`${API_BASE}/sim-isolation/tasks/${taskId}/cancel`, {
      method: 'POST',
    })

    if (!resp.ok) {
      state.totalErrors++
      return false
    }

    state.totalCancelled++
    state.activeTasks.delete(taskId!)
    emitEvent('simulation.bridge.cancelled', { taskId })
    return true
  } catch (err) {
    state.totalErrors++
    return false
  }
}

/**
 * 重试模拟任务 → 真实 task.retry()
 */
export async function bridgeRetry(taskType: string): Promise<boolean> {
  if (!config.enabled) return false

  // 重试 = 重新 submit（失败任务会在 Scheduler 中自动处理）
  // 这里模拟的是用户手动重试行为
  return bridgeSubmit(taskType)
}

/**
 * 连点器模式 → bulk submit
 */
export async function bridgeSpamSubmit(count: number, taskType: string): Promise<number> {
  let successCount = 0
  const batchSize = Math.min(count, 5) // 每批最多 5 个

  const promises: Promise<boolean>[] = []
  for (let i = 0; i < batchSize; i++) {
    promises.push(bridgeSubmit(taskType))
  }

  const results = await Promise.allSettled(promises)
  successCount = results.filter(r => r.status === 'fulfilled' && r.value).length

  return successCount
}

/**
 * 刷新/查询任务
 */
export async function bridgeRefresh(taskId?: string): Promise<boolean> {
  if (!config.enabled) return false

  if (!taskId && state.activeTasks.size > 0) {
    const entries = Array.from(state.activeTasks.entries())
    taskId = entries[Math.floor(Math.random() * entries.length)][0]
  }

  if (!taskId) return false

  try {
    const resp = await fetch(`${API_BASE}/sim-isolation/tasks/stats`, {
    })

    if (resp.ok) {
      emitEvent('simulation.bridge.refresh', { taskId })
      return true
    }
    return false
  } catch {
    return false
  }
}

// ============================================================
// Bridge 控制
// ============================================================

export function setBridgeConfig(updates: Partial<BridgeConfig>) {
  Object.assign(config, updates)

  emitEvent('simulation.bridge.config', {
    enabled: config.enabled,
    maxConcurrency: config.maxConcurrency,
    injectionWeight: config.injectionWeight,
    skipCost: config.skipCost,
  })
}

export function getBridgeConfig(): BridgeConfig {
  return { ...config }
}

export function getBridgeState(): BridgeState & {
  activeCount: number
  peakActive: number
  configEnabled: boolean
} {
  return {
    ...state,
    activeCount: state.activeTasks.size,
    activeTasks: state.activeTasks as any, // serializable summary
    peakActive: state.peakActive,
    configEnabled: config.enabled,
  }
}

export function resetBridgeState() {
  state.activeTasks.clear()
  state.totalCreated = 0
  state.totalCancelled = 0
  state.totalRetried = 0
  state.totalErrors = 0
  state.peakActive = 0
}
