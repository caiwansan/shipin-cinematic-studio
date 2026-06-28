#!/usr/bin/env node
/**
 * build-runtime-graph.ts — Phase 3-A Execution Graph Build
 *
 * Builds a dependency graph of the runtime layer:
 * - runtime/* files and their imports
 * - Which modules depend on runtime/*
 * - Cross-runtime dependency chains
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const OUTPUT_PATH = path.join(ROOT, 'reports/execution-graph/runtime-graph.json')

interface RuntimeNode {
  file: string
  module: string
  sizeBytes: number
  imports: DepInfo[]
  isExported: boolean
  exportNames: string[]
}

interface DepInfo {
  target: string
  kind: 'internal' | 'service' | 'external' | 'agent' | 'runtime' | 'graph-runtime' | 'other'
  isTypeOnly: boolean
}

function extractImports(filePath: string, relativeTo: string): DepInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const deps: DepInfo[] = []
  const importRegex = /(?:import\s+type\s*\{|import\s+)([^;]+?)\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    const fullDecl = match[0]
    const isTypeOnly = fullDecl.startsWith('import type') || match[1].trim().startsWith('type')
    const target = match[2]
    const resolved = target.startsWith('.')
      ? path.relative(relativeTo, path.resolve(path.dirname(filePath), target))
      : target

    let kind: DepInfo['kind'] = 'other'
    if (resolved.startsWith('..') || resolved.startsWith('.')) kind = 'internal'
    else if (resolved.includes('services/')) kind = 'service'
    else if (resolved.includes('runtime/')) kind = 'runtime'
    else if (resolved.includes('agents/')) kind = 'agent'
    else if (resolved.includes('graph-runtime')) kind = 'graph-runtime'
    else if (!resolved.startsWith('.') && !resolved.startsWith('..')) kind = 'external'

    deps.push({ target, kind, isTypeOnly })
  }
  return deps
}

function extractExports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const exports: string[] = []
  const exportRegex = /^export\s+(?:const|function|class|interface|type|let|var|default)\s+(\w+)/gm
  let match: RegExpExecArray | null
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1])
  }
  return exports
}

function scanRuntime(root: string): RuntimeNode[] {
  const runtimeFiles: RuntimeNode[] = []

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        const relativeFile = path.relative(SRC_PATH, full)
        if (relativeFile.startsWith('runtime/') || relativeFile.startsWith('routes/') || relativeFile.startsWith('services/')) {
          const imports = extractImports(full, SRC_PATH)
          const exports = extractExports(full)
          runtimeFiles.push({
            file: relativeFile,
            module: relativeFile.split('/')[0],
            sizeBytes: fs.statSync(full).size,
            imports,
            isExported: exports.length > 0,
            exportNames: exports,
          })
        }
      } else if (entry.isDirectory()) {
        scan(full)
      }
    }
  }

  scan(root)
  return runtimeFiles
}

function main() {
  console.log('# Phase 3-A: Runtime Dependency Graph')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const nodes = scanRuntime(SRC_PATH)
  console.log(`Files scanned: ${nodes.length}\n`)

  const byModule: Record<string, number> = {}
  for (const n of nodes) {
    byModule[n.module] = (byModule[n.module] || 0) + 1
  }

  console.log('## Files by Module\n')
  for (const [mod, count] of Object.entries(byModule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${mod}/: ${count} files`)
  }
  console.log()

  // Runtime-internal dependency edges
  const runtimeNodes = nodes.filter(n => n.module === 'runtime')
  const runtimeEdges: { from: string; to: string }[] = []
  for (const n of runtimeNodes) {
    for (const dep of n.imports) {
      if (dep.kind === 'runtime') {
        runtimeEdges.push({ from: n.file, to: dep.target })
      }
    }
  }

  console.log('## Runtime Internal Dependency Edges\n')
  for (const edge of runtimeEdges) {
    console.log(`  ${edge.from} → ${edge.to}`)
  }
  console.log()

  // Graph-runtime coupling in production modules
  const graphRuntimeEdges: { from: string; to: string; isTypeOnly: boolean }[] = []
  for (const n of nodes) {
    for (const dep of n.imports) {
      if (dep.kind === 'graph-runtime') {
        graphRuntimeEdges.push({ from: n.file, to: dep.target, isTypeOnly: dep.isTypeOnly })
      }
    }
  }

  console.log('## Graph-Runtime Coupling\n')
  for (const edge of graphRuntimeEdges) {
    console.log(`  ${edge.from} → ${edge.to} ${edge.isTypeOnly ? '(type)' : '(VALUE)'}`)
  }
  console.log()

  // External dependency summary
  const externalDeps = new Map<string, string[]>()
  for (const n of nodes) {
    for (const dep of n.imports) {
      if (dep.kind === 'external' && !dep.target.startsWith('.') && !dep.target.includes('openclaw')) {
        if (!externalDeps.has(dep.target)) {
          externalDeps.set(dep.target, [])
        }
        externalDeps.get(dep.target)!.push(n.file)
      }
    }
  }

  console.log('## External Dependencies\n')
  for (const [pkg, users] of [...externalDeps.entries()].sort()) {
    console.log(`  ${pkg}: used by ${users.length} files`)
  }
  console.log()

  // Save
  const output = {
    summary: {
      totalFiles: nodes.length,
      runtimeModules: Object.keys(byModule).filter(m => m === 'runtime').length,
      routeModules: Object.keys(byModule).filter(m => m === 'routes').length,
      serviceModules: Object.keys(byModule).filter(m => m === 'services').length,
      graphRuntimeEdges: graphRuntimeEdges.length,
      runtimeInternalEdges: runtimeEdges.length,
    },
    files: nodes.map(n => ({
      file: n.file,
      module: n.module,
      sizeBytes: n.sizeBytes,
      exportCount: n.exportNames.length,
      importCount: n.imports.length,
      externalDeps: n.imports.filter(i => i.kind === 'external').map(i => i.target),
      graphRuntimeDeps: n.imports.filter(i => i.kind === 'graph-runtime').map(i => ({ target: i.target, isTypeOnly: i.isTypeOnly })),
    })),
    edges: {
      runtimeInternal: runtimeEdges,
      graphRuntime: graphRuntimeEdges,
    },
    externalDependencies: [...externalDeps.entries()].map(([pkg, users]) => ({
      package: pkg,
      usedBy: users.length,
      files: users,
    })),
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)

  console.log('Summary:')
  console.log(`  Files scanned:       ${nodes.length}`)
  console.log(`  Runtime files:       ${runtimeNodes.length}`)
  console.log(`  Graph-runtime edges: ${graphRuntimeEdges.length} (${graphRuntimeEdges.filter(e => !e.isTypeOnly).length} value)`)
  console.log(`  Runtime int. edges:  ${runtimeEdges.length}`)
}

main()
