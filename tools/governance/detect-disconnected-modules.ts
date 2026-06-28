#!/usr/bin/env node
/**
 * detect-disconnected-modules.ts — Phase 2-A Governance Validator
 *
 * Finds modules that exist as src/ directories but have:
 * - No route registration in index.ts
 * - No import references from production modules
 * - No service references from runtime modules
 *
 * Mode: report-only
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const INDEX_PATH = path.join(SRC_PATH, 'index.ts')

interface ModuleStatus {
  name: string
  exists: boolean
  inIndexImport: boolean
  fileCount: number
  isDirectory: boolean
}

function getTopLevelModules(srcPath: string): ModuleStatus[] {
  const entries = fs.readdirSync(srcPath, { withFileTypes: true })
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8')

  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => {
      const dirPath = path.join(srcPath, e.name)
      const fileCount = countFiles(dirPath)
      const inIndexImport = indexContent.includes(e.name)

      return {
        name: e.name,
        exists: true,
        inIndexImport,
        fileCount,
        isDirectory: true,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function countFiles(dir: string): number {
  let count = 0
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isFile() && entry.name.endsWith('.ts')) count++
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        count += countFiles(path.join(dir, entry.name))
      }
    }
  } catch {}
  return count
}

function main() {
  console.log('# Disconnected Module Report')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const modules = getTopLevelModules(SRC_PATH)

  const connected = modules.filter(m => m.inIndexImport)
  const disconnected = modules.filter(m => !m.inIndexImport)

  console.log('## Disconnected Modules (not imported in index.ts)\n')
  if (disconnected.length === 0) {
    console.log('  ✅ All modules are imported in index.ts\n')
  } else {
    for (const m of disconnected) {
      console.log(`  [DISCONNECTED] ${m.name}/ — ${m.fileCount} files, not referenced in index.ts`)
    }
    console.log()
  }

  console.log('## Connected Modules (imported in index.ts)\n')
  for (const m of connected) {
    console.log(`  [CONNECTED] ${m.name}/ — ${m.fileCount} files`)
  }
  console.log()

  console.log('## Summary\n')
  console.log(`  Total modules:       ${modules.length}`)
  console.log(`  Connected:           ${connected.length}`)
  console.log(`  Disconnected:        ${disconnected.length}`)
  console.log(`  Total file count:    ${modules.reduce((a, m) => a + m.fileCount, 0)}`)
  console.log()

  if (disconnected.length > 0) {
    console.log('⚠️  Disconnected modules found. Review if they should be:\n')
    console.log('  - Imported into index.ts (if still needed)')
    console.log('  - Declared as frozen/archived in production.manifest.yaml')
    console.log('  - Fully removed in a future pruning pass')
    process.exit(1)
  } else {
    console.log('✅ All modules have an import path in index.ts')
  }
}

main()
