#!/usr/bin/env node
/**
 * patch-manifest.mjs — 构建后补丁
 * 
 * Nuxt 3.16 在客户端路由匹配时，如果 app manifest 的 matcher 中
 * static/wildcard/dynamic 三个 Map 都为空，client bundle 的 matchAll()
 * 会崩溃报：Error matching route rules. TypeError: Cannot read properties
 * of undefined (reading 'entries')
 * 
 * 解决：在 manifest JSON 中插入一个 dummy 静态路由，确保 Map 非空。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = join(fileURLToPath(import.meta.url), '..')
const publicDir = resolve(__dirname, '..', '.output', 'public')

const nuxtDir = resolve(publicDir, '_nuxt')
if (!existsSync(nuxtDir)) {
  console.log('[patch-manifest] ⚠️ _nuxt dir not found at', nuxtDir)
  process.exit(0)
}

const buildDirs = readdirSync(nuxtDir).filter(d => d.startsWith('build-'))
if (buildDirs.length === 0) {
  console.log('[patch-manifest] ⚠️ No build-* dirs found')
  process.exit(0)
}

const latest = buildDirs.sort().pop()
const metaDir = resolve(nuxtDir, latest, 'builds', 'meta')

if (!existsSync(metaDir)) {
  console.log('[patch-manifest] ⚠️ Meta dir not found:', metaDir)
  process.exit(0)
}

const files = readdirSync(metaDir).filter(f => f.endsWith('.json'))
let patched = 0

for (const f of files) {
  const fp = join(metaDir, f)
  const meta = JSON.parse(readFileSync(fp, 'utf-8'))

  if (!meta.matcher) continue

  const { static: s, wildcard: w, dynamic: d } = meta.matcher
  if (Object.keys(s || {}).length === 0 && 
      Object.keys(w || {}).length === 0 && 
      Object.keys(d || {}).length === 0) {
    meta._patched = true
    meta.matcher.static = { '/__nuxt_empty_route__': {} }
    writeFileSync(fp, JSON.stringify(meta, null, 2))
    patched++
    console.log(`[patch-manifest] ✅ ${f} — added dummy route`)
  }
}

if (patched === 0) {
  console.log('[patch-manifest] ✅ All manifests already OK')
}
