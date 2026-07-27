// Generate index.html for SPA fallback
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', '.output', 'public')

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>昆仑镜 - AI Workforce OS</title>
  <link rel="stylesheet" href="/_nuxt/entry.css">
</head>
<body>
  <div id="__nuxt"></div>
  <script type="module" src="/_nuxt/entry.js"></script>
</body>
</html>`

mkdirSync(publicDir, { recursive: true })
writeFileSync(resolve(publicDir, 'index.html'), html, 'utf-8')
console.log('[gen-index] ✅ index.html generated for SPA fallback')
