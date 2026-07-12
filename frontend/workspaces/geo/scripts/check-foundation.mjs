/**
 * Foundation Lock Check
 *
 * Compares current Foundation artifacts against foundation.lock.
 * CI: pnpm foundation:check — exit 0 = locked, 1 = drift detected
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const LOCK_PATH = resolve(ROOT, 'foundation.lock')

if (!existsSync(LOCK_PATH)) {
  console.error('[foundation] No foundation.lock — run foundation:lock first')
  process.exit(1)
}

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf-8'))

const hash = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)

const checks = {
  'token-manifest': readFileSync(resolve(ROOT, 'generated/geo-design-tokens.css'), 'utf-8') +
                    readFileSync(resolve(ROOT, 'generated/geo-design-tokens.json'), 'utf-8'),
  'event-contract': readFileSync(resolve(ROOT, 'types/event.ts'), 'utf-8'),
  'capability-registry': readFileSync(resolve(ROOT, 'config/capabilities.ts'), 'utf-8') +
                         readFileSync(resolve(ROOT, 'types/capability.ts'), 'utf-8'),
  'linter-rules': readFileSync(resolve(ROOT, 'scripts/lint.mjs'), 'utf-8'),
}

let failed = 0
for (const [key, data] of Object.entries(checks)) {
  const expected = lock.hashes[key]
  const actual = hash(data)
  if (actual === expected) {
    console.log(`  ✅ ${key}: ${actual}`)
  } else {
    console.error(`  ❌ ${key}: expected ${expected}, got ${actual}`)
    failed++
  }
}

if (failed > 0) {
  console.error(`\n[foundation] ${failed} artifact(s) changed. Foundation drift detected.`)
  console.error('[foundation] ADR required before modifying foundation artifacts.')
  process.exit(1)
} else {
  console.log(`\n[foundation] ✅ Foundation locked — ${Object.keys(checks).length}/4 artifacts match.`)
}
