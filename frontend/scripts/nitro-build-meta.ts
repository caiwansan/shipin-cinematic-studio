// Nuxt build meta — 写入当前构建的 assets manifest
// 每个 version.json 包含该次构建的所有 JS/CSS chunk 哈希
// Nginx 在 /_nuxt/ 请求找不到文件时回退到版本清单

import { resolve, dirname } from 'path'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

export default defineNuxtConfig({
  nitro: {
    hooks: {
      'compiled': () => {
        try {
          const publicDir = process.env.NITRO_OUTPUT_DIR
            ? resolve(process.env.NITRO_OUTPUT_DIR, '../public')
            : resolve(fileURLToPath(import.meta.url), '..', '..', '.output/public')

          // 读取 client.manifest 获取所有 chunk 及其哈希
          const serverDir = resolve(publicDir, '../server')
          const manifestPath = resolve(serverDir, 'chunks/build/client.manifest.mjs')
          if (!existsSync(manifestPath)) {
            console.warn('[build-meta] client.manifest not found, skipping')
            return
          }

          const manifestContent = readFileSync(manifestPath, 'utf-8')
          // export default 后面的 JSON
          const jsonStr = manifestContent.replace(/export default /, '').replace(/;\s*$/, '')
          const manifest = JSON.parse(jsonStr)

          // 提取所有 .js / .css 的路径
          const assets = Object.values(manifest).flatMap((entry: any) => {
            const files: string[] = []
            if (entry.css) files.push(...entry.css)
            if (entry.assets) files.push(...entry.assets.filter((a: string) => a.endsWith('.js') || a.endsWith('.css')))
            return files
          })

          const uniqueAssets = [...new Set(assets)]
          const buildId = `build-${Date.now()}`
          const versionData = {
            buildId,
            buildTime: new Date().toISOString(),
            assets: uniqueAssets,
          }

          // 写入 builds/meta/
          const metaDir = resolve(publicDir, '_nuxt', 'builds', 'meta')
          const buildMetaDir = resolve(publicDir, '_nuxt', 'builds', `build-${Date.now()}`)
          writeFileSync(resolve(metaDir, 'latest.json'), JSON.stringify(versionData, null, 2), 'utf-8')
          writeFileSync(resolve(buildMetaDir, 'manifest.json'), JSON.stringify(versionData, null, 2), 'utf-8')
          console.log(`[build-meta] ✅ Version manifest written (${uniqueAssets.length} assets, buildId: ${buildId.slice(0, 20)}...)`)
        } catch (err) {
          console.error('[build-meta] ❌ Failed:', err)
        }
      }
    }
  }
})
