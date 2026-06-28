#!/usr/bin/env node
/**
 * prisma-usage-scan.ts — Phase 2-C Database Reality Audit
 *
 * Scans the Prisma schema and cross-references against:
 * - TypeScript usage (which models are imported by runtime code)
 * - Route usage (which models appear in route handlers)
 * - Service usage (which models appear in service files)
 *
 * Produces a reality audit of which tables are actually in use vs. orphaned.
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SCHEMA_PATH = path.join(ROOT, 'backend/prisma/schema.prisma')
const SRC_PATH = path.join(ROOT, 'backend/src')
const OUTPUT_PATH = path.join(ROOT, 'reports/database/active-models.json')

interface ModelInfo {
  modelName: string
  inSchema: boolean
  schemaLine: number
  tsReferences: string[]
  humanReadable: string
}

function extractModelsFromSchema(schemaPath: string): Map<string, number> {
  const models = new Map<string, number>()
  const content = fs.readFileSync(schemaPath, 'utf-8')
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    const match = line.match(/^model\s+(\w+)\s*\{/)
    if (match) {
      models.set(match[1], i + 1)
    }
  })
  return models
}

function findReferences(searchName: string, files: [string, string][]): string[] {
  const refs: string[] = []
  for (const [file, content] of files) {
    // Look for the model name being used as a prisma query target
    // e.g. prisma.user.findMany, prisma.project.create, etc.
    const patterns = [
      new RegExp(`prisma\\.${searchName}\\.`, 'g'),
      new RegExp(`prisma\\.${searchName[0].toLowerCase() + searchName.slice(1)}\\.`, 'g'),
      new RegExp(`include\\s*:\\s*\\{[^}]*${searchName}[^}]*\\}`, 'g'),
      new RegExp(`\\b${searchName}\\b`, 'g'),
    ]

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        refs.push(file)
        break
      }
    }
  }
  return [...new Set(refs)]
}

function collectTsFiles(dir: string, basePath: string, maxDepth = 10): [string, string][] {
  if (maxDepth <= 0) return []
  const result: [string, string][] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        result.push([path.relative(basePath, full), fs.readFileSync(full, 'utf-8')])
      } else if (entry.isDirectory()) {
        result.push(...collectTsFiles(full, basePath, maxDepth - 1))
      }
    }
  } catch {}
  return result
}

function main() {
  console.log('# Prisma Usage Reality Audit')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const schemaModels = extractModelsFromSchema(SCHEMA_PATH)
  console.log(`Models defined in schema.prisma: ${schemaModels.size}\n`)

  const tsFiles = collectTsFiles(SRC_PATH, SRC_PATH)
  console.log(`TypeScript files scanned: ${tsFiles.length}\n`)

  const results: ModelInfo[] = []
  let referenced = 0
  let orphaned = 0

  for (const [modelName, lineNum] of schemaModels) {
    const refs = findReferences(modelName, tsFiles)
    const info: ModelInfo = {
      modelName,
      inSchema: true,
      schemaLine: lineNum,
      tsReferences: refs,
      humanReadable: refs.length > 0 ? `referenced by ${refs.length} file(s)` : '⚠️ ORPHAN — no runtime references',
    }
    results.push(info)
    if (refs.length > 0) {
      referenced++
    } else {
      orphaned++
    }
  }

  // Print orphaned models
  const orphans = results.filter(r => r.tsReferences.length === 0)
  console.log('## Orphaned Models (in schema but no runtime references)\n')
  for (const o of orphans) {
    console.log(`  ${o.modelName} (line ${o.schemaLine})`)
  }
  console.log()

  // Print heavily referenced models
  const active = results.filter(r => r.tsReferences.length > 0).sort((a, b) => b.tsReferences.length - a.tsReferences.length)
  console.log('## Active Models (by reference count)\n')
  for (const a of active.slice(0, 20)) {
    console.log(`  ${a.modelName} — referenced by ${a.tsReferences.length} file(s)`)
  }
  if (active.length > 20) {
    console.log(`  ... and ${active.length - 20} more active models`)
  }
  console.log()

  // Summary
  console.log('## Summary\n')
  console.log(`  Total models in schema: ${schemaModels.size}`)
  console.log(`  Referenced in runtime:   ${referenced}`)
  console.log(`  Orphaned (no refs):      ${orphaned}`)
  console.log(`  Orphan rate:             ${(orphaned / schemaModels.size * 100).toFixed(1)}%`)
  console.log()

  // Save
  const output = {
    summary: {
      totalModels: schemaModels.size,
      referenced,
      orphaned,
      orphanRate: Number((orphaned / schemaModels.size * 100).toFixed(1)),
    },
    models: results.map(r => ({
      modelName: r.modelName,
      schemaLine: r.schemaLine,
      referenceCount: r.tsReferences.length,
      referencedBy: r.tsReferences.slice(0, 10),
      status: r.tsReferences.length > 0 ? 'active' : 'orphan',
    })),
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  fs.writeFileSync(
    path.join(ROOT, 'reports/database/orphan-models.json'),
    JSON.stringify(
      orphans.map(o => ({ modelName: o.modelName, schemaLine: o.schemaLine })),
      null,
      2
    )
  )
  console.log(`Written to: ${OUTPUT_PATH}`)
  console.log(`Orphan list: reports/database/orphan-models.json\n`)

  if (orphaned > 0) {
    console.log('⚠️  Orphaned models found. Do NOT drop tables without:')
    console.log('  1. Verifying they are truly unused in production DB')
    console.log('  2. Checking migration history for dependencies')
    console.log('  3. Manual review of each model')
    process.exit(1)
  } else {
    console.log('✅ All models have runtime references')
  }
}

main()
