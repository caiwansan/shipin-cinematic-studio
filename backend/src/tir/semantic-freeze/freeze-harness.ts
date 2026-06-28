/**
 * TIR Semantic Freeze — Freeze Harness
 * 语义冻结主入口 — 运行所有冻结检查
 *
 * 用途：
 *   - 部署前验证（确保 TIR 语义未漂移）
 *   - CI 回归测试
 *   - 每次代码变更后的安全网
 */

import { checkEquivalence, assertEquivalence } from './roundtrip-checker.js'
import { checkAllInvariants, assertInvariants } from './ir-invariant-validator.js'
import { runGoldenSuite, GOLDEN_SAMPLES } from './golden-suite.js'
import { TIRParser } from '../tir-parser.js'
import { serializeTIR } from '../tir-serializer.js'

export interface FreezeReport {
  date: string
  goldenSuite: {
    total: number
    passed: number
    failed: number
  }
  invariantsPassed: boolean
  roundtripPassed: number
  roundtripFailed: number
  overall: '🟢 FROZEN' | '🔴 THAWED'
  violations: string[]
}

/**
 * 运行全量语义冻结检查
 */
export function runFreezeCheck(): FreezeReport {
  const violations: string[] = []

  // 1. Golden Suite
  const suite = runGoldenSuite()

  // 2. Invariants — 取第一个 golden sample 检查 IR 结构
  let invariantsPassed = true
  if (GOLDEN_SAMPLES.length > 0) {
    try {
      const parser = new TIRParser()
      const { graph } = parser.parse(GOLDEN_SAMPLES[0].source)
      assertInvariants(graph)
    } catch (e) {
      invariantsPassed = false
      violations.push(`[invariant] ${e}`)
    }
  }

  // 3. Roundtrip — 对所有 golden samples 做等价检查
  let roundtripPassed = 0
  let roundtripFailed = 0

  for (const sample of GOLDEN_SAMPLES) {
    try {
      assertEquivalence(sample.source)
      roundtripPassed++
    } catch (e) {
      roundtripFailed++
      violations.push(`[roundtrip] ${sample.name}: ${e}`)
    }
  }

  const overall = (suite.failed === 0 && invariantsPassed && roundtripFailed === 0)
    ? '🟢 FROZEN' as const
    : '🔴 THAWED' as const

  return {
    date: new Date().toISOString(),
    goldenSuite: {
      total: suite.total,
      passed: suite.passed,
      failed: suite.failed,
    },
    invariantsPassed,
    roundtripPassed,
    roundtripFailed,
    overall,
    violations,
  }
}

/**
 * API 响应格式的冻结检查
 */
export function handleFreezeStatus(): {
  frozen: boolean
  report: FreezeReport
} {
  const report = runFreezeCheck()
  return {
    frozen: report.overall === '🟢 FROZEN',
    report,
  }
}
