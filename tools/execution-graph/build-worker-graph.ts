#!/usr/bin/env node
/**
 * build-worker-graph.ts — Phase 3-A Execution Graph Build
 *
 * Maps: Worker registration → Job queue → Execution chain
 * Identifies:
 * - Active worker processes
 * - Worker-to-worker dependencies
 * - Worker scheduling frequency
 * - Worker registration in index.ts
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const OUTPUT_PATH = path.join(ROOT, 'reports/execution-graph/worker-graph.json')

interface WorkerEntry {
  file: string
  size: number
  name: string
  isJobWorker: boolean
  imports: string[]
  exports: string[]
  jobType: string | null
  references: string[]
}

function isJobWorker(content: string): { is: boolean; jobType: string | null } {
  const hasWorker = content.includes('Worker') && (content.includes('job') || content.includes('BullMQ') || content.includes('queue'))
  const typeMatch = content.match(/jobType\s*[:=]\s*['"]([^'"]+)['"]/)
  return { is: hasWorker || !!typeMatch, jobType: typeMatch?.[1] || null }
}

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const imports: string[] = []
  const regex = /from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (!match[1].startsWith('.')) {
      imports.push(match[1])
    }
  }
  return imports
}

function extractExports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const exports: string[] = []
  const regex = /^export\s+(?:const|function|class|let|var|default)\s+(\w+)/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    exports.push(match[1])
  }
  return exports
}

function main() {
  console.log('# Phase 3-A: Worker Execution Graph')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const workers: WorkerEntry[] = []
  const allImports: Map<string, string[]> = new Map()

  // Scan entire src/ for worker-related files
  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts') && 
          (entry.name.includes('worker') || entry.name.includes('worker'))) {
        const content = fs.readFileSync(full, 'utf-8')
        const { is, jobType } = isJobWorker(content)
        const imports = extractImports(full)
        const exports = extractExports(full)
        const relative = path.relative(SRC_PATH, full)

        workers.push({
          file: relative,
          size: content.length,
          name: entry.name.replace('.ts', ''),
          isJobWorker: is,
          imports,
          exports,
          jobType,
          references: [],
        })
      } else if (entry.isDirectory()) {
        scan(full)
      }
    }
  }

  scan(SRC_PATH)

  // Find references to each worker in non-worker files
  for (const w of workers) {
    const workerName = w.name.replace('.ts', '')
    // Search all .ts files for references
    function findRefs(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const full = path.join(dir, entry.name)
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(full, 'utf-8')
          if (content.includes(workerName) && !full.endsWith(w.file.replace(/^.*\//, ''))) {
            w.references.push(path.relative(SRC_PATH, full))
          }
        } else if (entry.isDirectory()) {
          findRefs(full)
        }
      }
    }
    findRefs(SRC_PATH)
  }

  const activeWorkers = workers.filter(w => w.references.length > 0 || w.isJobWorker)
  const orphanWorkers = workers.filter(w => w.references.length === 0 && !w.isJobWorker)

  console.log('## Workers with References\n')
  for (const w of activeWorkers.sort((a, b) => b.references.length - a.references.length)) {
    console.log(`  ${w.file}`)
    console.log(`    type:  ${w.isJobWorker ? 'JOB WORKER' : 'SERVICE'}`)
    if (w.jobType) console.log(`    job:   ${w.jobType}`)
    console.log(`    refs:  ${w.references.length} file(s)`)
    console.log(`    size:  ${(w.size / 1024).toFixed(1)} KB`)
    console.log()
  }

  console.log('## Orphan Workers (no references)\n')
  for (const w of orphanWorkers) {
    console.log(`  ${w.file} (${(w.size / 1024).toFixed(1)} KB)`)
  }
  console.log()

  // Worker interconnection matrix
  console.log('## Worker Dependencies\n')
  for (const w of activeWorkers) {
    const workerDeps = w.imports.filter(i => i.includes('worker') || i.includes('Worker') || i.includes('job') || i.includes('queue'))
    for (const dep of workerDeps) {
      console.log(`  ${w.file} → ${dep}`)
    }
  }
  console.log()

  // Save
  const output = {
    summary: {
      totalWorkers: workers.length,
      activeWorkers: activeWorkers.length,
      orphanWorkers: orphanWorkers.length,
      jobWorkers: workers.filter(w => w.isJobWorker).length,
    },
    workers: workers.map(w => ({
      file: w.file,
      sizeBytes: w.size,
      isJobWorker: w.isJobWorker,
      jobType: w.jobType,
      referenceCount: w.references.length,
      references: w.references.slice(0, 10),
      exports: w.exports,
    })),
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)

  console.log('Summary:')
  console.log(`  Total workers:    ${workers.length}`)
  console.log(`  Active:           ${activeWorkers.length}`)
  console.log(`  Orphan:           ${orphanWorkers.length}`)
  console.log(`  Job workers:      ${workers.filter(w => w.isJobWorker).length}`)
}

main()
