/**
 * optimization/optimizer-loop.ts — 全局优化循环
 *
 * 每 60 秒执行一次，持续优化系统。
 *
 * 流程：
 * 1. 收集 Metrics
 * 2. 评估系统健康
 * 3. 更新 Provider 评分
 * 4. 调整路由权重
 * 5. 更新队列优先级
 * 6. 调整背压阈值
 * 7. 自愈检查
 * 8. 写入优化日志
 */

import { getMetricsSnapshot } from '../observability/metrics.js'
import { getSystemHealth } from '../core/backpressure.js'
import { getAllCircuitBreakerStatus } from '../core/circuit-breaker.js'
import { updateProviderScore } from '../observability/provider-score.js'
import { selfHeal } from './self-healing.js'
import { recordFeedback } from './router-learning.js'
import { predictLoad } from './load-predictor.js'
import { evaluateAutonomyMode } from '../governance/governance-controller.js'
import { takeSnapshot, detectInstability, rollbackToLastStable } from '../governance/rollback-manager.js'
import { getSystemHealthScore } from '../governance/system-health.js'

interface OptimizationReport {
  timestamp: string
  systemHealth: {
    mode: string
    score: number
    providerCount: number
    degradedCount: number
    openCount: number
  }
  topProviders: { provider: string; score: number }[]
  actions: string[]
  loadPrediction?: {
    predictedQueueLoad: number
    risk: string
  }
  healingActions: number
}

let lastReport: OptimizationReport | null = null
let loopInterval: ReturnType<typeof setInterval> | null = null
let loopRunning = false

// 上次评分快照（用于检测是否需要写入告警）
let lastScores: Record<string, number> = {}

/**
 * 启动优化循环
 */
export function startOptimizerLoop(intervalMs: number = 60_000) {
  if (loopRunning) return
  loopRunning = true

  console.log('[Optimizer] 🧠 Starting optimization loop (every ' + (intervalMs / 1000) + 's)')
  runOptimizationCycle()  // 立即执行一次
  loopInterval = setInterval(runOptimizationCycle, intervalMs)
}

/**
 * 停止优化循环
 */
export function stopOptimizerLoop() {
  if (loopInterval) {
    clearInterval(loopInterval)
    loopInterval = null
  }
  loopRunning = false
  console.log('[Optimizer] ⏹ Stopped')
}

/**
 * 执行一次优化周期
 */
async function runOptimizationCycle() {
  const startTime = Date.now()
  const actions: string[] = []

  try {
    // Step 1: 收集指标
    const metrics = getMetricsSnapshot()
    const health = getSystemHealth()
    const providers = getAllCircuitBreakerStatus()

    // Step 2: 更新 Provider 评分
    const providerEntries = Object.entries(providers)
    let providerUpdates = 0
    for (const [name, status] of providerEntries) {
      const latency = status.avgLatency || 1000
      const successRate = status.totalRequests > 0 ? 1 - status.failureRate : 1
      const cost = name === 'openai' ? 0.04 : name === 'siliconflow' ? 0.01 : name === 'deepseek' ? 0.001 : 0.008

      // 更新 Provider Score 系统
      updateProviderScore(name, latency, successRate, cost, status.state)

      // 更新 Router Learning
      if (status.totalRequests > 0) {
        recordFeedback({
          provider: name,
          success: status.failureRate < 0.3,
          latency,
          cost,
          circuitOpened: status.state === 'OPEN',
        })
        providerUpdates++
      }
    }
    if (providerUpdates > 0) {
      actions.push(`Updated ${providerUpdates} provider scores`)
    }

    // Step 2.5: Governance — 评估自治模式 + 快照 + 回滚检查
    evaluateAutonomyMode()
    takeSnapshot()
    const instability = detectInstability()
    if (instability.unstable) {
      console.warn(`[Optimizer] ⚠️ Instability detected: ${instability.reason}`)
      actions.push(`⚠️ Instability: ${instability.reason}`)
      const rollbackResult = rollbackToLastStable()
      if (rollbackResult.rolledBack) {
        actions.push(`🔄 Rolled back to snapshot ${rollbackResult.snapshot?.id}`)
      }
    }

    // Step 3: 负载预测
    try {
      const prediction = await predictLoad()
      if (prediction.riskOfSpike !== 'none') {
        actions.push(`Load prediction: ${prediction.riskOfSpike} risk, predicted ${prediction.predictedQueueLoad} queue`)
      }
    } catch {}

    // Step 4: 自愈
    try {
      const healingActions = await selfHeal()
      if (healingActions.length > 0) {
        for (const a of healingActions) {
          actions.push(`Self-heal: ${a.action} on ${a.target} — ${a.reason.substring(0, 40)}`)
        }
      }
    } catch {}

    // Step 5: 评分变化检测（趋势告警）
    const currentScores: Record<string, number> = {}
    for (const [name, status] of providerEntries) {
      currentScores[name] = status.failureRate
    }
    for (const [name, failureRate] of Object.entries(currentScores)) {
      const last = lastScores[name] || 0
      if (failureRate > last + 0.2 && failureRate > 0.3) {
        actions.push(`⚠️ Provider ${name} failure rate spike: ${(last * 100).toFixed(0)}% → ${(failureRate * 100).toFixed(0)}%`)
      }
    }
    lastScores = currentScores

    // Safety Guard: 检测优化导致的性能退化
    if (lastReport && lastReport.systemHealth) {
      const lastScore = lastReport.systemHealth.score
      const currentScore = getOverallScore(metrics, health)
      const lastErrorRate = lastReport.systemHealth.openCount / Math.max(lastReport.systemHealth.providerCount, 1)
      const openProvCount = providerEntries.filter(([_, s]) => s.state === 'OPEN').length
      const errorRateChange = openProvCount / Math.max(providerEntries.length, 1) - lastErrorRate
      const scoreDrop = lastScore - currentScore

      if (scoreDrop > 20 || errorRateChange > 0.15) {
        actions.push(`🛑 SAFETY ROLLBACK: Score drop ${scoreDrop}pts (${lastScore}→${currentScore}), error rate +${(errorRateChange * 100).toFixed(0)}%`)
        console.warn(`[Optimizer] 🛑 Safety guard triggered — rolling back recent changes`)
        // 实际回滚：重置所有熔断器
        if (openProvCount > 2) {
          for (const [name] of providerEntries) {
            const { resetCircuitBreaker } = await import('../core/circuit-breaker.js')
            resetCircuitBreaker(name)
          }
        }
      }
    }

    // 生成报告
    const healthyCount = providerEntries.filter(([_, s]) => s.state === 'HEALTHY').length
    const openCount = providerEntries.filter(([_, s]) => s.state === 'OPEN').length
    const degradedCount = providerEntries.filter(([_, s]) => s.state === 'DEGRADED').length

    lastReport = {
      timestamp: new Date().toISOString(),
      systemHealth: {
        mode: health.mode,
        score: getOverallScore(metrics, health),
        providerCount: providerEntries.length,
        degradedCount,
        openCount,
      },
      topProviders: providerEntries
        .filter(([_, s]) => s.state === 'HEALTHY')
        .slice(0, 3)
        .map(([name, s]) => ({
          provider: name,
          score: Math.round((1 - s.failureRate) * 100) / 100,
        })),
      actions,
      healingActions: actions.filter(a => a.startsWith('Self-heal')).length,
    }

    if (actions.length > 0) {
      console.log(`[Optimizer] ✅ Cycle done (${Date.now() - startTime}ms) — ${actions.length} actions`)
      console.log(`         Actions: ${actions.join(' | ')}`)
    }
  } catch (err: any) {
    console.error(`[Optimizer] ❌ Cycle error: ${err.message}`)
  }
}

/**
 * 获取整体评分
 */
function getOverallScore(metrics: any, health: any): number {
  let score = 100
  if (metrics.system.errorRate > 0.1) score -= 20
  else if (metrics.system.errorRate > 0.05) score -= 10
  if (metrics.system.p95Latency > 20000) score -= 20
  else if (metrics.system.p95Latency > 10000) score -= 10
  if (health.queueCapacityRatio > 0.8) score -= 20
  else if (health.queueCapacityRatio > 0.5) score -= 10
  return Math.max(0, score)
}

/**
 * 获取最新优化报告
 */
export function getOptimizationReport(): OptimizationReport | null {
  return lastReport
}
