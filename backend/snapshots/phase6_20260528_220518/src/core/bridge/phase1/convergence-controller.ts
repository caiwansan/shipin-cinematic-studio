/**
 * PSC-1 Convergence Controller — Phase 1 安全收敛控制器（Dual-write Mode）
 *
 * ═══ 宪法 ═══
 * Dual-write: 永远执行 legacy + bridge 两条路径。
 * Legacy 永远是用户的真实输出源（source of truth）。
 * Bridge 只用于观测、对比、建立 confidence。
 *
 * A/B Router 只控制 bridge 是否执行 shadow，不控制用户看到什么。
 * Latency Gate / Rollback / Diff 全部作用于观测层，不直接影响用户输出。
 *
 * ═══ 迁移阶段 ═══
 * Phase 1.0: Dual-write（当前）— legacy 输出，shadow bridge，100% 观测
 * Phase 1.5: A/B active — bridge 偶尔返回（当 latency/diff confidence 达标）
 * Phase 2.0: Cutover — bridge 成为主路径（经过人工确认后）
 */

import { Capability } from '../../runtime/capabilities.js'
import { executionCutover } from '../../control-plane/cutover/execution-cutover.js'
import { abRouter } from './ab-router.js'
import { latencyGate } from './latency-gate.js'
import { shadowExecutor } from './shadow-executor.js'
import { rollbackEngine } from './rollback-engine.js'
import { runtimeCallTracer } from '../../verification/execution-plane/runtime-call-tracer.js'

export interface ConvergenceInput {
  userId: string
  capability: Capability
  model: string
  provider: string
  payload: Record<string, any>
  /** legacy 路径的执行函数（source of truth） */
  legacyExecutor: () => Promise<any>
}

export interface ConvergenceResult {
  success: boolean
  /** 用户实际看到的输出（永远是 legacy） */
  result?: any
  /** 是否是经过 bridge 路径（Phase 1.0 始终为 false） */
  bridged: boolean
  /** shadow 观测数据 */
  shadow: {
    executed: boolean
    diffScore: number
    legacyLatency: number
    bridgeLatency: number
    bridgeSuccess: boolean
    latencyGatePassed: boolean
  }
  latency: number
  fallbackReason?: string
}

class ConvergenceController {
  /**
   * 执行一次 dual-write 收敛调用
   *
   * 流程（不可改变）：
   *   1. 始终执行 legacy（用户响应）
   *   2. 按 A/B 决策决定是否影子执行 bridge
   *   3. 如果执行 bridge: latency gate → diff score
   *   4. 触发 rollback check（观测层）
   *   5. 返回 legacy 结果 + shadow 观测数据
   */
  async execute(input: ConvergenceInput): Promise<ConvergenceResult> {
    const start = Date.now()
    const bridgeStart = Date.now()

    // Step 1: 始终先执行 legacy（source of truth）
    let legacyResult: any
    let legacySuccess = true
    const legacyT0 = Date.now()

    try {
      legacyResult = await input.legacyExecutor()
    } catch (err: any) {
      legacySuccess = false
      return {
        success: false,
        result: undefined,
        bridged: false,
        shadow: {
          executed: false,
          diffScore: 1.0,
          legacyLatency: Date.now() - legacyT0,
          bridgeLatency: 0,
          bridgeSuccess: false,
          latencyGatePassed: false,
        },
        latency: Date.now() - start,
        fallbackReason: `legacy failed: ${err.message}`,
      }
    }

    const legacyLatency = Date.now() - legacyT0

    // Step 2: A/B 决策（只决定是否执行 shadow bridge，不影响返回）
    abRouter.report('legacy', legacySuccess)
    const runBridge = !rollbackEngine.isFrozen() && abRouter.decide()

    const shadow: ConvergenceResult['shadow'] = {
      executed: runBridge,
      diffScore: 0,
      legacyLatency,
      bridgeLatency: 0,
      bridgeSuccess: false,
      latencyGatePassed: false,
    }

    if (runBridge) {
      const bridgeT0 = Date.now()

      try {
        const bridgeResult = await executionCutover.executeProviderTask({
          capability: input.capability,
          userId: input.userId,
          model: input.model,
          provider: input.provider,
          input: input.payload,
        })

        const bridgeLatency = Date.now() - bridgeT0
        shadow.bridgeLatency = bridgeLatency
        shadow.bridgeSuccess = bridgeResult.success

        // Latency Gate
        latencyGate.record('bridge', bridgeLatency)
        const gateCheck = latencyGate.validate(bridgeLatency)
        shadow.latencyGatePassed = gateCheck.pass

        if (bridgeResult.success && gateCheck.pass) {
          // Diff 对比（output fidelity check）
          shadow.diffScore = shadowExecutor.calculateDiff(legacyResult, bridgeResult.result)
          abRouter.report('bridge', shadow.diffScore < 0.1)
        } else {
          shadow.diffScore = 1.0
          abRouter.report('bridge', false)

          // 定期触发 rollback check（仅观测层）
          if (abRouter.getStats().bridgeCalls % 20 === 0) {
            rollbackEngine.evaluate({
              bridgeErrorRate: abRouter.getStats().bridgeErrorRate,
              bridgeLatencyRatio: latencyGate.getAverageLatency('bridge') / Math.max(1, legacyLatency),
              bridgeDiffScore: shadowExecutor.getAverageDiff(),
            })
          }
        }

        // Shadow Executor 记录
        shadowExecutor.recordManual({
          diffScore: shadow.diffScore,
          legacyLatency,
          bridgeLatency,
          legacySuccess: true,
          bridgeSuccess: bridgeResult.success,
        })
      } catch {
        shadow.bridgeSuccess = false
        shadow.diffScore = 1.0
        shadow.bridgeLatency = Date.now() - bridgeT0
        abRouter.report('bridge', false)
      }
    }

    // 记录 runtime trace
    runtimeCallTracer.record({
      userId: input.userId,
      capability: input.capability,
      path: `tts/voice → dual-write → legacy(${legacyLatency}ms) | shadow(${shadow.bridgeLatency}ms, diff=${shadow.diffScore.toFixed(3)})`,
      latency: Date.now() - start,
      finalProvider: input.provider,
      bypassed: false,
      source: 'psc-1-dual-write',
    })

    return {
      success: true,
      result: legacyResult,
      bridged: false,
      shadow,
      latency: Date.now() - start,
    }
  }

  /**
   * 获取控制器状态
   */
  getStatus() {
    const bStats = abRouter.getStats()
    return {
      mode: 'dual-write',
      abRouter: bStats,
      latencyGate: {
        avgLegacy: latencyGate.getAverageLatency('legacy'),
        avgBridge: latencyGate.getAverageLatency('bridge'),
        config: latencyGate.getConfig(),
      },
      shadowExecutor: shadowExecutor.getStats(),
      rollbackEngine: {
        config: rollbackEngine.getConfig(),
        isFrozen: rollbackEngine.isFrozen(),
        events: rollbackEngine.getEvents().slice(-5),
      },
    }
  }
}

export const convergenceController = new ConvergenceController()
