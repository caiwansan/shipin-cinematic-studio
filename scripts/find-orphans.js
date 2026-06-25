#!/usr/bin/env node
/**
 * RC-2 Safe Orphan Scanner
 * 静态分析 dependency graph，输出零引用文件列表
 * 用法: node scripts/find-orphans.js --dir ./frontend --out ./tmp/orphans.json
 */
const fs = require('fs')
const path = require('path')

const args = {}
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1]
})

const srcDir = path.resolve(args.dir || process.cwd())
const outFile = args.out || ''
const ext = args.ext || '.ts,.vue,.tsx,.js,.mjs'

const allowedExts = new Set(ext.split(','))

// ── 收集所有文件 ──
function walk(dir) {
  const files = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.nuxt' || entry.name === '.output' || entry.name === '.turbo' || entry.name === 'dist') continue
        files.push(...walk(full))
      } else if (allowedExts.has(path.extname(full))) {
        files.push(full)
      }
    }
  } catch {}
  return files
}

console.error(`[RC-2] Scanning ${srcDir}...`)
const allFiles = walk(srcDir)
console.error(`[RC-2] Found ${allFiles.length} files`)

// ── 建立 import 图 ──
const importRegex = /(?:from\s+['"])([^'"]+)(?:['"])|(?:import\s+(?:['"])([^'"]+)(?:['"]))|(?:require\s*\(\s*['"])([^'"]+)(?:['"])/g

function normalizeImport(imp, baseDir) {
  if (imp.startsWith('.')) {
    const resolved = path.resolve(baseDir, imp)
    // 尝试常见扩展名
    for (const e of ['.ts', '.vue', '.tsx', '.js', '.mjs', '/index.ts', '/index.vue', '/index.js']) {
      const candidate = resolved + e
      if (fs.existsSync(candidate)) return candidate
    }
    return resolved + '.ts' // 默认
  }
  return imp // 外部依赖
}

const inbound = new Map()
for (const f of allFiles) inbound.set(f, new Set())

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf-8')
  const matches = [...content.matchAll(importRegex)]
  for (const m of matches) {
    const raw = m[1] || m[2] || m[3]
    if (!raw || raw.startsWith('@/')) continue // @/ 是 vue alias
    const target = normalizeImport(raw, path.dirname(f))
    // 只记录指向扫描目录内的引用
    if (inbound.has(target)) {
      inbound.get(target).add(f)
    }
  }
}

// ── 路由表引用 ──
// 额外收集路由注册文件
const routeFiles = allFiles.filter(f => f.includes('/routes/') || f.includes('router') || f.includes('nuxt.config'))
const routeRefs = new Set(
  routeFiles.flatMap(f => {
    const content = fs.readFileSync(f, 'utf-8')
    const refs = [...content.matchAll(/['"]([^'"]+\.(?:ts|vue|js))['"]|['"](\/[^'"]+)['"]/g)]
    return refs.map(m => m[1] || m[2])
  }).filter(Boolean)
)

// ── 报告零引用文件 ──
const orphans = []
for (const f of allFiles) {
  const rel = path.relative(srcDir, f)
  // 排除自身引用
  const refs = [...inbound.get(f)].filter(r => r !== f)
  if (refs.length === 0) {
    orphans.push({ file: f, relative: rel })
  }
}

console.log(JSON.stringify({
  scannedCount: allFiles.length,
  orphanCount: orphans.length,
  orphans,
  scanDir: srcDir,
}, null, 2))
