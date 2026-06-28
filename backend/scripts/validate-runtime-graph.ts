#!/usr/bin/env node
/**
 * scripts/validate-runtime-graph.ts — Phase 4.3 Step 1
 *
 * CI-ready validation script.
 * Inputs:
 *   - runtimeTrace (from GET /api/v1/runtime/trace)
 *   - ownership-map.json (from tools/execution-graph/build-ownership-map.ts)
 *
 * Checks:
 *   1. Every invoked module has a valid __RUNTIME_OWNER__
 *   2. No OBSERVE module executed in SYNC/ASYNC path
 *   3. No SHADOW module invoked from production (unless known exception)
 *   4. No LEGACY module has new invocations
 *
 * Exit code: 0 = pass, 1 + report = fail
 *
 * @phase4.3
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

const REPORTS = path.resolve(__dirname, '../../../reports/execution-graph')
const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const OWNERSHIP_MAP_PATH = path.join(REPORTS, 'ownership-map.json')
const RUNTIME_TRACE_URL = 'http://localhost:4002/api/v1/runtime/trace'

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

interface TraceResponse {
  success: boolean
  totalEvents: number
  invokedModules: string[]
  events: TraceEvent[]
}

interface Violation {
  type: string
  module: string
  message: string
  severity: 'error' | 'warning'
}

// Known exceptions to SHADOW → SYNC coupling
const KNOWN_SHADOW_EXCEPTIONS = new Set([
  'graph-runtime', // 12 value imports, tracked debt
])

// Known OBSERVE modules (director-v2) that are allowed to respond to requests
const OBSERVE_ALLOWED_ROUTES = new Set([
  '/api/v2/director',
  '/api/v1/runtime/trace',
])

async function fetchTrace(): Promise<TraceResponse> {
  return new Promise((resolve, reject) => {
    http.get(RUNTIME_TRACE_URL, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse trace response: ${data.slice(0, 100)}`))
        }
      })
    }).on('error', reject)
  })
}

function loadOwnershipMap(): Map<string, OwnerRecord> {
  const raw: { records: OwnerRecord[] } = JSON.parse(
    fs.readFileSync(OWNERSHIP_MAP_PATH, 'utf-8')
  )
  const map = new Map<string, OwnerRecord>()
  for (const r of raw.records) {
    map.set(r.file, r)
  }
  return map
}

function main() {
  console.log('# Phase 4.3 — Runtime Graph Validation\n')

  // 1. Load ownership map
  console.log('  Loading ownership map...')
  const ownershipMap = loadOwnershipMap()
  console.log(`    ${ownershipMap.size} modules with owners\n`)

  // 2. Fetch runtime trace
  console.log('  Fetching runtime trace from', RUNTIME_TRACE_URL)
  fetchTrace().then((trace) => {
    console.log(`    ${trace.totalEvents} events, ${trace.invokedModules.length} invoked modules\n`)

    const violations: Violation[] = []

    // 3. Check each invoked module
    for (const module of trace.invokedModules) {
      // Map module name to ownership record
      // The trace records module names like 'narrative-gateway' but ownership is by file path
      const ownerEntry = findOwnerForModule(module, ownershipMap)

      if (!ownerEntry) {
        violations.push({
          type: 'missing-owner',
          module,
          message: `Module "${module}" was invoked but has no __RUNTIME_OWNER__ declaration`,
          severity: 'error',
        })
        continue
      }

      const mode = ownerEntry.owner.mode

      // Rule 2: OBSERVE must not be in execution path
      if (mode === 'OBSERVE') {
        const isAllowed = [...OBSERVE_ALLOWED_ROUTES].some(r => module.includes(r))
        if (!isAllowed) {
          violations.push({
            type: 'observe-execution',
            module,
            message: `OBSERVE module "${module}" was invoked in execution path. OBSERVE modules must not execute.`,
            severity: 'error',
          })
        }
      }

      // Rule 3: SHADOW invocation from production
      if (mode === 'SHADOW' && !KNOWN_SHADOW_EXCEPTIONS.has(module)) {
        violations.push({
          type: 'shadow-execution',
          module,
          message: `SHADOW module "${module}" was invoked. SHADOW modules are frozen — new invocations forbidden.`,
          severity: 'warning',
        })
      }

      // Rule 4: LEGACY module has new invocations
      if (mode === 'LEGACY') {
        violations.push({
          type: 'legacy-execution',
          module,
          message: `LEGACY module "${module}" was invoked. LEGACY modules should not be in active execution paths.`,
          severity: 'warning',
        })
      }
    }

    // 4. Report
    console.log('  Validation Results:\n')
    console.log('  ' + '-'.repeat(60))

    if (violations.length === 0) {
      console.log('  ✅ ALL CHECKS PASSED — no violations found\n')
      console.log(`    Invoked modules: ${trace.invokedModules.length}`)
      console.log(`    All have valid ownership: yes`)
      console.log(`    No forbidden execution patterns: yes\n`)
      process.exit(0)
    }

    const errors = violations.filter(v => v.severity === 'error')
    const warnings = violations.filter(v => v.severity === 'warning')

    console.log(`  ❌ ${errors.length} errors, ${warnings.length} warnings found\n`)

    for (const v of violations) {
      const icon = v.severity === 'error' ? '❌' : '⚠️'
      console.log(`  ${icon} [${v.type}] ${v.module}`)
      console.log(`       ${v.message}\n`)
    }

    // Save report
    const report = {
      summary: {
        totalModules: ownershipMap.size,
        invokedModules: trace.invokedModules.length,
        totalEvents: trace.totalEvents,
        errors: errors.length,
        warnings: warnings.length,
      },
      violations,
      invokedModules: trace.invokedModules,
      timestamp: new Date().toISOString(),
    }

    const reportPath = path.join(REPORTS, 'validation-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`  Report saved to: ${reportPath}\n`)

    if (errors.length > 0) {
      process.exit(1)
    }
    process.exit(0)
  }).catch((err) => {
    console.error('  ❌ Failed to fetch runtime trace:', err.message)
    console.error('     Make sure api-server is running on port 4002')
    process.exit(2)
  })
}

function findOwnerForModule(module: string, map: Map<string, OwnerRecord>): OwnerRecord | null {
  // Module names from trace are like 'narrative-gateway', 'pipeline-executor'
  // Ownership map stores file paths like 'runtime/narrative-gateway.ts'
  for (const [filePath, record] of map) {
    if (filePath.includes(module)) return record
    if (filePath.replace('.ts', '').replace(/^.*\//, '') === module) return record
  }
  return null
}

main()
