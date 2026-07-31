#!/usr/bin/env node
/**
 * Route Ownership Check — 孤儿页面 CI 检查
 *
 * 扫描 pages/admin/** 与 AdminRouteRegistry 比对：
 *   - 未登记页面          → ⚠️ WARNING（孤儿页面，构建不阻断）
 *   - 已登记 deprecated   → ⚠️ WARNING（允许存在）
 *   - 已登记 active       → ✅ OK
 *
 * 冻结规则（Sprint-ADMIN-IA-REALITY-01-B）：
 *   pages/admin/* 必须属于 platform / workspace / system / deprecated 之一。
 *
 * 用法：node scripts/route-ownership-check.mjs [--strict]
 *   --strict 模式下孤儿页面使进程退出码非 0（CI 用）
 */
import { readdirSync, statSync } from 'fs'
import { join, relative, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PAGES_ADMIN = join(ROOT, 'pages', 'admin')
const REGISTRY_FILE = join(ROOT, 'config', 'admin-route-registry.ts')

const strict = process.argv.includes('--strict')

// 动态 import TS 配置在纯 node 下不可行，这里用轻量解析：读取已登记路由清单（正则提取 route 字段）
function loadRegisteredRoutes() {
  const fs = awaitImport('fs')
  const content = fs.readFileSync(REGISTRY_FILE, 'utf-8')
  const routes = new Set()
  const re = /route:\s*'([^']+)'/g
  let m
  while ((m = re.exec(content)) !== null) routes.add(m[1])
  // 处理动态段：/admin/xxx/[id] 视为 /admin/xxx 已登记
  return routes
}

function awaitImport(name) {
  // 简单兼容：用同步 require 风格
  const fs = require('fs')
  return fs
}

// 由于是 ESM，上面用 dynamic import 简化处理
import { readFileSync as _rfs } from 'fs'

function scanPages(dir, base) {
  const results = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...scanPages(full, base))
    } else if (name.endsWith('.vue')) {
      const rel = relative(base, full)
      // Nuxt 文件路由 → URL 路由
      let route = '/' + rel.replace(/\.vue$/, '').replace(/\\/g, '/')
      route = route.replace(/\/index$/, '')
      results.push(route)
    }
  }
  return results
}

// 读取注册表：按条目块分割，块内独立查找 route/owner/status
const content = _rfs(REGISTRY_FILE, 'utf-8')
const registered = new Map() // route → entry {status, owner}
// 每个条目以 `{ route: '` 开头（含缩进），先分割成块
const blocks = content.split(/\{\s*route:\s*'/)
for (let i = 1; i < blocks.length; i++) {
  const block = blocks[i]
  // route 是块开头直到下一个 ' 的内容
  const routeEnd = block.indexOf("'")
  if (routeEnd === -1) continue
  const route = block.slice(0, routeEnd)
  const owner = (block.match(/owner:\s*'([^']+)'/) || [])[1] || 'unknown'
  const status = (block.match(/status:\s*'([^']+)'/) || [])[1] || 'active'
  registered.set(route, { status, owner })
}

// 收集页面路由（[id] 动态段折叠为父路由）
const pageRoutes = scanPages(PAGES_ADMIN, join(ROOT, 'pages')).map(r => {
  // /admin/aigc/enterprises/[id] → /admin/aigc/enterprises
  const withoutId = r.replace(/\/\[[^\]]+\]$/, '')
  return withoutId
})

const uniqueRoutes = [...new Set(pageRoutes)]
uniqueRoutes.sort()

let orphans = []
let deprecated = []
let ok = 0

for (const route of uniqueRoutes) {
  const entry = registered.get(route)
  if (!entry) {
    orphans.push(route)
  } else if (entry.status === 'deprecated') {
    deprecated.push(route)
  } else {
    ok++
  }
}

console.log(`[route-ownership] 🔍 扫描 pages/admin → ${uniqueRoutes.length} 个页面路由`)
console.log(`[route-ownership] ✅ 已登记 active: ${ok}`)
console.log(`[route-ownership] 🗑 已登记 deprecated: ${deprecated.length}`)
for (const d of deprecated) console.log(`   ⚠️ deprecated: ${d}`)

if (orphans.length > 0) {
  console.log(`[route-ownership] ⚠️ 孤儿页面（未在 AdminRouteRegistry 登记）: ${orphans.length}`)
  for (const o of orphans) console.log(`   ❌ ${o}`)
  console.log('[route-ownership] → 请到 config/admin-route-registry.ts 登记归属，或标记 deprecated')
  if (strict) {
    console.log('[route-ownership] ❌ --strict 模式：孤儿页面阻断构建')
    process.exit(1)
  }
} else {
  console.log('[route-ownership] ✅ 无孤儿页面，全部路由已登记归属')
}

console.log('[route-ownership] ✅ 检查完成')
