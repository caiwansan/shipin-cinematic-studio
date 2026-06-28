/**
 * runtime/kernel/state-reconstructor.ts — Phase 5.1 Step 1
 *
 * Builds ExecutionState from runtime trace events.
 * Reconstructs what the system actually did, vs what it was designed to do.
 *
 * @phase4-owner { entry: "narrative-gateway", mode: "OBSERVE" }
 */

import { runtimeTrace } from '../trace/runtime-trace.js'

export type Domain = 'SYNC' | 'ASYNC' | 'WORKER' | 'TOOL' | 'OBSERVE' | 'LEGACY' | 'SHADOW' | 'UNKNOWN'

export type ExecutionStateEntry = {
  module: string
  function: string
  caller: string
  domain: Domain
  timestamp: number
  traceId: string
}

export type ExecutionState = {
  /** Ordered list of execution events (oldest first) */
  activePath: ExecutionStateEntry[]
  /** Unique modules invoked, grouped by domain */
  modulesByDomain: Record<Domain, string[]>
  /** First hop (entry point) */
  entryPoint: ExecutionStateEntry | null
  /** Last hop */
  lastHop: ExecutionStateEntry | null
  /** Timestamp of state reconstruction */
  reconstructedAt: number
  /** Number of events processed */
  totalEvents: number
}

// Map known module name fragments to domains.
// This mirrors the ownership-map but is a runtime-local copy
// to avoid loading JSON files.
const MODULE_DOMAIN_MAP: Record<string, Domain> = {
  'narrative-gateway': 'SYNC',
  'pipeline-executor': 'SYNC',
  'pipeline-adapter': 'SYNC',
  'pipeline-adapter-proxy': 'SYNC',
  'pipeline': 'SYNC',
  'runtime-gate': 'SYNC',
  'execution-guard': 'SYNC',
  'degrade-engine': 'SYNC',
  'provider.registry': 'TOOL',
  'circuit-breaker': 'TOOL',
  'aliyun': 'TOOL',
  'volcengine': 'TOOL',
  'deepseek': 'TOOL',
  'provider': 'TOOL',
  'director-v2': 'OBSERVE',
  'director-api': 'OBSERVE',
  'director-field': 'OBSERVE',
  'diagnostics': 'OBSERVE',
  'graph-runtime': 'SHADOW',
  'queue': 'SHADOW',
  'workflow': 'SHADOW',
  'legacy': 'LEGACY',
  'archive': 'LEGACY',
}

function resolveDomain(module: string): Domain {
  for (const [key, domain] of Object.entries(MODULE_DOMAIN_MAP)) {
    if (module.includes(key)) return domain
  }
  return 'UNKNOWN'
}

/**
 * State 1: Reconstruct ExecutionState from current runtime trace.
 * Non-invasive — reads trace events without modifying them.
 */
export function buildExecutionState(options?: { maxEvents?: number }): ExecutionState {
  const events = runtimeTrace.getEvents()
  const max = options?.maxEvents ?? events.length
  const slice = events.slice(0, max)

  const entries: ExecutionStateEntry[] = slice.map((evt) => ({
    module: evt.module,
    function: evt.function,
    caller: evt.caller,
    domain: resolveDomain(evt.module),
    timestamp: evt.timestamp,
    traceId: evt.traceId,
  }))

  // Build modules-by-domain map preserving order of first appearance
  const modulesByDomain: Record<Domain, string[]> = {
    SYNC: [], ASYNC: [], WORKER: [], TOOL: [], OBSERVE: [],
    LEGACY: [], SHADOW: [], UNKNOWN: [],
  }
  const seen = new Set<string>()
  for (const entry of entries) {
    const key = `${entry.domain}:${entry.module}`
    if (!seen.has(key)) {
      seen.add(key)
      modulesByDomain[entry.domain].push(entry.module)
    }
  }

  return {
    activePath: entries,
    modulesByDomain,
    entryPoint: entries[0] ?? null,
    lastHop: entries[entries.length - 1] ?? null,
    reconstructedAt: Date.now(),
    totalEvents: entries.length,
  }
}

/**
 * Utility: pretty print execution state for reports.
 */
export function formatExecutionState(state: ExecutionState): string {
  const lines: string[] = [
    `ExecutionState @ ${new Date(state.reconstructedAt).toISOString()}`,
    `  Events: ${state.totalEvents}`,
    `  Entry:  ${state.entryPoint ? `${state.entryPoint.module}.${state.entryPoint.function}` : 'none'}`,
    `  Last:   ${state.lastHop ? `${state.lastHop.module}.${state.lastHop.function}` : 'none'}`,
    `  Path:   ${state.activePath.map(e => `${e.module}:${e.function}`).join(' → ')}`,
    `  Domains:`,
  ]

  for (const [domain, modules] of Object.entries(state.modulesByDomain)) {
    if (modules.length > 0) {
      lines.push(`    ${domain}: ${modules.join(', ')}`)
    }
  }

  return lines.join('\n')
}
