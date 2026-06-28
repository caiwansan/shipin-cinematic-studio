#!/usr/bin/env node
/**
 * build-route-graph.ts — Phase 3-A Execution Graph Build
 *
 * Builds: Route → Service → Runtime dependency chain
 * Identifies all API endpoints registered via fastify.register() in index.ts
 * and traces each route handler to its imported modules.
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const INDEX_PATH = path.join(SRC_PATH, 'index.ts')
const ROUTES_PATH = path.join(SRC_PATH, 'routes')
const OUTPUT_PATH = path.join(ROOT, 'reports/execution-graph/route-graph.json')

interface RouteEntry {
  id: string
  registerName: string
  importSource: string
  resolvedFile: string | null
  fileExists: boolean
  importedServiceModules: string[]
  importedRuntimeModules: string[]
  routeMethods: RouteMethod[]
}

interface RouteMethod {
  method: string
  path: string
  hasPreHandler: boolean
}

function extractRegisters(): { name: string; source: string }[] {
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8')
  const registers: { name: string; source: string }[] = []

  // Match: await app.register(registerName [, options])
  const regRegex = /await app\.register\((\w+)\s*(?:,|\))/g
  let match: RegExpExecArray | null
  while ((match = regRegex.exec(indexContent)) !== null) {
    registers.push({ name: match[1], source: 'index.ts' })
  }

  return registers
}

function resolveImport(name: string): string | null {
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8')

  // Try to find the import statement for this name
  const importRegex = new RegExp(
    `import\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}\\s*from)\\s+['"]([^'"]+)['"]`,
    'g'
  )
  let impMatch: RegExpExecArray | null
  while ((impMatch = importRegex.exec(indexContent)) !== null) {
    const source = impMatch[1]
    // Resolve relative imports
    if (source.startsWith('./')) {
      const resolved = path.resolve(SRC_PATH, source)
      // Try .ts, .js
      for (const ext of ['.ts', '/index.ts', '.js', '/index.js']) {
        const candidate = resolved + ext
        if (fs.existsSync(candidate)) return path.relative(SRC_PATH, candidate)
      }
    }
    return source
  }

  return null
}

function extractRouteMethods(filePath: string): RouteMethod[] {
  const methods: RouteMethod[] = []
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const routeRegex = /fastify\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = routeRegex.exec(content)) !== null) {
      const preHandlerCheck = content.slice(
        Math.max(0, match.index - 100), match.index
      )
      methods.push({
        method: match[1].toUpperCase(),
        path: match[2],
        hasPreHandler: preHandlerCheck.includes('preHandler'),
      })
    }
  } catch {}
  return methods
}

function extractImports(filePath: string, moduleDirs: string[]): string[] {
  const results: string[] = []
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const importRegex = /from\s+['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1]
      if (moduleDirs.some(dir => imp.includes(dir))) {
        results.push(imp)
      }
    }
  } catch {}
  return results
}

function main() {
  console.log('# Phase 3-A: Route Graph Build')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const registers = extractRegisters()
  console.log(`Total route registrations: ${registers.length}\n`)

  const routeEntries: RouteEntry[] = []
  const moduleDirs = ['services/', 'runtime/', 'agents/', 'scheduler/', 'jobs/']

  for (const reg of registers) {
    const resolvedFile = resolveImport(reg.name)
    const tsexists = resolvedFile && fs.existsSync(path.join(SRC_PATH, resolvedFile))
    const resolvedPath = resolvedFile ? path.join(SRC_PATH, resolvedFile) : null

    const entry: RouteEntry = {
      id: `route-${reg.name}`,
      registerName: reg.name,
      importSource: resolvedFile || 'unknown',
      resolvedFile: resolvedFile ? path.resolve(SRC_PATH, resolvedFile) : null,
      fileExists: !!tsexists,
      importedServiceModules: [],
      importedRuntimeModules: [],
      routeMethods: [],
    }

    if (resolvedPath && fs.existsSync(resolvedPath)) {
      entry.importedServiceModules = extractImports(resolvedPath, ['services/', 'runtime/', 'agents/'])
        .filter(i => i.includes('services/'))
      entry.importedRuntimeModules = extractImports(resolvedPath, ['runtime/', 'agents/', 'scheduler/'])
        .filter(i => i.includes('runtime/') || i.includes('agents/') || i.includes('scheduler/'))
      entry.routeMethods = extractRouteMethods(resolvedPath)
    }

    routeEntries.push(entry)
  }

  // Categorize
  const withRoutes = routeEntries.filter(r => r.routeMethods.length > 0)
  const noRoutes = routeEntries.filter(r => r.routeMethods.length === 0)
  const fileMissing = routeEntries.filter(r => !r.fileExists)
  const withServices = routeEntries.filter(r => r.importedServiceModules.length > 0)

  console.log('## Route Registrations with Endpoints\n')
  for (const entry of withRoutes.slice(0, 30)) {
    const methods = entry.routeMethods.map(m => `${m.method} ${m.path}`).join(', ')
    console.log(`  ${entry.registerName}: ${entry.routeMethods.length} endpoints`)
    console.log(`    ${methods.substring(0, 120)}`)
    if (entry.importedServiceModules.length > 0) {
      console.log(`    services: ${entry.importedServiceModules.length}`)
    }
    if (entry.importedRuntimeModules.length > 0) {
      console.log(`    runtime:  ${entry.importedRuntimeModules.length}`)
    }
    console.log()
  }
  if (withRoutes.length > 30) {
    console.log(`  ... and ${withRoutes.length - 30} more\n`)
  }

  console.log('## Plugin Registrations (no endpoints)\n')
  for (const entry of noRoutes) {
    console.log(`  ${entry.registerName} — ${entry.importSource}`)
  }
  console.log()

  console.log('## File Not Found\n')
  for (const entry of fileMissing) {
    console.log(`  ⚠️  ${entry.registerName} → ${entry.importSource} (not resolved)`)
  }
  console.log()

  // Save
  const output = {
    summary: {
      totalRegistrations: registers.length,
      routeFiles: withRoutes.length,
      pluginsOnly: noRoutes.filter(r => r.fileExists).length,
      fileMissing: fileMissing.length,
    },
    routes: routeEntries
      .filter(r => r.routeMethods.length > 0)
      .map(r => ({
        registerName: r.registerName,
        importSource: r.importSource,
        fileExists: r.fileExists,
        routeCount: r.routeMethods.length,
        routes: r.routeMethods,
        serviceDeps: r.importedServiceModules.length,
        runtimeDeps: r.importedRuntimeModules.length,
      })),
    plugins: routeEntries.filter(r => r.routeMethods.length === 0).map(r => ({
      registerName: r.registerName,
      importSource: r.importSource,
      fileExists: r.fileExists,
    })),
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)

  const activeCount = withRoutes.length
  const pluginCount = noRoutes.filter(r => r.fileExists).length
  console.log('Summary:')
  console.log(`  Route files:       ${activeCount}`)
  console.log(`  Plugins:           ${pluginCount}`)
  console.log(`  Missing files:     ${fileMissing.length}`)
  console.log(`  Total registered:  ${registers.length}`)
}

main()
