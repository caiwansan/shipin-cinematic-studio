#!/usr/bin/env node
/**
 * runtime-import-graph.ts — Phase 2-B Runtime Boundary Audit
 *
 * Analyzes imports of runtime core modules (src/runtime/) to identify:
 * - What imports runtime/ from outside
 * - What runtime/ imports from outside
 * - Disconnected runtime subtrees (files that nothing imports)
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const OUTPUT_PATH = path.join(ROOT, 'reports/runtime/disconnected-runtime.json')

interface RuntimeNode {
  file: string
  importedBy: string[]
  dependsOn: string[]
  fileCount: number
  isDisconnected: boolean
  isExternalDependency: boolean
}

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const imports: string[] = []
  const regex = /from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

function scanAllFiles(dir: string, basePath: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      const relative = path.relative(basePath, full)
      result.set(relative, extractImports(full))
    } else if (entry.isDirectory()) {
      const sub = scanAllFiles(full, basePath)
      for (const [k, v] of sub) result.set(k, v)
    }
  }
  return result
}

function resolveImport(imp: string, filePath: string): string {
  if (imp.startsWith('.')) {
    return path.relative(
      path.resolve(SRC_PATH, '..'),
      path.resolve(path.dirname(path.join(SRC_PATH, filePath)), imp)
    )
  }
  return `external:${imp}`
}

function main() {
  console.log('# Runtime Import Graph Analysis')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const allFiles = scanAllFiles(SRC_PATH, SRC_PATH)
  const runtimeFiles = new Map<string, RuntimeNode>()

  // Identify runtime files
  for (const [file, imports] of allFiles) {
    if (file.startsWith('runtime/') || file.startsWith('routes/')) {
      runtimeFiles.set(file, {
        file,
        importedBy: [],
        dependsOn: imports
          .map(i => resolveImport(i, file))
          .filter(r => !r.startsWith('external:')),
        fileCount: 0,
        isDisconnected: true,
        isExternalDependency: imports.some(i => i.startsWith('.')),
      })
    }
  }

  // Build reverse dependency map
  for (const [file, node] of runtimeFiles) {
    for (const dep of node.dependsOn) {
      const existing = runtimeFiles.get(dep)
      if (existing) {
        existing.importedBy.push(file)
      }
    }
  }

  // Check which runtime files are imported by non-runtime files
  for (const [file, _imports] of allFiles) {
    if (!file.startsWith('runtime/')) {
      // Check if this file imports a runtime file
      for (const imp of _imports) {
        const resolved = resolveImport(imp, file)
        const rtNode = runtimeFiles.get(resolved)
        if (rtNode) {
          rtNode.importedBy.push(file)
        }
      }
    }
  }

  // Mark disconnected
  for (const [, node] of runtimeFiles) {
    node.isDisconnected = node.importedBy.length === 0 && node.fileCount === 0
  }

  // Re-count
  for (const [, node] of runtimeFiles) {
    node.importedBy = [...new Set(node.importedBy)]
    node.fileCount = node.importedBy.length
  }

  const disconnected = [...runtimeFiles.values()].filter(n => n.isDisconnected)
  const connected = [...runtimeFiles.values()].filter(n => !n.isDisconnected)

  console.log('### Connected Runtime Files\n')
  for (const node of connected.sort((a, b) => b.importedBy.length - a.importedBy.length)) {
    console.log(`  ${node.file}`)
    console.log(`    imported by: ${node.importedBy.length} file(s)`)
    console.log(`    depends on: ${node.dependsOn.length} file(s)`)
    console.log()
  }

  console.log('### Disconnected Runtime Files\n')
  for (const node of disconnected) {
    console.log(`  [DISCONNECTED] ${node.file}`)
    console.log(`    depends on: ${node.dependsOn.length} file(s)`)
    console.log()
  }

  // Save output
  const output = {
    connected: connected.map(n => ({
      file: n.file,
      importedByCount: n.importedBy.length,
      importedBy: n.importedBy,
    })),
    disconnected: disconnected.map(n => ({
      file: n.file,
      dependsOn: n.dependsOn,
    })),
    summary: {
      totalRuntimeFiles: runtimeFiles.size,
      connectedFiles: connected.length,
      disconnectedFiles: disconnected.length,
    },
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)
  console.log('Summary:')
  console.log(`  Total runtime files:    ${output.summary.totalRuntimeFiles}`)
  console.log(`  Connected:              ${output.summary.connectedFiles}`)
  console.log(`  Disconnected:           ${output.summary.disconnectedFiles}`)
}

main()
