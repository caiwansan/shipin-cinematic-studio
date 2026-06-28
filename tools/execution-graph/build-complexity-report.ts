#!/usr/bin/env node
/**
 * build-complexity-report.ts — Phase 3-E Execution Complexity Report
 *
 * Calculates structural complexity metrics:
 * - Total nodes (files with execution path)
 * - Reachable ratio
 * - Branching factor (average service deps per route)
 * - Deepest execution chain
 * - Average runtime hop count
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const REPORTS = path.join(ROOT, 'reports/execution-graph')
const OUTPUT_PATH = path.join(REPORTS, 'complexity-report.json')

function loadJson(relPath: string): any {
  return JSON.parse(fs.readFileSync(path.join(REPORTS, relPath), 'utf-8'))
}

interface ComplexityMetrics {
  totalNodes: number
  reachableNodes: number
  partiallyReachableNodes: number
  unreachableNodes: number
  reachableRatio: number
  unreachableRatio: number
  branchingFactor: number
  deepestExecutionChain: number
  averageRuntimeHopCount: number
  moduleCount: number
  routeCount: number
  serviceCount: number
  providerCount: number
  workerCount: number
}

function main() {
  console.log('# Phase 3-E: Execution Complexity Report\n')

  const reachability = loadJson('reachability.json')
  const routeGraph = loadJson('route-graph.json') || { routes: [], plugins: [] }
  const runtimeGraph = loadJson('runtime-graph.json') || { files: [], edges: {} }
  const providerGraph = loadJson('provider-graph.json') || { providers: [] }
  const workerGraph = loadJson('worker-graph.json') || { workers: [] }

  // Use reachability summary
  const summary = reachability.summary || {}
  const byModule = reachability.byModule || {}

  const r = summary.reachable || 0
  const p = summary.partiallyReachable || 0
  const u = summary.unreachable || 0
  const total = r + p + u

  const reachableRatio = total > 0 ? Number((r / total * 100).toFixed(1)) : 0
  const unreachableRatio = total > 0 ? Number((u / total * 100).toFixed(1)) : 0

  // Approximate branching factor: production routes ÷ production service/agent deps
  const productionRoutes = routeGraph.routes?.length || 0
  const productionFiles = runtimeGraph.files?.length || 0
  const branchingFactor = productionRoutes > 0
    ? Number((productionFiles / productionRoutes).toFixed(1))
    : 0

  // Deepest chain estimate from runtime-import-graph
  // Count edges from routes → runtime → services
  const hasRuntimeEdges = (runtimeGraph.edges?.runtimeInternal?.length || 0) > 0
  const hasGraphRuntimeEdges = (runtimeGraph.edges?.graphRuntime?.length || 0) > 0
  const deepestChain = 2 + (hasRuntimeEdges ? 1 : 0) + (hasGraphRuntimeEdges ? 1 : 0) + 1 // route→runtime→graph-runtime→provider

  // Average hop: count each edge type and average
  const totalEdges =
    (runtimeGraph.edges?.runtimeInternal?.length || 0) +
    (runtimeGraph.edges?.graphRuntime?.length || 0)

  const totalRuntimeFiles = runtimeGraph.files?.length || 0
  const averageHops = totalRuntimeFiles > 0
    ? Number((totalEdges / totalRuntimeFiles).toFixed(1))
    : 0

  const metrics: ComplexityMetrics = {
    totalNodes: total,
    reachableNodes: r,
    partiallyReachableNodes: p,
    unreachableNodes: u,
    reachableRatio,
    unreachableRatio,
    branchingFactor,
    deepestExecutionChain: deepestChain,
    averageRuntimeHopCount: averageHops,
    moduleCount: Object.keys(byModule).length,
    routeCount: routeGraph.routes?.length || 0,
    serviceCount: runtimeGraph.files?.filter((f: any) => f.module === 'services').length || 0,
    providerCount: providerGraph.summary?.totalProviders || 0,
    workerCount: workerGraph.summary?.totalWorkers || 0,
  }

  console.log('## Complexity Metrics\n')
  for (const [key, val] of Object.entries(metrics)) {
    console.log(`  ${key.padEnd(30)} ${val}`)
  }
  console.log()

  // Interpret results
  console.log('## Interpretation\n')

  if (reachableRatio > 60) {
    console.log('  Lean execution surface: >60% of code on production path.')
  } else if (reachableRatio > 30) {
    console.log('  Moderate bloat: 30-60% of code on production path.')
  } else {
    console.log('  HIGH DEBT: <30% of code on production path.')
  }

  if (unreachableRatio > 20) {
    console.log(`  ${unreachableRatio}% of files are unreachable — significant dead code load.`)
  }

  if (deepestChain > 5) {
    console.log(`  Deepest chain is ${deepestChain} hops — reasonable depth.`)
  }

  if (averageHops < 1) {
    console.log('  Low runtime coupling — modules are relatively independent.')
  } else {
    console.log(`  Average ${averageHops} runtime edges per file — moderate coupling.`)
  }

  console.log(`\n  Module count: ${metrics.moduleCount} top-level modules`)
  console.log(`  Route files:  ${metrics.routeCount}`)
  console.log(`  Service files: ${metrics.serviceCount}`)
  console.log(`  Providers:    ${metrics.providerCount} (${providerGraph.summary?.byVendor ? Object.keys(providerGraph.summary.byVendor).length : '?'} vendors)`)
  console.log(`  Workers:      ${metrics.workerCount}`)

  // Save
  const output = {
    metrics,
    reachability: {
      byModule: Object.entries(byModule).map(([mod, stats]: [string, any]) => ({
        module: mod,
        reachable: stats.r,
        partiallyReachable: stats.p,
        unreachable: stats.u,
        total: stats.r + stats.p + stats.u,
        reachableRatio: Number(((stats.r / (stats.r + stats.p + stats.u)) * 100).toFixed(1)),
      })),
    },
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nWritten to: ${OUTPUT_PATH}\n`)
}

main()
