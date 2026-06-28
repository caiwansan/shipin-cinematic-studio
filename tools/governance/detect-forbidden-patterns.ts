#!/usr/bin/env node
/**
 * detect-forbidden-patterns.ts — Phase 2-A Governance Validator
 *
 * Scans the entire backend/src/ directory tree for forbidden naming patterns.
 * Also scans routes/ for known forbidden evolution patterns.
 *
 * Forbidden patterns:
 *   - *-v2, *-v3          (use adapters, not parallel directories)
 *   - *-next               ("next" never becomes "now")
 *   - *-enhanced           (enhance the existing module)
 *   - *-final              (nothing is final)
 *   - new-*                (modify existing, don't create "new")
 *
 * Mode: report-only
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')

interface Violation {
  type: string
  path: string
  pattern: string
  severity: 'high' | 'medium' | 'low'
}

// Approved exceptions that should not be flagged
const KNOWN_EXCEPTIONS = new Set([
  'director-v2',   // Approved production runtime — superseded v1
])

const FORBIDDEN_PATTERNS: { pattern: RegExp; type: string; severity: 'high' | 'medium' | 'low' }[] = [
  { pattern: /-v2$/i,      type: 'parallel-version',  severity: 'high' },
  { pattern: /-v3$/i,      type: 'parallel-version',  severity: 'high' },
  { pattern: /-next$/i,    type: 'never-now',         severity: 'high' },
  { pattern: /-enhanced$/i,type: 'redundant-qualifier',severity: 'medium' },
  { pattern: /-final$/i,   type: 'false-final',       severity: 'medium' },
  { pattern: /^new-/i,     type: 'new-creation',       severity: 'medium' },
]

function scanDirectory(dir: string, basePath: string): Violation[] {
  const violations: Violation[] = []

  // Check directory name itself
  const dirName = path.basename(dir)
  if (KNOWN_EXCEPTIONS.has(dirName)) return violations  // skip known exceptions (e.g. director-v2)

  for (const fp of FORBIDDEN_PATTERNS) {
    if (fp.pattern.test(dirName)) {
      violations.push({
        type: fp.type,
        path: path.relative(basePath, dir),
        pattern: dirName,
        severity: fp.severity,
      })
    }
  }

  // Recurse
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        violations.push(...scanDirectory(path.join(dir, entry.name), basePath))
      }
    }
  } catch {
    // Permission or read error — skip
  }

  return violations
}

function main() {
  console.log('# Forbidden Pattern Detection Report')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const violations = scanDirectory(SRC_PATH, SRC_PATH)

  if (violations.length === 0) {
    console.log('✅ No forbidden naming patterns found\n')
    return
  }

  console.log('## Violations Found\n')

  // Group by severity
  const high = violations.filter(v => v.severity === 'high')
  const medium = violations.filter(v => v.severity === 'medium')
  const low = violations.filter(v => v.severity === 'low')

  const group = (list: Violation[], label: string) => {
    if (list.length === 0) return
    console.log(`### ${label}\n`)
    for (const v of list) {
      console.log(`  [${v.type}] ${v.path}`)
    }
    console.log()
  }

  group(high, '🔴 High Severity')
  group(medium, '🟡 Medium Severity')

  console.log('## Summary\n')
  console.log(`  High severity:   ${high.length}`)
  console.log(`  Medium severity: ${medium.length}`)
  console.log(`  Low severity:    ${low.length}`)
  console.log(`  Total:           ${violations.length}`)
  console.log()
  process.exit(high.length > 0 ? 1 : 0)
}

main()
