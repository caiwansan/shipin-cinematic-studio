#!/usr/bin/env node
/**
 * asset-sync.mjs — 将构建产物的静态资源同步到 Nginx webroot
 *
 * 替代原有的 sync-nuxt.sh，增加同步前后的完整性校验：
 *   1. 同步前验证源目录完整性
 *   2. rsync 同步
 *   3. 同步后验证目标文件数量一致
 */
import { existsSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = join(fileURLToPath(import.meta.url), '..')
import { join } from 'path'

const SRC = resolve(__dirname, '..', '.output', 'public', '_nuxt')
const DST = '/www/wwwroot/aigc.fushtn.com/_nuxt'

const failures = []

function fail(msg) {
  failures.push(msg)
  console.error(`[asset-sync] ❌ ${msg}`)
}

function pass(msg) {
  console.log(`[asset-sync] ✅ ${msg}`)
}

// ── 1. 源目录检查 ──
if (!existsSync(SRC)) {
  fail(`source directory not found: ${SRC}`)
  process.exit(1)
}

const srcFiles = readdirSync(SRC).filter(f => f.endsWith('.js') || f.endsWith('.css'))
if (srcFiles.length === 0) {
  fail(`no JS/CSS files in source: ${SRC}`)
  process.exit(1)
}
pass(`source has ${srcFiles.length} JS/CSS files`)

// ── 2. 同步前记录目标状态 ──
const beforeCount = existsSync(DST) 
  ? readdirSync(DST).filter(f => f.endsWith('.js') || f.endsWith('.css')).length
  : 0
pass(`target currently has ${beforeCount} JS/CSS files`)

// ── 3. 执行同步 ──
try {
  execSync(`mkdir -p "${DST}" && rsync -a --delete "${SRC}/" "${DST}/"`, { stdio: 'inherit' })
  execSync(`chown -R www:www "${DST}" 2>/dev/null || true`, { stdio: 'inherit' })
  execSync(`chmod -R 755 "${DST}" 2>/dev/null || true`, { stdio: 'inherit' })
  pass('rsync completed')
} catch (e) {
  fail(`rsync failed: ${e.message}`)
  process.exit(1)
}

// ── 4. 同步后验证 ──
const afterFiles = readdirSync(DST).filter(f => f.endsWith('.js') || f.endsWith('.css'))
const afterCount = afterFiles.length

// 检查关键文件是否存在
const missing = srcFiles.filter(f => !existsSync(join(DST, f)))
if (missing.length > 0) {
  fail(`${missing.length} files failed to sync: ${missing.slice(0, 5).join(', ')}`)
} else {
  pass(`all ${srcFiles.length} source files synced to target`)
}

// 计数合理性检查（目标只多不少，因为有构建目录）
if (afterCount < srcFiles.length * 0.5) {
  fail(`target has only ${afterCount} files after sync, expected at least ${Math.floor(srcFiles.length * 0.5)}`)
} else {
  pass(`target now has ${afterCount} files (${afterCount - beforeCount} new/changed)`)
}

// ── Summary ──
if (failures.length > 0) {
  console.error(`[asset-sync] ❌ ${failures.length} failure(s) — sync incomplete`)
  process.exit(1)
} else {
  console.log(`[asset-sync] ✅ Sync complete and verified`)
}
