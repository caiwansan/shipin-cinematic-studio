/**
 * Phase 6C-3.2 — Lifecycle Manager
 *
 * 所有 timer / interval / event buffer 的生命周期控制。
 * 防止长时间运行的系统因 orphan timer、事件泄漏、未捕获异常而慢性死亡。
 *
 * 核心能力：
 *   ① Timer Registry  — 所有 setInterval/setTimeout 必须注册并 bind 到 lifecycle
 *   ② Event Buffer    — 有上限的环形队列，不会无限增长
 *   ③ Snapshot Guard  — 快照历史有上限，自动驱逐旧数据
 *   ④ Global Shield   — unhandledRejection / uncaughtException 拦截
 *   ⑤ Safe Mode       — 压力过大时自动降频
 */

// ============================================================
// ① Timer Registry
// ============================================================

class TimerRegistry {
  private timers: Set<NodeJS.Timeout> = new Set()
  private intervals: Set<NodeJS.Timeout> = new Set()

  setTimeout(fn: () => void, ms: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      fn()
    }, ms)
    this.timers.add(timer)
    return timer
  }

  setInterval(fn: () => void, ms: number): NodeJS.Timeout {
    const id = setInterval(() => {
      try { fn() } catch (err) {
        console.error('[Lifecycle] Interval handler error:', err)
      }
    }, ms)
    this.intervals.add(id)
    return id
  }

  clearTimeout(timer: NodeJS.Timeout): void {
    clearTimeout(timer)
    this.timers.delete(timer)
  }

  clearInterval(id: NodeJS.Timeout): void {
    clearInterval(id)
    this.intervals.delete(id)
  }

  clearAll(): void {
    for (const t of this.timers) clearTimeout(t)
    for (const i of this.intervals) clearInterval(i)
    this.timers.clear()
    this.intervals.clear()
  }

  get activeTimers(): number { return this.timers.size }
  get activeIntervals(): number { return this.intervals.size }
  get totalActive(): number { return this.timers.size + this.intervals.size }
}

export const timerRegistry = new TimerRegistry()

// ============================================================
// ② Bounded Event Buffer
// ============================================================

interface TimedEvent {
  id: number
  type: string
  data: any
  ts: Date
}

export class BoundedEventBuffer {
  private buffer: TimedEvent[] = []
  private nextId = 1
  private maxSize: number

  constructor(maxSize = 200) {
    this.maxSize = maxSize
  }

  push(type: string, data: any): void {
    this.buffer.push({ id: this.nextId++, type, data, ts: new Date() })
    if (this.buffer.length > this.maxSize) {
      // 移除最旧的 25%
      this.buffer.splice(0, Math.floor(this.maxSize * 0.25))
    }
  }

  getRecent(n = 50): TimedEvent[] {
    return this.buffer.slice(-n)
  }

  getByType(type: string): TimedEvent[] {
    return this.buffer.filter(e => e.type === type)
  }

  get length(): number { return this.buffer.length }

  clear(): void {
    this.buffer = []
  }
}

// ============================================================
// ③ Bounded Snapshot History
// ============================================================

export class BoundedSnapshotHistory<T> {
  private snapshots: T[] = []
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  add(snapshot: T): void {
    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSize) {
      this.snapshots.splice(0, Math.floor(this.maxSize * 0.3))
    }
  }

  getAll(): T[] {
    return [...this.snapshots]
  }

  getRecent(n: number): T[] {
    return this.snapshots.slice(-n)
  }

  get length(): number { return this.snapshots.length }

  clear(): void {
    this.snapshots = []
  }
}

// ============================================================
// ④ Global Error Shield
// ============================================================

let shieldInstalled = false

export function installErrorShield() {
  if (shieldInstalled) return
  shieldInstalled = true

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Lifecycle] ⚠️ unhandledRejection:', reason)
    // 只记录不退出
  })

  process.on('uncaughtException', (err) => {
    console.error('[Lifecycle] ⚠️ uncaughtException:', err.message)
    console.error(err.stack)
    // 允许进程继续运行，但标记 degraded 状态
    lifecycleState.degraded = true
  })

  // SIGTERM 优雅关闭
  process.on('SIGTERM', () => {
    console.log('[Lifecycle] SIGTERM received — cleaning up...')
    timerRegistry.clearAll()
    process.exit(0)
  })

  console.log('[Lifecycle] Error shield installed')
}

// ============================================================
// ⑤ Safe Mode / Lifecycle State
// ============================================================

export const lifecycleState = {
  safeMode: false,
  degraded: false,
  startedAt: new Date(),
  totalErrors: 0,
  lastErrorAt: null as Date | null,
}

export function enableSafeMode() {
  lifecycleState.safeMode = true
  console.log('[Lifecycle] Safe mode enabled — reducing event/snapshot frequency')
}

export function disableSafeMode() {
  lifecycleState.safeMode = false
  console.log('[Lifecycle] Safe mode disabled')
}

// ============================================================
// 全局事件总线（带容量上限）
// ============================================================

const globalEventBuffer = new BoundedEventBuffer(500)
const globalSnapshotHistory = new BoundedSnapshotHistory<any>(100)

export function pushGlobalEvent(type: string, data: any) {
  globalEventBuffer.push(type, data)
}

export function pushGlobalSnapshot(snapshot: any) {
  globalSnapshotHistory.add(snapshot)
}

export function getGlobalEvents(n = 50) {
  return globalEventBuffer.getRecent(n)
}

export function getGlobalSnapshots(n = 50) {
  return globalSnapshotHistory.getRecent(n)
}

// ============================================================
// 系统健康状态
// ============================================================

export function getLifecycleStatus() {
  return {
    timers: timerRegistry.activeTimers,
    intervals: timerRegistry.activeIntervals,
    totalActive: timerRegistry.totalActive,
    eventBuffer: globalEventBuffer.length,
    snapshotHistory: globalSnapshotHistory.length,
    safeMode: lifecycleState.safeMode,
    degraded: lifecycleState.degraded,
    uptimeMs: Date.now() - lifecycleState.startedAt.getTime(),
    totalErrors: lifecycleState.totalErrors,
    lastErrorAt: lifecycleState.lastErrorAt?.toISOString() ?? null,
  }
}

/**
 * 一次调用完成所有 Safety Net 初始化
 */
export function initializeRuntimeSafety() {
  installErrorShield()
  pushGlobalEvent('lifecycle.init', { timestamp: new Date().toISOString() })
  console.log('[Lifecycle] Runtime safety initialized')
}
