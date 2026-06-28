// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Event-Driven Health System
// 健康状态由事件推导，不再使用 timer-based 模拟
// healthScore = f(eventLatency, replayConsistency, failureRate, snapshotIntegrity)
// ============================================================================

import { runtimeEventBus, type RuntimeEvent } from '../events/runtime-event-bus.js'

interface HealthMetrics {
  healthScore: number
  driftRate: number
  recoveryRate: number
  replayConsistency: number
  snapshotIntegrity: number
  eventLatency: number  // ms
  failureRate: number
  loadTier: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SATURATION'
  operatingZone: 'SAFE' | 'DEGRADED' | 'UNSTABLE'
}

export class EventDrivenHealth {
  private window: RuntimeEvent[] = []
  private windowSize = 100
  private lastHealth: HealthMetrics | null = null

  /** 从事件流计算健康指标 */
  computeHealth(events: RuntimeEvent[]): HealthMetrics {
    const window = this.getOrUpdateWindow(events)

    if (window.length === 0) {
      return {
        healthScore: 100,
        driftRate: 0,
        recoveryRate: 1,
        replayConsistency: 1,
        snapshotIntegrity: 1,
        eventLatency: 0,
        failureRate: 0,
        loadTier: 'LIGHT',
        operatingZone: 'SAFE'
      }
    }

    // ── 从事件推导各项指标 ──────────────────────────────────────────

    const events_ = window

    // 1. 失败率：dag.error / (dag.execute + dag.complete + dag.error)
    const executeCount = events_.filter(e => e.type === 'dag.execute').length || 1
    const errorCount = events_.filter(e => e.type === 'dag.error').length
    const failureRate = errorCount / executeCount

    // 2. 回放一致性：replay.compare 事件中 match=true 的比例
    const replayResults = events_.filter(e => e.type === 'replay.compare')
    const replaySuccess = replayResults.filter(e => (e.data as any).match === true).length
    const replayConsistency = replayResults.length > 0 ? replaySuccess / replayResults.length : 1

    // 3. 快照完整性：snapshot.verify 事件
    const verifyResults = events_.filter(e => e.type === 'snapshot.verify')
    const verifyPassed = verifyResults.filter(e => (e.data as any).valid === true).length
    const snapshotIntegrity = verifyResults.length > 0 ? verifyPassed / verifyResults.length : 1

    // 4. 事件延迟（DAG 执行到完成的时间差）
    const dagLatencies = events_
      .filter(e => e.type === 'dag.complete' || e.type === 'dag.error')
      .map(e => (e.data as any).durationMs as number || 0)
    const avgLatency = dagLatencies.length > 0
      ? dagLatencies.reduce((a, b) => a + b, 0) / dagLatencies.length
      : 0

    // 5. 漂移率：从 replay.drift 事件获取
    const driftEvents = events_.filter(e => e.type === 'replay.drift')
    const driftRate = driftEvents.length > 0
      ? driftEvents.map(e => (e.data as any).driftRate as number).reduce((a, b) => a + b, 0) / driftEvents.length
      : 0

    // 6. 恢复率：repair.complete / (repair.trigger + 1)
    const repairTriggered = events_.filter(e => e.type === 'repair.trigger').length
    const repairComplete = events_.filter(e => e.type === 'repair.complete').length
    const recoveryRate = repairTriggered > 0 ? repairComplete / repairTriggered : 1

    // ── 综合健康度 ──────────────────────────────────────────────────

    // 权重配置
    const weights = {
      failureRate: 0.30,
      replayConsistency: 0.25,
      snapshotIntegrity: 0.20,
      eventLatency: 0.15,
      driftRate: 0.10
    }

    // 归一化各指标到 [0, 1]
    const normFailure = 1 - Math.min(failureRate, 1)
    const normLatency = Math.max(0, 1 - avgLatency / 5000)
    const normDrift = Math.max(0, 1 - driftRate * 100)

    // 加权综合
    let healthScore = (
      normFailure * weights.failureRate +
      replayConsistency * weights.replayConsistency +
      snapshotIntegrity * weights.snapshotIntegrity +
      normLatency * weights.eventLatency +
      normDrift * weights.driftRate
    ) * 100

    healthScore = Math.round(healthScore * 10) / 10
    const clampedScore = Math.max(0, Math.min(100, healthScore))

    // ── 推导负载等级 ────────────────────────────────────────────────

    const loadTier = this.deriveLoadTier(clampedScore, failureRate)
    const operatingZone = this.deriveOperatingZone(clampedScore, recoveryRate)

    const metrics: HealthMetrics = {
      healthScore: clampedScore,
      driftRate: Math.round(driftRate * 10000) / 10000,
      recoveryRate: Math.round(recoveryRate * 1000) / 1000,
      replayConsistency: Math.round(replayConsistency * 1000) / 1000,
      snapshotIntegrity: Math.round(snapshotIntegrity * 1000) / 1000,
      eventLatency: Math.round(avgLatency),
      failureRate: Math.round(failureRate * 10000) / 10000,
      loadTier,
      operatingZone
    }

    this.lastHealth = metrics
    return metrics
  }

  /** 主动触发健康计算并发出事件 */
  tick(events: RuntimeEvent[]): HealthMetrics {
    const metrics = this.computeHealth(events)

    runtimeEventBus.emit('health.update', {
      ...metrics,
      timestamp: new Date().toISOString()
    })

    return metrics
  }

  /** 获取最近一次健康结果 */
  getLastHealth(): HealthMetrics | null {
    return this.lastHealth
  }

  // ── private ──────────────────────────────────────────────────────────

  private getOrUpdateWindow(events: RuntimeEvent[]): RuntimeEvent[] {
    if (events.length > 0) {
      // 追加到窗口
      this.window.push(...events)
      // 截断到窗口大小
      if (this.window.length > this.windowSize) {
        this.window = this.window.slice(-this.windowSize)
      }
    }
    return this.window
  }

  private deriveLoadTier(healthScore: number, failureRate: number): HealthMetrics['loadTier'] {
    if (healthScore >= 70 && failureRate < 0.1) return 'LIGHT'
    if (healthScore >= 40 && failureRate < 0.3) return 'MODERATE'
    if (healthScore >= 10 && failureRate < 0.6) return 'HEAVY'
    return 'SATURATION'
  }

  private deriveOperatingZone(healthScore: number, recoveryRate: number): HealthMetrics['operatingZone'] {
    if (healthScore >= 70 && recoveryRate >= 0.9) return 'SAFE'
    if (healthScore >= 30 && recoveryRate >= 0.5) return 'DEGRADED'
    return 'UNSTABLE'
  }

  reset(): void {
    this.window = []
    this.lastHealth = null
  }
}

export const eventDrivenHealth = new EventDrivenHealth()
