#!/usr/bin/env node
/**
 * build-ownership-map.ts — Phase 4.1 Output
 *
 * Scans all files for __RUNTIME_OWNER__ and produces:
 * 1. ownership-map.json — full ownership registry
 * 2. execution-domains.json — domain aggregation
 *
 * Mode: read-only
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../../backend/src')
const REPORTS = path.resolve(import.meta.dirname, '../../reports/execution-graph')

interface OwnerExport {
  entry: string
  mode: string
}

interface OwnerRecord {
  file: string
  owner: OwnerExport
}

function scanOwners(dir: string): OwnerRecord[] {
  const results: OwnerRecord[] = []

  function scan(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(d, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        const content = fs.readFileSync(full, 'utf-8')
        const match = content.match(/__RUNTIME_OWNER__\s*=\s*(\{[^}]+\})/)
        if (match) {
          try {
            const owner = JSON.parse(match[1]) as OwnerExport
            results.push({
              file: path.relative(ROOT, full),
              owner,
            })
          } catch {
            console.warn(`  Parse error in ${full}`)
          }
        }
      } else if (entry.isDirectory()) {
        scan(full)
      }
    }
  }

  scan(dir)
  return results
}

function main() {
  console.log('# Phase 4.1 — Build Ownership Map\n')

  const records = scanOwners(ROOT)
  console.log(`  Files with owner: ${records.length}\n`)

  // Sort by file
  records.sort((a, b) => a.file.localeCompare(b.file))

  // Build domain aggregation
  const byMode: Record<string, { count: number; entries: Set<string>; files: string[] }> = {}
  const byEntry: Record<string, { count: number; modes: Set<string>; files: string[] }> = {}

  for (const r of records) {
    const { mode, entry } = r.owner
    if (!byMode[mode]) byMode[mode] = { count: 0, entries: new Set(), files: [] }
    byMode[mode].count++
    byMode[mode].entries.add(entry)
    byMode[mode].files.push(r.file)

    if (!byEntry[entry]) byEntry[entry] = { count: 0, modes: new Set(), files: [] }
    byEntry[entry].count++
    byEntry[entry].modes.add(mode)
    byEntry[entry].files.push(r.file)
  }

  // Summary
  console.log('  By Mode:')
  console.log('  ' + '-'.repeat(50))
  for (const [mode, stats] of Object.entries(byMode).sort()) {
    console.log(`    ${mode.padEnd(10)} ${String(stats.count).padEnd(5)} entries: [${[...stats.entries].join(', ')}]`)
  }
  console.log()

  console.log('  By Entry:')
  console.log('  ' + '-'.repeat(50))
  for (const [entry, stats] of Object.entries(byEntry).sort()) {
    console.log(`    ${entry.padEnd(25)} ${String(stats.count).padEnd(4)} modes: [${[...stats.modes].join(', ')}]`)
  }
  console.log()

  // Save ownership-map.json
  const ownershipMap = {
    summary: {
      totalFiles: records.length,
      byMode: Object.fromEntries(
        Object.entries(byMode).map(([m, s]) => [m, { count: s.count, entries: [...s.entries] }])
      ),
      byEntry: Object.fromEntries(
        Object.entries(byEntry).map(([e, s]) => [e, { count: s.count, modes: [...s.modes] }])
      ),
    },
    records: records.map(r => ({ file: r.file, owner: r.owner })),
    timestamp: new Date().toISOString(),
  }

  const mapPath = path.join(REPORTS, 'ownership-map.json')
  fs.writeFileSync(mapPath, JSON.stringify(ownershipMap, null, 2))
  console.log(`  Written: ${mapPath}\n`)

  // Save execution-domains.json
  const executionDomains = {
    domains: {
      SYNC: {
        entry: 'narrative-gateway',
        description: 'Synchronous LLM/inference execution. All routes converge here.',
        fileCount: byMode['SYNC']?.count || 0,
        entries: [...(byMode['SYNC']?.entries || [])],
      },
      ASYNC: {
        entry: 'narrative-gateway',
        description: 'Asynchronous job-based execution (BullMQ).',
        fileCount: byMode['ASYNC']?.count || 0,
        entries: [...(byMode['ASYNC']?.entries || [])],
      },
      WORKER: {
        entry: 'worker-registry',
        description: 'Background job workers. Must register via worker-registry.',
        fileCount: byMode['WORKER']?.count || 0,
        entries: [...(byMode['WORKER']?.entries || [])],
      },
      TOOL: {
        entry: 'provider.registry',
        description: 'AI provider implementations. Must register via provider.registry.',
        fileCount: byMode['TOOL']?.count || 0,
        entries: [...(byMode['TOOL']?.entries || [])],
      },
      OBSERVE: {
        entry: 'director-api',
        description: 'Observability & analytics only. No execution routing allowed.',
        fileCount: byMode['OBSERVE']?.count || 0,
        entries: [...(byMode['OBSERVE']?.entries || [])],
      },
      LEGACY: {
        entry: 'various',
        description: 'Frozen/archived modules. No new code. Read-only usage only.',
        fileCount: byMode['LEGACY']?.count || 0,
        entries: [...(byMode['LEGACY']?.entries || [])],
      },
      SHADOW: {
        entry: 'various',
        description: 'Frozen-with-coupling modules. Read-only. New imports forbidden.',
        fileCount: byMode['SHADOW']?.count || 0,
        entries: [...(byMode['SHADOW']?.entries || [])],
      },
    },
    summary: {
      totalFiles: records.length,
      modeCount: Object.keys(byMode).length,
    },
    timestamp: new Date().toISOString(),
  }

  const domainsPath = path.join(REPORTS, 'execution-domains.json')
  fs.writeFileSync(domainsPath, JSON.stringify(executionDomains, null, 2))
  console.log(`  Written: ${domainsPath}`)
}

main()
