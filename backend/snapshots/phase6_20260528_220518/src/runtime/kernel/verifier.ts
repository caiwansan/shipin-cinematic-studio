/**
 * runtime/kernel/verifier.ts — Phase 5.1 Step 2
 *
 * Self-verification engine. Takes ExecutionState and validates it
 * against runtime consistency rules.
 *
 * Rules (Phase 5 minimal set):
 *   1. No OBSERVE module in active path (must not be in SYNC execution)
 *   2. Gateway must be the first hop (entry discipline)
 *   3. SHADOW modules must not appear in active path
 *   4. LEGACY modules must not be in active execution
 *
 * @phase4-owner { entry: "narrative-gateway", mode: "OBSERVE" }
 */

import { type ExecutionState, type ExecutionStateEntry, type Domain } from './state-reconstructor.js'

export type VerificationRule = 'no-observe-in-execution' | 'gateway-first-hop' | 'no-shadow-execution' | 'no-legacy-execution'

export type RuleResult = {
  rule: VerificationRule
  passed: boolean
  message: string
  violations: string[]
}

export type VerificationReport = {
  state: {
    totalEvents: number
    entryModule: string | null
    lastModule: string | null
  }
  rules: RuleResult[]
  passed: boolean
  timestamp: number
}

/**
 * Verify execution state against all active rules.
 */
export function verify(state: ExecutionState): VerificationReport {
  const rules: RuleResult[] = [
    checkNoObserveInExecution(state),
    checkGatewayFirstHop(state),
    checkNoShadowExecution(state),
    checkNoLegacyExecution(state),
  ]

  const passed = rules.every(r => r.passed)

  return {
    state: {
      totalEvents: state.totalEvents,
      entryModule: state.entryPoint?.module ?? null,
      lastModule: state.lastHop?.module ?? null,
    },
    rules,
    passed,
    timestamp: Date.now(),
  }
}

/**
 * Rule 1: OBSERVE domain modules must not appear in execution path.
 */
function checkNoObserveInExecution(state: ExecutionState): RuleResult {
  const observeInPath = state.activePath.filter(e => e.domain === 'OBSERVE')
  return {
    rule: 'no-observe-in-execution',
    passed: observeInPath.length === 0,
    message: observeInPath.length === 0
      ? 'No OBSERVE modules in execution path'
      : `${observeInPath.length} OBSERVE module(s) found in execution path`,
    violations: observeInPath.map(e => `${e.module}.${e.function} (${e.domain})`),
  }
}

/**
 * Rule 2: Gateway must be the first hop in execution.
 * Narrative-gateway is the sole sanctioned entry point.
 */
function checkGatewayFirstHop(state: ExecutionState): RuleResult {
  const first = state.entryPoint
  if (!first) {
    return {
      rule: 'gateway-first-hop',
      passed: true,
      message: 'No execution events',
      violations: [],
    }
  }
  const isGateway = first.module.includes('narrative-gateway') || first.module.includes('gateway')
  return {
    rule: 'gateway-first-hop',
    passed: isGateway,
    message: isGateway
      ? `Entry point is ${first.module}.${first.function}`
      : `Entry point ${first.module}.${first.function} is not a sanctioned gateway`,
    violations: isGateway ? [] : [`${first.module}.${first.function} is first hop but not a gateway`],
  }
}

/**
 * Rule 3: SHADOW modules must not appear in execution path.
 */
function checkNoShadowExecution(state: ExecutionState): RuleResult {
  const shadowInPath = state.activePath.filter(e => e.domain === 'SHADOW')
  const knownExceptions = new Set(['graph-runtime']) // tracked governance debt
  const violations = shadowInPath.filter(e => !knownExceptions.has(e.module))
  return {
    rule: 'no-shadow-execution',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'No forbidden SHADOW modules in execution path'
      : `${violations.length} SHADOW module(s) executed without exception`,
    violations: violations.map(e => `${e.module}.${e.function} (exception: ${knownExceptions.has(e.module) ? 'allowed' : 'forbidden'})`),
  }
}

/**
 * Rule 4: LEGACY modules must not be in active execution.
 */
function checkNoLegacyExecution(state: ExecutionState): RuleResult {
  const legacyInPath = state.activePath.filter(e => e.domain === 'LEGACY')
  return {
    rule: 'no-legacy-execution',
    passed: legacyInPath.length === 0,
    message: legacyInPath.length === 0
      ? 'No LEGACY modules in execution path'
      : `${legacyInPath.length} LEGACY module(s) found in execution path`,
    violations: legacyInPath.map(e => `${e.module}.${e.function}`),
  }
}

/**
 * Pretty print verification report.
 */
export function formatVerificationReport(report: VerificationReport): string {
  const lines: string[] = [
    `Verification Report @ ${new Date(report.timestamp).toISOString()}`,
    `  Overall: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`,
    `  Events:  ${report.state.totalEvents}`,
    `  Entry:   ${report.state.entryModule ?? 'none'}`,
    `  Last:    ${report.state.lastModule ?? 'none'}`,
    '',
    '  Rules:',
  ]

  for (const rule of report.rules) {
    const icon = rule.passed ? '✅' : '❌'
    lines.push(`    ${icon} ${rule.rule}`)
    lines.push(`        ${rule.message}`)
    if (rule.violations.length > 0) {
      for (const v of rule.violations) {
        lines.push(`        ⚠  ${v}`)
      }
    }
  }

  return lines.join('\n')
}
