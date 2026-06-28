/**
 * PSC-1 Shadow Validation Harness — 影子执行验证系统
 *
 * 用模拟 provider 调用测试 PSC-1 控制面的完整性，不依赖真实 API Key。
 *
 * 验证目标：
 *   1. A/B Router 正确决策（10% bridge shadow）
 *   2. Shadow execution 正确触发
 *   3. Latency gate 正确测量和判断
 *   4. Diff score 正确计算
 *   5. Rollback engine 正确响应
 *   6. EPVH trace 正确记录
 */

import { convergenceController } from './convergence-controller.js'
import { abRouter } from './ab-router.js'
import { latencyGate } from './latency-gate.js'
import { shadowExecutor } from './shadow-executor.js'
import { rollbackEngine } from './rollback-engine.js'
import { runtimeCallTracer } from '../../verification/execution-plane/runtime-call-tracer.js'
import { Capability } from '../../runtime/capabilities.js'

export interface ValidationResult {
  testName: string
  passed: boolean
  detail: string
  metrics?: Record<string, any>
}

export interface ValidationReport {
  timestamp: number
  totalTests: number
  passed: number
  failed: number
  results: ValidationResult[]
  summary: string
  readyForPhase1D: boolean
}

class ShadowValidationHarness {
  /**
   * 运行完整验证套件
   */
  async runAll(): Promise<ValidationReport> {
    const results: ValidationResult[] = []

    // Test 1: A/B Router 基础决策
    results.push(await this.testAbRouterDecision())

    // Test 2: A/B Router 流量控制
    results.push(await this.testAbRouterTraffic())

    // Test 3: Latency Gate 基础
    results.push(await this.testLatencyGate())

    // Test 4: Shadow Diff Score
    results.push(await this.testShadowDiff())

    // Test 5: Convergence Controller 双通道
    results.push(await this.testConvergenceDualWrite())

    // Test 6: EPVH Trace 记录
    results.push(await this.testEpvhTrace())

    // Test 7: Rollback Engine 触发
    results.push(await this.testRollbackTrigger())

    // Test 8: Rollback Freeze
    results.push(await this.testRollbackFreeze())

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    // 判定是否 ready for Phase 1D
    const readyForPhase1D = failed === 0

    return {
      timestamp: Date.now(),
      totalTests: results.length,
      passed,
      failed,
      results,
      summary: readyForPhase1D
        ? `✅ 所有 ${results.length} 项验证通过，PSC-1 控制面完整，可进入 Phase 1D`
        : `❌ ${failed}/${results.length} 项失败，需修复后重试`,
      readyForPhase1D,
    }
  }

  /**
   * Test 1: A/B Router 决策正确性
   */
  private async testAbRouterDecision(): Promise<ValidationResult> {
    const initialPercent = abRouter.getConfig().bridgeTrafficPercent
    const testCount = 1000
    let bridgeCount = 0

    for (let i = 0; i < testCount; i++) {
      if (abRouter.decide()) bridgeCount++
    }

    const actualPercent = (bridgeCount / testCount) * 100
    const tolerance = 3 // ±3%
    const inRange = Math.abs(actualPercent - initialPercent) < tolerance

    return {
      testName: 'A/B Router 决策精度',
      passed: inRange,
      detail: `配置 ${initialPercent}%, 实测 ${actualPercent.toFixed(1)}% (${bridgeCount}/${testCount})`,
      metrics: { configured: initialPercent, actual: actualPercent, bridgeCount, total: testCount },
    }
  }

  /**
   * Test 2: A/B Router 流量控制
   */
  private async testAbRouterTraffic(): Promise<ValidationResult> {
    // 设置 0%，验证全部 legacy
    const origPercent = abRouter.getConfig().bridgeTrafficPercent
    abRouter.setTraffic(0)

    let bridgeCount = 0
    for (let i = 0; i < 100; i++) {
      if (abRouter.decide()) bridgeCount++
    }

    abRouter.setTraffic(origPercent)

    return {
      testName: 'A/B Router 0% 流量',
      passed: bridgeCount === 0,
      detail: `0% 配置时 bridge 触发次数: ${bridgeCount}/100`,
      metrics: { bridgeCount, total: 100 },
    }
  }

  /**
   * Test 3: Latency Gate
   */
  private async testLatencyGate(): Promise<ValidationResult> {
    // 记录足够多 legacy 延迟样本（trust period = 5）
    for (let i = 0; i < 5; i++) {
      latencyGate.record('legacy', 100 + Math.random() * 20)
    }

    // bridge 延迟 120ms（应在 1.3x=130ms 以内 → pass）
    const passResult = latencyGate.validate(120)
    // bridge 延迟 200ms（超过 130ms → fail）
    const failResult = latencyGate.validate(200)

    const gateWorking = passResult.pass && !failResult.pass

    return {
      testName: 'Latency Gate 阈值检查',
      passed: gateWorking,
      detail: `120ms(OK=${passResult.pass}), 200ms(blocked=${!failResult.pass})`,
      metrics: {
        legacyAvg: latencyGate.getAverageLatency('legacy'),
        pass120: passResult.pass,
        block200: !failResult.pass,
        passReason: passResult.reason,
        failReason: failResult.reason,
      },
    }
  }

  /**
   * Test 4: Shadow Diff Score
   */
  private async testShadowDiff(): Promise<ValidationResult> {
    // 完全相同
    const exactMatch = shadowExecutor.calculateDiff('hello world', 'hello world')
    // 完全不同
    const noMatch = shadowExecutor.calculateDiff('aaaa', 'bbbb')
    // 部分不同
    const partialMatch = shadowExecutor.calculateDiff('hello world', 'hello there')

    const diffWorks = exactMatch === 0 && noMatch > 0.5

    return {
      testName: 'Diff Score 计算',
      passed: diffWorks,
      detail: `exact=${exactMatch}, partial=${partialMatch.toFixed(3)}, different=${noMatch.toFixed(3)}`,
      metrics: { exactMatch, partialMatch, noMatch },
    }
  }

  /**
   * Test 5: Convergence Controller 双通道
   */
  private async testConvergenceDualWrite(): Promise<ValidationResult> {
    const legacyResult = { audioUrl: 'https://example.com/legacy.mp3', duration: 3.5 }

    const result = await convergenceController.execute({
      capability: Capability.VOICE_GENERATION,
      userId: 'test-user',
      model: 'qwen3-tts',
      provider: 'aliyun',
      payload: { text: '你好', voice: 'test-voice', speed: 1.0 },
      legacyExecutor: async () => legacyResult,
    })

    const dualWriteWorking =
      result.success &&
      result.result === legacyResult &&          // legacy is source of truth
      result.bridged === false &&                // not bridged in phase 1
      result.shadow !== undefined                // shadow data is present

    return {
      testName: 'Convergence Controller Dual-write',
      passed: dualWriteWorking,
      detail: `success=${result.success}, legacy_match=${result.result === legacyResult}, shadow_executed=${result.shadow.executed}`,
      metrics: {
        success: result.success,
        legacyMatch: result.result === legacyResult,
        shadowExecuted: result.shadow.executed,
        diffScore: result.shadow.diffScore,
        legacyLatency: result.shadow.legacyLatency,
        bridgeLatency: result.shadow.bridgeLatency,
      },
    }
  }

  /**
   * Test 6: EPVH Trace 记录
   */
  private async testEpvhTrace(): Promise<ValidationResult> {
    const tracesBefore = runtimeCallTracer.getTraces().length

    // 通过 convergenceController 执行一次
    await convergenceController.execute({
      capability: Capability.VOICE_GENERATION,
      userId: 'test-user',
      model: 'qwen3-tts',
      provider: 'aliyun',
      payload: { text: 'trace test', voice: 'test', speed: 1.0 },
      legacyExecutor: async () => ({ audioUrl: 'test.mp3', duration: 1.0 }),
    })

    const tracesAfter = runtimeCallTracer.getTraces().length
    const traceRecorded = tracesAfter > tracesBefore

    return {
      testName: 'EPVH Trace 记录',
      passed: traceRecorded,
      detail: `trace count: ${tracesBefore} → ${tracesAfter}`,
      metrics: { before: tracesBefore, after: tracesAfter },
    }
  }

  /**
   * Test 7: Rollback Engine 触发
   */
  private async testRollbackTrigger(): Promise<ValidationResult> {
    const eventsBefore = rollbackEngine.getEvents().length

    // 触发 rollback: 错误率 > 2%
    await rollbackEngine.evaluate({
      bridgeErrorRate: 0.05, // 5% > 2% threshold
      bridgeLatencyRatio: 1.0,
      bridgeDiffScore: 0.05,
    })

    const eventsAfter = rollbackEngine.getEvents().length
    const rollbackTriggered = eventsAfter > eventsBefore

    // 重置（unfreeze）
    rollbackEngine.unfreeze()

    return {
      testName: 'Rollback Engine 自动触发',
      passed: rollbackTriggered,
      detail: `events: ${eventsBefore} → ${eventsAfter}`,
      metrics: { before: eventsBefore, after: eventsAfter },
    }
  }

  /**
   * Test 8: Rollback Freeze 冻结
   */
  private async testRollbackFreeze(): Promise<ValidationResult> {
    rollbackEngine.freeze('验证测试')
    const frozen = rollbackEngine.isFrozen()
    rollbackEngine.unfreeze()
    const unfrozen = !rollbackEngine.isFrozen()

    return {
      testName: 'Rollback Freeze/Unfreeze',
      passed: frozen && unfrozen,
      detail: `frozen=${frozen}, unfrozen=${unfrozen}`,
      metrics: { frozen, unfrozen },
    }
  }
}

export const shadowValidationHarness = new ShadowValidationHarness()
