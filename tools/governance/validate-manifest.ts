#!/usr/bin/env node
/**
 * validate-manifest.ts — Phase 2-A Governance Validator
 *
 * Checks:
 * 1. All directories listed in production.manifest.yaml actually exist
 * 2. All src/ directories are classified (no unclassified modules)
 * 3. Reports any discrepancies
 *
 * Mode: report-only
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MANIFEST_PATH = path.join(ROOT, 'production.manifest.yaml')
const SRC_PATH = path.join(ROOT, 'backend/src')

type Category = 'production_modules' | 'frozen_modules' | 'experimental_modules' | 'archived_modules' | 'unclassified'

interface Manifest {
  production_modules: string[]
  frozen_modules: string[]
  experimental_modules: string[]
  archived_modules: string[]
  unclassified: string[]
}

function parseManifest(filePath: string): Manifest {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const result: Manifest = {
    production_modules: [],
    frozen_modules: [],
    experimental_modules: [],
    archived_modules: [],
    unclassified: [],
  }

  let currentKey: Category | null = null
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed === '') continue

    const keyMatch = trimmed.match(/^(\w+):/)
    if (keyMatch) {
      const key = keyMatch[1] as Category
      if (key in result) {
        currentKey = key
      } else {
        currentKey = null
      }
      continue
    }

    if (currentKey && trimmed.startsWith('- ')) {
      // Remove inline comments (# ... )
      const raw = trimmed.slice(2).trim().replace(/^src\//, '')
      const value = raw.split('#')[0].trim()
      if (value) {
        result[currentKey].push(value)
      }
    }
  }

  return result
}

function getActualDirectories(srcPath: string): string[] {
  return fs.readdirSync(srcPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith('.') && name !== 'node_modules')
    .sort()
}

function main() {
  console.log('# Manifest Validation Report')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const manifest = parseManifest(MANIFEST_PATH)
  const actualDirs = getActualDirectories(SRC_PATH)

  const allClassified = new Set([
    ...manifest.production_modules,
    ...manifest.frozen_modules,
    ...manifest.experimental_modules,
    ...manifest.archived_modules,
    ...manifest.unclassified,
  ])

  // Check 1: All listed directories exist
  let missingCount = 0
  console.log('## 1. Listed directories that do not exist in src/\n')
  for (const cat of Object.keys(manifest) as Category[]) {
    for (const dir of manifest[cat]) {
      const full = path.join(SRC_PATH, dir)
      if (!fs.existsSync(full)) {
        console.log(`  [MISSING] ${cat}: ${dir} → ${full} does not exist on disk`)
        missingCount++
      }
    }
  }
  if (missingCount === 0) console.log('  ✅ All listed directories exist on disk\n')

  // Check 2: Unclassified directories
  const unclassified = actualDirs.filter(d => !allClassified.has(d))
  console.log('## 2. Unclassified directories (in src/ but not in manifest)\n')
  if (unclassified.length === 0) {
    console.log('  ✅ All directories are classified\n')
  } else {
    for (const dir of unclassified) {
      console.log(`  [UNCLASSIFIED] ${dir} — not listed in production.manifest.yaml`)
    }
    console.log()
  }

  // Summary
  console.log('## 3. Summary\n')
  console.log(`  Production modules:   ${manifest.production_modules.length}`)
  console.log(`  Frozen modules:       ${manifest.frozen_modules.length}`)
  console.log(`  Experimental modules: ${manifest.experimental_modules.length}`)
  console.log(`  Archived modules:     ${manifest.archived_modules.length}`)
  console.log(`  Unclassified:         ${unclassified.length}`)
  console.log(`  Total actual dirs:    ${actualDirs.length}`)
  console.log(`  Missing from disk:    ${missingCount}`)
  console.log()

  if (missingCount > 0 || unclassified.length > 0) {
    console.log('⚠️  Discrepancies found — review and update production.manifest.yaml or ARCHITECTURE.md')
    process.exit(1)
  } else {
    console.log('✅ Manifest is consistent with disk state')
  }
}

main()
