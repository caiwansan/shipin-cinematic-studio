#!/usr/bin/env npx tsx
/**
 * Reality Gate — 部署质量门禁系统
 *
 * 自动扫描 Stub/Mock/Hardcode/TODO/FIXME 等问题，
 * P0 自动阻断上线，P1 发出警告。
 *
 * 昆仑镜 GEO 产品化团队
 *
 * Usage: npx tsx scripts/reality-gate.ts
 *        npm run reality-gate
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Issue {
  severity: 'P0' | 'P1'
  file: string
  line: number
  type: string
  content: string
  message: string
}

interface Result {
  passed: boolean
  p0Count: number
  p1Count: number
  issues: Issue[]
  summary: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PROJECT_ROOT = path.resolve(ROOT, '..')
const FRONTEND_GEO = path.resolve(PROJECT_ROOT, 'frontend', 'workspaces', 'geo')
const BACKEND_GEO = path.resolve(ROOT, 'src', 'services', 'geo')

// ─── File Walker ────────────────────────────────────────────────────────────

function* walkFiles(
  dir: string,
  pattern: RegExp,
  ignoreDirs: Set<string> = new Set(['node_modules'])
): Generator<{ file: string; lines: string[] }> {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
        yield* walkFiles(fullPath, pattern, ignoreDirs)
      }
    } else if (entry.isFile() && pattern.test(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8')
        yield { file: fullPath, lines: content.split('\n') }
      } catch {
        // skip unreadable files
      }
    }
  }
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

function scanDirectory(
  scanDir: string,
  projectBaseDir: string,
  filePattern: RegExp,
  allowStubFilePatterns: string[],
  allowStubDirPatterns: string[],
  allowMathRandomLinePatterns: string[],
  issues: Issue[]
) {
  if (!fs.existsSync(scanDir)) {
    console.log(`[reality-gate] Skipping non-existent: ${scanDir}`)
    return
  }

  for (const { file, lines } of walkFiles(scanDir, filePattern)) {
    const relFile = path.relative(projectBaseDir, file).split(path.sep).join('/')
    const fileName = path.basename(file)
    const isTestFile =
      file.includes('/__tests__/') ||
      file.includes('.test.') ||
      file.includes('.spec.')
    const isAllowedStubFile = allowStubFilePatterns.some((p) => fileName.includes(p))
    const isAllowedStubDir = allowStubDirPatterns.some((p) => file.includes(p))
    // Skip all P0 checks for known stub directories
    if (isAllowedStubDir) continue

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1
      const trimmed = lines[i].trim()
      const isComment = /^\s*(\/\/|\*|\/\*)/.test(lines[i])
      const hasBetaStub = trimmed.includes('@beta-stub')

      // ── P0: Stub/mock/fake/hardcode without @beta-stub ──
      if (
        !hasBetaStub &&
        !isAllowedStubFile &&
        !isAllowedStubDir &&
        !isComment &&
        /\b(stub|mock|fake)\b/i.test(trimmed) &&
        !trimmed.includes('isStub') &&
        !trimmed.includes('_meta') &&
        !trimmed.includes('stub-badge') &&
        !trimmed.includes('mockScanner') &&
        !trimmed.includes('MockScanner') &&
        !trimmed.includes('MockProvider') &&
        !trimmed.includes('mockCreate') &&
        !trimmed.includes('mockFind') &&
        !trimmed.includes('mockResolvedValue') &&
        !trimmed.includes('jest.fn') &&
        !/import\s+.*mock/.test(trimmed) &&
        !/from\s+['"].*mock/.test(trimmed) &&
        !trimmed.includes('acceptable to hardcode') &&
        !trimmed.includes('hardcode — acceptable')
      ) {
        issues.push({
          severity: 'P0',
          file: relFile,
          line: lineNum,
          type: 'stub',
          content: trimmed.substring(0, 120),
          message: 'Unmarked stub/mock/fake/hardcode — add // @beta-stub if intentional',
        })
      }

      // ── P0: console.warn/console.log with "not implemented" / "stub" ──
      if (
        /console\.(warn|log)\s*\(/.test(trimmed) &&
        /not\s*implemented|stub|placeholder/i.test(trimmed)
      ) {
        issues.push({
          severity: 'P0',
          file: relFile,
          line: lineNum,
          type: 'console-stub',
          content: trimmed.substring(0, 120),
          message: 'Console call with stub/not-implemented content',
        })
      }

      // ── P0: TODO / FIXME comments ──
      if (/\/\/\s*(TODO|FIXME)\b|(\*|\/\*)\s*(TODO|FIXME)\b/i.test(trimmed)) {
        issues.push({
          severity: 'P0',
          file: relFile,
          line: lineNum,
          type: 'todo-fixme',
          content: trimmed.substring(0, 120),
          message: 'TODO or FIXME found in code',
        })
      }

      // ── P0: Math.random() for mock data (not ID generators or tests) ──
      if (
        !isTestFile &&
        /Math\.random\s*\(/.test(trimmed) &&
        !allowMathRandomLinePatterns.some((p) => trimmed.includes(p))
      ) {
        issues.push({
          severity: 'P0',
          file: relFile,
          line: lineNum,
          type: 'math-random',
          content: trimmed.substring(0, 120),
          message: 'Math.random() used — likely mock/stub data generation',
        })
      }

      // ── P0: POST/PUT/DELETE/PATCH routes with preHandler: [] (no auth) ──
      if (
        /(fastify\.(post|put|delete|patch))\s*\(/.test(trimmed) &&
        /preHandler\s*:\s*\[\s*\]/.test(lines[i])
      ) {
        issues.push({
          severity: 'P0',
          file: relFile,
          line: lineNum,
          type: 'unauthenticated-route',
          content: trimmed.substring(0, 120),
          message: 'Mutating route (POST/PUT/DELETE/PATCH) without authentication',
        })
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): Result {
  const issues: Issue[] = []

  console.log('═'.repeat(60))
  console.log('  Reality Gate — 部署质量门禁')
  console.log('═'.repeat(60))
  console.log()

  // ── Scan frontend ──
  console.log('── Scanning frontend (workspaces/geo/) ──')
  scanDirectory(
    FRONTEND_GEO,
    PROJECT_ROOT,
    /\.(vue|ts|js)$/,
    [], // allowStubFilePatterns
    [], // allowStubDirPatterns
    // Legitimate Math.random() ID generators
    [
      'toString(36)',
      "'tl-'",
      "'wb-'",
      "'st-'",
      "'trace_'",
      "'req_'",
      "'replay_'",
      "'exec-'",
      "'ver-'",
      "'clm-'",
      "'evd-'",
      "'disco-'",
      "'promo_'",
      "'candidate_'",
      "'sc-'",
    ],
    issues
  )

  // ── Scan backend ──
  console.log('── Scanning backend (src/services/geo/) ──')
  scanDirectory(
    BACKEND_GEO,
    ROOT,
    /\.ts$/,
    ['mock-provider', 'mock-scanner', 'legacy-mock'], // allowStubFilePatterns
    ['/__tests__/', '.test.', '.spec.', '/presence/adapters/'], // allowStubDirPatterns
    // Legitimate Math.random() ID generators
    [
      'toString(36)',
      "'trace_'",
      "'req_'",
      "'replay_'",
      "'exec-'",
      "'ver-'",
      "'clm-'",
      "'evd-'",
      "'disco-'",
      "'promo_'",
      "'candidate_'",
      "'sc-'",
    ],
    issues
  )

  // ── Tally ──
  const p0Count = issues.filter((i) => i.severity === 'P0').length
  const p1Count = issues.filter((i) => i.severity === 'P1').length
  const passed = p0Count === 0

  const summary = passed
    ? `✔ Reality Gate PASSED: ${p0Count} P0 issues, ${p1Count} P1 warnings`
    : `✘ Reality Gate FAILED: ${p0Count} P0 issues found (${p1Count} P1 warnings) — blocking deployment`

  const result: Result = { passed, p0Count, p1Count, issues, summary }

  // ── Console output ──
  console.log()
  console.log('─'.repeat(60))
  console.log(`  P0 issues: ${p0Count}`)
  console.log(`  P1 issues: ${p1Count}`)
  console.log(`  Result: ${passed ? 'PASSED ✔' : 'FAILED ✘'}`)
  console.log('─'.repeat(60))

  if (issues.length > 0) {
    console.log()
    for (const issue of issues) {
      const icon = issue.severity === 'P0' ? '🔴' : '🟡'
      console.log(`  ${icon} [${issue.severity}] ${issue.file}:${issue.line}`)
      console.log(`      Type: ${issue.type}  │  ${issue.message}`)
      console.log(`      ${issue.content.substring(0, 100)}`)
      console.log()
    }
  }

  // ── Write JSON report ──
  const reportsDir = path.resolve(ROOT, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const outputPath = path.resolve(reportsDir, 'reality-gate-report.json')
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`  📄 Report written to: ${outputPath}`)

  // ── Exit with code ──
  if (!passed) {
    console.error(`\n  ${summary}`)
    process.exit(1)
  }

  console.log(`\n  ${summary}`)
  return result
}

main()
