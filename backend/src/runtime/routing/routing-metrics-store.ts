/**
 * routing-metrics-store.ts — Phase 2.0 内存信号聚合器
 *
 * ═══════════════════════════════════════════════════════════════
 * 职责：
 *   接收 RoutingSignal → 按 provider 聚合 → 定时计算窗口统计
 *
 * 约束（不可违反）：
 *   1. 纯观测：不输出到 scoring / routing / fallback
 *   2. 异步非阻塞：emit() 不 await，不 catch
 *   3. 内存窗口：5 分钟滑动窗口，不做持久化
 * ═══════════════════════════════════════════════════════════════
 */

import type { RoutingSignal, ProviderMetricsWindow } from './routing-signal.js'

// ─── 配置 ─────────────────────────────────────────────────────

const WINDOW_MS = 5 * 60 * 1000  // 5 分钟
const CLEANUP_INTERVAL_MS = 60 * 1000 // 每分钟清理一次过期信号
const MAX_SIGNALS_PER_PROVIDER = 10000 // 单 provider 最大信号数（防止内存溢出）

// ─── 内部状态 ─────────────────────────────────────────────────

/** provider → 信号列表（按时间升序） */
const signalsByProvider = new Map<string, RoutingSignal[]>()
/** provider → 缓存的最新聚合窗口（惰性计算） */
const metricsCache = new Map<string, ProviderMetricsWindow>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null

// ─── 启动/停止 ───────────────────────────────────────────────

export function startMetricsStore(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    cleanupExpired()
    recomputeAll()
  }, CLEANUP_INTERVAL_MS)
  console.log('[MetricsStore] 启动 — 窗口 %dms, 清理间隔 %dms', WINDOW_MS, CLEANUP_INTERVAL_MS)
}

export function stopMetricsStore(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
  signalsByProvider.clear()
  metricsCache.clear()
  console.log('[MetricsStore] 已停止并清空')
}

// ─── 核心 API ────────────────────────────────────────────────

/**
 * 记录一个路由信号
 * 纯插入，不阻塞，不抛错
 */
export function emit(signal: RoutingSignal): void {
  const key = signal.provider
  let list = signalsByProvider.get(key)
  if (!list) {
    list = []
    signalsByProvider.set(key, list)
  }

  list.push(signal)

  // 内存安全保护
  if (list.length > MAX_SIGNALS_PER_PROVIDER) {
    const excess = list.length - MAX_SIGNALS_PER_PROVIDER
    list.splice(0, excess)
  }
}

/**
 * 获取指定 provider 的当前窗口统计
 * 惰性计算：首次或窗口变更时计算
 */
export function getMetrics(provider: string): ProviderMetricsWindow | null {
  const cached = metricsCache.get(provider)
  if (cached) return cached

  return recomputeForProvider(provider)
}

/**
 * 获取所有 provider 的当前窗口统计
 */
export function getAllMetrics(): ProviderMetricsWindow[] {
  recomputeAll()
  return Array.from(metricsCache.values())
}

/**
 * 获取指定 provider 的原始信号列表（用于调试）
 */
export function getRawSignals(provider: string, limit = 100): RoutingSignal[] {
  const list = signalsByProvider.get(provider)
  if (!list) return []
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  return list.filter(s => s.timestamp >= windowStart).slice(-limit)
}

// ─── 内部计算 ────────────────────────────────────────────────

function recomputeAll(): void {
  for (const provider of signalsByProvider.keys()) {
    recomputeForProvider(provider)
  }
}

function recomputeForProvider(provider: string): ProviderMetricsWindow | null {
  const list = signalsByProvider.get(provider)
  if (!list || list.length === 0) return null

  const now = Date.now()
  const windowStart = now - WINDOW_MS
  const windowSignals = list.filter(s => s.timestamp >= windowStart)

  if (windowSignals.length === 0) {
    metricsCache.delete(provider)
    return null
  }

  const latencies = windowSignals.map(s => s.latencyMs).sort((a, b) => a - b)
  const costs = windowSignals.map(s => s.costUsd)
  const successCount = windowSignals.filter(s => s.success).length
  const failCount = windowSignals.length - successCount

  // 去重能力类型
  const capabilities = Array.from(new Set(windowSignals.map(s => s.capability)))

  const window: ProviderMetricsWindow = {
    provider,
    capabilities,
    totalRequests: windowSignals.length,
    successCount,
    failCount,
    errorRate: failCount / windowSignals.length,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgCostUsd: Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 10000) / 10000,
    totalCostUsd: Math.round(costs.reduce((a, b) => a + b, 0) * 10000) / 10000,
    windowStartMs: windowStart,
    windowEndMs: now,
  }

  metricsCache.set(provider, window)
  return window
}

function cleanupExpired(): void {
  const now = Date.now()
  const cutoff = now - WINDOW_MS

  for (const [provider, list] of signalsByProvider.entries()) {
    // 二分查找第一个未过期的
    let firstValid = list.findIndex(s => s.timestamp >= cutoff)
    if (firstValid > 0) {
      signalsByProvider.set(provider, list.slice(firstValid))
    } else if (firstValid === -1) {
      signalsByProvider.delete(provider)
      metricsCache.delete(provider)
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

/**
 * 计算 provider 健康分数（Phase 2.2 — Provider Health Layer）
 *
 * 公式：healthScore = successRate × 100 - errorRate × 50 - fallbackRate × 25
 * 范围：-100 ~ 100
 * 约束：仅供观测，不参与路由决策
 */
export function getProviderHealth(provider: string): {
  healthScore: number
  successRate: number
  errorRate: number
  fallbackRate: number
  sampleSize: number
} | null {
  const metrics = getMetrics(provider)
  if (!metrics || metrics.totalRequests === 0) return null

  const successRate = metrics.successCount / metrics.totalRequests
  const errorRate = metrics.failCount / metrics.totalRequests
  const fallbackRate = 0 // Phase 2.2 暂不追踪 fallback 路径，留待未来

  const healthScore = Math.round(
    (successRate * 100) -
    (errorRate * 50) -
    (fallbackRate * 25)
  )

  return {
    healthScore: Math.max(-100, Math.min(100, healthScore)),
    successRate: Math.round(successRate * 10000) / 10000,
    errorRate: Math.round(errorRate * 10000) / 10000,
    fallbackRate: Math.round(fallbackRate * 10000) / 10000,
    sampleSize: metrics.totalRequests,
  }
}

export default { emit, getMetrics, getAllMetrics, getRawSignals, startMetricsStore, stopMetricsStore, getProviderHealth }
