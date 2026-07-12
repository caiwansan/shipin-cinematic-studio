/**
 * GEO Architecture Linter — Core engine
 *
 * Scans workspace source files and enforces architecture rules.
 * Part of S1.1A Foundation.
 *
 * Rule Groups (P0 for S1.1A-04):
 *   1. Layer Import — enforce one-way page -> store -> service -> repository
 *   2. Token — detect hardcoded spacing/color/radius, suggest token replacement
 *   3. Mock Data — detect mock/fake/placeholder patterns
 *   4. Console — detect console.log/console.debug (permit console.error)
 *   5. AgentResponse — bare return objects in services
 *   6. Prisma Boundary — PrismaCli ent/$queryRaw only in repository/
 *
 * Usage:
 *   node scripts/lint.mjs           # list violations
 *   node scripts/lint.mjs --fix     # print autofix suggestions
 *   node scripts/lint.mjs --ci      # exit 0 = clean, 1 = violations
 *
 * Exit code: 0 = clean, 1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, relative, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WORKSPACE_ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const CI_MODE = args.includes('--ci')
const FIX_MODE = args.includes('--fix')

const results = []

function report(r) {
  results.push(r)
  const loc = `${relative(WORKSPACE_ROOT, r.file)}:${r.line}:${r.column}`
  console.error(`  [${r.rule}] ${loc}`)
  console.error(`         ${r.message}`)
  if (r.suggestion && FIX_MODE) {
    console.error(`         Suggestion: ${r.suggestion}`)
  }
}

// ── File discovery (no deps) ──

const EXTENSIONS = new Set(['.vue', '.ts'])
const IGNORE_DIRS = new Set(['node_modules', '.nuxt', '.output', 'generated', 'scripts'])

function collectFiles(dir, baseRel) {
  baseRel = baseRel || ''
  const files = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relPath = baseRel ? join(baseRel, entry.name) : entry.name

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        files.push(...collectFiles(fullPath, relPath))
      }
    } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function getLine(source, lineNum) {
  const lines = source.split('\n')
  return lines[lineNum - 1] || ''
}

// ── Rule 1: Layer Import ──

const LAYER_PATTERNS = [
  { dir: '/pages/',       allowed: ['stores'] },
  { dir: '/stores/',      allowed: ['services', 'lib', 'config', 'composables', 'types'] },
  { dir: '/services/',    allowed: ['repository', 'lib', 'config', 'types'] },
  { dir: '/repository/',  allowed: [] },
]

const ALWAYS_OK = new Set(['lib', 'config', 'types', 'composables'])

function checkLayerImports(source, filePath) {
  const relPath = '/' + relative(WORKSPACE_ROOT, filePath).replace(/\\/g, '/')
  const layer = LAYER_PATTERNS.find(l => relPath.includes(l.dir))
  if (!layer) return

  const re = /from\s+['"]\.\.?\/(\w+)/g
  let m
  while ((m = re.exec(source)) !== null) {
    const imported = m[1]
    const before = source.slice(0, m.index)
    const line = before.split('\n').length
    const col = m.index - (before.lastIndexOf('\n') + 1)

    if (relPath.includes('/' + imported + '/')) continue
    if (ALWAYS_OK.has(imported)) continue
    if (layer.allowed.includes(imported)) continue

    report({
      file: filePath, line, column: col,
      rule: 'layer-import',
      message: `"${relPath}" imports from "${imported}/" — allowed: [${layer.allowed.join(', ')}]`,
    })
  }
}

// ── Rule 2: Token Detection ──

const TOKEN_RULES = [
  { re: /(padding|margin|gap|top|left|right|bottom|width|height|font-size)\s*:\s*(\d+)px/gi, desc: 'hardcoded pixel spacing' },
  { re: /(border-radius|rounded)\s*:\s*(\d+)px/gi, desc: 'hardcoded border radius' },
  { re: /background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8}/gi, desc: 'hardcoded hex color (background)' },
  { re: /color\s*:\s*#[0-9a-fA-F]{3,8}/gi, desc: 'hardcoded hex color' },
  { re: /border\s*:\s*\d+px\s+solid\s+#[0-9a-fA-F]{3,8}/gi, desc: 'hardcoded border color' },
  { re: /box-shadow\s*:\s*[^;]+/gi, desc: 'hardcoded box-shadow' },
  { re: /z-index\s*:\s*\d+/gi, desc: 'hardcoded z-index' },
]

function checkTokens(source, filePath) {
  if (filePath.includes('/generated/')) return

  for (const rule of TOKEN_RULES) {
    let m
    while ((m = rule.re.exec(source)) !== null) {
      const before = source.slice(0, m.index)
      const line = before.split('\n').length
      const col = m.index - (before.lastIndexOf('\n') + 1)

      report({
        file: filePath, line, column: col,
        rule: 'token-usage',
        message: `${rule.desc} in "${m[0].trim()}"`,
        suggestion: 'Use --geo-* CSS custom property from generated/geo-design-tokens.css',
      })
    }
  }
}

// ── Rule 3: Mock Data ──

const MOCK_RE = /\b(mock|fake|placeholder)\b/i

function checkMockData(source, filePath) {
  const seen = new Set()

  let m
  while ((m = MOCK_RE.exec(source)) !== null) {
    const before = source.slice(0, m.index)
    const line = before.split('\n').length
    const col = m.index - (before.lastIndexOf('\n') + 1)
    const lc = getLine(source, line).trim()

    if (lc.startsWith('//') || lc.startsWith('*') || lc.startsWith('/*')) continue
    if (lc.includes('placeholder=')) continue

    const key = filePath + ':' + line
    if (seen.has(key)) continue
    seen.add(key)

    report({
      file: filePath, line, column: col,
      rule: 'mock-data',
      message: `Potential mock/fake/placeholder data: "${lc.slice(0, 80)}"`,
      suggestion: 'Replace with data from stores/services or AgentResponse',
    })
  }
}

// ── Rule 4: Console ──

function checkConsole(source, filePath) {
  const patterns = [
    { re: /console\.log\s*\(/g, name: 'console.log' },
    { re: /console\.debug\s*\(/g, name: 'console.debug' },
  ]

  for (const p of patterns) {
    let m
    while ((m = p.re.exec(source)) !== null) {
      const before = source.slice(0, m.index)
      const line = before.split('\n').length
      const col = m.index - (before.lastIndexOf('\n') + 1)
      if (filePath.includes('middleware.ts')) continue

      report({
        file: filePath, line, column: col,
        rule: 'console-usage',
        message: `${p.name}: "${getLine(source, line).trim().slice(0, 80)}"`,
        suggestion: 'Use EventBus dev logger (middleware.ts) or remove before commit',
      })
    }
  }
}

// ── Rule 5: AgentResponse ──

function checkAgentResponse(source, filePath) {
  if (!filePath.includes('/services/')) return

  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const bare = lines[i].match(/return\s*\{/)
    if (!bare) continue

    const start = Math.max(0, i - 8)
    const ctx = lines.slice(start, i + 1).join('\n')
    if (ctx.includes('AgentResponse') || ctx.includes('agentResponse')) continue

    const funcLine = lines.slice(start, i).find(l => l.includes('function') || l.includes('=>') || l.includes(':'))
    if (!funcLine) continue

    const col = lines[i].search(/return/) + 1
    report({
      file: filePath, line: i + 1, column: col,
      rule: 'agent-response',
      message: `Bare return object without AgentResponse: "${lines[i].slice(0, 60)}"`,
      suggestion: 'Wrap with AgentResponse: return { success: true, data: ... }',
    })
  }
}

// ── Rule 6: Prisma Boundary ──

const PRISMA_RE = [
  { re: /from\s+['"].*@prisma\/client['"]/g, name: '@prisma/client import' },
  { re: /\bprisma\.\w+/g, name: 'prisma.* usage' },
  { re: /\$queryRaw/g, name: '$queryRaw' },
  { re: /\$executeRaw/g, name: '$executeRaw' },
]

function checkPrismaBoundary(source, filePath) {
  if (filePath.includes('/repository/')) return

  for (const p of PRISMA_RE) {
    let m
    while ((m = p.re.exec(source)) !== null) {
      const before = source.slice(0, m.index)
      const line = before.split('\n').length
      const col = m.index - (before.lastIndexOf('\n') + 1)

      report({
        file: filePath, line, column: col,
        rule: 'prisma-boundary',
        message: `${p.name} outside repository/`,
        suggestion: 'Move Prisma access to repository/. Services go through repository.',
      })
    }
  }
}

// ── Main ──

function main() {
  const files = collectFiles(WORKSPACE_ROOT)
  console.error(`[geo-linter] Scanning ${files.length} files in ${WORKSPACE_ROOT}...\n`)

  for (const file of files) {
    const source = readFileSync(file, 'utf-8')
    checkLayerImports(source, file)
    checkTokens(source, file)
    checkMockData(source, file)
    checkConsole(source, file)
    checkAgentResponse(source, file)
    checkPrismaBoundary(source, file)
  }

  const fileCount = new Set(results.map(r => r.file)).size
  console.error(`\n[geo-linter] ${results.length} violations across ${fileCount} files`)

  if (results.length > 0) {
    const byRule = {}
    for (const r of results) { byRule[r.rule] = (byRule[r.rule] || 0) + 1 }
    console.error('\nBreakdown:')
    for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
      console.error(`  ${rule}: ${count}`)
    }
    if (CI_MODE) process.exit(1)
  } else {
    console.error('No violations.')
    process.exit(0)
  }
}

main()
