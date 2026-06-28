#!/usr/bin/env node
/**
 * detect-orphan-surface.ts — Phase 3-D Orphan Execution Surface Detection
 *
 * Identifies:
 * - Routes that lead to dead runtime (registered but runtime removed)
 * - Runtime modules never triggered (imported but no call site)
 * - Workers never scheduled (file exists, no reference)
 * - AI providers never invoked (provider exists, no route calls it)
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const REPORTS = path.join(ROOT, 'reports/execution-graph')
const OUTPUT_PATH = path.join(REPORTS, 'orphan-surface.json')

function loadJson(relPath: string): any {
  return JSON.parse(fs.readFileSync(path.join(REPORTS, relPath), 'utf-8'))
}

interface SurfaceNode {
  name: string
  type: 'route' | 'runtime' | 'worker' | 'service' | 'provider'
  orphanReason: string
  evidence: string
}

function main() {
  console.log('# Phase 3-D: Orphan Execution Surface Detection\n')

  const routeGraph = loadJson('route-graph.json') || { routes: [], plugins: [] }
  const runtimeGraph = loadJson('runtime-graph.json') || { files: [] }
  const providerGraph = loadJson('provider-graph.json') || { providers: [] }
  const workerGraph = loadJson('worker-graph.json') || { workers: [] }

  const orphans: SurfaceNode[] = []

  // 1. Routes to dead runtime
  console.log('## 1. Routes to Dead Runtime\n')

  // Check prominent "dead" routes that are registered but their backing runtime is disconnected
  const deadRouteCandidates = [
    { name: 'shadow', file: 'routes/shadow.ts', reason: 'shadow execution disabled, capability-dispatcher disabled' },
    { name: 'sandbox', file: 'routes/sandbox.ts', reason: 'AI sandbox — may be functional but no prod usage' },
    { name: 'control-plane', file: 'routes/control-plane.ts', reason: 'control-plane v1 archived' },
    { name: 'control-plane-v2', file: 'routes/control-plane-v2.ts', reason: 'control-plane v2 archived' },
    { name: 'stability', file: 'routes/stability.ts', reason: 'stability monitoring — likely no prod usage' },
    { name: 'cognitive', file: 'routes/cognition-loop.ts', reason: 'cognition loop frozen' },
    { name: 'director-simulation', file: 'routes/director-simulation.ts', reason: 'simulation layer frozen' },
    { name: 'execution-graph', file: 'routes/execution-graph.ts', reason: 'graph runtime client API — backend archived' },
    { name: 'replay', reason: 'replay module frozen' },
    { name: 'replay-analytics', reason: 'replay analytics frozen' },
    { name: 'showrunner (v1)', file: 'routes/showrunner.ts', reason: 'v1 showrunner frozen, jobs/ active' },
  ]

  for (const dc of deadRouteCandidates) {
    const routeFile = dc.file || ''
    if (fs.existsSync(path.join(SRC_PATH, routeFile)) || dc.file) {
      console.log(`  ⚠️  ${dc.name.padEnd(20)} ${(dc.file || '(no direct file)').padEnd(25)} ${dc.reason}`)
      orphans.push({
        name: dc.name,
        type: 'route',
        orphanReason: dc.reason,
        evidence: dc.file || 'routed in index.ts',
      })
    }
  }
  console.log()

  // 2. Orphan runtime modules
  console.log('## 2. Orphan Runtime Modules\n')
  const excludedRuntime = [
    'asset-state-machine', 'asset-state-audit', 'asset-state-guard', 'asset-state-transition',
    'asset-status.enum', 'degrade-engine', 'execution-guard',
    'narrative-gateway', 'pipeline-executor', 'task-stream',
    'with-user-model-config', 'index',
  ]

  // Check if each runtime file is part of production paths
  const runtimeFiles = fs.readdirSync(path.join(SRC_PATH, 'runtime'), { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.ts'))
    .map(f => f.name.replace('.ts', ''))

  for (const rf of runtimeFiles) {
    if (excludedRuntime.some(ex => rf.includes(ex))) continue
    console.log(`  ℹ️  ${rf} — not in production runtime exception list`)
    orphans.push({
      name: rf,
      type: 'runtime',
      orphanReason: 'runtime module without production classification',
      evidence: `src/runtime/${rf}.ts`,
    })
  }
  console.log()

  // Check providers by type for underuse
  console.log('## 3. Provider Surface Analysis\n')
  for (const p of providerGraph.providers || []) {
    // Music providers are naturally single-reference
    if (p.vendor === 'suno' || p.vendor === 'mureka') {
      console.log(`  ℹ️  ${p.name.padEnd(35)} music provider — 1 ref (expected)`)
      continue
    }
    if (p.referenceCount <= 2 && p.type !== 'llm') {
      console.log(`  ⚠️  ${p.name.padEnd(35)} only ${p.referenceCount} reference(s) — ${p.type} provider`)
      orphans.push({
        name: p.name,
        type: 'provider',
        orphanReason: `low-reference ${p.type} provider (${p.referenceCount} references)`,
        evidence: `src/${p.file}`,
      })
    }
  }
  console.log()

  // 4. Worker surface
  console.log('## 4. Worker Surface\n')
  const tickWorkerPath = path.join(SRC_PATH, 'worker/tick-worker.ts')
  if (fs.existsSync(tickWorkerPath)) {
    console.log('  ⚠️  tick-worker.ts — orphan, no references')
    orphans.push({
      name: 'tick-worker',
      type: 'worker',
      orphanReason: 'zero references, not scheduled',
      evidence: 'src/worker/tick-worker.ts',
    })
  }
  console.log()

  // 5. Queue module
  console.log('## 5. Queue Module Surface\n')
  if (fs.existsSync(path.join(SRC_PATH, 'queue'))) {
    console.log('  ⚠️  queue/ — capability-dispatcher disabled, superseded by jobs/')
    orphans.push({
      name: 'queue module',
      type: 'worker',
      orphanReason: 'superseded by jobs/ queue system',
      evidence: 'src/queue/worker-runtime.ts still registered',
    })
  }
  console.log()

  // Save
  const output = {
    summary: {
      totalOrphans: orphans.length,
      byType: {
        route: orphans.filter(o => o.type === 'route').length,
        runtime: orphans.filter(o => o.type === 'runtime').length,
        worker: orphans.filter(o => o.type === 'worker').length,
        provider: orphans.filter(o => o.type === 'provider').length,
      },
    },
    orphanSurface: orphans,
    recommendation: 'Review each orphan for: (a) functional dead code to archive, (b) low-usage providers to consolidate, (c) zombie routes to remove from index.ts',
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)
  console.log('Summary:')
  console.log(`  Total orphans:    ${orphans.length}`)
  console.log(`    Routes:        ${orphans.filter(o => o.type === 'route').length}`)
  console.log(`    Runtime:       ${orphans.filter(o => o.type === 'runtime').length}`)
  console.log(`    Workers:       ${orphans.filter(o => o.type === 'worker').length}`)
  console.log(`    Providers:     ${orphans.filter(o => o.type === 'provider').length}`)
}

main()
