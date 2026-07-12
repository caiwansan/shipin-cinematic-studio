#!/usr/bin/env node
/**
 * Contract Linter — API Contract Drift Detection
 *
 * Phase A: Report Only (Sprint 3)
 * - Validates every canonical endpoint in API_CONTRACT.yaml exists on backend
 * - Validates every geoApi() call path is declared in Manifest
 * - Validates every direct ofetch() path matches Manifest
 * - Reports aliases pointing to nonexistent canonical targets
 *
 * Phase B (future): Fail CI on missing canonical / method mismatch
 *
 * Usage: node scripts/contract-linter.mjs [--fail]
 */

import { readFileSync, existsSync } from 'fs'
import { readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BACKEND = resolve(ROOT, '../../../backend')
const BACKEND_SRC_GEO = resolve(BACKEND, 'src/services/geo')

// ── 1. Parse Manifest ──

function loadManifest() {
  const path = resolve(ROOT, 'docs/API_CONTRACT.yaml')
  if (!existsSync(path)) {
    console.error('Missing API_CONTRACT.yaml at', path)
    process.exit(1)
  }

  const raw = readFileSync(path, 'utf-8')
  const lines = raw.split('\n')
  const endpoints = []
  let currentDomain = ''
  let currentEp = null
  const IGNORE_KEYS = new Set(['consumers', 'aliases', 'description', 'success', 'data', 'example'])

  for (const line of lines) {
    // Domain header: "  discovery:"
    const dm = line.match(/^  (\w+):$/)
    if (dm && !line.startsWith('    ')) {
      currentDomain = dm[1]
      continue
    }

    // Endpoint header: "    getReport:"
    const em = line.match(/^    (\w+):$/)
    if (em) {
      if (currentEp) finalizeEp(currentEp, endpoints)
      currentEp = { name: currentDomain + '.' + em[1], method: '', path: '', canonical: true }
      continue
    }

    // Property: "      key: value"
    if (currentEp) {
      const pm = line.match(/^\s{6}(\w+):\s*(.+)$/)
      if (pm) {
        const key = pm[1]
        if (key === 'method') currentEp.method = pm[2].trim()
        else if (key === 'path') currentEp.path = pm[2].trim()
        else if (key === 'canonical') currentEp.canonical = pm[2].trim() === 'true'
        else if (key === 'status') currentEp.status = pm[2].trim()
        else if (key === 'alias_target') currentEp.alias_target = pm[2].trim()
        else if (key === 'deprecated') currentEp.deprecated = pm[2].trim() === 'true'
        else if (key === 'decision_pending') currentEp.decision_pending = pm[2].trim()
        // If it's a nested block (like verdict:), consume all until next endpoint
        else if (IGNORE_KEYS.has(key)) { /* skip */ }
      }
    }
  }
  if (currentEp) finalizeEp(currentEp, endpoints)
  return endpoints
}

function finalizeEp(ep, endpoints) {
  if (ep.canonical === undefined) ep.canonical = ep.status !== 'unsupported'
  if (ep.method && ep.path) endpoints.push(ep)
}

// ── 2. Scan Backend Routes ──

function scanBackendRoutes() {
  const routes = []
  const dirs = [
    resolve(BACKEND_SRC_GEO, 'routes'),
  ]
  const extraFiles = [
    resolve(BACKEND_SRC_GEO, 'routes/geo-showcase.route.ts'),
    resolve(BACKEND_SRC_GEO, 'routes/geo-execution.route.ts'),
    resolve(BACKEND_SRC_GEO, 'recommendation/recommendation.route.ts'),
  ]
  // Also scan decision-intelligence directory
  const diDir = resolve(BACKEND_SRC_GEO, 'decision-intelligence')
  if (existsSync(diDir)) {
    const diFiles = readdirSync(diDir).filter(function(f) { return f.endsWith('.ts') })
    for (const file of diFiles) {
      const content = readFileSync(resolve(diDir, file), 'utf-8')
      extractRoutes(content, 'decision-intelligence/' + file, routes)
    }
  }

  for (const d of dirs) {
    if (!existsSync(d)) continue
    const files = readdirSync(d).filter(function(f) { return f.endsWith('.ts') })
    for (const file of files) {
      const content = readFileSync(resolve(d, file), 'utf-8')
      extractRoutes(content, file, routes)
    }
  }
  for (const f of extraFiles) {
    if (!existsSync(f)) continue
    const content = readFileSync(f, 'utf-8')
    extractRoutes(content, f.split('/').pop(), routes)
  }
  return routes
}

function extractRoutes(content, filename, routes) {
  const re = /(fastify|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) {
    routes.push({ method: m[2].toUpperCase(), path: m[3], file: filename })
  }
}

// ── 3. Scan Frontend API Calls ──

function scanFrontendAPICalls() {
  const calls = []
  const dirs = ['lib', 'services', 'pages', 'components']

  function walk(dir) {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = resolve(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        walk(full)
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.vue'))) {
        const content = readFileSync(full, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const g = line.match(/geoApi[<(].*?['"`]([^'"`]+)['"`]/)
          if (g && !g[1].includes('${')) {
            calls.push({ path: g[1], file: relPath(full), line: i + 1 })
          }
          const o = line.match(/ofetch\s*\(\s*['"]([^'"]*api[^'"]*)['"]/)
          if (o && (o[1].includes('/api/geo') || o[1].includes('/api/v1/geo'))) {
            calls.push({ path: o[1], file: relPath(full), line: i + 1 })
          }
          const f = line.match(/fetch\s*\(.*['"]([^'"]*\/api\/[^'"]*)['"]/)
          if (f) {
            calls.push({ path: f[1], file: relPath(full), line: i + 1 })
          }
        }
      }
    }
  }

  function relPath(full) { return full.replace(ROOT, '.') }

  for (const d of dirs) walk(resolve(ROOT, d))
  return calls
}

// ── 4. Normalize ──

function norm(p) {
  return p.replace(/^\/api\/v1\/geo/, '').replace(/^\/api\/geo/, '').replace(/\/+$/, '').split('?')[0]
}

// ── 5. Main ──

function main() {
  const failMode = process.argv.includes('--fail')
  let exitCode = 0
  const report = []
  let total = 0, pass = 0, fail = 0

  report.push('='.repeat(68))
  report.push('CONTRACT LINTER — Phase A (Report Only)')
  report.push('Mode: ' + (failMode ? 'FAIL ON ERROR' : 'REPORT ONLY'))
  report.push('='.repeat(68))
  report.push('')

  const manifest = loadManifest()
  const backendRoutes = scanBackendRoutes()
  const frontendCalls = scanFrontendAPICalls()

  report.push('Manifest: ' + manifest.length + ' endpoints')
  report.push('Backend:  ' + backendRoutes.length + ' routes')
  report.push('Frontend: ' + frontendCalls.length + ' API calls')
  report.push('')

  const canonical = manifest.filter(function(e) { return e.canonical && !e.alias_target })
  const aliases = manifest.filter(function(e) { return e.alias_target })
  const manPaths = manifest.map(function(e) { return norm(e.path) })

  // 1. Missing canonical
  report.push('── Check 1: Missing Canonical ──')
  let c1fail = 0
  for (const ep of canonical) {
    total++
    const np = norm(ep.path)
    const found = backendRoutes.some(function(r) { return norm(r.path) === np && r.method === ep.method })
    if (found) { pass++ } else { fail++; c1fail++; exitCode = 1; report.push('  MISS  ' + ep.method + ' ' + ep.path) }
  }
  report.push(c1fail === 0 ? '  OK: ' + canonical.length + '/' + canonical.length + ' endpoints matched' : '  FAIL: ' + c1fail + ' missing')
  report.push('')

  // 2. Alias validation
  report.push('── Check 2: Alias Validation ──')
  let c2fail = 0
  for (const ep of aliases) {
    total++
    const found = backendRoutes.some(function(r) { return norm(r.path) === norm(ep.path) && r.method === ep.method })
    if (found) { pass++ } else { fail++; c2fail++; exitCode = 1; report.push('  MISS  ' + ep.method + ' ' + ep.path + ' (alias)') }
  }
  report.push(c2fail === 0 ? '  OK: ' + aliases.length + '/' + aliases.length + ' aliases registered' : '  FAIL: ' + c2fail + ' missing')
  report.push('')

  // 3. Orphan backend routes
  report.push('── Check 3: Orphan Backend Routes ──')
  let c3fail = 0
  for (const route of backendRoutes) {
    if (!route.path.startsWith('/api/geo')) continue
    total++
    const np = norm(route.path)
    const found = manPaths.indexOf(np) !== -1
    if (found) { pass++ } else { fail++; c3fail++; report.push('  ORPHAN  ' + route.method + ' ' + route.path) }
  }
  report.push(c3fail === 0 ? '  OK: no orphan routes' : '  ' + c3fail + ' orphan(s)')
  report.push('')

  // 4. Frontend coverage
  report.push('── Check 4: Frontend API Call Coverage ──')
  let c4fail = 0
  const uncovered = []
  for (const call of frontendCalls) {
    total++
    const np = norm(call.path)
    const found = manPaths.indexOf(np) !== -1
    if (found) { pass++ } else { fail++; c4fail++; uncovered.push(call) }
  }
  if (c4fail > 0) {
    report.push('  UNCOVERED: ' + c4fail + ' calls not in Manifest:')
    for (const c of uncovered) report.push('     ' + c.path + '  (' + c.file + ':' + c.line + ')')
  } else {
    report.push('  OK: all ' + frontendCalls.length + ' calls covered')
  }
  report.push('')

  // Summary
  report.push('='.repeat(68))
  report.push('SUMMARY')
  report.push('-'.repeat(68))
  report.push('  Checks:     ' + total)
  report.push('  Pass:       ' + pass)
  report.push('  Fail:       ' + fail)
  report.push('  Canonical:  ' + canonical.length)
  report.push('  Aliases:    ' + aliases.length)
  report.push('  Orphans:    ' + c3fail)
  report.push('  Uncovered:  ' + c4fail)

  console.log(report.join('\n'))
  if (failMode && exitCode) { console.error('\nFAILED'); process.exit(1) }
  process.exit(0)
}

main()
