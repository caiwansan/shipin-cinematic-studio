/**
 * Chaos Injector — 故障注入系统
 * 
 * 可注入故障类型：
 *   - API 延迟抖动（+500ms ~ +10s）
 *   - Worker 随机死亡
 *   - SSE 随机断线重连
 *   - Redis 队列延迟
 *   - Cost spike（模型突然变贵 3x）
 */

import { emitEvent } from '../services/observability.service.js'

// ============================================================
// 故障类型
// ============================================================

export type InjectionType =
  | 'api_delay'
  | 'worker_kill'
  | 'sse_disconnect'
  | 'redis_lag'
  | 'cost_spike'

export interface ChaosInjection {
  type: InjectionType
  severity: 'low' | 'medium' | 'high'
  durationMs: number
  delayMs: number         // 注入参数：延迟量
}

// ============================================================
// 故障效果记录
// ============================================================

export interface InjectionResult {
  id: string
  type: InjectionType
  severity: 'low' | 'medium' | 'high'
  startedAt: Date
  endedAt?: Date
  active: boolean
  effectDescription: string
}

let activeInjections: InjectionResult[] = []
let injectionCounter = 0

// ============================================================
// 故障注入 API
// ============================================================

const originalSetTimeout = globalThis.setTimeout

// 保存原始函数引用，用于清除
const activeDelays = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 注入 API 延迟
 */
export function injectApiDelay(severity: 'low' | 'medium' | 'high'): InjectionResult {
  const delays: Record<string, number> = {
    low: 500 + Math.floor(Math.random() * 1000),      // 0.5~1.5s
    medium: 2000 + Math.floor(Math.random() * 3000),   // 2~5s
    high: 5000 + Math.floor(Math.random() * 5000),     // 5~10s
  }

  const delayMs = delays[severity]
  const id = `api-delay-${++injectionCounter}-${Date.now()}`
  const result: InjectionResult = {
    id,
    type: 'api_delay',
    severity,
    startedAt: new Date(),
    active: true,
    effectDescription: `API response delayed by +${delayMs}ms (${severity})`,
  }

  activeInjections.push(result)

  // 广播故障注入事件
  emitEvent('simulation.injection', {
    type: 'api_delay',
    severity,
    delayMs,
    id,
  })

  return result
}

/**
 * 清除 API 延迟（重置）
 */
export function clearApiDelay(id: string) {
  activeInjections = activeInjections.filter(i => i.id !== id)
}

/**
 * 清除所有故障注入
 */
export function clearAllInjections() {
  for (const [id] of activeDelays) {
    clearTimeout(activeDelays.get(id))
  }
  activeDelays.clear()
  activeInjections = []
}

/**
 * 获取当前故障状态
 */
export function getActiveInjections(): InjectionResult[] {
  return activeInjections
}

// ============================================================
// 随机故障注入（混沌模式用）
// ============================================================

export function randomInjection(): InjectionResult {
  const types: InjectionType[] = ['api_delay', 'worker_kill', 'sse_disconnect', 'redis_lag', 'cost_spike']
  const severities: ('low' | 'medium' | 'high')[] = ['low', 'low', 'medium', 'medium', 'high']
  const type = types[Math.floor(Math.random() * types.length)]
  const severity = severities[Math.floor(Math.random() * severities.length)]

  switch (type) {
    case 'api_delay':
      return injectApiDelay(severity)
    case 'worker_kill':
      const id = `worker-kill-${++injectionCounter}-${Date.now()}`
      const result: InjectionResult = {
        id,
        type: 'worker_kill',
        severity,
        startedAt: new Date(),
        active: true,
        effectDescription: `Worker process randomly killed (${severity})`,
      }
      activeInjections.push(result)
      emitEvent('simulation.injection', { type: 'worker_kill', severity, id })
      return result
    case 'sse_disconnect':
      const sseId = `sse-drop-${++injectionCounter}-${Date.now()}`
      const sseResult: InjectionResult = {
        id: sseId,
        type: 'sse_disconnect',
        severity,
        startedAt: new Date(),
        active: true,
        effectDescription: `SSE connection dropped (${severity})`,
      }
      activeInjections.push(sseResult)
      emitEvent('simulation.injection', { type: 'sse_disconnect', severity, id: sseId })
      return sseResult
    case 'redis_lag':
      const lagId = `redis-lag-${++injectionCounter}-${Date.now()}`
      const lagResult: InjectionResult = {
        id: lagId,
        type: 'redis_lag',
        severity,
        startedAt: new Date(),
        active: true,
        effectDescription: `Redis queue latency injected: +${severity === 'high' ? 5000 : severity === 'medium' ? 2000 : 500}ms`,
      }
      activeInjections.push(lagResult)
      emitEvent('simulation.injection', { type: 'redis_lag', severity, id: lagId })
      return lagResult
    case 'cost_spike':
      const spikeId = `cost-spike-${++injectionCounter}-${Date.now()}`
      const multiplier = severity === 'high' ? 5 : severity === 'medium' ? 3 : 2
      const spikeResult: InjectionResult = {
        id: spikeId,
        type: 'cost_spike',
        severity,
        startedAt: new Date(),
        active: true,
        effectDescription: `Model cost multiplied by ${multiplier}x (${severity})`,
      }
      activeInjections.push(spikeResult)
      emitEvent('simulation.injection', { type: 'cost_spike', severity, multiplier, id: spikeId })
      return spikeResult
  }
}
