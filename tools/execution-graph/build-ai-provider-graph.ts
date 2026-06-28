#!/usr/bin/env node
/**
 * build-ai-provider-graph.ts — Phase 3-A Execution Graph Build
 *
 * Maps the AI provider invocation graph:
 * - Which route/service invokes which provider
 * - Which provider types exist (LLM / Image / TTS / Video)
 * - Provider call frequency / usage patterns
 * - Provider fallback chains
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const OUTPUT_PATH = path.join(ROOT, 'reports/execution-graph/provider-graph.json')

interface ProviderInfo {
  file: string
  name: string
  providerType: 'llm' | 'image' | 'tts' | 'video' | 'music' | 'other'
  vendor: string
  sizeBytes: number
  exports: string[]
  imports: string[]
  referencedBy: string[]
}

function classifyProvider(file: string): { vendor: string; type: ProviderInfo['providerType'] } {
  const lower = file.toLowerCase()
  let vendor = 'unknown'
  if (lower.includes('aliyun') || lower.includes('ali')) vendor = 'aliyun'
  else if (lower.includes('volcengine') || lower.includes('volc')) vendor = 'volcengine'
  else if (lower.includes('siliconflow') || lower.includes('silicon')) vendor = 'siliconflow'
  else if (lower.includes('mureka')) vendor = 'mureka'
  else if (lower.includes('music') || lower.includes('suno')) vendor = 'suno'
  else if (lower.includes('deepseek')) vendor = 'deepseek'
  else if (lower.includes('openai')) vendor = 'openai'
  else if (lower.includes('replicate')) vendor = 'replicate'

  let type: ProviderInfo['providerType'] = 'other'
  if (lower.includes('llm') || lower.includes('deepseek') || lower.includes('openai')) type = 'llm'
  else if (lower.includes('image')) type = 'image'
  else if (lower.includes('tts') || lower.includes('voice')) type = 'tts'
  else if (lower.includes('video')) type = 'video'
  else if (lower.includes('music')) type = 'music'

  return { vendor, type }
}

function extractExports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const exports: string[] = []
  const regex = /^export\s+(?:const|function|class|let|var|default|async\s+function)\s+(\w+)/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    exports.push(match[1])
  }
  return exports
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

function findProviderReferences(vendorName: string, providerType: string, allFiles: [string, string][]): string[] {
  const refs: string[] = []
  // Search patterns like "volcengine-image.provider", "aliyun-tts"
  const pattern = `${vendorName}-${providerType}`
  const pattern2 = `${vendorName}.${providerType}`

  for (const [file, content] of allFiles) {
    if (content.includes(pattern) || content.includes(pattern2) || 
        content.includes(`${vendorName}Image`) || content.includes(`${vendorName}Video`) ||
        content.includes(`${vendorName}Tts`) || content.includes(`${vendorName}LLM`)) {
      refs.push(file)
    }
  }
  return refs
}

function main() {
  console.log('# Phase 3-A: AI Provider Invocation Graph')
  console.log(`Generated: new Date().toISOString()\n}`)

  // Find all provider files
  const providers: ProviderInfo[] = []
  const allFiles: [string, string][] = []

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        allFiles.push([path.relative(SRC_PATH, full), fs.readFileSync(full, 'utf-8')])
        if (entry.name.includes('.provider.')) {
          const { vendor, type } = classifyProvider(entry.name)
          const exports = extractExports(full)
          const imports = extractImports(full)
          providers.push({
            file: path.relative(SRC_PATH, full),
            name: entry.name.replace('.ts', ''),
            providerType: type,
            vendor,
            sizeBytes: fs.statSync(full).size,
            exports,
            imports,
            referencedBy: [],
          })
        }
      } else if (entry.isDirectory()) {
        scan(full)
      }
    }
  }

  scan(SRC_PATH)

  // Find references to each provider
  for (const p of providers) {
    const baseName = p.name
    const refs = allFiles
      .filter(([file]) => !file.includes(p.file))
      .filter(([_, content]) => content.includes(baseName))
      .map(([file]) => file)

    // Also search by export name
    for (const exp of p.exports) {
      for (const [file, content] of allFiles) {
        if (!refs.includes(file) && !file.includes(p.file) && content.includes(exp)) {
          refs.push(file)
        }
      }
    }

    p.referencedBy = [...new Set(refs)]
  }

  const referenced = providers.filter(p => p.referencedBy.length > 0)
  const orphan = providers.filter(p => p.referencedBy.length === 0)

  console.log('## Provider Reference Count\n')
  for (const p of [...referenced].sort((a, b) => b.referencedBy.length - a.referencedBy.length)) {
    console.log(`  ${p.vendor}/${p.providerType}: ${p.name}`)
    console.log(`    refs: ${p.referencedBy.length} file(s), exports: ${p.exports.join(', ')}`)
    console.log()
  }

  console.log('## Orphan Providers (zero references)\n')
  for (const p of orphan) {
    console.log(`  ${p.name} (${p.vendor}/${p.providerType}) — ${(p.sizeBytes / 1024).toFixed(1)} KB`)
  }
  console.log()

  // Provider type stats
  const byType: Record<string, number> = {}
  const byVendor: Record<string, number> = {}
  for (const p of providers) {
    byType[p.providerType] = (byType[p.providerType] || 0) + 1
    byVendor[p.vendor] = (byVendor[p.vendor] || 0) + 1
  }

  console.log('## Providers by Type\n')
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${type}: ${count}`)
  }
  console.log()

  console.log('## Providers by Vendor\n')
  for (const [vendor, count] of Object.entries(byVendor).sort()) {
    console.log(`  ${vendor}: ${count}`)
  }
  console.log()

  // Save
  const output = {
    summary: {
      totalProviders: providers.length,
      referenced: referenced.length,
      orphan: orphan.length,
      byType,
      byVendor,
    },
    providers: providers.map(p => ({
      file: p.file,
      name: p.name,
      vendor: p.vendor,
      type: p.providerType,
      sizeBytes: p.sizeBytes,
      exports: p.exports,
      referenceCount: p.referencedBy.length,
      referencedBy: p.referencedBy.slice(0, 10),
    })),
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)

  console.log('Summary:')
  console.log(`  Total providers: ${providers.length}`)
  console.log(`  Referenced:      ${referenced.length}`)
  console.log(`  Orphan:          ${orphan.length}`)
}

main()
