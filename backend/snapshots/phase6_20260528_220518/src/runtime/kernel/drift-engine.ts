/**
 * runtime/kernel/drift-engine.ts — Phase 5.1 Step 3
 *
 * Compares "designed execution graph" (from ownership map + manifest)
 * against "actual execution graph" (from runtime trace).
 *
 * Drift = modules that should be invoked but aren't, or shouldn't be but are.
 *
 * Output is purely observational — no enforcement.
 *
 * @phase4-owner { entry: "narrative-gateway", mode: "OBSERVE" }
 */

import { type ExecutionState, type Domain } from './state-reconstructor.js'

export type DriftCategory = 'missing' | 'unexpected' | 'domain_violation' | 'no_longer_reachable'

export type DriftItem = {
  category: DriftCategory
  module: string
  detail: string
}

export type DriftReport = {
  timestamp: number
  driftItems: DriftItem[]
  driftCount: number
  summary: string
  // Aggregated counts
  missingCount: number
  unexpectedCount: number
  domainViolationCount: number
}

/**
 * Design graph — what the system SHOULD execute.
 * This mirrors the production.manifest.yaml's production paths.
 * Hardcoded as a minimal design graph for self-reference.
 */
const DESIGN_GRAPH: { module: string; domain: Domain; reason: string }[] = [
  // Core production path: incoming request
  { module: 'narrative-gateway', domain: 'SYNC', reason: 'Production gateway — all requests must pass through' },
  { module: 'pipeline-executor', domain: 'SYNC', reason: 'Pipeline execution — downstream of gateway' },
  { module: 'pipeline-adapter', domain: 'SYNC', reason: 'Pipeline adapter — abstraction boundary' },

  // Provider layer
  { module: 'provider.registry', domain: 'TOOL', reason: 'Provider registry — TOOL domain' },
  { module: 'aliyun-image', domain: 'TOOL', reason: 'Aliyun image provider' },
  { module: 'aliyun-video', domain: 'TOOL', reason: 'Aliyun video provider' },
  { module: 'aliyun-llm', domain: 'TOOL', reason: 'Aliyun LLM provider' },
  { module: 'aliyun-tts', domain: 'TOOL', reason: 'Aliyun TTS provider' },
  { module: 'volcengine-llm', domain: 'TOOL', reason: 'Volcengine LLM provider' },
  { module: 'volcengine-image', domain: 'TOOL', reason: 'Volcengine image provider' },
  { module: 'volcengine-tts', domain: 'TOOL', reason: 'Volcengine TTS provider' },
  { module: 'deepseek', domain: 'TOOL', reason: 'DeepSeek provider' },

  // Circuit breaker
  { module: 'circuit-breaker', domain: 'TOOL', reason: 'Circuit breaker — TOOL domain' },

  // Workers
  { module: 'showrunner-worker', domain: 'WORKER', reason: 'Showrunner worker' },
  { module: 'cognition-worker', domain: 'WORKER', reason: 'Cognition worker' },

  // Observability
  { module: 'runtime-trace', domain: 'OBSERVE', reason: 'Runtime trace — OBSERVE domain (must respond but not execute)' },
  { module: 'runtime-observability', domain: 'OBSERVE', reason: 'Observability dashboard' },
]

/**
 * Build drift report comparing design graph vs actual execution state.
 * Only observational — does not enforce or modify state.
 */
export function analyzeDrift(state: ExecutionState): DriftReport {
  const invokedModules = new Set(state.activePath.map(e => e.module))
  const invokedDomains = new Map<string, Domain>()
  for (const entry of state.activePath) {
    if (!invokedDomains.has(entry.module)) {
      invokedDomains.set(entry.module, entry.domain)
    }
  }

  const items: DriftItem[] = []

  // Check 1: Design graph modules that are missing from trace
  for (const design of DESIGN_GRAPH) {
    // Module name matching: check if any invoked module contains the design module key
    const invoked = [...invokedModules].find(m => m.includes(design.module))
    if (!invoked) {
      items.push({
        category: 'missing',
        module: design.module,
        detail: `Designed for ${design.domain} execution but never invoked. ${design.reason}`,
      })
    } else {
      // Check domain consistency
      const actualDomain = invokedDomains.get(invoked)
      if (actualDomain && actualDomain !== design.domain) {
        items.push({
          category: 'domain_violation',
          module: design.module,
          detail: `Invoked as ${invoked} but belongs to ${design.domain} domain (actual: ${actualDomain})`,
        })
      }
    }
  }

  // Check 2: Modules in trace that are NOT in design graph (unexpected)
  for (const module of invokedModules) {
    const inDesign = DESIGN_GRAPH.some(d => module.includes(d.module))
    if (!inDesign) {
      const domain = invokedDomains.get(module) ?? 'UNKNOWN'
      items.push({
        category: 'unexpected',
        module,
        detail: `Module "${module}" (${domain}) appeared in execution but is not in the design graph`,
      })
    }
  }

  // Count by category
  const missingCount = items.filter(i => i.category === 'missing').length
  const unexpectedCount = items.filter(i => i.category === 'unexpected').length
  const domainViolationCount = items.filter(i => i.category === 'domain_violation').length

  return {
    timestamp: Date.now(),
    driftItems: items,
    driftCount: items.length,
    summary: buildSummary(items, missingCount, unexpectedCount, domainViolationCount, state.totalEvents),
    missingCount,
    unexpectedCount,
    domainViolationCount,
  }
}

function buildSummary(
  items: DriftItem[],
  missingCount: number,
  unexpectedCount: number,
  domainViolationCount: number,
  totalEvents: number,
): string {
  if (items.length === 0) {
    return `✅ No drift detected. ${totalEvents} events match design expectations.`
  }

  const parts: string[] = []
  if (missingCount > 0) parts.push(`${missingCount} missing modules`)
  if (unexpectedCount > 0) parts.push(`${unexpectedCount} unexpected modules`)
  if (domainViolationCount > 0) parts.push(`${domainViolationCount} domain violations`)

  return `⚠️  Drift detected: ${parts.join(', ')} (${totalEvents} events analyzed)`
}

/**
 * Pretty print drift report.
 */
export function formatDriftReport(report: DriftReport): string {
  const lines: string[] = [
    `Drift Report @ ${new Date(report.timestamp).toISOString()}`,
    `  ${report.summary}`,
    `  Total drift items: ${report.driftCount}`,
    `    Missing:            ${report.missingCount}`,
    `    Unexpected:         ${report.unexpectedCount}`,
    `    Domain violations:  ${report.domainViolationCount}`,
    '',
  ]

  if (report.driftItems.length > 0) {
    lines.push('  Items:')
    for (const item of report.driftItems) {
      const icon = item.category === 'missing' ? '⬜' : item.category === 'unexpected' ? '🟡' : '🔴'
      lines.push(`    ${icon} [${item.category}] ${item.module}`)
      lines.push(`        ${item.detail}`)
    }
  }

  return lines.join('\n')
}
