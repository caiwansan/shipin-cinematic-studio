/**
 * observability/metrics.ts — 实时指标系统
 *
 * 以 60s 滑动窗口收集系统级 + provider 级+ 队列级指标
 * 异步写入（不阻塞业务逻辑）
 */

interface WindowedMetric {
  count: number
  success: number
  error: number
  totalLatency: number
  p95Latencies: number[]   // 最近 N 个延迟，用于 P95 计算
  minLatency: number
  maxLatency: number
}

interface ProviderMetric extends WindowedMetric {
  costEstimate: number
}

interface MetricsSnapshot {
  system: {
    requestCount: number
    successRate: number
    errorRate: number
    avgLatency: number
    p95Latency: number
    activeTraces: number
  }
  queue: {
    avgWaitTime: number
    avgProcessingTime: number
  }
  providers: Record<string, {
    latency: number
    successRate: number
    errorRate: number
    costEstimate: number
  }>
}

// 每个 provider 的指标
const providerMetrics = new Map<string, ProviderMetric>()
// 系统全局指标
let sysMetric: WindowedMetric = initWindowedMetric()
// 队列等待 & 处理时间
let queueWaitTimes: number[] = []
let queueProcessingTimes: number[] = []
// 刷新间隔
const WINDOW_MS = 60_000
const MAX_P95_SAMPLES = 500
let lastFlush = Date.now()
let flushCallbacks: Array<(snapshot: MetricsSnapshot) => void> = []

function initWindowedMetric(): WindowedMetric {
  return {
    count: 0, success: 0, error: 0,
    totalLatency: 0, p95Latencies: [],
    minLatency: Infinity, maxLatency: 0,
  }
}

function initProviderMetric(): ProviderMetric {
  return { ...initWindowedMetric(), costEstimate: 0 }
}

/**
 * 记录一次请求
 */
export function recordRequest(
  success: boolean,
  latency: number,
  provider?: string,
  costEstimate?: number
) {
  cleanup()

  // 系统级
  sysMetric.count++
  if (success) { sysMetric.success++ } else { sysMetric.error++ }
  sysMetric.totalLatency += latency
  sysMetric.p95Latencies.push(latency)
  if (sysMetric.p95Latencies.length > MAX_P95_SAMPLES) sysMetric.p95Latencies.shift()
  if (latency < sysMetric.minLatency) sysMetric.minLatency = latency
  if (latency > sysMetric.maxLatency) sysMetric.maxLatency = latency

  // Provider 级
  if (provider) {
    if (!providerMetrics.has(provider)) {
      providerMetrics.set(provider, initProviderMetric())
    }
    const pm = providerMetrics.get(provider)!
    pm.count++
    if (success) { pm.success++ } else { pm.error++ }
    pm.totalLatency += latency
    pm.p95Latencies.push(latency)
    if (pm.p95Latencies.length > MAX_P95_SAMPLES) pm.p95Latencies.shift()
    if (latency < pm.minLatency) pm.minLatency = latency
    if (latency > pm.maxLatency) pm.maxLatency = latency
    if (costEstimate) pm.costEstimate += costEstimate
  }
}

/**
 * 记录队列等待时间
 */
export function recordQueueWait(waitMs: number) {
  queueWaitTimes.push(waitMs)
  if (queueWaitTimes.length > 500) queueWaitTimes.shift()
}

/**
 * 记录队列处理时间
 */
export function recordQueueProcessing(processMs: number) {
  queueProcessingTimes.push(processMs)
  if (queueProcessingTimes.length > 500) queueProcessingTimes.shift()
}

/**
 * 计算 P95
 */
function calcP95(sorted: number[], length: number): number {
  if (length === 0) return 0
  const idx = Math.min(Math.floor(length * 0.95), length - 1)
  return sorted[Math.max(0, idx)]
}

/**
 * 获取当前指标快照（线程安全）
 */
export function getMetricsSnapshot(): MetricsSnapshot {
  cleanup()

  const latencySorted = [...sysMetric.p95Latencies].sort((a, b) => a - b)
  const providerSnap: Record<string, any> = {}

  for (const [prov, pm] of providerMetrics) {
    const pSorted = [...pm.p95Latencies].sort((a, b) => a - b)
    providerSnap[prov] = {
      latency: pm.count > 0 ? Math.round(pm.totalLatency / pm.count) : 0,
      p95Latency: calcP95(pSorted, pm.p95Latencies.length),
      successRate: pm.count > 0 ? pm.success / pm.count : 1,
      errorRate: pm.count > 0 ? pm.error / pm.count : 0,
      costEstimate: Math.round(pm.costEstimate * 1000) / 1000,
      totalCalls: pm.count,
    }
  }

  return {
    system: {
      requestCount: sysMetric.count,
      successRate: sysMetric.count > 0 ? sysMetric.success / sysMetric.count : 1,
      errorRate: sysMetric.count > 0 ? sysMetric.error / sysMetric.count : 0,
      avgLatency: sysMetric.count > 0 ? Math.round(sysMetric.totalLatency / sysMetric.count) : 0,
      p95Latency: calcP95(latencySorted, sysMetric.p95Latencies.length),
      activeTraces: 0,
    },
    queue: {
      avgWaitTime: queueWaitTimes.length > 0
        ? Math.round(queueWaitTimes.reduce((a, b) => a + b, 0) / queueWaitTimes.length)
        : 0,
      avgProcessingTime: queueProcessingTimes.length > 0
        ? Math.round(queueProcessingTimes.reduce((a, b) => a + b, 0) / queueProcessingTimes.length)
        : 0,
    },
    providers: providerSnap,
  }
}

/**
 * 定期清理过期指标
 */
function cleanup() {
  const now = Date.now()
  if (now - lastFlush < WINDOW_MS) return
  lastFlush = now

  // 重置系统指标（滑动窗口）
  sysMetric = initWindowedMetric()
  providerMetrics.clear()
  queueWaitTimes = []
  queueProcessingTimes = []

  // 通知 flush 回调
  if (flushCallbacks.length > 0) {
    const snapshot = getMetricsSnapshot()
    for (const cb of flushCallbacks) {
      try { cb(snapshot) } catch {}
    }
  }
}

/**
 * 注册 flush 回调（用于写入 DB 等持久化）
 */
export function onMetricsFlush(cb: (snapshot: MetricsSnapshot) => void) {
  flushCallbacks.push(cb)
}
