/**
 * Token CI Validation
 *
 * Regenerates tokens and compares byte-for-byte against committed generated/ files.
 * Uses direct fd comparison (not git diff) to work with untracked/committed files.
 *
 * Exit code 0 = matching, 1 = drift detected.
 *
 * Usage: node scripts/validate-tokens.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WORKSPACE_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = resolve(WORKSPACE_ROOT, 'generated')

const FILES = [
  'geo-design-tokens.css',
  'geo-design-tokens.json',
  'geo-design-tokens.manifest.json',
]

function stripGeneratedAt(json) {
  if (!json) return json
  try {
    const obj = JSON.parse(json)
    delete obj.generatedAt
    return JSON.stringify(obj, null, 2)
  } catch {
    return json
  }
}

function readFileSafe(p) {
  try { return readFileSync(p, 'utf-8') } catch { return null }
}

function main() {
  console.log('Validating tokens — regenerating and comparing...')

  // Snapshot current generated files before regeneration
  const before = {}
  for (const f of FILES) {
    before[f] = readFileSafe(resolve(GENERATED_DIR, f))
  }

  // Regenerate
  execSync('node scripts/generate-tokens.mjs', {
    cwd: WORKSPACE_ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
  })

  // Compare — skip generatedAt in manifest (always changes)
  let hasDiff = false
  for (const f of FILES) {
    const path = resolve(GENERATED_DIR, f)
    const content = readFileSafe(path)
    const oldContent = before[f]

    if (content === null && oldContent === null) continue // both don't exist

    const a = f === 'geo-design-tokens.manifest.json' ? stripGeneratedAt(content) : content
    const b = f === 'geo-design-tokens.manifest.json' ? stripGeneratedAt(oldContent) : oldContent

    if (a !== b) {
      console.error(`DRIFT: ${f}`)
      hasDiff = true
    }
  }

  if (hasDiff) {
    console.error('')
    console.error('TOKENS DRIFT DETECTED!')
    console.error('Generated files do not match design/tokens.ts.')
    console.error('Run `pnpm tokens:generate` locally and commit the changes.')
    process.exit(1)
  }

  console.log('TOKENS OK — generated files match source.')
  process.exit(0)
}

main()
