#!/usr/bin/env node
/**
 * postbuild-fix.mjs — 构建后修复脚本
 *
 * 解决以下问题：
 * 1. buildId 不一致：nitro.mjs 的 buildId 与 renderer.mjs 的 buildId 不同
 *    导致客户端请求不存在的 builds/meta/{buildId}.json 返回 500
 * 2. 确保 latest.json 存在
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { join } from 'path'

const __dirname = join(fileURLToPath(import.meta.url), '..')
const publicDir = resolve(__dirname, '..', '.output', 'public')
const metaDir = resolve(publicDir, '_nuxt', 'builds', 'meta')

if (!existsSync(metaDir)) {
  console.log('[postbuild-fix] ⏭ No meta dir, skipping')
  process.exit(0)
}

const files = readdirSync(metaDir).filter(f => f.endsWith('.json') && f !== 'latest.json')
if (files.length === 0) {
  console.log('[postbuild-fix] ⏭ No meta files found')
  process.exit(0)
}

// Use the first meta file as the canonical one
const canonicalFile = files[0]
const canonicalId = canonicalFile.replace('.json', '')
const canonicalPath = resolve(metaDir, canonicalFile)

// 1) Ensure latest.json always matches the canonical file
const latestPath = resolve(metaDir, 'latest.json')
writeFileSync(latestPath, readFileSync(canonicalPath, 'utf-8'))
console.log(`[postbuild-fix] ✅ latest.json → ${canonicalId}`)

// 2) Find all JS entry chunks that contain a different buildId and patch them
//    The nitro.mjs is the main concern — it has a baked buildId
const serverDir = resolve(__dirname, '..', '.output', 'server')
const nitroMjs = resolve(serverDir, 'chunks', 'nitro', 'nitro.mjs')

if (existsSync(nitroMjs)) {
  let content = readFileSync(nitroMjs, 'utf-8')
  
  // Find all buildId references in nitro.mjs
  const buildIds = content.match(/"buildId":"([^"]+)"/g)
  if (buildIds) {
    const uniqueIds = [...new Set(buildIds.map(b => b.replace(/"buildId":"|"/g, '')))]
    if (uniqueIds.length > 1 || uniqueIds[0] !== canonicalId) {
      console.log(`[postbuild-fix] 🔧 BuildId mismatch detected: ${uniqueIds.join(', ')} → ${canonicalId}`)
      
      // Replace ALL buildId values with canonical
      for (const id of uniqueIds) {
        content = content.replaceAll(`"buildId":"${id}"`, `"buildId":"${canonicalId}"`)
      }
      writeFileSync(nitroMjs, content, 'utf-8')
      console.log(`[postbuild-fix] ✅ Patched ${uniqueIds.length} buildId reference(s) in nitro.mjs`)
    } else {
      console.log(`[postbuild-fix] ✅ BuildId consistent: ${canonicalId}`)
    }
  }
}

// 3) Also check renderer.mjs
const rendererMjs = resolve(serverDir, 'chunks', 'routes', 'renderer.mjs')
if (existsSync(rendererMjs)) {
  let content = readFileSync(rendererMjs, 'utf-8')
  const rendererIds = [...new Set(content.match(/"buildId":"([^"]+)"/g) || [])]
    .map(b => b.replace(/"buildId":"|"/g, ''))
  
  for (const id of rendererIds) {
    if (id !== canonicalId) {
      content = content.replaceAll(`"buildId":"${id}"`, `"buildId":"${canonicalId}"`)
      console.log(`[postbuild-fix] ✅ Patched buildId ${id} → ${canonicalId} in renderer.mjs`)
    }
  }
  writeFileSync(rendererMjs, content, 'utf-8')
}

// 4) Create aliases for all alternate buildIds found, so clients never get 500
// Scan both nitro.mjs and renderer.mjs for all buildId values
const allIds = new Set()
for (const file of [nitroMjs, rendererMjs]) {
  if (existsSync(file)) {
    const content = readFileSync(file, 'utf-8')
    for (const m of content.matchAll(/"buildId":"([^"]+)"/g)) {
      allIds.add(m[1])
    }
  }
}
allIds.delete(canonicalId)

for (const altId of allIds) {
  const altPath = resolve(metaDir, `${altId}.json`)
  if (!existsSync(altPath)) {
    // Use symlink or copy — copy is safer with immutable cache headers
    writeFileSync(altPath, readFileSync(canonicalPath, 'utf-8'))
    console.log(`[postbuild-fix] ✅ Created alias: ${altId}.json → ${canonicalId}.json`)
  }
}

console.log(`[postbuild-fix] ✅ Done (canonical: ${canonicalId}, aliases: ${allIds.size})`)
