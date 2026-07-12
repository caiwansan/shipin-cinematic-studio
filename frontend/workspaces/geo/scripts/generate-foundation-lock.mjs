/**
 * Generate Foundation Lock
 *
 * Hashes current Foundation artifacts and writes foundation.lock.
 * Run when Foundation is intentionally updated (requires ADR).
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const hash = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)

const lock = {
  version: '1.0',
  created: new Date().toISOString(),
  description: 'GEO Workspace Foundation Lock — PA-004 S1.1A',
  hashes: {
    'token-manifest': hash(
      readFileSync(resolve(ROOT, 'generated/geo-design-tokens.css'), 'utf-8') +
      readFileSync(resolve(ROOT, 'generated/geo-design-tokens.json'), 'utf-8')),
    'event-contract': hash(
      readFileSync(resolve(ROOT, 'types/event.ts'), 'utf-8')),
    'capability-registry': hash(
      readFileSync(resolve(ROOT, 'config/capabilities.ts'), 'utf-8') +
      readFileSync(resolve(ROOT, 'types/capability.ts'), 'utf-8')),
    'linter-rules': hash(
      readFileSync(resolve(ROOT, 'scripts/lint.mjs'), 'utf-8')),
  },
  baseline: {
    'prisma-boundary': 0,
    'layer-import': 87,
    'agent-response': 12,
    'token-usage': 2656,
  },
}

writeFileSync(resolve(ROOT, 'foundation.lock'), JSON.stringify(lock, null, 2))
console.log(`[foundation] ✅ Lock written: ${Object.keys(lock.hashes).length} artifacts hashed`)
