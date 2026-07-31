#!/usr/bin/env node
/**
 * asset-sync.mjs — Sprint-10D 修复
 *
 * 每次 Nuxt 构建后同步 .output/public/ 到 nginx 静态根目录。
 * 确保 _nuxt/ JS/CSS 文件被 nginx 直服（不走 Nitro proxy → 消除 chunked encoding 截断）。
 *
 * 同步策略：删除 nginx root 的旧 _nuxt/，复制新 _nuxt/，保留 non-nuxt 文件（tts/ 等）。
 */

import { existsSync, readdirSync, cpSync, rmSync, copyFileSync, mkdirSync, statSync } from 'fs'
import { resolve, relative, join } from 'path'

const PUBLIC_DIR = resolve(import.meta.dirname, '../.output/public')
const NGINX_ROOT = '/www/wwwroot/aigc.fushtn.com'

const SYNC_DIRS = ['_nuxt']
const SYNC_FILES = [
  '__tc-bridge.js',
  '__tc-init.js',
]
const PRESERVE_DIRS = ['tts']

function sync() {
  console.log(`[asset-sync] PUBLIC_DIR=${PUBLIC_DIR}`)
  console.log(`[asset-sync] NGINX_ROOT=${NGINX_ROOT}`)

  if (!existsSync(PUBLIC_DIR)) {
    console.error(`[asset-sync] ❌ PUBLIC_DIR not found: ${PUBLIC_DIR}`)
    process.exit(1)
  }

  // --- Sync _nuxt/ ---
  for (const dir of SYNC_DIRS) {
    const srcDir = join(PUBLIC_DIR, dir)
    const dstDir = join(NGINX_ROOT, dir)

    if (!existsSync(srcDir)) {
      console.warn(`[asset-sync] ⚠️  Source dir missing: ${srcDir}, skipping`)
      continue
    }

    // Remove old version
    if (existsSync(dstDir)) {
      const oldCount = readdirSync(dstDir).length
      rmSync(dstDir, { recursive: true, force: true })
      console.log(`[asset-sync] 🗑  Removed old ${dir}/ (${oldCount} files)`)
    }

    // Copy new version
    cpSync(srcDir, dstDir, { recursive: true, force: true })
    const newCount = readdirSync(dstDir).length
    console.log(`[asset-sync] ✅ Synced ${dir}/ (${newCount} files)`)
  }

  // --- Sync individual files ---
  for (const file of SYNC_FILES) {
    const srcFile = join(PUBLIC_DIR, file)
    const dstFile = join(NGINX_ROOT, file)

    if (!existsSync(srcFile)) {
      console.warn(`[asset-sync] ⚠️  Source file missing: ${srcFile}, skipping`)
      continue
    }

    copyFileSync(srcFile, dstFile)
    const size = statSync(dstFile).size
    console.log(`[asset-sync] ✅ Synced ${file} (${size} bytes)`)
  }

  // --- Preserved directories check ---
  for (const dir of PRESERVE_DIRS) {
    const preserveDir = join(NGINX_ROOT, dir)
    if (existsSync(preserveDir)) {
      const count = readdirSync(preserveDir).length
      console.log(`[asset-sync] 🔒 Preserved ${dir}/ (${count} files)`)
    }
  }

  console.log('[asset-sync] ✅ All assets synced successfully')
}

sync()
