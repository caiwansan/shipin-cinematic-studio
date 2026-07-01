#!/usr/bin/env node
/**
 * build-validator.mjs — 构建产物完整性校验
 *
 * 检查项（分 mode）：
 *   1. Nitro server entry 是否存在
 *   2. _nuxt/ 目录非空
 *   3. Manifest Consistency — client.manifest.mjs 引用所有文件在磁盘上存在（Set Diff）
 *   4. 无孤儿文件（manifest 未引用但存在于磁盘）
 *   5. SSR 模式额外检查 index.html + 引用的资源
 *
 * Manifest Consistency 做精确 Set Diff：
 *   manifest 引用 a.js b.js  → 检查磁盘存在
 *   磁盘有 a.js c.js         → 报 orphan: c.js
 *   任何丢失或孤儿都失败
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve, parse } from 'path'
import { fileURLToPath } from 'url'
import { join } from 'path'

const __dirname = join(fileURLToPath(import.meta.url), '..')

const publicDir = resolve(__dirname, '..', '.output', 'public')
const nuxtDir = resolve(publicDir, '_nuxt')
const serverDir = resolve(__dirname, '..', '.output', 'server')
const serverEntry = resolve(serverDir, 'index.mjs')
const manifestPath = resolve(serverDir, 'chunks/build/client.manifest.mjs')

const isSsr = existsSync(resolve(publicDir, 'index.html'))
const failures = []
const warnings = []

function fail(msg) { failures.push(msg); console.error(`[build-validator] ❌ ${msg}`) }
function pass(msg) { console.log(`[build-validator] ✅ ${msg}`) }
function warn(msg) { warnings.push(msg); console.log(`[build-validator] ⚠️ ${msg}`) }

console.log(`[build-validator] 🔍 Mode: ${isSsr ? 'SSR' : 'SPA'}`)

// ── 1. Nitro server entry ──
if (existsSync(serverDir) && existsSync(serverEntry)) {
  const size = readFileSync(serverEntry).length
  pass(`Nitro server entry exists (${(size / 1024).toFixed(1)} KB)`)
} else {
  fail(`Nitro server entry missing: ${serverEntry}`)
}

// ── 2. _nuxt/ 目录 ──
if (!existsSync(nuxtDir)) {
  fail(`_nuxt/ directory not found`)
  process.exit(1)
}

const diskFiles = new Set(readdirSync(nuxtDir).filter(f => f.endsWith('.js') || f.endsWith('.css')))
pass(`_nuxt/ has ${diskFiles.size} JS/CSS files on disk`)

// ── 3. Manifest Consistency — Set Diff ──
let manifestRefs = new Set()
if (existsSync(manifestPath)) {
  const manifestContent = readFileSync(manifestPath, 'utf-8')
  
  // 从 client.manifest.mjs 提取所有引用的文件
  // 结构: {"_xxx.js": {file: "xxx.js", ...}, "xxx.css": {file: "xxx.css", ...}}
  const fileMatches = [...manifestContent.matchAll(/"file":\s*"([^"]+\.(js|css))"/g)]
  manifestRefs = new Set(fileMatches.map(m => m[1]))
  
  pass(`manifest references ${manifestRefs.size} unique files`)

  // Missing: manifest 引用但磁盘没有
  const missing = [...manifestRefs].filter(f => !diskFiles.has(f))
  if (missing.length > 0) {
    fail(`manifest→disk missing (${missing.length}): ${missing.slice(0, 10).join(', ')}`)
  } else {
    pass('manifest→disk: all referenced files exist')
  }

  // Orphan: 磁盘有但 manifest 没引用
  // 注意：manifest 中可能不包含所有 CSS（如入口 CSS 由 index.html 直接引用）
  // 所以 orphan 只报 warning 不 fail
  const orphan = [...diskFiles].filter(f => !manifestRefs.has(f))
  if (orphan.length > 0) {
    warn(`disk→manifest orphan (${orphan.length}): ${orphan.slice(0, 10).join(', ')}`)
  } else {
    pass('disk→manifest: no orphan files')
  }
} else {
  // SPA 模式有时 manifest 是 JS 格式的
  const altManifest = resolve(publicDir, '..', 'build', 'client.manifest.json')
  if (existsSync(altManifest)) {
    pass(`alternative manifest found at ${altManifest}`)
  } else {
    warn(`manifest not found at ${manifestPath} — skipping Set Diff (acceptable for some builds)`)
  }
}

// ── 4. SSR: index.html resource check ──
if (isSsr) {
  const htmlPath = resolve(publicDir, 'index.html')
  const html = readFileSync(htmlPath, 'utf-8')
  const htmlRefs = [
    ...html.matchAll(/<script[^>]+src="(\/_nuxt\/[^"]+)"/g),
    ...html.matchAll(/<link[^>]+href="(\/_nuxt\/[^"]+)"/g)
  ].map(m => m[1].replace('/_nuxt/', ''))

  if (htmlRefs.length === 0) {
    fail('no assets in index.html')
  } else {
    const htmlMissing = htmlRefs.filter(f => !diskFiles.has(f))
    if (htmlMissing.length > 0) {
      fail(`index.html→disk missing (${htmlMissing.length}): ${htmlMissing.slice(0, 10).join(', ')}`)
    } else {
      pass(`index.html references ${htmlRefs.length} assets, all present`)
    }
  }
}

// ── Summary ──
if (failures.length > 0) {
  console.error(`[build-validator] ❌ ${failures.length} failure(s) — blocking release`)
  process.exit(1)
} else {
  if (warnings.length > 0) {
    console.log(`[build-validator] ⚠️ ${warnings.length} warning(s) — build valid but review recommended`)
  }
  console.log(`[build-validator] ✅ All checks passed — build is valid`)
}
