#!/usr/bin/env node
/**
 * route-runtime-map.ts — Phase 2-B Runtime Boundary Audit
 *
 * Maps: API route → handler function → imported service/runtime modules
 * Produces a dependency graph of the production routing layer.
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTES_PATH = path.join(ROOT, 'backend/src/routes')
const RUNTIME_PATH = path.join(ROOT, 'backend/src/runtime')
const AGENTS_PATH = path.join(ROOT, 'backend/src/agents')
const OUTPUT_PATH = path.join(ROOT, 'reports/runtime/production-runtime-map.json')

interface ImportMap {
  [routeFile: string]: string[]
}

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const imports: string[] = []
  const regex = /from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1]
    if (!importPath.startsWith('.')) {
      imports.push(importPath) // external
    } else {
      // Resolve relative
      const resolved = path.resolve(path.dirname(filePath), importPath)
      imports.push(path.relative(ROOT, resolved))
    }
  }
  return imports
}

function scanDir(dir: string, prefix: string = ''): ImportMap {
  const result: ImportMap = {}

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      const key = path.relative(ROOT, full)
      result[key] = extractImports(full)
    } else if (entry.isDirectory() && entry.name !== 'node_modules') {
      Object.assign(result, scanDir(full))
    }
  }

  return result
}

function main() {
  console.log('# Route → Runtime Dependency Map')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const routes = scanDir(ROUTES_PATH)
  const runtime = scanDir(RUNTIME_PATH)
  const agents = scanDir(AGENTS_PATH)

  const map: any = {
    routes: {},
    runtime: {},
    agents: {},
  }

  // Identify which routes import which runtime modules
  const runtimeDirs = ['src/runtime', 'src/services', 'src/agents', 'src/director-v2', 'src/scheduler']

  for (const [routeFile, imports] of Object.entries(routes)) {
    const runtimeDeps = imports.filter(i =>
      runtimeDirs.some(rd => i.includes(rd))
    )
    if (runtimeDeps.length > 0) {
      map.routes[routeFile] = runtimeDeps
    }
  }

  for (const [rtFile, imports] of Object.entries(runtime)) {
    const deps = imports.filter(i =>
      i.includes('src/services') || i.includes('src/agents') || i.includes('src/utils')
    )
    if (deps.length > 0) {
      map.runtime[rtFile] = deps
    }
  }

  for (const [agentFile, imports] of Object.entries(agents)) {
    const deps = imports.filter(i =>
      i.includes('src/services') || i.includes('src/runtime') || i.includes('src/utils')
    )
    if (deps.length > 0) {
      map.agents[agentFile] = deps
    }
  }

  // Summary
  console.log('### Routes → Runtime Dependencies\n')
  for (const [route, deps] of Object.entries(map.routes)) {
    console.log(`  ${route.replace('src/routes/', '')}`)
    for (const dep of deps as string[]) {
      console.log(`    └─→ ${dep}`)
    }
    console.log()
  }

  console.log('### Runtime → Service Dependencies\n')
  for (const [rt, deps] of Object.entries(map.runtime)) {
    console.log(`  ${rt.replace('src/runtime/', '')}`)
    for (const dep of deps as string[]) {
      console.log(`    └─→ ${dep}`)
    }
    console.log()
  }

  // Save output
  const output = {
    routes: map.routes,
    runtime: map.runtime,
    agents: map.agents,
    summary: {
      totalRoutes: Object.keys(map.routes).length,
      totalRuntimeFiles: Object.keys(map.runtime).length,
      totalAgentFiles: Object.keys(map.agents).length,
      uniqueRouteFiles: Object.keys(routes).length,
      uniqueRuntimeFiles: Object.keys(runtime).length,
      uniqueAgentFiles: Object.keys(agents).length,
    },
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nWritten to: ${OUTPUT_PATH}\n`)

  console.log('Summary:')
  console.log(`  Route files:           ${output.summary.uniqueRouteFiles}`)
  console.log(`  Runtime files:         ${output.summary.uniqueRuntimeFiles}`)
  console.log(`  Agent files:           ${output.summary.uniqueAgentFiles}`)
  console.log(`  Routes with runtime deps: ${output.summary.totalRoutes}`)
}

main()
