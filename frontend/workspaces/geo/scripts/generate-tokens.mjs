/**
 * GEO Design Token Generator
 *
 * Reads design/tokens.ts (SSOT) and generates:
 *   generated/geo-design-tokens.css   — CSS custom properties
 *   generated/geo-design-tokens.json  — structured JSON for tools/Storybook
 *   generated/geo-design-tokens.manifest.json — content hash manifest
 *
 * Usage: node scripts/generate-tokens.mjs
 * Deterministic: stable sort, prettier formatting.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WORKSPACE_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = resolve(WORKSPACE_ROOT, 'generated')
const TOKENS_FILE = resolve(WORKSPACE_ROOT, 'design', 'tokens.ts')

// Token category CSS prefix + value transform
const CATEGORY_MAP = {
  space:    { prefix: 'space',   css: v => v },
  radius:   { prefix: 'radius',  css: v => v },
  icon:     { prefix: 'icon',    css: v => v },
  weight:   { prefix: 'weight',  css: v => v },
  z:        { prefix: 'z',       css: v => String(v) },
  duration: { prefix: 'duration',css: v => `${v}ms` },
  shadow:   { prefix: 'shadow',  css: v => v },
  easing:   { prefix: 'easing',  css: v => v },
  bp:       { prefix: 'bp',      css: v => v },
}

const SPECIAL_PREFIXES = {
  text:     'text',
  font:     'font',
  color:    'color',
  priority: 'priority',
  chart:    'chart',
}

// Strip TypeScript from tokens.ts and evaluate the object
function parseGeoTokens(source) {
  // Remove TypeScript-specific syntax
  let cleaned = source
    .replace(/^import\s.+;?\s*$/gm, '')
    .replace(/^export\s+type\s.+;?\s*$/gm, '')
    .replace(/^export\s+interface\s.+;?\s*$/gm, '')
    .replace(/\s+as\s+const/g, '')
    .replace(/\s+satisfies\s+\w+/g, '')
    .replace(/,\s*([}\]])/g, '$1')

  const match = cleaned.match(/GeoTokens\s*=\s*({[\s\S]*})/)
  if (!match) {
    throw new Error('Could not parse GeoTokens object from tokens.ts')
  }

  try {
    const fn = new Function(`return (${match[1]})`)
    return fn()
  } catch (err) {
    throw new Error(`Failed to evaluate GeoTokens: ${err.message}`)
  }
}

// Generate CSS custom properties
function generateCSS(tokens) {
  const lines = [
    '/* AUTO GENERATED — DO NOT EDIT */',
    '/* Source: design/tokens.ts — edit that file, then run `pnpm tokens:generate` */',
    '',
    ':root {',
  ]

  for (const [category, values] of Object.entries(tokens)) {
    if (!values || typeof values !== 'object') continue

    const catInfo = CATEGORY_MAP[category]
    const specialPrefix = SPECIAL_PREFIXES[category]
    const prefix = catInfo ? catInfo.prefix : (specialPrefix || null)
    if (!prefix) continue

    const cssTransform = (catInfo && catInfo.css) || (v => v)

    if (category === 'text') {
      for (const [key, val] of Object.entries(values)) {
        if (val && typeof val === 'object') {
          const fontSize = typeof val.size === 'string' ? val.size : `${val.size}px`
          const lineH = typeof val.lineHeight === 'string' ? val.lineHeight : `${val.lineHeight}px`
          const fontWeight = val.weight || '400'
          lines.push(`  --geo-text-${key}: ${fontSize};`)
          lines.push(`  --geo-text-${key}-line-height: ${lineH};`)
          lines.push(`  --geo-text-${key}-weight: ${fontWeight};`)
        }
      }
    } else {
      const keys = Object.keys(values).sort()
      for (const key of keys) {
        const rawVal = values[key]
        const cssVal = typeof rawVal === 'string' ? cssTransform(rawVal) : cssTransform(String(rawVal))
        lines.push(`  --geo-${prefix}-${key}: ${cssVal};`)
      }
    }
  }

  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

// Generate JSON (structured)
function generateJSON(tokens) {
  return JSON.stringify(tokens, null, 2)
}

// Generate manifest with hash
function generateManifest(tokens) {
  const cssContent = generateCSS(tokens)
  const jsonContent = generateJSON(tokens)
  const hash = createHash('sha256')
    .update(cssContent)
    .update(jsonContent)
    .digest('hex')

  return JSON.stringify({
    version: '1.0',
    hash,
    generatedAt: new Date().toISOString(),
    source: 'design/tokens.ts',
    files: [
      'generated/geo-design-tokens.css',
      'generated/geo-design-tokens.json',
    ],
  }, null, 2)
}

// Main
function main() {
  if (!existsSync(GENERATED_DIR)) {
    mkdirSync(GENERATED_DIR, { recursive: true })
  }

  const source = readFileSync(TOKENS_FILE, 'utf-8')
  const tokens = parseGeoTokens(source)

  const css = generateCSS(tokens)
  const json = generateJSON(tokens)
  const manifest = generateManifest(tokens)

  writeFileSync(resolve(GENERATED_DIR, 'geo-design-tokens.css'), css, 'utf-8')
  writeFileSync(resolve(GENERATED_DIR, 'geo-design-tokens.json'), json, 'utf-8')
  writeFileSync(resolve(GENERATED_DIR, 'geo-design-tokens.manifest.json'), manifest, 'utf-8')

  const hash = JSON.parse(manifest).hash
  console.log(`Tokens generated (${css.length}B css, ${json.length}B json) hash: ${hash.slice(0, 16)}...`)
}

main()
