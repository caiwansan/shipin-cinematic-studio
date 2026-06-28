import type { ApiResponse } from '../contracts/api/base.js';
/**
 * PSC-1 Bridge Routes — Phase 1 安全收敛控制 API
 *
 * GET  /api/v2/bridge/psc1/status       — PSC-1 全局状态
 * POST /api/v2/bridge/psc1/traffic      — 设置 A/B 流量比例
 * POST /api/v2/bridge/psc1/freeze       — 冻结 bridge
 * POST /api/v2/bridge/psc1/unfreeze     — 解冻 bridge
 * POST /api/v2/bridge/psc1/config       — 更新配置
 */

import { FastifyInstance } from 'fastify'
import { abRouter } from '../core/bridge/phase1/ab-router.js'
import { latencyGate } from '../core/bridge/phase1/latency-gate.js'
import { rollbackEngine } from '../core/bridge/phase1/rollback-engine.js'
import { convergenceController } from '../core/bridge/phase1/convergence-controller.js'
import { shadowValidationHarness } from '../core/bridge/phase1/validation-harness.js'
import { shadowExecutor } from '../core/bridge/phase1/shadow-executor.js'

export default async function psc1Routes(app: FastifyInstance) {
  // 状态
  app.get('/api/v2/bridge/psc1/status', async () => {
    return { success: true, data: convergenceController.getStatus() } satisfies ApiResponse<unknown>;

  })

  // 设置流量
  app.post<{ Body: { percent: number } }>('/api/v2/bridge/psc1/traffic', async (req) => {
    const { percent } = req.body
    if (percent < 0 || percent > 100) {
      return { success: false, error: 'percent 必须 0-100' } satisfies ApiResponse<unknown>;

    }
    abRouter.setTraffic(percent)
    return { success: true, data: { bridgeTrafficPercent: percent } } satisfies ApiResponse<unknown>;

  })

  // 冻结
  app.post<{ Body: { reason?: string } }>('/api/v2/bridge/psc1/freeze', async (req) => {
    rollbackEngine.freeze(req.body.reason || '手动操作')
    return { success: true, data: { frozen: true } } satisfies ApiResponse<unknown>;

  })

  // 解冻
  app.post('/api/v2/bridge/psc1/unfreeze', async () => {
    rollbackEngine.unfreeze()
    return { success: true, data: { frozen: false } } satisfies ApiResponse<unknown>;

  })

  // 配置
  app.post<{ Body: { abRouter?: any; latencyGate?: any; rollbackEngine?: any } }>('/api/v2/bridge/psc1/config', async (req) => {
    if (req.body.abRouter) abRouter.setConfig(req.body.abRouter)
    if (req.body.latencyGate) latencyGate.setConfig(req.body.latencyGate)
    if (req.body.rollbackEngine) rollbackEngine.setConfig(req.body.rollbackEngine)
    return { success: true, data: convergenceController.getStatus() } satisfies ApiResponse<unknown>;

  })

  // 运行 Shadow Validation
  app.post('/api/v2/bridge/psc1/validate', async () => {
    const report = await shadowValidationHarness.runAll()
    return { success: true, data: report } satisfies ApiResponse<unknown>;

  })

  // 渐进 ramping（10% → 15% → 20%，需满足三条件锁）
  app.post('/api/v2/bridge/psc1/ramp', async (_req, reply) => {
    const current = abRouter.getConfig().bridgeTrafficPercent
    const target = current < 15 ? 15 : current < 20 ? 20 : 20

    if (target <= current) {
      return reply.status(400).send({
        success: false,
        error: `已处于 ${current}%，无更高阶段可升级`,
      })
    }

    // 三条件锁检查（从 shadowExecutor 取 stats）
    const shadowStats = shadowExecutor.getStats()
    const recentDiffs = shadowStats.recentDiffScores || []
    const diffVariance = recentDiffs.length > 0
      ? (() => {
          const mean = recentDiffs.reduce((a: number, b: number) => a + b, 0) / recentDiffs.length
          return recentDiffs.reduce((v: number, d: number) => v + (d - mean) ** 2, 0) / recentDiffs.length
        })()
      : 0

    const avgDiff = recentDiffs.length > 0
      ? recentDiffs.reduce((a: number, b: number) => a + b, 0) / recentDiffs.length
      : 0

    const avgLegacyLat = latencyGate.getAverageLatency('legacy')
    const avgBridgeLat = latencyGate.getAverageLatency('bridge')
    const latencyDelta = avgBridgeLat - avgLegacyLat

    const totalComparisons = shadowStats.totalComparisons || 0
    const fallbackRate = totalComparisons > 0
      ? (shadowStats.fallbackCount || 0) / totalComparisons
      : 0

    // Lock 1: Diff Score 稳定窗口
    const lock1 = recentDiffs.length >= 8 && diffVariance < 0.05 && Math.max(...recentDiffs) <= 0.1

    // Lock 2: Latency Delta 稳定
    const lock2 = totalComparisons > 0 && latencyDelta < 80

    // Lock 3: Fallback rate
    const lock3 = totalComparisons > 0 && fallbackRate < 0.01

    if (!lock1 || !lock2 || !lock3) {
      const failedLocks: string[] = []
      if (!lock1) failedLocks.push(`diff 稳定窗口 (样本=${recentDiffs.length}, 方差=${diffVariance.toFixed(4)}, 峰值=${Math.max(...recentDiffs).toFixed(3)})`)
      if (!lock2) failedLocks.push(`latency delta (${latencyDelta.toFixed(0)}ms, 需 <80ms)`)
      if (!lock3) failedLocks.push(`fallback 率 (${(fallbackRate * 100).toFixed(1)}%, 需 <1%)`)

      return reply.status(412).send({
        success: false,
        error: `三条件锁未满足，无法升级至 ${target}%`,
        failedLocks,
        metrics: { avgDiff, diffVariance, latencyDelta, fallbackRate },
      })
    }

    // 通过，执行 ramping
    const newPercent = current + 5
    abRouter.setTraffic(newPercent)

    return {
      success: true,
      data: {
        previousPercent: current,
        newPercent,
        targetLevel: target,
        locks: { lock1: true, lock2: true, lock3: true },
        metrics: { avgDiff, diffVariance, latencyDelta, fallbackRate },
      },
    }
  })

  // Stability 状态
  app.get('/api/v2/bridge/psc1/stability', async () => {
    const shadowStats = shadowExecutor.getStats()
    const recentDiffs = shadowStats.recentDiffScores || []
    const avgDiff = recentDiffs.length > 0
      ? recentDiffs.reduce((a: number, b: number) => a + b, 0) / recentDiffs.length
      : 0

    const avgLegacyLat = latencyGate.getAverageLatency('legacy')
    const avgBridgeLat = latencyGate.getAverageLatency('bridge')
    const latencyDelta = avgBridgeLat - avgLegacyLat

    const totalComparisons = shadowStats.totalComparisons || 0
    const fallbackRate = totalComparisons > 0
      ? (shadowStats.fallbackCount || 0) / totalComparisons
      : 0

    const currentPercent = abRouter.getConfig().bridgeTrafficPercent

    return {
      success: true,
      data: {
        phase: currentPercent <= 10 ? '1C-validation' : '1D-stabilization',
        shadowTrafficPercent: currentPercent,
        locks: {
          diffStability: {
            status: recentDiffs.length >= 8 ? 'ok' : 'insufficient_data',
            samples: recentDiffs.length,
            variance: recentDiffs.length > 0
              ? (() => {
                  const mean = recentDiffs.reduce((a: number, b: number) => a + b, 0) / recentDiffs.length
                  return recentDiffs.reduce((v: number, d: number) => v + (d - mean) ** 2, 0) / recentDiffs.length
                })()
              : 0,
            maxDiff: recentDiffs.length > 0 ? Math.max(...recentDiffs) : 0,
            threshold: { variance: 0.05, max: 0.1 },
          },
          latencyDelta: {
            status: totalComparisons > 0 && latencyDelta < 80 ? 'ok' : 'insufficient_data',
            deltaMs: latencyDelta,
            threshold: 80,
          },
          fallbackRate: {
            status: totalComparisons > 0 && fallbackRate < 0.01 ? 'ok' : 'insufficient_data',
            rate: fallbackRate,
            threshold: 0.01,
          },
        },
        ramp: {
          current: currentPercent,
          canRampTo15: currentPercent < 15 && recentDiffs.length >= 8 && (() => {
            const mean = recentDiffs.reduce((a: number, b: number) => a + b, 0) / recentDiffs.length
            const variance = recentDiffs.reduce((v: number, d: number) => v + (d - mean) ** 2, 0) / recentDiffs.length
            return variance < 0.05 && Math.max(...recentDiffs) <= 0.1
          })(),
          canRampTo20: currentPercent >= 15 && currentPercent < 20 && totalComparisons > 0 && latencyDelta < 80 && fallbackRate < 0.01,
          nextTarget: currentPercent < 15 ? 15 : currentPercent < 20 ? 20 : null,
        },
      },
    }
  })
}
