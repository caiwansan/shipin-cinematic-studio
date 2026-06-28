#!/usr/bin/env node
/**
 * build-trace-based-reachability.ts — Phase 4.2.5
 *
 * Replaces the static import-graph-based reachability analyzer with
 * a runtime-trace-based source of truth.
 *
 * Input:
 *   - Runtime trace from GET /api/v1/runtime/trace
 *   - Ownership map from tools/execution-graph/build-ownership-map.ts
 *   - (Optional) Previous trace report for diff analysis
 *
 * Output:
 *   - reports/execution-graph/reachability.json
 *     { invoked, neverInvoked, total, byDomain, diff (if available) }
 *
 * Mode: read-only
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

const REPORTS_DIR = path.resolve(import.meta.dirname, '../../reports/execution-graph')
const RUNTIME_TRACE_DIR = path.resolve(import.meta.dirname, '../../reports/runtime-trace')
const OWNERSHIP_MAP_PATH = path.join(REPORTS_DIR, 'ownership-map.json')
const TRACE_URL = 'http://localhost:4002/api/v1/runtime/trace'
const OUTPUT_PATH = path.join(REPORTS_DIR, 'reachability.json')

interface OwnerRecord {
  file: string
  owner: {
    entry: string
    mode: string
  }
}

interface TraceEvent {
  module: string
  function: string
  caller: string
  timestamp: number
  traceId: string
}

interface OwnerMapData {
  records: OwnerRecord[]
}

interface ReachabilityReport {
  timestamp: string
  totalModules: number
  invokedModules: string[]
  neverInvokedModules: string[]
  byDomain: Record<string, { total: number; invoked: number; neverInvoked: string[] }>
  executionCount: Record<string, number>
  diff?: {
    previousTimestamp: string
    newInvocations: string[]
    stoppedInvocations: string[]
  }
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

function loadOwnershipMap(): OwnerMapData {
  return JSON.parse(fs.readFileSync(OWNERSHIP_MAP_PATH, 'utf-8'))
}

function findPreviousReport(): { timestamp: string; invokedModules: string[] } | null {
  if (!fs.existsSync(RUNTIME_TRACE_DIR)) return null
  const files = fs.readdirSync(RUNTIME_TRACE_DIR)
    .filter(f => f.startsWith('run-') && f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length < 2) return null

  // Get the second most recent file for "previous" comparison
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(RUNTIME_TRACE_DIR, files[1]), 'utf-8'))
    return {
      timestamp: prev.flushedAt || files[1],
      invokedModules: prev.invokedModules || [],
    }
  } catch {
    return null
  }
}

function mapModuleToOwner(module: string, map: Map<string, OwnerRecord>): OwnerRecord | null {
  for (const [filePath, record] of map) {
    if (filePath.includes(module.replace(/^.*\//, ''))) return record
    if (filePath.replace('.ts', '') === module) return record
    if (filePath.replace('.ts', '').replace(/^.*\//, '') === module) return record
  }
  return null
}

async function main() {
  console.log('# Phase 4.2.5 — Runtime Trace-Based Reachability\n')

  // 1. Load ownership map
  const ownershipData = loadOwnershipMap()
  const ownerMap = new Map<string, OwnerRecord>()
  for (const r of ownershipData.records) {
    ownerMap.set(r.file, r)
  }
  console.log(`  Ownership map: ${ownerMap.size} modules`)

  // 2. Fetch runtime trace
  let trace: { invokedModules: string[]; events: TraceEvent[] } = { invokedModules: [], events: [] }
  try {
    trace = await fetchJSON(TRACE_URL)
    console.log(`  Runtime trace: ${trace.events?.length || 0} events, ${trace.invokedModules?.length || 0} invoked modules`)
  } catch (err) {
    console.warn(`  ⚠️  Could not fetch trace (server down?): ${err}`)
    console.log('  Proceeding with empty trace...')
  }

  // 3. Build name → owner map for lookup
  const invokedModules = trace.invokedModules || []
  const invokedSet = new Set(invokedModules)
  const executionCount: Record<string, number> = {}
  for (const evt of trace.events || []) {
    executionCount[evt.module] = (executionCount[evt.module] || 0) + 1
  }

  // 4. Build by-domain breakdown
  const byDomain: Record<string, { total: number; invoked: number; neverInvoked: string[] }> = {}
  const neverInvokedModules: string[] = []

  for (const [filePath, record] of ownerMap) {
    const mode = record.owner?.mode || 'UNKNOWN'
    const shortName = filePath.replace(/^.*\//, '').replace('.ts', '')

    if (!byDomain[mode]) {
      byDomain[mode] = { total: 0, invoked: 0, neverInvoked: [] }
    }
    byDomain[mode].total++

    if (invokedSet.has(shortName)) {
      byDomain[mode].invoked++
    } else {
      byDomain[mode].neverInvoked.push(shortName)
      neverInvokedModules.push(shortName)
    }
  }

  // 5. Build diff with previous report
  let diff = undefined
  const previous = findPreviousReport()
  if (previous) {
    const prevSet = new Set(previous.invokedModules)
    const currentSet = new Set(invokedModules)

    const newInvocations = invokedModules.filter(m => !prevSet.has(m))
    const stoppedInvocations = previous.invokedModules.filter(m => !currentSet.has(m))

    if (newInvocations.length > 0 || stoppedInvocations.length > 0) {
      diff = {
        previousTimestamp: previous.timestamp,
        newInvocations,
        stoppedInvocations,
      }
    }
  }

  // 6. Build report
  const report: ReachabilityReport = {
    timestamp: new Date().toISOString(),
    totalModules: ownerMap.size,
    invokedModules: [...invokedModules],
    neverInvokedModules: neverInvokedModules.slice(0, 500), // cap at 500 to avoid bloat
    byDomain,
    executionCount,
    diff,
  }

  // 7. Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2))
  console.log(`\n  Report written: ${OUTPUT_PATH}`)

  // 8. Summary
  console.log(`\n  === Summary ===`)
  console.log(`  Total modules: ${report.totalModules}`)
  console.log(`  Invoked:       ${report.invokedModules.length}`)
  console.log(`  Never invoked: ${report.neverInvokedModules.length}`)

  for (const [domain, stats] of Object.entries(byDomain)) {
    const pct = stats.total > 0 ? Math.round((stats.invoked / stats.total) * 100) : 0
    console.log(`  ${domain.padEnd(10)} ${stats.invoked}/${stats.total} (${pct}%)`)
  }

  if (diff) {
    console.log(`\n  === Drift from previous ===`)
    if (diff.newInvocations.length > 0) console.log(`  New invocations:    ${diff.newInvocations.join(', ')}`)
    if (diff.stoppedInvocations.length > 0) console.log(`  Stopped invocations: ${diff.stoppedInvocations.join(', ')}`)
  }

  if (report.invokedModules.length === 0) {
    console.log('\n  ⚠️  Empty trace — no execution events recorded yet.')
    console.log('     Run a production call (e.g., script/parse) and re-run this tool.')
  }

  console.log('')
}

main().catch(console.error)
