#!/usr/bin/env node
/**
 * prevent-entropy.ts — Phase 2-D Governance CI Hooks
 *
 * Soft governance check that detects:
 * - New forbidden naming patterns (e.g. someone creating a "foo-v2" directory)
 * - New disconnected modules (created in src/ but not added to index.ts)
 * - Duplicate runtime/providers
 *
 * Outputs warnings only — does NOT block builds.
 *
 * Mode: soft governance (report-and-warn)
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const INDEX_PATH = path.join(SRC_PATH, 'index.ts')

const FORBIDDEN_PATTERNS = [
  /-v2$/i, /-v3$/i, /-next$/i, /-enhanced$/i, /-final$/i, /^new-/i,
]

interface Warning {
  type: string
  severity: 'warning' | 'info'
  message: string
  recommendation: string
}

function checkForbiddenNaming(): Warning[] {
  const warnings: Warning[] = []

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(entry.name)) {
          warnings.push({
            type: 'forbidden-naming',
            severity: 'warning',
            message: `Directory "${path.relative(SRC_PATH, full)}" matches forbidden pattern`,
            recommendation: `Rename to avoid suffix pattern (${pattern.source}). Use in-module refactoring instead.`,
          })
        }
      }
      scan(full)
    }
  }

  scan(SRC_PATH)
  return warnings
}

function checkDisconnectedModules(): Warning[] {
  const warnings: Warning[] = []
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8')

  const dirs = fs.readdirSync(SRC_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name)

  for (const dir of dirs) {
    if (!indexContent.includes(dir) && 
        !['routes', 'services', 'utils', 'plugins', 'config', 'types', 'tests', 'schemas', 'scripts', 'prompts', 'middleware', 'storage', 'transport', 'api'].includes(dir)) {
      warnings.push({
        type: 'disconnected-module',
        severity: 'warning',
        message: `"src/${dir}" is not imported in index.ts`,
        recommendation: `Add to index.ts, or declare as frozen/archived in production.manifest.yaml and ARCHITECTURE.md`,
      })
    }
  }

  return warnings
}

function checkKnownPatterns(): Warning[] {
  const warnings: Warning[] = []

  // Check for known parallel-duplication patterns in routes/
  const routesDir = path.join(SRC_PATH, 'routes')
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))

  // Look for provider wrappers
  const servicesDir = path.join(SRC_PATH, 'services')
  const providers = fs.readdirSync(servicesDir)
    .filter(f => f.endsWith('.ts') && (f.includes('provider') || f.includes('llm') || f.includes('image') || f.includes('video') || f.includes('tts')))

  const aliProviders = providers.filter(f => f.toLowerCase().includes('aliyun') || f.toLowerCase().includes('ali'))
  const volcProviders = providers.filter(f => f.toLowerCase().includes('volc') || f.toLowerCase().includes('huoshan'))

  if (aliProviders.length > 2) {
    warnings.push({
      type: 'duplicate-provider',
      severity: 'info',
      message: `${aliProviders.length} aliyun-related provider wrappers found: ${aliProviders.join(', ')}`,
      recommendation: `Consolidate aliyun providers into fewer files. One provider = one wrapper.`,
    })
  }

  if (volcProviders.length > 2) {
    warnings.push({
      type: 'duplicate-provider',
      severity: 'info',
      message: `${volcProviders.length} volcengine-related provider wrappers found`,
      recommendation: `Same consolidation recommendation.`,
    })
  }

  return warnings
}

function main() {
  console.log('# Governance Entropy Check')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  const allWarnings: Warning[] = [
    ...checkForbiddenNaming(),
    ...checkDisconnectedModules(),
    ...checkKnownPatterns(),
  ]

  if (allWarnings.length === 0) {
    console.log('✅ No governance warnings\n')
    return
  }

  const warnings = allWarnings.filter(w => w.severity === 'warning')
  const infos = allWarnings.filter(w => w.severity === 'info')

  if (warnings.length > 0) {
    console.log(`## ⚠️ Warnings (${warnings.length})\n`)
    for (const w of warnings) {
      console.log(`  [${w.type}] ${w.message}`)
      console.log(`    → ${w.recommendation}`)
      console.log()
    }
  }

  if (infos.length > 0) {
    console.log(`## ℹ️ Info (${infos.length})\n`)
    for (const w of infos) {
      console.log(`  [${w.type}] ${w.message}`)
      console.log(`    → ${w.recommendation}`)
      console.log()
    }
  }

  console.log(`Summary: ${warnings.length} warnings, ${infos.length} info items`)
  console.log()
  console.log('This is soft governance. No automatic actions taken.')
}

main()
