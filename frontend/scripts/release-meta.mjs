#!/usr/bin/env node
/**
 * release-meta.mjs — 生成发布元信息
 *
 * 输出到 .output/release.json，包含版本、构建时间、commit、资产 hash 等。
 * 通过 /api/version 接口可在线查询当前版本。
 */
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { join } from 'path'
import { createHash } from 'crypto'

const __dirname = join(fileURLToPath(import.meta.url), '..')
const outputDir = resolve(__dirname, '..', '.output')
const nuxtDir = resolve(outputDir, 'public', '_nuxt')

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 3000 }).trim()
  } catch {
    return 'unknown'
  }
}

// Collect metadata
const meta = {
  version: process.env.RELEASE_VERSION || tryExec('git describe --tags --always 2>/dev/null') || 'dev',
  buildTime: new Date().toISOString(),
  gitCommit: tryExec('git rev-parse HEAD 2>/dev/null'),
  gitBranch: tryExec('git rev-parse --abbrev-ref HEAD 2>/dev/null'),
  builder: process.env.USER || 'unknown',
  buildMode: existsSync(resolve(outputDir, 'public', 'index.html')) ? 'ssr' : 'spa',
  
  // Asset hash: sha256 of all _nuxt/ filenames sorted, to detect content drift
  assetHash: null,
  assetCount: 0,
}

if (existsSync(nuxtDir)) {
  const { readdirSync } = await import('fs')
  const files = readdirSync(nuxtDir).filter(f => f.endsWith('.js') || f.endsWith('.css')).sort()
  meta.assetCount = files.length
  meta.assetHash = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 16)
}

// Write
const outputPath = resolve(outputDir, 'release.json')
writeFileSync(outputPath, JSON.stringify(meta, null, 2) + '\n')
console.log(`[release-meta] ✅ Written to ${outputPath}`)
console.log(`[release-meta]   version: ${meta.version}`)
console.log(`[release-meta]   commit: ${meta.gitCommit.slice(0, 12)}`)
console.log(`[release-meta]   mode: ${meta.buildMode}`)
console.log(`[release-meta]   assets: ${meta.assetCount} (hash: ${meta.assetHash})`)
